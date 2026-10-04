// Validate and merge naming agent outputs (.tmp/bulk/naming/out-*.json) into .tmp/bulk/names.json.
import { readdir, unlink } from 'node:fs/promises';
import { path, readJson, writeJson } from './lib/common.mjs';
const CATS = ['characters', 'props', 'environments', 'vehicles', 'nature'];
const names = await readJson(path('names.json'), {}); let merged = 0, bad = 0;
for (const f of (await readdir(path('naming'))).filter(f => /^out-\d+\.json$/.test(f)).sort()) {
  let out, inp; try { out = await readJson(path('naming', f)); inp = await readJson(path('naming', f.replace('out', 'in'))); } catch (e) { console.log('unreadable', f); continue; }
  const want = new Map(inp.map(i => [i.id, i]));
  for (const o of out) {
    if (!want.has(o.id)) { bad++; continue; }
    const tags = [...new Set((o.tags ?? []).map(t => String(t).toLowerCase().trim().replace(/\s+/g, '-')).filter(t => t && t.length <= 30))].slice(0, 12);
    const ok = typeof o.title === 'string' && o.title.length >= 2 && o.title.length <= 80 && CATS.includes(o.category) && o.concept && typeof o.description === 'string' && o.description.length >= 10 && o.description.length <= 400 && tags.length >= 3;
    if (!ok && !o.skip) { bad++; continue; }
    names[o.id] = { title: String(o.title ?? '').trim(), concept: String(o.concept ?? '').toLowerCase().trim(), category: o.category, tags, description: String(o.description ?? '').trim(), skip: !!o.skip, skipReason: o.skipReason ?? '', modular: !!o.modular };
    want.delete(o.id); merged++;
  }
  if (want.size) { console.log(f, 'missing', want.size, 'items; leaving file for retry'); continue; }
  await unlink(path('naming', f)); await unlink(path('naming', f.replace('out', 'in')));
}
await writeJson(path('names.json'), names);
console.log('merged', merged, 'invalid', bad, 'total named', Object.keys(names).length);
