import { readFile, writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { assertConfig, selected, quoteIdent, slotFor, due, hash, safeSegment, validateMarker, retentionPlan,
  digestFile, command, validateObjectPath, removeTempDirectory, BACKUP_NAME, OBJECT_NAME } from './lib.mjs';
import { countCopyRows, verifyCounts } from './verify.mjs';
import { connectionOptions, databaseCaPath } from './database-connect.mjs';

const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8'));
assertConfig(config);
const force = process.argv.includes('--force');
const configFile = process.env.RCLONE_CONFIG;
const recipient = process.env.BACKUP_AGE_RECIPIENT;
const age = process.env.AGE_BIN || 'age', rclone = process.env.RCLONE_BIN || 'rclone';
const pgDump = process.env.PG_DUMP_BIN || 'pg_dump', pgRestore = process.env.PG_RESTORE_BIN || 'pg_restore';
const temp = await mkdtemp(join(tmpdir(), 'waqf-backup-'));
let db;
function required(name) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
async function remote(args, capture = false) { return command(rclone, ['--config', configFile, '--log-level', 'ERROR', ...args], { capture }); }
async function folders(path) { return JSON.parse(await remote(['lsjson', path, '--dirs-only', '--max-depth', '1'], true)); }
async function markers(root, project) {
  const out = [];
  for (const entry of await folders(root)) {
    if (!BACKUP_NAME.test(entry.Name)) continue;
    const names = JSON.parse(await remote(['lsjson', `${root}/${entry.Name}`, '--files-only', '--max-depth', '1'], true));
    if (!names.some(n => n.Name === 'complete.json')) continue; // unfinished upload is never counted or pruned
    const marker = JSON.parse(await remote(['cat', `${root}/${entry.Name}/complete.json`], true));
    out.push(validateMarker(marker, entry.Name, project.id));
  }
  return out.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}
async function verifyRemote(remoteFile, expected) {
  const local = join(temp, 'remote-verification');
  try {
    await remote(['copyto', remoteFile, local]);
    const digest = await digestFile(local);
    if (digest.sha256 !== expected.sha256 || digest.bytes !== expected.bytes) throw new Error('Remote checksum verification failed');
  } finally { await rm(local, { force: true }); }
}
async function publish(local, destination) {
  const digest = await digestFile(local);
  await remote(['copyto', local, destination, '--immutable']);
  await verifyRemote(destination, digest);
  return digest;
}
async function downloadObject(row, output, serviceKey) {
  validateObjectPath(row.name);
  const path = [row.bucket_id, ...row.name.split('/')].map(encodeURIComponent).join('/');
  const url = `https://${config.projectRef}.supabase.co/storage/v1/object/${path}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(180000) });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Storage download HTTP ${response.status}`); }
      await pipeline(Readable.fromWeb(response.body), createWriteStream(output, { mode: 0o600 }));
      if ((await stat(output)).size !== Number(row.metadata?.size)) throw new Error('Storage size mismatch');
      return;
    } catch (error) {
      await rm(output, { force: true });
      if (attempt === 3) throw error;
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}
function connectionEnv(url) {
  const u = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || u.hostname !== `db.${config.projectRef}.supabase.co`
    && !(u.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(u.username).endsWith(`.${config.projectRef}`))) throw new Error('Database connection does not match configured Supabase project');
  return { ...process.env, PGHOST: u.hostname, PGPORT: u.port || '5432', PGDATABASE: u.pathname.slice(1) || 'postgres',
    PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: fileURLToPath(databaseCaPath), PGCONNECT_TIMEOUT: '30' };
}
function pgConfig(databaseUrl) {
  return connectionOptions(databaseUrl);
}
async function snapshotProject(project, root, previous, databaseUrl, serviceKey) {
  const startedAt = new Date().toISOString();
  const folder = `backup-${startedAt.replaceAll(/[-:.]/g, '')}-${randomBytes(4).toString('hex')}`;
  const stage = join(temp, project.id); await mkdir(stage);
  const snapshot = (await db.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  const tableRows = (await db.query("SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','S') ORDER BY 1,2")).rows.filter(t => selected(project, t.schema, t.name));
  if (!tableRows.some(t => t.kind !== 'S')) throw new Error('Empty database scope');
  const counts = {};
  for (const table of tableRows.filter(t => t.kind !== 'S')) {
    counts[`${table.schema}.${table.name}`] = (await db.query(`SELECT count(*)::text AS count FROM ONLY ${quoteIdent(table.schema)}.${quoteIdent(table.name)}`)).rows[0].count;
  }
  const fks = (await db.query("SELECT n.nspname AS schema, c.relname AS name, rn.nspname AS referenced_schema, rc.relname AS referenced_name FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class rc ON rc.oid=f.confrelid JOIN pg_namespace rn ON rn.oid=rc.relnamespace WHERE f.contype='f' AND n.nspname IN ('public','private')")).rows;
  if (fks.some(f => selected(project, f.schema, f.name) && !selected(project, f.referenced_schema, f.referenced_name))) throw new Error('Cross-project foreign key detected: update backup scope before continuing');
  const env = connectionEnv(databaseUrl);
  const common = ['--format=custom', '--no-owner', `--snapshot=${snapshot}`];
  await command(pgDump, [...common, '--schema-only', ...config.schemaContext.map(s => `--schema=${s}`), '--file', join(stage, 'schema.dump')], { env });
  await command(pgDump, [...common, '--data-only', ...tableRows.map(t => `--table=${quoteIdent(t.schema)}.${quoteIdent(t.name)}`), '--file', join(stage, 'data.dump')], { env });
  for (const name of ['schema.dump', 'data.dump']) {
    if ((await stat(join(stage, name))).size < 20) throw new Error('Empty database archive');
    await command(pgRestore, ['--list', join(stage, name)]);
  }
  const decodedData = join(temp, `${project.id}-rows.sql`);
  try {
    await command(pgRestore, ['--data-only', '--file', decodedData, join(stage, 'data.dump')]);
    verifyCounts(counts, await countCopyRows(decodedData));
  } finally { await rm(decodedData, { force: true }); }
  const buckets = (await db.query('SELECT * FROM storage.buckets WHERE id = ANY($1::text[]) ORDER BY id', [project.buckets])).rows;
  // Keep policy/extension/publication definitions as recovery context without dumping managed tables or their data.
  const storagePolicies = (await db.query("SELECT policyname,roles,cmd,permissive,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname")).rows;
  const extensions = (await db.query('SELECT e.extname,e.extversion,n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY e.extname')).rows;
  const publications = (await db.query("SELECT pubname,schemaname,tablename FROM pg_publication_tables WHERE schemaname IN ('public','private') ORDER BY 1,2,3")).rows.filter(t => selected(project, t.schemaname, t.tablename));
  const objects = (await db.query('SELECT id, bucket_id, name, version, updated_at, metadata FROM storage.objects WHERE bucket_id = ANY($1::text[]) ORDER BY bucket_id,name', [project.buckets])).rows;
  const cached = new Map(previous.flatMap(m => m.objects.map(o => [o.name, o])));
  const references = [], files = [];
  for (const row of objects) {
    validateObjectPath(row.name);
    const bytes = Number(row.metadata?.size);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Missing Storage size metadata');
    const name = `${hash(JSON.stringify([config.projectRef, row.bucket_id, row.name, row.version, row.updated_at, bytes, row.metadata?.eTag, recipient]))}.age`;
    let reference = cached.get(name);
    if (reference) {
      // Verify cached ciphertext before making a new snapshot depend on it.
      await verifyRemote(`${root}/_objects/${name}`, reference);
    } else {
      const plain = join(temp, 'object-plain'), encrypted = join(temp, 'object.age');
      try {
        await downloadObject(row, plain, serviceKey);
        await command(age, ['-r', recipient, '-o', encrypted, plain]);
        reference = { name, plainSha256: (await digestFile(plain)).sha256, ...await publish(encrypted, `${root}/_objects/${name}`) };
      } finally { await rm(plain, { force: true }); await rm(encrypted, { force: true }); }
    }
    references.push(reference);
    files.push({ ...row, object: name, sha256: reference.plainSha256 });
  }
  // A database snapshot cannot freeze Storage bytes. Check their versions again on a fresh connection.
  const check = new pg.Client(pgConfig(databaseUrl));
  try {
    await check.connect();
    const current = (await check.query('SELECT id,bucket_id,name,version,updated_at,metadata FROM storage.objects WHERE bucket_id = ANY($1::text[]) ORDER BY bucket_id,name', [project.buckets])).rows;
    if (JSON.stringify(current) !== JSON.stringify(objects)) throw new Error('Storage changed during backup: retain old backups and retry next run');
  } finally { await check.end(); }
  const dumps = {};
  for (const name of ['schema.dump', 'data.dump']) dumps[name] = await digestFile(join(stage, name));
  await writeFile(join(stage, 'manifest.json'), JSON.stringify({ format: 1, projectId: project.id, projectRef: config.projectRef, startedAt,
    snapshot, tables: tableRows, rowCounts: counts, schemaContext: config.schemaContext, buckets, storagePolicies, extensions, publications, files, dumps }, null, 2), { mode: 0o600 });
  const tar = join(temp, `${project.id}.tar.gz`), archive = join(temp, `${project.id}.tar.gz.age`);
  await command('tar', ['-czf', tar, '-C', stage, 'manifest.json', 'schema.dump', 'data.dump']);
  await command(age, ['-r', recipient, '-o', archive, tar]);
  const digest = await publish(archive, `${root}/${folder}/snapshot.tar.gz.age`);
  const marker = validateMarker({ format: 1, projectId: project.id, folder, slot: slotFor(startedAt, config), completedAt: new Date().toISOString(),
    archiveHash: digest.sha256, archiveBytes: digest.bytes, objects: references }, folder, project.id);
  const markerFile = join(temp, `${project.id}-complete.json`);
  await writeFile(markerFile, JSON.stringify(marker, null, 2));
  await publish(markerFile, `${root}/${folder}/complete.json`); // success is committed LAST
  return marker;
}
async function prune(root, project) {
  const { remove, referenced } = retentionPlan(await markers(root, project), config.keep);
  for (const marker of remove) {
    safeSegment(marker.folder);
    // Only this project's validated completed snapshots, never root or unfinished folders.
    await remote(['purge', `${root}/${marker.folder}`]);
  }
  const objects = JSON.parse(await remote(['lsjson', `${root}/_objects`, '--files-only', '--max-depth', '1'], true));
  for (const object of objects) if (OBJECT_NAME.test(object.Name) && !referenced.has(object.Name)) {
    await remote(['deletefile', `${root}/_objects/${object.Name}`]);
  }
}
async function main() {
  required('RCLONE_CONFIG'); required('BACKUP_AGE_RECIPIENT');
  if (!/^age1[0-9a-z]+$/.test(recipient)) throw new Error('Invalid age recipient');
  const pending = [];
  for (const project of config.projects) {
    const root = `${config.remoteRoot}/${project.folder}`;
    await remote(['mkdir', root]); await remote(['mkdir', `${root}/_objects`]);
    const previous = await markers(root, project);
    if (force || due(previous[0], new Date(), config)) pending.push({ project, root, previous });
    else {
      // Retry interrupted retention without creating another backup.
      await prune(root, project);
      console.log(`${project.folder}: not due; last verified snapshot is less than three schedule days old.`);
    }
  }
  if (!pending.length) return;
  const databaseUrl = required('BACKUP_DATABASE_URL'), serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  connectionEnv(databaseUrl);
  db = new pg.Client(pgConfig(databaseUrl));
  await db.connect();
  let failures = 0;
  for (const { project, root, previous } of pending) {
    try {
      // Separate consistent, read-only transaction per project; a failed project cannot poison the next one.
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await db.query("SET LOCAL statement_timeout = '120s'");
      const marker = await snapshotProject(project, root, previous, databaseUrl, serviceKey);
      await prune(root, project);
      console.log(`${project.folder}: encrypted snapshot verified; retained latest three successful snapshots.`);
      if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `- ${project.folder}: ${marker.folder} verified.\n`, { flag: 'a' });
    } catch (error) { failures++; console.error(`${project.folder}: ${error instanceof pg.DatabaseError ? 'Database read failed.' : error.message}`); }
    finally { await db.query('ROLLBACK'); }
  }
  if (failures) throw new Error(`${failures} project backup(s) failed. Previous successful snapshots remain available.`);
}
try { await main(); }
catch (error) {
  console.error(['28P01','28000'].includes(error.code) ? 'Database password/authorization rejected (AUTH_FAILED).'
    : error instanceof pg.DatabaseError ? `Database read failed (${error.code || 'UNKNOWN'}); check connection, grants and runtime.` : error.message);
  process.exitCode = 1;
}
finally { if (db) { await db.query('ROLLBACK').catch(() => {}); await db.end(); } await removeTempDirectory(temp, 'waqf-backup-'); }
