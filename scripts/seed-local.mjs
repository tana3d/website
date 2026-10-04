import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base='http://127.0.0.1:4321';
const root=resolve('.tmp/starter');
const catalog=JSON.parse(await readFile(resolve(root,'catalog.json'),'utf8'));
const existing=await (await fetch(base+'/api/admin/assets?limit=60')).json();
if(!existing.assets)throw new Error('Start the local dev server with LOCAL_ADMIN=true before seeding.');
for(const asset of catalog) {
  const prior=existing.assets.find(a=>a.slug===asset.slug);
  const form=new FormData();
  for(const name of ['slug','name','description','category','creator','source_url','license','license_url','attribution','tile_size','colour'])form.set(name,asset[name]);
  form.set('tags',asset.tags.join(', '));form.set('published','1');
  form.set('model',new File([await readFile(resolve(root,asset.filename))],asset.filename,{type:'model/gltf-binary'}));
  form.set('preview',new File([await readFile(resolve(root,asset.slug+(asset.animated?'.gif':'.png')))],asset.slug+(asset.animated?'.gif':'.png'),{type:asset.animated?'image/gif':'image/png'}));
  if(asset.animated)form.set('poster',new File([await readFile(resolve(root,asset.slug+'.png'))],asset.slug+'.png',{type:'image/png'}));
  const response=await fetch(base+'/api/admin/assets'+(prior?'/'+prior.id:''),{method:prior?'PUT':'POST',headers:{Origin:base},body:form});
  const result=await response.json();if(!response.ok)throw new Error(`${asset.name}: ${result.error}`);
  console.log(`Published ${asset.name}`);
}
