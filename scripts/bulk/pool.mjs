// Pre-filter candidates (exact geometry duplicates, recolours, numbered junk) and cut naming batches.
// Writes .tmp/bulk/pool.json and .tmp/bulk/naming/in-NNN.json for items without names yet.
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { path, readJson, writeJson } from './lib/common.mjs';
import { baseKey, designKey, COLOURS } from './lib/names.mjs';
import { PACKS } from './packs.mjs';
const BATCH = 70;
const cands = await readJson(path('candidates.json'));
const kenneyIdx = await readJson(path('cache/kenney/index.json'), []);
const titles = Object.fromEntries(kenneyIdx.map(k => [k.slug, k.title.replace(/&middot;.*$/, '').replace(/&amp;/g, '&').trim()]));
const priority = { quaternius: 0, 'quaternius-drive': 0, kaykit: 1, polyhaven: 1, kenney: 2 };
const junk = /^(roadtile_?\d+|tile_?\d+|template|.*_template|.*template_.*|.*-template|untitled.*|cube\.\d+|empty)$/i;
const hasColour = n => n.toLowerCase().split(/[^a-z]+/).some(t => COLOURS.has(t));
const sorted = [...cands].filter(c => !c.error && c.geomHash && c.tris >= 8 && !junk.test(c.name))
  .sort((a, b) => (priority[a.source] - priority[b.source]) || a.pack.localeCompare(b.pack) || (hasColour(a.name) - hasColour(b.name)) || a.name.localeCompare(b.name));
const seenHash = new Set(), seenDesign = new Set(), baseCount = new Map(), pool = [];
const drop = { duplicateGeometry: 0, recolour: 0, variantCap: 0 };
for (const c of sorted) {
  if (seenHash.has(c.geomHash)) { drop.duplicateGeometry++; continue; } seenHash.add(c.geomHash);
  const d = c.pack + '|' + designKey(c.name); if (seenDesign.has(d)) { drop.recolour++; continue; } seenDesign.add(d);
  const b = c.pack + '|' + baseKey(c.name); const n = baseCount.get(b) ?? 0; if (n >= 3) { drop.variantCap++; continue; } baseCount.set(b, n + 1);
  const meta = PACKS[c.pack] ?? [];
  let ph = null; if (c.source === 'polyhaven') { ph = await readJson(path('ex/polyhaven', c.pack, 'info.json'), null); if (!ph) continue; }
  pool.push({ ...c, ph: ph && { name: ph.name, categories: ph.categories, tags: ph.tags, authors: Object.keys(ph.authors ?? {}) }, packTitle: c.source === 'polyhaven' ? 'Poly Haven' : c.source === 'kenney' ? titles[c.pack] ?? c.pack : c.pack.replace(/^KayKit-|-1\.0$/g, '').replace(/-/g, ' '), packSubject: ph ? `realistic scanned/modelled props; Poly Haven categories: ${ph.categories.join(', ')}; tags: ${ph.tags.join(', ')}` : meta[2] ?? '', defaultCategory: ph ? 'props' : meta[0] ?? '', packTags: meta[1] ?? '' });
}
await writeJson(path('pool.json'), pool);
console.log('candidates', cands.length, 'pool', pool.length, drop);
const names = await readJson(path('names.json'), {});
const need = pool.filter(p => !names[p.id]);
await mkdir(path('naming'), { recursive: true });
for (const f of await readdir(path('naming'))) if (/^in-\d+\.json$/.test(f) && process.argv.includes('--reset')) await import('node:fs/promises').then(m => m.unlink(path('naming', f)));
let k = 0; const existing = new Set((await readdir(path('naming'))).filter(f => f.startsWith('in-')));
for (let i = 0; i < need.length; i += BATCH) {
  const file = `in-${String(Math.floor(i / BATCH)).padStart(3, '0')}.json`;
  const slice = need.slice(i, i + BATCH).map(p => ({ id: p.id, pack: p.packTitle, subject: p.packSubject, creator: p.ph ? p.ph.authors.join(', ') : p.source === 'kenney' ? 'Kenney' : p.source === 'kaykit' ? 'Kay Lousberg' : p.source === 'polyhaven' ? 'Poly Haven' : 'Quaternius', raw: p.ph?.name ?? p.name, categoryHint: p.defaultCategory, tris: p.tris, size: p.bbox.map(v => +v.toFixed(2)), animations: p.animations.length, rigged: p.skins > 0 }));
  await writeJson(path('naming', file), slice); k++;
}
console.log('naming batches written', k, 'items needing names', need.length);
