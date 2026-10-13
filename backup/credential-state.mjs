import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
export function sealConfig(config, key, repository) {
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32) throw new Error('Invalid credential encryption key');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', decoded, iv);
  cipher.setAAD(Buffer.from(repository));
  const payload = Buffer.concat([cipher.update(config), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: payload.toString('base64') });
}
export function openConfig(encoded, key, repository) {
  const state = JSON.parse(encoded), decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32 || state.version !== 1) throw new Error('Invalid credential state');
  const cipher = createDecipheriv('aes-256-gcm', decoded, Buffer.from(state.iv, 'base64'));
  cipher.setAAD(Buffer.from(repository)); cipher.setAuthTag(Buffer.from(state.tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(state.data, 'base64')), cipher.final()]);
}
