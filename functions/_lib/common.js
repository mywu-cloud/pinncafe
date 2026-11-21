// 共用：JSON 回應、資料轉換、Cloudflare Access 驗證

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const SETTING_KEYS = ['showScones', 'showStore', 'showEmail', 'lineId', 'facebookUrl'];

/** 資料庫一列 → 前台／後台用的物件 */
export function rowToBean(r) {
  let notes = [];
  try { notes = JSON.parse(r.notes || '[]'); } catch { notes = []; }
  return {
    id: r.id,
    sort: r.sort,
    name: r.name,
    region: r.region,
    regionEn: r.region_en,
    description: r.description,
    notes: Array.isArray(notes) ? notes : [],
    process: r.process,
    altitude: r.altitude,
    roast: r.roast,
    weight: r.weight,
    price: r.price,
    color: r.color,
    show: !!r.show,
    soldOut: !!r.sold_out,
    image: r.image_ver ? `/api/img/${r.id}?v=${r.image_ver}` : null,
    updatedAt: r.updated_at,
  };
}

export async function readSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const { key, value } of results) {
    try { out[key] = JSON.parse(value); } catch { /* 略過壞資料 */ }
  }
  return out;
}

// ---------- Cloudflare Access ----------
// 後台路徑 /admin、/api/admin 在 Cloudflare 邊緣已由 Access 擋住；
// 這裡再驗一次 JWT（RS256），防止繞過。沒有設定 CF_ACCESS_* 時一律拒絕（公開網站，不留開發模式後門），
// 本機開發可在 .dev.vars 設 DEV_NO_AUTH="1"。

let jwksCache = { url: null, keys: null, at: 0 };

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKeys(teamDomain) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  if (jwksCache.url === url && jwksCache.keys && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(503, '無法取得 Cloudflare Access 公鑰');
  const { keys } = await res.json();
  jwksCache = { url, keys, at: Date.now() };
  return keys;
}

export async function authenticate(request, env) {
  if (env.DEV_NO_AUTH === '1') return 'dev@local';
  if (!env.CF_ACCESS_AUD || !env.CF_ACCESS_TEAM_DOMAIN) throw new HttpError(503, '後台登入尚未設定');

  const token =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    (request.headers.get('Cookie') || '').match(/CF_Authorization=([^;]+)/)?.[1];
  if (!token) throw new HttpError(401, '未登入');

  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, '登入憑證格式錯誤');
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch { throw new HttpError(401, '登入憑證格式錯誤'); }

  const keys = await getKeys(env.CF_ACCESS_TEAM_DOMAIN);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, '登入憑證金鑰不符');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new HttpError(401, '登入憑證驗證失敗');

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new HttpError(401, '登入已過期，請重新整理頁面');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.CF_ACCESS_AUD)) throw new HttpError(401, '登入憑證不屬於本網站');
  if (payload.iss !== `https://${env.CF_ACCESS_TEAM_DOMAIN}`) throw new HttpError(401, '登入憑證發行者不符');
  return payload.email || payload.sub || 'unknown';
}
