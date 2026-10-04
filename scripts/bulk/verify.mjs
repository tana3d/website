// Verify published rows through the public site: row fields, model GLB header/size, preview bytes.
// Usage: node scripts/bulk/verify.mjs [--sample N | --all]
import { path, readJson, writeJson, cloudflare, pool, progress } from './lib/common.mjs';
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? Number(process.argv[i + 1]) : undefined; };
const cf = await cloudflare(); const base = 'https://tana.gg';
const enc = k => k.split('/').map(encodeURIComponent).join('/');
const rows = []; for (let off = 0; ; off += 500) { const r = await cf.query('SELECT * FROM assets WHERE published=1 ORDER BY created_at LIMIT 500 OFFSET ?', [off]); rows.push(...r); if (r.length < 500) break; }
let pick = rows;
if (!process.argv.includes('--all')) { const n = arg('sample') ?? 40; pick = rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / n)) === 0).slice(0, n); }
const bad = []; let ok = 0;
await pool(pick, 6, async r => {
  const problems = [];
  if (!r.name || !r.description || JSON.parse(r.tags).length < 3 && r.creator) problems.push('metadata thin');
  if (r.license !== 'CC0' && (!r.creator || !r.license_url || !r.attribution)) problems.push('licence credit incomplete');
  const m = await fetch(`${base}/media/${enc(r.model_key)}`);
  const buf = new Uint8Array(await m.arrayBuffer());
  if (m.status !== 200) problems.push('model http ' + m.status);
  else { if (new TextDecoder().decode(buf.slice(0, 4)) !== 'glTF') problems.push('not glb'); if (buf.byteLength !== r.model_bytes) problems.push(`size ${buf.byteLength} != ${r.model_bytes}`); }
  const p = await fetch(`${base}/media/${enc(r.preview_key)}`); const pb = await p.arrayBuffer();
  if (p.status !== 200 || pb.byteLength < 1000) problems.push('preview http ' + p.status);
  const one = await fetch(`${base}/api/assets/${r.id}`); if (one.status !== 200) problems.push('api/assets/[id] ' + one.status);
  problems.length ? bad.push({ slug: r.slug, problems }) : ok++;
});
const total = (await cf.query('SELECT COUNT(*) c FROM assets WHERE published=1'))[0].c;
console.log(`published rows ${total}; checked ${pick.length}; ok ${ok}; problems ${bad.length}`); bad.slice(0, 20).forEach(b => console.log(b.slug, b.problems.join(', ')));
await writeJson(path('verify.json'), { at: new Date().toISOString(), published_rows: total, checked: pick.length, ok, problems: bad });
