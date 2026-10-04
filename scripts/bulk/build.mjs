// Build stage: normalise each planned model into a self-contained GLB, validate it, render our own preview.
// Reads .tmp/bulk/plan.json, writes .tmp/bulk/out/<slug>/{model.glb,preview.png|gif,poster.png,built.json}. Resumable.
// Usage: node scripts/bulk/build.mjs [--limit N] [--offset N]
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { path, readJson, writeJson, sha256, progress } from './lib/common.mjs';
import { getIO, normalise, stats } from './lib/gltf.mjs';
import { createRenderer } from './lib/render.mjs';
import { inspectModel, inspectImage } from '../../src/lib/validation.ts';
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? Number(process.argv[i + 1]) : undefined; };
const plan = await readJson(path('plan.json'));
const slice = plan.slice(arg('offset') ?? 0, (arg('offset') ?? 0) + (arg('limit') ?? plan.length));
const io = await getIO(); const renderer = await createRenderer();
let built = 0, skipped = 0; const failures = [];
for (const item of slice) {
  const dir = path('out', item.slug);
  try { await stat(resolve(dir, 'built.json')); skipped++; continue; } catch {}
  try {
    await mkdir(dir, { recursive: true });
    const doc = await io.read(resolve(path('ex'), item.file));
    // Keep downloads reasonable: step texture size down until the file is under ~2 MB (min 256 px).
    let glb = await normalise(doc, 1024);
    for (const size of [512, 256]) if (glb.byteLength > 2 * 1048576) glb = await normalise(await io.readBinary(glb), size);
    const model = await inspectModel(new File([glb], 'model.glb'));
    const s = stats(await io.readBinary(glb)); if (!s.verts) throw Error('model has no geometry');
    const r = await renderer.render(glb);
    const still = await inspectImage(new File([r.png], 'poster.png'), true);
    if (r.png.byteLength < 2000) throw Error('preview looks empty');
    await writeFile(resolve(dir, 'model.glb'), glb);
    await writeFile(resolve(dir, 'poster.png'), r.png);
    let preview = 'poster.png';
    if (r.gif) { await inspectImage(new File([r.gif], 'preview.gif')); await writeFile(resolve(dir, 'preview.gif'), r.gif); preview = 'preview.gif'; }
    await writeJson(resolve(dir, 'built.json'), { slug: item.slug, model_bytes: glb.byteLength, sha256: sha256(glb), preview, colour: r.colour, animations: model.animations, rigged: model.rigged, tris: s.tris, bbox: s.bbox, built: new Date().toISOString() });
    built++;
  } catch (e) { failures.push({ slug: item.slug, error: e.message }); console.log('FAILED', item.slug, e.message); }
  if ((built + skipped) % 100 === 0) { await progress({ current_action: `building previews ${built + skipped}/${slice.length}` }); console.log('built', built, 'skipped', skipped); }
}
await renderer.close();
await writeJson(path('build-failures.json'), failures);
console.log('build done: built', built, 'already built', skipped, 'failed', failures.length);
