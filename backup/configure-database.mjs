import { readFile } from 'node:fs/promises';
import { command } from './lib.mjs';
import pg from 'pg';
let raw = ''; for await (const chunk of process.stdin) raw += chunk;
const { poolerUrl, password, repository } = JSON.parse(raw);
raw = '';
const url = new URL(poolerUrl);
const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8'));
if (!url.hostname.endsWith('.pooler.supabase.com') || decodeURIComponent(url.username) !== `postgres.${config.projectRef}` || url.port !== '5432') throw new Error('Cached pooler URL does not match this project');
url.password = password;
for (const key of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 30000 });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '10s'");
  await client.query("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'waqf\\_%' OR tablename LIKE 'mdr\\_%')");
  await client.query('ROLLBACK');
  await command('gh', ['secret','set','BACKUP_DATABASE_URL','--repo',repository], { stdin: url.toString() });
  console.log('Read-only database connection verified and GitHub Secret configured.');
} catch { console.error('Connection check failed. Verify the database password and network; no database settings were changed.'); process.exitCode = 1; }
finally { await client.end(); }
