// GET /api/img/:id?v=版本 — 產品照片（網址含版本號，可長期快取）
export async function onRequestGet({ env, params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return new Response('Not found', { status: 404 });
  const row = await env.DB.prepare(
    'SELECT i.type, i.data FROM bean_images i JOIN beans b ON b.id = i.bean_id WHERE i.bean_id = ?',
  ).bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      'Content-Type': row.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
