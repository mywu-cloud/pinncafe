// /api/admin/* — 後台 API（需 Cloudflare Access 登入）
//   GET    /api/admin/beans             全部豆子（含下架）
//   POST   /api/admin/beans             新增
//   PUT    /api/admin/beans/:id         修改（可只送部分欄位，例如 {soldOut:true}）
//   DELETE /api/admin/beans/:id         刪除
//   PUT    /api/admin/beans/:id/image   上傳照片（body = 圖片檔本身）
//   DELETE /api/admin/beans/:id/image   移除照片
//   PUT    /api/admin/order             排序 {ids:[3,1,2]}
//   GET    /api/admin/settings          網站設定
//   PUT    /api/admin/settings          修改網站設定
import { json, HttpError, rowToBean, readSettings, authenticate, SETTING_KEYS } from '../../_lib/common.js';

const MAX_IMAGE = 1.5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const TEXT_FIELDS = { name: 'name', region: 'region', regionEn: 'region_en', description: 'description',
  process: 'process', altitude: 'altitude', roast: 'roast', weight: 'weight', color: 'color' };

function str(v, max = 200) {
  if (v == null) return '';
  if (typeof v !== 'string' && typeof v !== 'number') throw new HttpError(400, '欄位格式錯誤');
  return String(v).trim().slice(0, max);
}

/** 把前端送來的欄位轉成資料庫欄位；只處理有送的欄位 */
function toColumns(body) {
  const cols = {};
  for (const [k, col] of Object.entries(TEXT_FIELDS)) {
    if (k in body) cols[col] = str(body[k], k === 'description' ? 2000 : 200);
  }
  if ('notes' in body) {
    const arr = Array.isArray(body.notes) ? body.notes : String(body.notes || '').split(/[,，、\n]/);
    cols.notes = JSON.stringify(arr.map((n) => str(n, 40)).filter(Boolean).slice(0, 12));
  }
  if ('price' in body) {
    if (body.price === null || body.price === '') cols.price = null;
    else {
      const p = Number(body.price);
      if (!Number.isInteger(p) || p < 0 || p > 1_000_000) throw new HttpError(400, '價格要是 0 以上的整數');
      cols.price = p;
    }
  }
  if ('show' in body) cols.show = body.show ? 1 : 0;
  if ('soldOut' in body) cols.sold_out = body.soldOut ? 1 : 0;
  if ('name' in cols && !cols.name) throw new HttpError(400, '產地（品名）不能空白');
  return cols;
}

async function getBean(db, id) {
  const row = await db.prepare('SELECT * FROM beans WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, '找不到這支豆子');
  return rowToBean(row);
}

async function handle(request, env, path) {
  const db = env.DB;
  const m = request.method;
  const seg = path.filter(Boolean);

  if (seg[0] === 'me' && m === 'GET') return json({ email: await authenticate(request, env) });

  if (seg[0] === 'beans' && seg.length === 1) {
    if (m === 'GET') {
      const { results } = await db.prepare('SELECT * FROM beans ORDER BY sort, id').all();
      return json({ beans: results.map(rowToBean) });
    }
    if (m === 'POST') {
      const body = await request.json();
      const cols = toColumns({ notes: [], ...body });
      if (!cols.name) throw new HttpError(400, '產地（品名）不能空白');
      const next = await db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM beans').first();
      cols.sort = next.n;
      const keys = Object.keys(cols);
      const res = await db.prepare(
        `INSERT INTO beans (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
      ).bind(...keys.map((k) => cols[k])).run();
      return json({ bean: await getBean(db, res.meta.last_row_id) }, 201);
    }
  }

  if (seg[0] === 'beans' && seg.length >= 2) {
    const id = Number(seg[1]);
    if (!Number.isInteger(id)) throw new HttpError(404, '找不到這支豆子');
    await getBean(db, id);

    if (seg.length === 2 && m === 'PUT') {
      const cols = toColumns(await request.json());
      const keys = Object.keys(cols);
      if (keys.length) {
        await db.prepare(
          `UPDATE beans SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
        ).bind(...keys.map((k) => cols[k]), id).run();
      }
      return json({ bean: await getBean(db, id) });
    }
    if (seg.length === 2 && m === 'DELETE') {
      await db.batch([
        db.prepare('DELETE FROM bean_images WHERE bean_id = ?').bind(id),
        db.prepare('DELETE FROM beans WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }
    if (seg[2] === 'image' && m === 'PUT') {
      const type = (request.headers.get('Content-Type') || '').split(';')[0].trim();
      if (!IMAGE_TYPES.includes(type)) throw new HttpError(400, '照片請用 JPG、PNG 或 WebP');
      const data = await request.arrayBuffer();
      if (!data.byteLength) throw new HttpError(400, '沒有收到照片');
      if (data.byteLength > MAX_IMAGE) throw new HttpError(413, '照片太大（上限 1.5 MB）');
      await db.batch([
        db.prepare('INSERT INTO bean_images (bean_id, type, data) VALUES (?, ?, ?) ON CONFLICT(bean_id) DO UPDATE SET type = excluded.type, data = excluded.data')
          .bind(id, type, data),
        db.prepare("UPDATE beans SET image_ver = image_ver + 1, updated_at = datetime('now') WHERE id = ?").bind(id),
      ]);
      return json({ bean: await getBean(db, id) });
    }
    if (seg[2] === 'image' && m === 'DELETE') {
      await db.batch([
        db.prepare('DELETE FROM bean_images WHERE bean_id = ?').bind(id),
        db.prepare("UPDATE beans SET image_ver = 0, updated_at = datetime('now') WHERE id = ?").bind(id),
      ]);
      return json({ bean: await getBean(db, id) });
    }
  }

  if (seg[0] === 'order' && m === 'PUT') {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || !ids.every(Number.isInteger)) throw new HttpError(400, '排序資料錯誤');
    await db.batch(ids.map((id, i) => db.prepare('UPDATE beans SET sort = ? WHERE id = ?').bind(i + 1, id)));
    return json({ ok: true });
  }

  if (seg[0] === 'settings') {
    if (m === 'GET') return json({ settings: await readSettings(db) });
    if (m === 'PUT') {
      const body = await request.json();
      const stmts = [];
      for (const k of SETTING_KEYS) {
        if (!(k in body)) continue;
        let v = body[k];
        if (k.startsWith('show')) v = !!v;
        else {
          v = str(v, 300);
          if (k === 'lineId' && !/^@?[\w.\-]{2,40}$/.test(v)) throw new HttpError(400, 'LINE ID 格式不對，例如 @pinncafe');
          if (k === 'facebookUrl' && !/^https:\/\/(www\.)?facebook\.com\//i.test(v)) throw new HttpError(400, 'Facebook 網址要以 https://www.facebook.com/ 開頭');
        }
        stmts.push(db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
          .bind(k, JSON.stringify(v)));
      }
      if (stmts.length) await db.batch(stmts);
      return json({ settings: await readSettings(db) });
    }
  }

  throw new HttpError(404, '找不到這個功能');
}

export async function onRequest({ request, env, params }) {
  try {
    await authenticate(request, env);
    const path = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
    return await handle(request, env, path);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    if (err instanceof SyntaxError) return json({ error: '資料格式錯誤' }, 400);
    console.error(err);
    return json({ error: '伺服器錯誤，請稍後再試' }, 500);
  }
}
