import { handle } from '@astrojs/cloudflare/handler';
import { DurableObject } from 'cloudflare:workers';
import { Container } from '@cloudflare/containers';
import { finishImport, type ImportJob as Job } from './lib/import-jobs';
import type { Bindings } from './lib/types';

export class BlenderConverter extends Container {
  defaultPort=8080;
  sleepAfter='30s';
  enableInternet=false;
}
export class ImportJob extends DurableObject<Bindings>{
  async fetch(request:Request){
    const {id}=await request.json() as {id:string};
    if(!/^[a-f\d-]{36}$/i.test(id))return new Response('Invalid job',{status:400});
    await this.ctx.storage.put('job',id);await this.ctx.storage.setAlarm(Date.now()+100);
    return Response.json({queued:true});
  }
  async alarm(){
    const id=await this.ctx.storage.get<string>('job');if(!id)return;
    const job=await this.env.DB.prepare('SELECT * FROM import_jobs WHERE id=?').bind(id).first<Job>();
    if(!job||['ready','failed'].includes(job.state))return;
    await this.env.DB.prepare("UPDATE import_jobs SET state='converting',attempts=attempts+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id).run();
    try{
      const source=await this.env.LIBRARY.get(job.source_key);if(!source)throw new Error('The uploaded source package is missing.');
      const format=job.source_key.split('.').at(-1)!;
      // R2 streams the upload into the container; no 80 MB copy is made in the
      // 128 MB Worker isolate. Container names keep conversion concurrency at 1.
      const response=await this.env.CONVERTER!.getByName('studio-model-converter').fetch(new Request(`http://container/convert?format=${format}`,{method:'POST',headers:{'Content-Type':'application/octet-stream','Content-Length':String(source.size)},body:source.body as unknown as ReadableStream}));
      if(response.status===429){await this.env.DB.prepare("UPDATE import_jobs SET state='queued',attempts=attempts-1 WHERE id=?").bind(id).run();await this.ctx.storage.setAlarm(Date.now()+15000);return;}
      if(!response.ok){const body=await response.text();let message=body;try{message=(JSON.parse(body) as {error?:string}).error??body;}catch{/* Container startup errors are plain text. */}throw new Error(message||'The converter could not open this model.');}
      const model=await response.arrayBuffer();if(model.byteLength>32*1024*1024)throw new Error('The converted model exceeds 32 MB.');
      const warnings=JSON.parse(decodeURIComponent(response.headers.get('X-Conversion-Warnings')??'%5B%5D')) as string[];
      await this.env.DB.prepare("UPDATE import_jobs SET state='saving',elapsed_ms=? WHERE id=?").bind(Number(response.headers.get('X-Conversion-Ms'))||null,id).run();
      await finishImport(job,model,warnings,this.env);
    }catch(error){
      const message=error instanceof Error?error.message:'Conversion failed.';
      // Only transient container startup errors are retried. Invalid models
      // remain visible as failed jobs; the original upload is retained.
      const retry=job.attempts<2&&/container|network|connection|timeout|capacity/i.test(message);
      await this.env.DB.prepare("UPDATE import_jobs SET state=?,error=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(retry?'queued':'failed',message.slice(0,2000),id).run();
      if(retry)await this.ctx.storage.setAlarm(Date.now()+15000);
    }
  }
}
export default {fetch:handle};
