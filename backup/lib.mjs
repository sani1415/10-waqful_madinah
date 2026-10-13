import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

export const DAY = 86400000;
export const BACKUP_NAME = /^backup-\d{8}T\d{9}Z-[a-f0-9]{8}$/;
export const OBJECT_NAME = /^[a-f0-9]{64}\.age$/;
export function hash(value) { return createHash('sha256').update(value).digest('hex'); }
export function quoteIdent(s) { return '"' + s.replaceAll('"', '""') + '"'; }
export function selected(project, schema, name) {
  return (project.prefixes[schema] || []).some(p => name.startsWith(p));
}
export function safeSegment(s) {
  if (typeof s !== 'string' || !s || /[\\/:\x00-\x1f]/.test(s) || s === '.' || s === '..') throw new Error('Unsafe folder name');
  return s;
}
export function assertConfig(config) {
  if (config.intervalDays !== 3 || config.keep !== 3) throw new Error('Expected three days and three retained backups');
  if (!/^[a-z0-9]+$/.test(config.projectRef) || !/^onedrive:[^\r\n]+$/.test(config.remoteRoot)) throw new Error('Invalid destination/project');
  if (config.remoteRoot.split(/[/:]/).some(s => s === '..' || s === '.')) throw new Error('Unsafe root');
  const ids = new Set(), folders = new Set();
  for (const project of config.projects) {
    safeSegment(project.folder);
    if (ids.has(project.id) || folders.has(project.folder)) throw new Error('Duplicate project');
    ids.add(project.id); folders.add(project.folder);
    for (const prefixes of Object.values(project.prefixes)) {
      if (!prefixes.length || prefixes.some(p => !/^[a-z][a-z0-9]*_$/.test(p))) throw new Error('Unsafe table scope');
    }
    project.buckets.forEach(safeSegment);
  }
}
export function slotFor(now, config) {
  const date = new Date(now);
  let slot = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), config.slotHourUtc, config.slotMinuteUtc);
  if (slot > date.getTime()) slot -= DAY;
  return new Date(slot).toISOString();
}
export function due(last, now, config) {
  return !last || new Date(slotFor(now, config)).getTime() >= Date.parse(last.slot) + config.intervalDays * DAY;
}
export function validateMarker(marker, folder, projectId) {
  if (!BACKUP_NAME.test(folder) || marker.format !== 1 || marker.folder !== folder || marker.projectId !== projectId
    || !Number.isFinite(Date.parse(marker.slot)) || !Number.isFinite(Date.parse(marker.completedAt))
    || !/^[a-f0-9]{64}$/.test(marker.archiveHash) || !Array.isArray(marker.objects)
    || !Number.isSafeInteger(marker.archiveBytes) || marker.archiveBytes < 1) throw new Error('Invalid backup marker; retention stopped');
  const seen = new Set();
  for (const object of marker.objects) {
    if (!OBJECT_NAME.test(object.name) || !/^[a-f0-9]{64}$/.test(object.sha256) || !/^[a-f0-9]{64}$/.test(object.plainSha256)
      || !Number.isSafeInteger(object.bytes) || object.bytes < 1 || seen.has(object.name)) throw new Error('Invalid object reference');
    seen.add(object.name);
  }
  return marker;
}
export function retentionPlan(markers, keep = 3) {
  const sorted = [...markers].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const retain = sorted.slice(0, keep), remove = sorted.slice(keep);
  const referenced = new Set(retain.flatMap(m => m.objects.map(o => o.name)));
  return { retain, remove, referenced };
}
export async function digestFile(file) {
  const sha = createHash('sha256'); let bytes = 0;
  await pipeline(createReadStream(file), new Writable({ write(chunk, encoding, cb) { sha.update(chunk); bytes += chunk.length; cb(); } }));
  return { sha256: sha.digest('hex'), bytes };
}
// Never put credentials in a command line or print subprocess stderr (it may contain tokens).
export function command(binary, args, { env = process.env, capture = false, stdin } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env, windowsHide: true, stdio: ['pipe', capture ? 'pipe' : 'ignore', 'pipe'] });
    const chunks = []; let bytes = 0;
    child.stderr.resume();
    child.on('error', () => reject(new Error(`Cannot start ${binary.split(/[\\/]/).at(-1)}`)));
    if (capture) child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) child.kill(); else chunks.push(chunk); });
    child.on('close', code => code === 0 ? resolve(Buffer.concat(chunks).toString('utf8')) : reject(new Error(`${binary.split(/[\\/]/).at(-1)} failed (exit ${code})`)));
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
  });
}
export function validateObjectPath(name) {
  if (!name || name.includes('\\') || name.includes('\0') || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe Storage object path');
  return name;
}
export async function removeTempDirectory(directory, prefix) {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith(prefix) || basename(target).length <= prefix.length) {
    throw new Error('Refusing cleanup outside the verified task temporary directory');
  }
  await rm(target, { recursive: true, force: true });
}
