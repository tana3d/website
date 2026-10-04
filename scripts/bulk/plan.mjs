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
const existing = await cf.query('SELECT slug, source_url, name FROM assets'); const reserved = new Set(existing.map(r => r.slug)); const existingSources = new Set(existing.map(r => r.source_url));
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '');
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const ANIM_WORDS = ['idle', 'walk', 'run', 'jog', 'sprint', 'jump', 'attack', 'dance', 'death', 'hit', 'punch', 'sword', 'shoot', 'crouch', 'swim', 'roll', 'wave', 'sit', 'cheer', 'dodge', 'block', 'throw'];
const LICENSES = {
  cc0: { license: 'CC0', url: CC0, text: (t, c, pack) => `${t}: model by ${c}, from ${pack}. Released under CC0 1.0. Converted to a self-contained GLB and previewed by Tana.` },
  gso: { license: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', text: (t, c, pack) => `${t}: 3D scan by ${c}, from the Google Scanned Objects dataset (Downs et al., 2022, "Google Scanned Objects: A High-Quality Dataset of 3D Scanned Household Items", ICRA), distributed on Gazebo Fuel under CC BY 4.0. Changes: converted to a self-contained GLB, textures resized, preview rendered by Tana.` },
  nasa: { license: 'CUSTOM', url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/', text: (t, c) => `${t}: model from NASA 3D Resources (${c}). NASA describes these assets as free and without copyright; see NASA media usage guidelines (no endorsement implied, NASA insignia restricted). Converted and previewed by Tana.` },
};
// Items already published are pinned (same slug/title/metadata) and count toward the caps.
const ledger = await readJson(path('published.json'), {});
const pinned = Object.values(ledger).filter(l => l.item).map(l => l.item); const pinnedIds = new Set(pinned.map(p => p.id));
const EXCLUDE_PACKS = new Set(['modularcharacteroutfitsfantasy']); // outfit fragments (body/legs/hat pieces), not standalone assets
const usable = p => (p.clips ?? []).filter(c => c.duration > 0.2 && c.channels > 0);
const deferred = []; // characters without real animation clips: not catalogued yet
const KEEP_CHARACTER = p => { if (names[p.id].category !== 'characters') return true; if (usable(p).length) return true; deferred.push({ id: p.id, title: names[p.id].title }); return false; };
// Deferred sources: NASA assets only carry a generic usage statement, not a specific per-asset open licence.
const DEFERRED_SOURCES = new Set(['nasa']);
// Concept families with tight caps across ALL sources, including assets already published (and the starter set).
const famKey = (concept, title = '') => {
  const t = (concept + ' ' + title).toLowerCase(); const c = concept.toLowerCase();
  if (/wheelchair|high ?chair|chairlift|chair ?lift/.test(t)) return c;
  if (/arm ?chair|lounge chair|recliner|club chair/.test(c)) return 'family:armchair';
  if (/\bchairs?\b|\bstool\b/.test(c) && !/\btable\b/.test(c)) return /stool/.test(c) ? 'family:stool' : 'family:chair';
  if (/\b(sofa|couch|loveseat)\b/.test(c)) return 'family:sofa';
  if (/\btable\b/.test(c) && !/tablecloth|table lamp|table tennis|tabletop game/.test(c)) return 'family:table:' + c;
  return c;
};
const FAMILY_CAP = key => key === 'family:chair' || key === 'family:armchair' || key === 'family:sofa' ? 3 : key === 'family:stool' ? 3 : key.startsWith('family:table:') ? 3 : null;
const famBase = new Map(); const bump = k => famBase.set(k, (famBase.get(k) ?? 0) + 1);
for (const r of existing) bump(famKey(r.name, r.name));
for (const p of pinned) bump(famKey(p.concept ?? p.name, p.name));
const named = pool.filter(p => !DEFERRED_SOURCES.has(p.source) && !pinnedIds.has(p.id) && !EXCLUDE_PACKS.has(p.pack) && !/decal/i.test(names[p.id]?.concept ?? '') && !/decal/i.test(p.name)).filter(p => names[p.id] && !names[p.id].skip && KEEP_CHARACTER(p) && !(p.source === 'polyhaven' && existingSources.has(`https://polyhaven.com/a/${p.pack}`)));
// Group by concept, interleave packs, apply caps.
const byConcept = new Map();
for (const p of named) { let k = famKey(names[p.id].concept, names[p.id].title); if (p.source === 'gso' && !k.startsWith('family:')) k = 'gso:' + k; (byConcept.get(k) ?? byConcept.set(k, []).get(k)).push(p); }
const selected = []; const dropped = { cap: 0 };
// Characters: at most 10 per pack so animal/fish packs do not dominate.
const charCount = new Map(); const charCap = p => { if (names[p.id]?.category !== 'characters') return true; const k = p.source + '/' + p.pack; const n = charCount.get(k) ?? 0; if (n >= 10) return false; charCount.set(k, n + 1); return true; };
const pinnedCount = famBase;
for (const [concept, items] of byConcept) {
  const modular = items.filter(p => names[p.id].modular).length > items.length / 2; const cap = Math.max(0, (FAMILY_CAP(concept) ?? (concept.startsWith('gso:') ? 3 : modular ? CAP_MOD : CAP_OBJ)) - (pinnedCount.get(concept) ?? 0)); // NASA craft are distinct real missions, not variants
  const packs = new Map(); for (const p of items.sort((a, b) => a.id.localeCompare(b.id))) { const pk = ['polyhaven','gso','nasa','graft'].includes(p.source) ? p.source : p.pack; const l = packs.get(pk) ?? packs.set(pk, []).get(pk); if (l.length < PER_PACK) l.push(p); else dropped.cap++; }
  const lists = [...packs.values()]; let n = 0;
  for (let round = 0; n < cap && lists.some(l => l.length > round); round++) for (const l of lists) if (l[round] && n < cap) { if (charCap(l[round])) { selected.push(l[round]); n++; } else dropped.cap++; } 
  dropped.cap += lists.reduce((a, l) => a + l.length, 0) - n;
}
// Deterministic interleave (hash order, stable as the pool grows) so the newest rows on the site mix categories and packs.
const order = id => createHash('sha1').update(id).digest('hex');
selected.sort((a, b) => order(a.id).localeCompare(order(b.id)));
import { readdir } from 'node:fs/promises';
const ledgerSlugs = new Set(Object.keys(ledger));
const scenesInfo = []; try { for (const d of await readdir(path('ex/scenes'))) scenesInfo.push(await readJson(path('ex/scenes', d, 'info.json'))); } catch {}
for (const p of pinned) { if (!['props', 'characters', 'scenes'].includes(p.category)) p.category = 'props'; }
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
  else if (p.source === 'gso') { creator = 'Google Research'; source_url = `https://app.gazebosim.org/GoogleResearch/fuel/models/${p.pack}`; }
  else if (p.source === 'nasa') { creator = 'NASA'; source_url = p.other?.repo ?? 'https://github.com/nasa/NASA-3D-Resources'; }
  else if (p.source === 'graft') { creator = 'Quaternius'; source_url = 'https://quaternius.itch.io/universal-base-characters'; }
  else { creator = p.ph.authors.join(', '); source_url = `https://polyhaven.com/a/${p.pack}`; }
  const pretty = p.source === 'polyhaven' ? 'Poly Haven' : pt;
  const lic = LICENSES[p.source] ?? LICENSES.cc0;
  attribution = lic.text(title, creator, pretty);
  // Top-level category is props | characters | scenes; vehicles, nature, architecture etc. become tags.
  const category = n.category === 'characters' ? 'characters' : 'props';
  const subtype = { vehicles: 'vehicle', nature: 'nature', environments: 'architecture' }[n.category];
  const clipTags = category === 'characters' ? ['animated', ...new Set(usable(p).flatMap(c => ANIM_WORDS.filter(w => c.name.toLowerCase().includes(w))))] : [];
  const tags = [...new Set([...(category === 'characters' ? ['character'] : []), ...(subtype ? [subtype] : []), ...clipTags, ...n.tags, ...(PACK_TAGS(p))])].slice(0, 16);
  const [bx, by, bz] = p.bbox; const tile_size = by > 1.6 * Math.max(bx, bz) ? 'vert' : 'small';
  plan.push({ id: p.id, source: p.source, pack: p.pack, file: p.file, slug, name: title, description: n.description, category, tags, creator, source_url, license: lic.license, license_url: lic.url, attribution, tile_size, concept: n.concept, modular: n.modular });
}
// Assembled scenes (scripts/bulk/scenes.mjs): metadata is hand-written in the recipes, credits come from the kits used.
const KIT_CREDIT = (pack) => /^KayKit/.test(pack) ? 'Kay Lousberg (KayKit)' : /^(universal|quaternius)/.test(pack) ? 'Quaternius' : 'Kenney';
const KIT_TITLE = { 'nature-kit': 'Nature Kit', 'survival-kit': 'Survival Kit', 'graveyard-kit': 'Graveyard Kit', 'pirate-kit': 'Pirate Kit', 'fantasy-town-kit': 'Fantasy Town Kit', 'furniture-kit': 'Furniture Kit', 'city-kit-suburban': 'City Kit (Suburban)', 'city-kit-roads': 'City Kit (Roads)', 'KayKit-Dungeon-Remastered-1.0': 'KayKit Dungeon Remastered', 'KayKit-Medieval-Hexagon-Pack-1.0': 'KayKit Medieval Hexagon Pack' };
for (const sc of (scenesInfo ?? [])) {
  if (ledgerSlugs.has(sc.slug) || reserved.has(sc.slug)) continue; reserved.add(sc.slug);
  const credits = [...new Set(sc.packs.map(k => `${KIT_TITLE[k] ?? k} by ${KIT_CREDIT(k)}`))];
  plan.push({ id: `scenes/${sc.slug}`, source: 'scenes', pack: 'scenes', file: `ex/scenes/${sc.slug}/model.glb`.replace(/^ex\//, ''), slug: sc.slug, name: sc.title, description: sc.description, category: 'scenes', tags: [...new Set([...sc.tags, 'assembled', 'customisable'])].slice(0, 16), creator: [...new Set(sc.packs.map(KIT_CREDIT))].join(', '), source_url: 'https://github.com/tana3d/website/blob/main/docs/catalog-sourcing.md', license: 'CC0', license_url: CC0, attribution: `${sc.title}: scene assembled by Tana from CC0 kit parts (${credits.join('; ')}). Each placed part is a separate node. Released under CC0 1.0.`, tile_size: 'hero', concept: 'scene:' + sc.slug, modular: false });
}
function PACK_TAGS(p) { return (p.packTags || '').split(',').filter(Boolean).slice(0, 2); }
await writeJson(path('plan.json'), plan);
const count = k => plan.reduce((m, p) => (m[p[k]] = (m[p[k]] ?? 0) + 1, m), {});
console.log('pinned', pinned.length, 'named', named.length, 'concepts', byConcept.size, 'selected', plan.length, 'dropped by caps', dropped.cap);
if (deferred.length) await writeJson(path('deferred-characters.json'), deferred); console.log('deferred unanimated characters', deferred.length);
console.log('by category', count('category')); console.log('by source', count('source'));
