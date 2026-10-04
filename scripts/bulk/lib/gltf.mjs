// glTF reading, statistics and GLB normalisation shared by discovery and build stages.
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, flatten, textureCompress, getBounds, resample } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
let io;
export async function getIO() {
  if (io) return io;
  await MeshoptDecoder.ready; io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
  return io;
}
export function stats(doc) {
  const root = doc.getRoot(); let verts = 0, tris = 0; const h = createHash('sha256');
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'); if (!pos) continue; verts += pos.getCount();
    const idx = prim.getIndices(); tris += idx ? idx.getCount() / 3 : pos.getCount() / 3;
    const a = pos.getArray(); const q = new Int32Array(a.length); for (let i = 0; i < a.length; i++) q[i] = Math.round(a[i] * 1e4);
    h.update(Buffer.from(q.buffer)); if (idx) h.update(Buffer.from(Uint32Array.from(idx.getArray()).buffer));
  }
  const scene = root.getDefaultScene() ?? root.listScenes()[0]; let bbox = [0, 0, 0], bmin = [0, 0, 0];
  if (scene) { const b = getBounds(scene); bbox = [0, 1, 2].map(i => +(b.max[i] - b.min[i]).toFixed(4)); bmin = b.min.map(v => +v.toFixed(4)); }
  return { verts, tris: Math.round(tris), bbox, bmin, meshes: root.listMeshes().length, materials: root.listMaterials().length, textures: root.listTextures().length,
    animations: root.listAnimations().map(a => a.getName()), skins: root.listSkins().length, geomHash: verts ? h.digest('hex') : null };
}
// Convert to a compact, self-contained GLB: merge duplicates, drop unused data, bound texture size.
// Blender's FBX import can leave materials fully transparent; a zero-alpha untextured material is a conversion artefact.
export function repairMaterials(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    const c = m.getBaseColorFactor();
    if (!m.getBaseColorTexture() && c[3] < 0.01) { m.setBaseColorFactor([c[0], c[1], c[2], 1]); m.setAlphaMode('OPAQUE'); }
  }
}
export async function normalise(doc, maxTexture = 1024) {
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  repairMaterials(doc);
  if (doc.getRoot().listAnimations().length) await doc.transform(resample());
  await doc.transform(dedup(), prune());
  const big = doc.getRoot().listTextures().some(t => { const s = t.getSize(); return s && Math.max(...s) > maxTexture; });
  if (big) await doc.transform(textureCompress({ encoder: sharp, resize: [maxTexture, maxTexture] }));
  const bufs = doc.getRoot().listBuffers();
  if (bufs.length > 1) { for (const a of doc.getRoot().listAccessors()) a.setBuffer(bufs[0]); for (const b of bufs.slice(1)) b.dispose(); }
  const io = await getIO();
  return Buffer.from(await io.writeBinary(doc));
}

// Read .glb/.gltf from disk; for .gltf, resolve external files and tolerate Quaternius's "_png.png" name quirk.
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve as resolvePath, extname } from 'node:path';
export async function readModel(file) {
  const io = await getIO();
  if (extname(file).toLowerCase() !== '.gltf') return io.read(file);
  const json = JSON.parse(await readFile(file, 'utf8')); const dir = dirname(file); const resources = {};
  for (const item of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (!item.uri || item.uri.startsWith('data:')) continue;
    const uri = decodeURIComponent(item.uri); const base = uri.split('/').pop();
    const tries = [resolvePath(dir, uri), resolvePath(dir, uri.replace(/_png(\.png)$/i, '$1')), resolvePath(dir, '../Textures', base), resolvePath(dir, '../../Textures', base), resolvePath(dir, '../../../Textures', base), resolvePath(dir, 'Textures', base)];
    let p = null; for (const t of tries) { try { await stat(t); p = t; break; } catch {} }
    if (!p) throw Error('missing resource ' + uri);
    resources[item.uri] = new Uint8Array(await readFile(p));
  }
  return io.readJSON({ json, resources });
}
// Animation summary used for catalogue accuracy: name, duration (s) and channel count per clip.
export function clips(doc) {
  return doc.getRoot().listAnimations().map(a => {
    let end = 0; for (const s of a.listSamplers()) { const t = s.getInput(); if (t && t.getCount()) end = Math.max(end, t.getMax([])[0]); }
    return { name: a.getName() || 'Animation', duration: +end.toFixed(3), channels: a.listChannels().length };
  });
}
export const usableClips = doc => clips(doc).filter(c => c.duration > 0.2 && c.channels > 0);
