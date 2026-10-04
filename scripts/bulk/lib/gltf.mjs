// glTF reading, statistics and GLB normalisation shared by discovery and build stages.
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, flatten, textureCompress, getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
let io;
export async function getIO() {
  if (io) return io;
  await MeshoptDecoder.ready; io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
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
  const scene = root.getDefaultScene() ?? root.listScenes()[0]; let bbox = [0, 0, 0];
  if (scene) { const b = getBounds(scene); bbox = [0, 1, 2].map(i => +(b.max[i] - b.min[i]).toFixed(4)); }
  return { verts, tris: Math.round(tris), bbox, meshes: root.listMeshes().length, materials: root.listMaterials().length, textures: root.listTextures().length,
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
  await doc.transform(dedup(), prune());
  const big = doc.getRoot().listTextures().some(t => { const s = t.getSize(); return s && Math.max(...s) > maxTexture; });
  if (big) await doc.transform(textureCompress({ encoder: sharp, resize: [maxTexture, maxTexture] }));
  const io = await getIO();
  return Buffer.from(await io.writeBinary(doc));
}
