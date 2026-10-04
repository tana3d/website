// Google Scanned Objects (Google Research, CC BY 4.0) via Gazebo Fuel: list, download, convert OBJ -> GLB with Blender.
// Output: .tmp/bulk/ex/gso/<name>/model.glb + info.json (Fuel metadata incl. licence). Resumable, polite.
import { mkdir, writeFile, stat, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { path, readJson, writeJson, sleep } from './lib/common.mjs';
const UA = 'TanaStudio/0.1 (tana.gg; catalog sourcing; contact sfouad@gmail.com)';
const get = async (url, json) => { for (let a = 0; a < 4; a++) { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: json ? 'application/json' : '*/*' } }); if (r.ok) return r; await sleep(2000 * (a + 1)); } throw Error('GET failed ' + url); };
const list = []; for (let page = 1; ; page++) { const d = await (await get(`https://fuel.gazebosim.org/1.0/GoogleResearch/models?per_page=100&page=${page}`, true)).json(); if (!d.length) break; list.push(...d); if (d.length < 100) break; }
console.log('Fuel GoogleResearch models', list.length);
const keep = list.filter(m => m.license_url?.includes('creativecommons.org/licenses/by/4.0'));
console.log('CC BY 4.0 licensed', keep.length, 'of', list.length);
const root = path('cache/gso'), ex = path('ex/gso'); await mkdir(root, { recursive: true });
const jobs = []; let fetched = 0;
for (const m of keep) {
  const out = resolve(ex, m.name, 'model.glb'); try { if ((await stat(out)).size > 0) continue; } catch {}
  const dir = resolve(root, m.name);
  try { await stat(resolve(dir, 'meshes/model.obj')); } catch {
    await mkdir(dir, { recursive: true }); const zip = resolve(root, m.name + '.zip');
    await writeFile(zip, Buffer.from(await (await get(`https://fuel.gazebosim.org/1.0/GoogleResearch/models/${m.name}/tip/${m.name}.zip`)).arrayBuffer()));
    execFileSync('unzip', ['-qo', zip, '-d', dir]); await rm(zip); fetched++; await sleep(700);
  }
  await mkdir(dirname(out), { recursive: true }); await writeJson(resolve(dirname(out), 'info.json'), { ...m, fetched: new Date().toISOString() });
  jobs.push({ src: resolve(dir, 'meshes/model.obj'), out });
  if (jobs.length >= 20) { await convert(jobs.splice(0)); }
}
if (jobs.length) await convert(jobs);
async function convert(batch) {
  const jf = path('blender-jobs-gso.json'); await writeJson(jf, batch);
  await new Promise(res => { const p = spawn('/Applications/Blender.app/Contents/MacOS/Blender', ['-b', '--threads', '2', '-P', resolve('scripts/bulk/blender-convert.py'), '--', jf], { stdio: 'ignore' }); p.on('close', res); });
  const bad = (await readJson(jf + '.result', [])).filter(r => !r.ok); if (bad.length) console.log('convert failures', bad.length, bad[0].error);
  console.log('gso progress: downloaded', fetched);
}
console.log('gso done');
