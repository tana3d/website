import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHostedModel} from '../src/lib/source-package.ts';
import {metadata} from '../src/lib/validation.ts';
import {readFile} from 'node:fs/promises';
import {parse} from 'parse5';
function zip(names){
 const directory=names.map(name=>{const encoded=Buffer.from(name),header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50);header.writeUInt16LE(encoded.length,28);return Buffer.concat([header,encoded]);});
 const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(central.length,12);return new File([central,end],'model.zip');
}
test('source packages are stored without inflating textures or claiming animation metadata',async()=>{
 const result=await inspectHostedModel(zip(['asset/model.blend','asset/textures/albedo.jpg']));
 assert.equal(result.format,'zip');assert.equal(result.buffer,null);assert.deepEqual(result.animations,[]);
 assert.equal((await inspectHostedModel(new File(['BLENDER-v304'],'model.blend'))).format,'blend');
});
test('hosting rejects unsafe and ambiguous packages before saving',async()=>{
 for(const names of [['model.obj'],['first.blend','second.blend'],['model.blend','../texture.jpg'],['/model.blend'],['model.blend','textures\\test.png']])await assert.rejects(inspectHostedModel(zip(names)));
 await assert.rejects(inspectHostedModel(new File(['this is not Blender'],'fake.blend')));
 await assert.rejects(inspectHostedModel(new File(['invalid zip bytes'],'broken.zip')));
});
test('CC-BY credits are derived from the existing citation fields',()=>{
 const form=new FormData();for(const [key,value] of Object.entries({name:'Model',slug:'model',description:'A model.',category:'props',license:'CC-BY-4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',creator:'Artist',source_url:'https://example.com/model',tile_size:'small',colour:'#aabbcc'}))form.set(key,value);
 const credit=metadata(form).attribution;assert.match(credit,/Model/);assert.match(credit,/Artist/);assert.match(credit,/CC-BY-4.0/);assert.match(credit,/https:\/\/example.com\/model/);
 form.set('attribution','Custom modification notes');assert.equal(metadata(form).attribution,'Custom modification notes');
});
test('the admin form defaults to public, accepts source packages and has no cloud conversion or duplicate credit field',async()=>{
 const source=await readFile('src/pages/admin/index.astro','utf8');const tree=parse(source);
 const nodes=[];function walk(node){nodes.push(node);for(const child of node.childNodes??[])walk(child);}walk(tree);
 const inputs=nodes.filter(n=>n.tagName==='input');const field=name=>inputs.find(n=>n.attrs.some(a=>a.name==='name'&&a.value===name));
 assert.ok(field('published').attrs.some(a=>a.name==='checked'));
 assert.match(field('model').attrs.find(a=>a.name==='accept').value,/\.blend/);assert.match(field('model').attrs.find(a=>a.name==='accept').value,/\.zip/);
 assert.equal(nodes.filter(n=>n.tagName==='textarea'&&n.attrs.some(a=>a.name==='name'&&a.value==='attribution')).length,0);
 assert.doesNotMatch(source,/Model conversions|\/api\/admin\/imports/);
});
