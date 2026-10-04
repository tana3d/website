// Graft animation clips from a library GLB onto characters that share its skeleton (matched by bone name).
// Used for Quaternius Universal Base Characters (+ Universal Animation Library): the output GLBs contain real clips.
// Output: .tmp/bulk/ex/graft/<name>/model.glb + info.json. Usage: node scripts/bulk/graft.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { path, writeJson } from './lib/common.mjs';
import { getIO, readModel, clips } from './lib/gltf.mjs';
const Q = path('ex/quaternius');
const UBC = resolve(Q, 'universalbasecharacters/Universal Base Characters[Standard]/Base Characters/Godot - UE');
const UAL1 = resolve(Q, 'universalanimationlibrary/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const UAL2 = resolve(Q, 'universalanimationlibrary2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb');
const targets = [
  { id: 'superhero-male', file: resolve(UBC, 'Superhero_Male_FullBody.gltf'), title: 'Superhero Male', pack: 'universalbasecharacters' },
  { id: 'superhero-female', file: resolve(UBC, 'Superhero_Female_FullBody.gltf'), title: 'Superhero Female', pack: 'universalbasecharacters' },
];
function graft(dst, src) {
  const byName = new Map(); for (const n of dst.getRoot().listNodes()) if (!byName.has(n.getName())) byName.set(n.getName(), n);
  let ok = 0, miss = 0;
  const existing = new Set(dst.getRoot().listAnimations().map(a => a.getName()));
  for (const a of src.getRoot().listAnimations()) {
    if (a.getName() === 'A_TPose' || existing.has(a.getName())) continue; existing.add(a.getName());
    const anim = dst.createAnimation(a.getName()); const smap = new Map();
    for (const ch of a.listChannels()) {
      const target = byName.get(ch.getTargetNode()?.getName()); if (!target) { miss++; continue; }
      let s = smap.get(ch.getSampler());
      if (!s) { const o = ch.getSampler(); const inp = dst.createAccessor().setArray(o.getInput().getArray().slice()).setType('SCALAR'); const out = dst.createAccessor().setArray(o.getOutput().getArray().slice()).setType(o.getOutput().getType()); s = dst.createAnimationSampler().setInput(inp).setOutput(out).setInterpolation(o.getInterpolation()); anim.addSampler(s); smap.set(o, s); smap.set(ch.getSampler(), s); }
      anim.addChannel(dst.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(s)); ok++;
    }
  }
  return { ok, miss };
}
const io = await getIO(); const libs = [await readModel(UAL1), await readModel(UAL2)];
for (const t of targets) {
  const dst = await readModel(t.file); const have = new Set(dst.getRoot().listAnimations().map(a => a.getName())); let stats = [];
  for (const lib of libs) stats.push(graft(dst, lib));
  const names = clips(dst); const out = path('ex/graft', t.id); await mkdir(out, { recursive: true });
  await writeFile(resolve(out, 'model.glb'), Buffer.from(await io.writeBinary(dst)));
  await writeJson(resolve(out, 'info.json'), { ...t, file: undefined, clips: names, source: 'Quaternius Universal Base Characters + Universal Animation Library 1 and 2 (clips grafted by bone name)', grafted: stats });
  console.log(t.id, 'clips', names.length, JSON.stringify(stats));
}
