// Selection: apply the variation policy (concept caps) to named pool items and write .tmp/bulk/plan.json.
// Policy: skip non-assets; per-concept cap (objects 8, modular pieces 12) with at most 4 per pack per concept,
// round-robin across packs so several art styles survive; unique titles and slugs; existing D1 slugs reserved.
// Usage: node scripts/bulk/plan.mjs [--cap-object N] [--cap-modular N] [--per-pack N]
import { createHash } from 'node:crypto';
import { path, readJson, writeJson, cloudflare } from './lib/common.mjs';
import { SOURCES } from './sources.mjs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? Number(process.argv[i + 1]) : d; };
const CAP_OBJ = arg('cap-object', 8), CAP_MOD = arg('cap-modular', 12), PER_PACK = arg('per-pack', 4);
const pool = await readJson(path('pool.json')), names = await readJson(path('names.json'));
const kenneyIdx = Object.fromEntries((await readJson(path('cache/kenney/index.json'), [])).map(k => [k.slug, k]));
const qItch = Object.fromEntries((await readJson(path('cache/quaternius/index.json'), [])).map(k => [k.page, k]));
const qDrive = Object.fromEntries((await readJson(path('cache/quaternius-drive/index.json'), [])).map(k => [k.page, k]));
const kayIdx = Object.fromEntries((await readJson(path('cache/kaykit/index.json'), [])).map(k => [k.repo, k]));
const cf = await cloudflare();
const existing = await cf.query('SELECT slug, source_url FROM assets'); const reserved = new Set(existing.map(r => r.slug)); const existingSources = new Set(existing.map(r => r.source_url));
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '');
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
// Items already published are pinned (same slug/title/metadata) and count toward the caps.
const ledger = await readJson(path('published.json'), {});
const pinned = Object.values(ledger).filter(l => l.item).map(l => l.item); const pinnedIds = new Set(pinned.map(p => p.id));
const EXCLUDE_PACKS = new Set(['modularcharacteroutfitsfantasy']); // outfit fragments (body/legs/hat pieces), not standalone assets
const named = pool.filter(p => !pinnedIds.has(p.id) && !EXCLUDE_PACKS.has(p.pack) && !/decal/i.test(names[p.id]?.concept ?? '') && !/decal/i.test(p.name)).filter(p => names[p.id] && !names[p.id].skip && !(p.source === 'polyhaven' && existingSources.has(`https://polyhaven.com/a/${p.pack}`)));
// Group by concept, interleave packs, apply caps.
const byConcept = new Map();
for (const p of named) { const k = names[p.id].concept; (byConcept.get(k) ?? byConcept.set(k, []).get(k)).push(p); }
const selected = []; const dropped = { cap: 0 };
const pinnedCount = new Map(); for (const p of pinned) pinnedCount.set(p.concept, (pinnedCount.get(p.concept) ?? 0) + 1);
for (const [concept, items] of byConcept) {
  const modular = items.filter(p => names[p.id].modular).length > items.length / 2; const cap = Math.max(0, (modular ? CAP_MOD : CAP_OBJ) - (pinnedCount.get(concept) ?? 0));
  const packs = new Map(); for (const p of items.sort((a, b) => a.id.localeCompare(b.id))) { const l = packs.get(p.pack) ?? packs.set(p.pack, []).get(p.pack); if (l.length < PER_PACK) l.push(p); else dropped.cap++; }
  const lists = [...packs.values()]; let n = 0;
  for (let round = 0; n < cap && lists.some(l => l.length > round); round++) for (const l of lists) if (l[round] && n < cap) { selected.push(l[round]); n++; } 
  dropped.cap += lists.reduce((a, l) => a + l.length, 0) - n;
}
// Deterministic interleave (hash order, stable as the pool grows) so the newest rows on the site mix categories and packs.
const order = id => createHash('sha1').update(id).digest('hex');
selected.sort((a, b) => order(a.id).localeCompare(order(b.id)));
const titles = new Set(pinned.map(p => p.name.toLowerCase())), plan = [...pinned]; for (const p of pinned) reserved.add(p.slug);
for (const p of selected) {
  const n = names[p.id]; let title = n.title; const pt = p.packTitle;
  if (titles.has(title.toLowerCase())) title = `${title} (${pt})`; for (let k = 2; titles.has(title.toLowerCase()); k++) title = `${n.title} (${pt} ${k})`;
  titles.add(title.toLowerCase());
  let slug = slugify(title) || slugify(p.name); for (let k = 2; reserved.has(slug); k++) slug = `${slugify(title).slice(0, 66)}-${k}`; reserved.add(slug);
  let creator, source_url, attribution;
  if (p.source === 'kenney') { creator = 'Kenney'; source_url = kenneyIdx[p.pack]?.page ?? `https://kenney.nl/assets/${p.pack}`; }
  else if (p.source === 'kaykit') { creator = 'Kay Lousberg'; source_url = kayIdx[p.pack]?.url ?? `https://github.com/KayKit-Game-Assets/${p.pack}`; }
  else if (p.source === 'quaternius') { creator = 'Quaternius'; source_url = qItch[p.pack]?.itch ?? 'https://quaternius.com/'; }
  else if (p.source === 'quaternius-drive') { creator = 'Quaternius'; source_url = qDrive[p.pack]?.page_url ?? 'https://quaternius.com/'; }
  else { creator = p.ph.authors.join(', '); source_url = `https://polyhaven.com/a/${p.pack}`; }
  const pretty = p.source === 'polyhaven' ? 'Poly Haven' : pt;
  attribution = `${title}: model by ${creator}${p.source === 'polyhaven' ? ' / Poly Haven' : ''}, from ${pretty}. Released under CC0 1.0. Converted to a self-contained GLB and previewed by Tana.`;
  const tags = [...new Set([...n.tags, ...(PACK_TAGS(p))])].slice(0, 16);
  const [bx, by, bz] = p.bbox; const tile_size = by > 1.6 * Math.max(bx, bz) ? 'vert' : 'small';
  plan.push({ id: p.id, source: p.source, pack: p.pack, file: p.file, slug, name: title, description: n.description, category: n.category, tags, creator, source_url, license: 'CC0', license_url: CC0, attribution, tile_size, concept: n.concept, modular: n.modular });
}
function PACK_TAGS(p) { return (p.packTags || '').split(',').filter(Boolean).slice(0, 2); }
await writeJson(path('plan.json'), plan);
const count = k => plan.reduce((m, p) => (m[p[k]] = (m[p[k]] ?? 0) + 1, m), {});
console.log('pinned', pinned.length, 'named', named.length, 'concepts', byConcept.size, 'selected', plan.length, 'dropped by caps', dropped.cap);
console.log('by category', count('category')); console.log('by source', count('source'));
