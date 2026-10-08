/**
 * Shared env loader for /api/* (the `_` prefix keeps Vercel from routing it).
 * `vercel dev` sometimes misses .env.local until restart — load missing keys.
 */
const fs = require('fs');
const path = require('path');

let loaded = false;

function ensureEnv() {
  if (loaded) return;
  loaded = true;
  for (const name of ['.env.local', '.env']) {
    try {
      const envPath = path.join(process.cwd(), name);
      if (!fs.existsSync(envPath)) continue;
      for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (!match || line.trim().startsWith('#')) continue;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (process.env[match[1]] === undefined && value) process.env[match[1]] = value;
      }
    } catch (_) {}
  }
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = { ensureEnv, json, readBody };
