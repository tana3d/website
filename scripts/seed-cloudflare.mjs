// Initial catalog provisioning through Cloudflare's control plane. No app auth bypass.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {metadata,inspectModel,inspectImage} from '../src/lib/validation.ts';
if(!process.argv.includes('--publish'))throw Error('Pass --publish to upload the prepared starter catalog to production.');
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('Set CLOUDFLARE_API_TOKEN in the environment.');
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const account=config.account_id, database=config.d1_databases[0].database_id, bucket=config.r2_buckets[0].bucket_name;
const apiRoot=`https://api.cloudflare.com/client/v4/accounts/${account}`;
async function api(path,method='GET',body,contentType='application/json'){
 const response=await fetch(apiRoot+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':contentType},body:body===undefined?undefined:contentType==='application/json'?JSON.stringify(body):body});
 const result=await response.json();
 if(!response.ok||!result.success)throw Error(`Cloudflare ${response.status}: ${JSON.stringify(result.errors)}`);
 return result.result;
}
const query=(sql,params=[])=>api(`/d1/database/${database}/query`,'POST',{sql,params});
const root=resolve('.tmp/starter');
const catalog=JSON.parse(await readFile(resolve(root,'catalog.json'),'utf8'));
for(const asset of catalog){
 const prior=await query('SELECT id FROM assets WHERE slug=?',[asset.slug]);
 if(prior[0].results.length){console.log(`Already present: ${asset.name}`);continue;}
 const form=new FormData();
 for(const name of ['slug','name','description','category','creator','source_url','license','license_url','attribution','tile_size','colour'])form.set(name,asset[name]);
 form.set('tags',asset.tags.join(', '));form.set('published','1');
 const meta=metadata(form);
 const model=await inspectModel(new File([await readFile(resolve(root,asset.filename))],asset.filename));
 const previewName=asset.slug+(asset.animated?'.gif':'.png');
 const preview=await inspectImage(new File([await readFile(resolve(root,previewName))],previewName));
 const poster=asset.animated?await inspectImage(new File([await readFile(resolve(root,asset.slug+'.png'))],asset.slug+'.png'),true):null;
 const id=randomUUID(),prefix=`assets/${id}/${randomUUID()}`;
 async function put(name,data,mime){const key=`${prefix}/${name}`;const result=await api(`/r2/buckets/${bucket}/objects/${key}`,'PUT',data,mime);if(Number(result.size)!==data.byteLength)throw Error('R2 upload size mismatch');return key;}
 const [model_key,preview_key,poster_key]=await Promise.all([put('model.glb',model.buffer,'model/gltf-binary'),put(`preview.${preview.kind}`,preview.buffer,preview.mime),poster?put(`poster.${poster.kind}`,poster.buffer,poster.mime):Promise.resolve(null)]);
 const row={...meta,id,tags:JSON.stringify(meta.tags),model_key,model_bytes:model.buffer.byteLength,preview_key,poster_key:poster_key??preview_key,preview_animated:Number(preview.animated),animations:JSON.stringify(model.animations),rigged:model.rigged};
 const fields=Object.keys(row);
 await query(`INSERT INTO assets (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,Object.values(row));
 console.log(`Published in Cloudflare: ${asset.name}`);
}
