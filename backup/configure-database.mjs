import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { command } from './lib.mjs';
import pg from 'pg';
import { connectionOptions } from './database-connect.mjs';
let raw = ''; for await (const chunk of process.stdin) raw += chunk;
const { poolerUrl, password, repository, resolvedAddresses = [], verifyLocally = true } = JSON.parse(raw);
raw = '';
const url = new URL(poolerUrl);
const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8'));
if (!url.hostname.endsWith('.pooler.supabase.com') || decodeURIComponent(url.username) !== `postgres.${config.projectRef}` || url.port !== '5432') throw new Error('Cached pooler URL does not match this project');
url.password = password;
for (const key of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
const client = new pg.Client(connectionOptions(url.toString(), resolvedAddresses));
let outcome = 'DATABASE_CONNECTION_FAILED';
let phase = 'CONNECT', safeErrorCode = null;
try {
  if (!verifyLocally) {
    phase = 'SECRET_WRITE';
    await command('gh', ['secret','set','BACKUP_DATABASE_URL','--repo',repository], { stdin: url.toString() });
    outcome = 'SAVED_FOR_CLOUD_CHECK';
    console.log('Password saved securely. GitHub will verify the database connection; local network settings were not changed.');
  } else {
  await client.connect();
  phase = 'READ_ONLY_CHECK';
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '10s'");
  await client.query("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'waqf\\_%' OR tablename LIKE 'mdr\\_%')");
  await client.query('ROLLBACK');
  phase = 'SECRET_WRITE';
  await command('gh', ['secret','set','BACKUP_DATABASE_URL','--repo',repository], { stdin: url.toString() });
  outcome = 'SUCCESS';
  console.log('Read-only database connection verified and GitHub Secret configured.');
  }
} catch (error) {
  // Only fixed status codes go to the local prompt. Never expose raw driver errors,
  // connection URLs, passwords or command output.
  safeErrorCode = /^[A-Z0-9_]{1,64}$/.test(String(error.code || '')) ? error.code : 'NO_ERROR_CODE';
  const text = String(error.message || '');
  const status = phase === 'SECRET_WRITE' ? 'DATABASE_SECRET_WRITE_FAILED'
    : ['28P01','28000'].includes(error.code) || /password authentication failed|invalid password/i.test(text) ? 'DATABASE_AUTH_FAILED'
    : /circuit breaker|too many authentication/i.test(text) ? 'DATABASE_AUTH_COOLDOWN'
    : /tenant or user not found/i.test(text) ? 'DATABASE_POOLER_CONFIG_FAILED'
    : ['ETIMEDOUT','ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET'].includes(error.code) ? 'DATABASE_NETWORK_FAILED'
    : /connection timeout|connection timed out/i.test(text) ? 'DATABASE_NETWORK_FAILED'
    : /CERT|TLS|SSL/.test(String(error.code || '')) ? 'DATABASE_TLS_FAILED' : 'DATABASE_CONNECTION_FAILED';
  outcome = status;
  if (phase === 'CONNECT' && ['DATABASE_NETWORK_FAILED','DATABASE_TLS_FAILED','DATABASE_CONNECTION_FAILED'].includes(status)) {
    // Local networking is not authoritative about the password. Store the user's
    // masked input in GitHub Secrets, then verify through the cloud runner.
    try {
      await command('gh', ['secret','set','BACKUP_DATABASE_URL','--repo',repository], { stdin: url.toString() });
      outcome = 'SAVED_FOR_CLOUD_CHECK';
      console.log('Password saved securely for GitHub verification. Local network could not verify it; no database settings were changed.');
    } catch { outcome = 'DATABASE_SECRET_WRITE_FAILED'; console.log(outcome); process.exitCode = 1; }
  } else { console.log(status); process.exitCode = 1; }
}
finally {
  await client.end();
  // A fixed status is safe for the agent to inspect without reading terminal input.
  await writeFile(join(homedir(), '.config', 'waqf-backup', 'database-status.json'), JSON.stringify({ outcome, phase, safeErrorCode, checkedAt: new Date().toISOString() }), { mode: 0o600 });
}
