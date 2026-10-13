import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
let outcome = 'DATABASE_CONNECTION_FAILED';
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '10s'");
  await client.query("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'waqf\\_%' OR tablename LIKE 'mdr\\_%')");
  await client.query('ROLLBACK');
  await command('gh', ['secret','set','BACKUP_DATABASE_URL','--repo',repository], { stdin: url.toString() });
  outcome = 'SUCCESS';
  console.log('Read-only database connection verified and GitHub Secret configured.');
} catch (error) {
  // Only fixed status codes go to the local prompt. Never expose raw driver errors,
  // connection URLs, passwords or command output.
  const status = ['28P01','28000'].includes(error.code) ? 'DATABASE_AUTH_FAILED'
    : ['ETIMEDOUT','ENOTFOUND','ECONNREFUSED','ECONNRESET'].includes(error.code) ? 'DATABASE_NETWORK_FAILED'
    : /CERT|TLS|SSL/.test(String(error.code || '')) ? 'DATABASE_TLS_FAILED' : 'DATABASE_CONNECTION_FAILED';
  outcome = status; console.log(status); process.exitCode = 1;
}
finally {
  await client.end();
  // A fixed status is safe for the agent to inspect without reading terminal input.
  await writeFile(join(homedir(), '.config', 'waqf-backup', 'database-status.json'), JSON.stringify({ outcome, checkedAt: new Date().toISOString() }), { mode: 0o600 });
}
