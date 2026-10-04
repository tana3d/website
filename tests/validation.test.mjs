import test from 'node:test';
import assert from 'node:assert/strict';
import { metadata, inspectModel, inspectImage } from '../src/lib/validation.ts';
function form(values={}) { const f=new FormData();for(const [k,v]of Object.entries({name:'Chair',slug:'chair',description:'A wooden chair.',category:'props',license:'CC0',tile_size:'small',colour:'#aabbcc',...values}))f.set(k,v);return f; }
function glb(json) {let text=JSON.stringify(json);text+=' '.repeat((4-text.length%4)%4);const b=new ArrayBuffer(20+text.length);const v=new DataView(b);[0x46546c67,2,b.byteLength,text.length,0x4e4f534a].forEach((n,i)=>v.setUint32(i*4,n,true));new Uint8Array(b,20).set(new TextEncoder().encode(text));return new File([b],'model.glb');}
test('metadata normalizes tags and rejects unsafe fields and missing attribution',()=>{
 assert.deepEqual(metadata(form({tags:'Wood, wood, chair'})).tags,['wood','chair']);
 assert.throws(()=>metadata(form({source_url:'javascript:alert(1)'})));
 assert.throws(()=>metadata(form({colour:'red; background:url(foo)'})));
 assert.throws(()=>metadata(form({license:'CC-BY-4.0'})),/creator/);
 assert.throws(()=>metadata(form({slug:'../../admin'})),/slug/);
 assert.throws(()=>metadata(form({category:'anything'})),/category/);
});
test('GLB inspection extracts actual rig and animation metadata',async()=>{
 const result=await inspectModel(glb({asset:{version:'2.0'},skins:[{joints:[0]}],animations:[{name:'Walk'},{}]}));
 assert.equal(result.rigged,1);assert.deepEqual(result.animations,['Walk','Animation 2']);
 await assert.rejects(inspectModel(glb({asset:{version:'2.0'},images:[{uri:'https://example.com/texture.png'}]})),/external/);
 await assert.rejects(inspectModel(new File(['not a model'],'model.glb')),/GLB/);
});
test('image inspection rejects SVG, mismatched extensions, and animated stills',async()=>{
 await assert.rejects(inspectImage(new File(['<svg><script>x</script></svg>'],'preview.svg')),/preview/i);
 const gif=new File(['GIF89a'+String.fromCharCode(1,0,1,0,0,0,0)],'preview.gif');
 assert.equal((await inspectImage(gif)).animated,true);
 await assert.rejects(inspectImage(gif,true),/still/);
 await assert.rejects(inspectImage(new File([await gif.arrayBuffer()],'preview.png')),/extension/);
});
