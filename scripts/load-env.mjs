/** Loads .env.local then .env into process.env (does not override existing vars). */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseLine(line) {
  const t = line.trim();
  if (!t || t.startsWith('#')) return null;
  const i = t.indexOf('=');
  if (i <= 0) return null;
  const key = t.slice(0, i).trim();
  let val = t.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  return { key, val };
}

function loadFile(name) {
  const p = join(root, name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed || process.env[parsed.key] !== undefined) continue;
    process.env[parsed.key] = parsed.val;
  }
}

export function loadProjectEnv() {
  loadFile('.env.local');
  loadFile('.env');
}

loadProjectEnv();
