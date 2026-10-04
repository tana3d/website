// Convert fetched Quaternius Drive packs (FBX/OBJ) to GLB with headless Blender; glTF packs are copied as-is.
// Output: .tmp/bulk/ex/quaternius-drive/<pack>/<file>.glb. Resumable, one Blender process at a time.
import { readdir, mkdir, cp, writeFile, stat, readFile } from 'node:fs/promises';
import { resolve, relative, extname, basename, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { path, readJson, writeJson } from './lib/common.mjs';
const BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';
const cache = path('cache/quaternius-drive'), exRoot = path('ex/quaternius-drive');
const walk = async dir => { const out = []; for (const e of await readdir(dir, { withFileTypes: true })) { const p = resolve(dir, e.name); if (e.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; };
const only = process.argv.slice(2);
const index = await readJson(resolve(cache, 'index.json'), []);
const exists = async f => { try { return (await stat(f)).size > 0; } catch { return false; } };
for (const pack of index.filter(p => p.done && (!only.length || only.includes(p.page)))) {
  const dir = resolve(cache, pack.page), out = resolve(exRoot, pack.page); await mkdir(out, { recursive: true });
  const files = await walk(dir);
  const gl = files.filter(f => /\.(glb|gltf)$/i.test(f));
  if (gl.length) { await cp(dir, out, { recursive: true, force: false, errorOnExist: false }); console.log(pack.page, 'copied glTF pack', gl.length); continue; }
  const fbx = files.filter(f => /\.fbx$/i.test(f)), obj = files.filter(f => /\.obj$/i.test(f));
  const srcs = fbx.length ? fbx : obj; const jobs = [];
  for (const src of srcs) { const o = resolve(out, relative(dir, src).replace(/\.[^.]+$/, '') .replace(/^(FBX|OBJ)[\\/]/i, '') + '.glb'); if (!await exists(o)) { await mkdir(dirname(o), { recursive: true }); jobs.push({ src, out: o }); } }
  for (let i = 0; i < jobs.length; i += 20) {
    const batch = jobs.slice(i, i + 20), jf = path('blender-jobs.json'); await writeJson(jf, batch);
    await new Promise(res => { const p = spawn(BLENDER, ['-b', '--threads', '2', '-P', resolve('scripts/bulk/blender-convert.py'), '--', jf], { stdio: 'ignore' }); p.on('close', res); });
    const results = await readJson(jf + '.result', []); const bad = results.filter(r => !r.ok);
    if (bad.length) console.log(pack.page, 'convert failures', bad.map(b => basename(b.src) + ': ' + b.error).join('; '));
  }
  console.log(pack.page, `converted ${srcs.length} ${fbx.length ? 'FBX' : 'OBJ'}`);
}
