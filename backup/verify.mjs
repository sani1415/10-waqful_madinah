import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { command, digestFile, validateMarker, validateObjectPath, safeSegment, removeTempDirectory } from './lib.mjs';

export async function countCopyRows(file) {
  const counts = {}; let table = null;
  for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    if (table) { if (line === '\\.') table = null; else counts[table]++; }
    else {
      const match = /^COPY "?([a-zA-Z0-9_]+)"?\."?([a-zA-Z0-9_]+)"? .* FROM stdin;$/.exec(line);
      if (match) { table = `${match[1]}.${match[2]}`; if (Object.hasOwn(counts, table)) throw new Error('Duplicate COPY section'); counts[table] = 0; }
    }
  }
  if (table) throw new Error('Truncated COPY data');
  return counts;
}
export function verifyCounts(expected, actual) {
  for (const [table, count] of Object.entries(expected)) {
    if (String(actual[table] ?? 0) !== String(count)) throw new Error(`Row count mismatch for ${table}`);
  }
  for (const table of Object.keys(actual)) if (!Object.hasOwn(expected, table)) throw new Error('Unexpected table in archive');
}
export async function verifyBackup(localProjectRoot, folder, identity, output) {
  const marker = JSON.parse(await readFile(join(localProjectRoot, folder, 'complete.json'), 'utf8'));
  validateMarker(marker, folder, marker.projectId);
  const archive = join(localProjectRoot, folder, 'snapshot.tar.gz.age');
  const digest = await digestFile(archive);
  if (digest.sha256 !== marker.archiveHash || digest.bytes !== marker.archiveBytes) throw new Error('Archive checksum mismatch');
  const work = await mkdtemp(join(tmpdir(), 'backup-verify-'));
  const age = process.env.AGE_BIN || 'age', pgRestore = process.env.PG_RESTORE_BIN || 'pg_restore';
  try {
    const tar = join(work, 'snapshot.tar.gz');
    await command(age, ['-d', '-i', identity, '-o', tar, archive]);
    const names = (await command('tar', ['-tzf', tar], { capture: true })).trim().split(/\r?\n/).sort();
    if (JSON.stringify(names) !== JSON.stringify(['data.dump', 'manifest.json', 'schema.dump'])) throw new Error('Unexpected archive members');
    await mkdir(output, { recursive: false });
    await command('tar', ['-xzf', tar, '-C', output]);
    const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
    if (manifest.projectId !== marker.projectId || manifest.format !== 1) throw new Error('Manifest project mismatch');
    for (const name of ['schema.dump', 'data.dump']) {
      const actual = await digestFile(join(output, name));
      if (actual.sha256 !== manifest.dumps[name].sha256 || actual.bytes !== manifest.dumps[name].bytes) throw new Error('Database archive checksum mismatch');
      await command(pgRestore, ['--list', join(output, name)]);
    }
    const copy = join(work, 'data.sql');
    await command(pgRestore, ['--data-only', '--file', copy, join(output, 'data.dump')]);
    verifyCounts(manifest.rowCounts, await countCopyRows(copy));
    const refs = new Map(marker.objects.map(o => [o.name, o]));
    for (const file of manifest.files) {
      safeSegment(file.bucket_id);
      validateObjectPath(file.name);
      const ref = refs.get(file.object); if (!ref) throw new Error('Missing object reference');
      const encrypted = join(localProjectRoot, '_objects', ref.name);
      const cipher = await digestFile(encrypted);
      if (cipher.sha256 !== ref.sha256 || cipher.bytes !== ref.bytes) throw new Error('Storage ciphertext checksum mismatch');
      const target = resolve(output, 'files', file.bucket_id, file.name);
      const base = resolve(output, 'files') + (process.platform === 'win32' ? '\\' : '/');
      if (!target.startsWith(base)) throw new Error('Unsafe extraction path');
      await mkdir(resolve(target, '..'), { recursive: true });
      await command(age, ['-d', '-i', identity, '-o', target, encrypted]);
      const plain = await digestFile(target);
      if (plain.sha256 !== file.sha256 || plain.bytes !== Number(file.metadata.size)) throw new Error('Storage plaintext checksum mismatch');
    }
    await writeFile(join(output, 'VERIFIED.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), project: marker.projectId, tables: Object.keys(manifest.rowCounts).length, files: manifest.files.length }, null, 2));
    console.log('Decryption, checksums, database row counts and Storage files verified. Production was not changed.');
  } finally { await removeTempDirectory(work, 'backup-verify-'); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, folder, identity, output] = process.argv.slice(2);
  if (!root || !folder || !identity || !output) { console.error('Usage: node verify.mjs PROJECT_FOLDER BACKUP_FOLDER RECOVERY_KEY NEW_OUTPUT_FOLDER'); process.exitCode = 1; }
  else await verifyBackup(root, folder, identity, output).catch(() => { console.error('Backup verification failed; output may be partial. No production restore was attempted.'); process.exitCode = 1; });
}
