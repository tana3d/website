// Assemble starter scenes from CC0 kit parts (Kenney, KayKit). Every placed part is its own named node so the
// scene can be customised. Output: .tmp/bulk/ex/scenes/<slug>/model.glb + info.json (credits, parts list).
// Usage: node scripts/bulk/scenes.mjs [slug ...]
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { path, readJson, writeJson } from './lib/common.mjs';
import { SceneBuilder, rng } from './lib/compose.mjs';
import { getIO, normalise } from './lib/gltf.mjs';
import { SCENES } from './scene-recipes.mjs';
const only = process.argv.slice(2);
const cands = await readJson(path('candidates.json'));
const lookup = new Map(cands.filter(c => !c.error).map(c => [`${c.pack}/${c.name}`, c]));
const io = await getIO();
for (const s of SCENES) {
  if (only.length && !only.includes(s.slug)) continue;
  const b = new SceneBuilder(s.title); const r = rng(s.seed ?? 7); const used = new Map();
  // P(pack, name, x, z, {y, ry, s}) places a part; y defaults to lifting the part so its base sits on y=0.
  const P = async (pack, name, x = 0, z = 0, o = {}) => {
    const c = lookup.get(`${pack}/${name}`); if (!c) throw Error(`part not found: ${pack}/${name}`);
    const sc = o.s ?? 1; const y = o.y ?? 0; used.set(pack, (used.get(pack) ?? 0) + 1);
    // Centre each part on its footprint and sit its base at y, so rotation is about the part's own centre.
    const off = [-(c.bmin[0] + c.bbox[0] / 2), -c.bmin[1], -(c.bmin[2] + c.bbox[2] / 2)];
    return b.place(c.file, x, y, z, o.ry ?? 0, sc, name, off);
  };
  const size = (pack, name) => lookup.get(`${pack}/${name}`)?.bbox;
  await s.build({ b, P, r, size, pick: (arr) => arr[Math.floor(r() * arr.length)] });
  // glTF units are metres: scale the whole scene so doors, trees, ships etc. are roughly real-world size.
  const SCALE = { 'nature-kit': 3, 'furniture-kit': 2, 'survival-kit': 3, 'graveyard-kit': 2.5, 'pirate-kit': 1, 'fantasy-town-kit': 3, 'KayKit-Dungeon-Remastered-1.0': 1, 'city-kit-suburban': 6, 'KayKit-Medieval-Hexagon-Pack-1.0': 5 };
  const dominant = [...used.entries()].sort((a, c) => c[1] - a[1])[0][0]; const k = s.scale ?? SCALE[dominant] ?? 1; b.root.setScale([k, k, k]);
  const glb = await normalise(b.doc, 1024);
  const dir = path('ex/scenes', s.slug); await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'model.glb'), glb);
  const packs = [...used.keys()];
  await writeJson(resolve(dir, 'info.json'), { slug: s.slug, title: s.title, description: s.description, tags: s.tags, packs, parts: b.placed.length, metre_scale: k, distinct_parts: new Set(b.placed.map(p => p.file)).size, recipe: 'scripts/bulk/scene-recipes.mjs' });
  console.log(s.slug, (glb.length / 1048576).toFixed(2) + ' MB', b.placed.length + ' parts');
}
