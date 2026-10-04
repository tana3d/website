import { fromRow, type AssetRow, type Bindings } from './types';

export async function listAssets(env: Bindings, params = new URLSearchParams(), admin = false) {
  const where = [admin ? '1=1' : 'published=1'];
  const values: (string | number)[] = [];
  const q = (params.get('q') ?? '').trim().slice(0,120);
  if (q) { where.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM json_each(assets.tags) WHERE value LIKE ? ESCAPE '\\'))"); const term='%'+q.replace(/[\\%_]/g,'\\$&')+'%'; values.push(term,term,term); }
  if (params.get('category')) { where.push('category=?'); values.push(params.get('category')!); }
  if (params.get('tag')) { where.push('EXISTS(SELECT 1 FROM json_each(assets.tags) WHERE value=?)'); values.push(params.get('tag')!); }
  const limit = Math.floor(Math.min(60,Math.max(1,Number(params.get('limit')) || 60)));
  const page = Math.max(1,Math.min(100000,Math.floor(Number(params.get('page')) || 1)));
  const filter = where.join(' AND ');
  const [rows,count] = await Promise.all([
    env.DB.prepare(`SELECT * FROM assets WHERE ${filter} ORDER BY created_at DESC, id LIMIT ? OFFSET ?`).bind(...values,limit,(page-1)*limit).all<AssetRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM assets WHERE ${filter}`).bind(...values).first<{count:number}>(),
  ]);
  return { assets: rows.results.map(fromRow), total: count?.count ?? 0, page, pages: Math.ceil((count?.count ?? 0)/limit) };
}
export async function assetBySlug(env: Bindings, slug: string, admin = false) {
  const row = await env.DB.prepare(`SELECT * FROM assets WHERE slug=? ${admin ? '' : 'AND published=1'}`).bind(slug).first<AssetRow>();
  return row ? fromRow(row) : null;
}
