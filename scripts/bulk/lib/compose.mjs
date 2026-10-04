// Compose scenes from existing CC0 parts: each placed part becomes its own named node so users can move/replace it.
import { Document } from '@gltf-transform/core';
import { mergeDocuments } from '@gltf-transform/functions';
import { readModel } from './gltf.mjs';
import { resolve } from 'node:path';
import { path } from './common.mjs';

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class SceneBuilder {
  constructor(name) { this.doc = new Document(); this.doc.createBuffer(); this.scene = this.doc.createScene(name); this.templates = new Map(); this.count = 0; this.placed = []; this.root = this.doc.createNode(name); this.scene.addChild(this.root); }
  async template(file) {
    if (this.templates.has(file)) return this.templates.get(file);
    const src = await readModel(resolve(path('ex'), file));
    const map = mergeDocuments(this.doc, src);
    const added = [...src.getRoot().listScenes()].map(sc => map.get(sc));
    // Scene parts are static: drop skins/animations carried in with merged characters.
    for (const a of src.getRoot().listAnimations()) map.get(a)?.dispose();
    for (const n of src.getRoot().listNodes()) map.get(n)?.setSkin(null);
    for (const m of src.getRoot().listMeshes()) for (const pr of map.get(m).listPrimitives()) { pr.setAttribute('JOINTS_0', null); pr.setAttribute('WEIGHTS_0', null); }
    const holder = this.doc.createNode('tpl'); for (const sc of added) { for (const c of sc.listChildren()) { sc.removeChild(c); holder.addChild(c); } sc.dispose(); }
    const info = { node: holder };
    this.templates.set(file, info); return info;
  }
  clone(node) {
    const n = this.doc.createNode(node.getName()).setTranslation(node.getTranslation()).setRotation(node.getRotation()).setScale(node.getScale());
    if (node.getMesh()) n.setMesh(node.getMesh());
    for (const c of node.listChildren()) n.addChild(this.clone(c)); return n;
  }
  // Place a part. y is the height of the part's base; ry is rotation about Y in radians; s uniform scale.
  async place(file, x = 0, y = 0, z = 0, ry = 0, s = 1, label, offset = [0, 0, 0]) {
    const t = await this.template(file); const holder = this.doc.createNode('part'); const inner = this.clone(t.node).setTranslation(offset); holder.addChild(inner);
    const base = (label ?? file.split('/').pop().replace(/\.(glb|gltf)$/i, '')).replace(/[^\w-]+/g, '_');
    holder.setName(`${base}_${++this.count}`).setTranslation([x, y, z]).setRotation([0, Math.sin(ry / 2), 0, Math.cos(ry / 2)]).setScale([s, s, s]);
    this.root.addChild(holder); this.placed.push({ file, label: base }); return holder;
  }
  // Own-generated flat coloured slab (ground, floor, water) so scenes are standalone without external ground tiles.
  slab(width, depth, thickness, rgb, name = 'Ground', y = 0) {
    const d = this.doc, buf = d.getRoot().listBuffers()[0], hw = width / 2, hd = depth / 2;
    const p = [], idx = []; const v = (x, yy, z) => p.push(x, yy, z);
    // top
    v(-hw, y, -hd); v(hw, y, -hd); v(hw, y, hd); v(-hw, y, hd); v(-hw, y - thickness, -hd); v(hw, y - thickness, -hd); v(hw, y - thickness, hd); v(-hw, y - thickness, hd);
    idx.push(0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7);
    const pos = d.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(buf);
    const ind = d.createAccessor().setType('SCALAR').setArray(new Uint16Array(idx)).setBuffer(buf);
    const mat = d.createMaterial(name).setBaseColorFactor([rgb[0], rgb[1], rgb[2], 1]).setRoughnessFactor(0.95).setMetallicFactor(0);
    const prim = d.createPrimitive().setAttribute('POSITION', pos).setIndices(ind).setMaterial(mat);
    const node = d.createNode(name).setMesh(d.createMesh(name).addPrimitive(prim)); this.root.addChild(node); return node;
  }
}
