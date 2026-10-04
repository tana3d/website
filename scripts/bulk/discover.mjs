// Scan extracted source packs, read each model, and write .tmp/bulk/candidates.json.
// Usage: node scripts/bulk/discover.mjs [source ...]   (kenney | kaykit | quaternius | ...)
import { readdir, stat } from 'node:fs/promises';
import { resolve, relative, basename, extname, dirname } from 'node:path';
import { path, readJson, writeJson, progress } from './lib/common.mjs';
import { getIO, stats, readModel, clips } from './lib/gltf.mjs';
import { SOURCES } from './sources.mjs';
const want = process.argv.slice(2);
const walk = async dir => { const out = []; for (const e of await readdir(dir, { withFileTypes: true })) { const p = resolve(dir, e.name); if (e.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; };
const cacheFile = path('stats-cache.json'); const cache = await readJson(cacheFile, {});
const io = await getIO(); const all = [];
for (const src of SOURCES) {
  if (want.length && !want.includes(src.id)) continue;
  const base = path('ex', src.id); let packs = []; try { packs = await readdir(base); } catch { continue; }
  for (const pack of packs.sort()) {
    const root = resolve(base, pack); const files = await walk(root);
    const picked = src.pick(files, root, pack);
    const seen = new Set();
    for (const file of picked) {
      const name = src.nameOf(file);
      if (!name || seen.has(name.toLowerCase())) continue; seen.add(name.toLowerCase());
      const key = relative(path('ex'), file); let s = cache[key];
      if (!s) { try { { const d = await readModel(file); s = { ...stats(d), clips: clips(d) }; } } catch (e) { s = { error: e.message }; } cache[key] = s; }
      all.push({ id: `${src.id}/${pack}/${name}`, source: src.id, pack, name, file: key, ...s });
    }
    console.log(src.id, pack, picked.length);
  }
}
await writeJson(cacheFile, cache);
const prior = (await readJson(path('candidates.json'), [])).filter(c => want.length && !want.includes(c.source));
await writeJson(path('candidates.json'), [...prior, ...all]);
console.log('candidates', prior.length + all.length, 'errors', all.filter(c => c.error).length);
