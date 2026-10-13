import { writeFile, readFile, rm } from 'node:fs/promises';
import { command } from './lib.mjs';
import { openConfig } from './credential-state.mjs';
const repo = process.env.GITHUB_REPOSITORY, token = process.env.GH_TOKEN;
if (!repo || !token || !process.env.BACKUP_TOKEN_ENCRYPTION_KEY || !process.env.RCLONE_CONFIG) throw new Error('Missing credential-state configuration');
async function api(path, binary = false) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error(`Credential-state API failed (${response.status})`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
}
const { artifacts } = await api('actions/artifacts?name=backup-onedrive-credentials&per_page=100');
let loaded = false;
for (const artifact of artifacts.filter(a => !a.expired).sort((a,b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
  const run = await api(`actions/runs/${artifact.workflow_run.id}`);
  if (run.path !== '.github/workflows/database-backup.yml' || run.head_branch !== 'main' || !['schedule','workflow_dispatch'].includes(run.event)) continue;
  if (artifact.size_in_bytes > 1024 * 1024) throw new Error('Unexpected encrypted credential state size');
  const zip = `${process.env.RCLONE_CONFIG}.state.zip`;
  try {
    await writeFile(zip, await api(`actions/artifacts/${artifact.id}/zip`, true), { mode: 0o600 });
    const encrypted = await command('unzip', ['-p', zip, 'onedrive-state.enc.json'], { capture: true });
    const config = openConfig(encrypted, process.env.BACKUP_TOKEN_ENCRYPTION_KEY, repo);
    await writeFile(process.env.RCLONE_CONFIG, config, { mode: 0o600 });
    loaded = true;
  } finally { await rm(zip, { force: true }); }
  break;
}
console.log(loaded ? 'Latest authenticated OneDrive credential state loaded.' : 'First run: using initial OneDrive authorization.');
