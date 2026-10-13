import dns from 'node:dns';
import net from 'node:net';
import { readFileSync } from 'node:fs';

export const databaseCaPath = new URL('./supabase-ca.crt', import.meta.url);

export function lookupWithFallback(hostname, options, callback) {
  dns.lookup(hostname, options, async (error, address, family) => {
    if (!error) { callback(null, address, family); return; }
    if (!['EAI_AGAIN','ENOTFOUND','ESERVFAIL'].includes(error.code)) { callback(error); return; }
    try {
      const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('DNS lookup unavailable');
      const answers = (await response.json()).Answer || [];
      const addresses = answers.filter(a => a.type === 1 && net.isIP(a.data) === 4).map(a => ({ address: a.data, family: 4 }));
      if (!addresses.length) throw new Error('No IPv4 DNS answer');
      if (options?.all) callback(null, addresses);
      else callback(null, addresses[0].address, 4);
    } catch { callback(error); }
  });
}
export function connectionOptions(databaseUrl, resolvedAddresses = []) {
  const url = new URL(databaseUrl);
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
  const result = { connectionString: url.toString(), ssl: { rejectUnauthorized: true, ca: readFileSync(databaseCaPath, 'utf8') }, connectionTimeoutMillis: 30000 };
  // Cloud runners use pg's normal stream. The custom lookup is only needed for
  // the Windows setup's HTTPS-resolved addresses.
  if (resolvedAddresses.length) result.stream = () => {
      const socket = new net.Socket();
      socket.connect = function (port, host) {
        // Keep the hostname intact for TLS/SNI verification; only DNS lookup falls back.
        const addresses = resolvedAddresses.filter(ip => net.isIP(ip) === 4).map(address => ({ address, family: 4 }));
        const lookup = addresses.length ? (hostname, options, callback) => {
          if (options?.all) callback(null, addresses);
          else callback(null, addresses[0].address, 4);
        } : lookupWithFallback;
        return net.Socket.prototype.connect.call(this, { port, host, lookup });
      };
      return socket;
    };
  return result;
}
