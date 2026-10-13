import { readFile, writeFile } from 'node:fs/promises';
import { sealConfig } from './credential-state.mjs';

// rclone refreshes Microsoft OAuth tokens in its private config. Persist that rotation,
// State is AES-GCM encrypted; the normal workflow token can save the ciphertext
// artifact. No personal GitHub token or repository Secrets-write access is needed.
if (process.env.BACKUP_TOKEN_ENCRYPTION_KEY && process.env.RCLONE_CONFIG && process.env.GITHUB_REPOSITORY && process.env.CREDENTIAL_STATE_FILE) {
  const config = await readFile(process.env.RCLONE_CONFIG);
  await writeFile(process.env.CREDENTIAL_STATE_FILE, sealConfig(config, process.env.BACKUP_TOKEN_ENCRYPTION_KEY, process.env.GITHUB_REPOSITORY), { mode: 0o600 });
  console.log('Refreshed OneDrive credential state encrypted securely.');
} else { throw new Error('Missing credentials needed to persist OneDrive token rotation'); }
