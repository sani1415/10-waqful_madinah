/**
 * Caller verification for /api/* — the browser sends `auth: { role, waqf?, pin }`
 * plus its `x-waqf-device` header; we check it with the PIN-gated Supabase RPC
 * `madrasa_rel_verify_session` (same lockout rules as the app itself).
 */
const crypto = require('crypto');
const { ensureEnv } = require('./_env');

const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // sha256(role|waqf|pin) → expiry

function cacheKey(role, waqf, pin) {
  return crypto.createHash('sha256').update(`${role}|${waqf}|${pin}`).digest('hex');
}

/**
 * @param {object} opts.allow  roles allowed for this endpoint, e.g. ['teacher']
 * @returns {Promise<{ok:true, role:string} | {ok:false, status:number, error:string}>}
 */
async function verifyCaller(req, auth, opts) {
  ensureEnv();
  const allow = (opts && opts.allow) || ['teacher', 'student'];
  const role = auth && typeof auth.role === 'string' ? auth.role : '';
  const pin = auth && auth.pin != null ? String(auth.pin).trim() : '';
  const waqf = auth && auth.waqf != null ? String(auth.waqf).trim() : '';
  if (!allow.includes(role) || !/^\d{4,8}$/.test(pin) || (role === 'student' && !/^[\w-]{1,40}$/.test(waqf))) {
    return { ok: false, status: 401, error: 'অনুগ্রহ করে আবার লগইন করুন।' };
  }

  const key = cacheKey(role, waqf, pin);
  const now = Date.now();
  if ((cache.get(key) || 0) > now) return { ok: true, role };

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, status: 500, error: 'সার্ভার কনফিগার করা নেই।' };

  const device = String(req.headers['x-waqf-device'] || '').slice(0, 128);
  let response;
  try {
    response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/madrasa_rel_verify_session`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
        ...(device ? { 'x-waqf-device': device } : {}),
      },
      body: JSON.stringify({ p_role: role, p_waqf: role === 'student' ? waqf : null, p_pin: pin }),
    });
  } catch (error) {
    console.error('[auth] verify request failed', error?.message || error);
    return { ok: false, status: 502, error: 'লগইন যাচাই করা যায়নি।' };
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const msg = String(data?.message || '');
    if (msg.includes('pin_locked')) {
      return { ok: false, status: 429, error: 'অনেকবার ভুল পিন — কিছুক্ষণ পর আবার চেষ্টা করুন।' };
    }
    console.error('[auth] verify rpc error', response.status, msg);
    return { ok: false, status: 502, error: 'লগইন যাচাই করা যায়নি।' };
  }
  if (data !== true) return { ok: false, status: 401, error: 'অনুগ্রহ করে আবার লগইন করুন।' };

  if (cache.size > 500) cache.clear();
  cache.set(key, now + TTL_MS);
  return { ok: true, role };
}

module.exports = { verifyCaller };
