// GET /api/beans — 前台公開：上架中的豆子（依順序）＋ 網站設定
import { json, rowToBean, readSettings } from '../_lib/common.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM beans WHERE show = 1 ORDER BY sort, id').all();
    const beans = results.map(rowToBean).map(({ show, sort, updatedAt, ...b }) => b);
    const settings = await readSettings(env.DB);
    return json({ beans, settings }, 200, { 'Cache-Control': 'public, max-age=15' });
  } catch (err) {
    console.error(err);
    return json({ error: '資料庫暫時無法讀取' }, 500);
  }
}
