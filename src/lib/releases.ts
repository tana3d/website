import type { R2Bucket } from '@cloudflare/workers-types';
export interface ReleaseFile {platform:string|null;label:string;filename:string;key:string;url:string;bytes:number;sha256:string;}
export interface ReleaseUpdate extends ReleaseFile {target:string;signature:string;}
export interface Release {schema:1;version:string;buildId:string;buildNumber:number;commit:string;publishedAt:string;files:ReleaseFile[];sources:ReleaseFile[];updates?:ReleaseUpdate[];}
export interface ReleaseBindings {RELEASES?:R2Bucket;}
const labels:Record<string,string>={'darwin-arm64':'macOS Apple Silicon','darwin-x64':'macOS Intel','win32-x64':'Windows','linux-x64':'Linux'};
const updateTargets:Record<string,string>={'darwin-aarch64':'darwin-arm64','darwin-x86_64':'darwin-x64','windows-x86_64':'win32-x64','linux-x86_64':'linux-x64'};
export const emptyRelease={version:null,files:[] as ReleaseFile[],sources:[] as ReleaseFile[]};
export function validateRelease(value:unknown):Release {
 const r=value as Release;
 if(r?.schema!==1||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(r.version??'')||r.version.split('.').some(n=>!Number.isSafeInteger(Number(n)))||!/^\d+-\d+-[a-f\d]{12}$/.test(r.buildId??'')||!Number.isSafeInteger(r.buildNumber)||r.buildNumber<1||!/^[a-f\d]{40}$/.test(r.commit??'')||!Number.isFinite(Date.parse(r.publishedAt??'')))throw Error('Invalid release manifest.');
 if(!r.buildId.startsWith(`${r.buildNumber}-`)||!r.buildId.endsWith(r.commit.slice(0,12)))throw Error('Inconsistent release identity.');
 if(!Array.isArray(r.files)||r.files.length!==4||new Set(r.files.map(f=>f.platform)).size!==4||!Array.isArray(r.sources)||r.sources.length<2)throw Error('Incomplete release manifest.');
 if(r.updates!==undefined&&(!Array.isArray(r.updates)||r.updates.length!==4||new Set(r.updates.map(f=>f.target)).size!==4||new Set(r.updates.map(f=>f.key)).size!==4))throw Error('Incomplete signed updates.');
 for(const file of [...r.files,...r.sources,...(r.updates??[])]){
  if(!/^[\w.-]+$/.test(file.filename??'')||file.key!==`releases/${r.buildId}/${file.filename}`||file.url!==`https://tana.gg/downloads/${file.key}`||!Number.isSafeInteger(file.bytes)||file.bytes<1||!/^[a-f\d]{64}$/.test(file.sha256??''))throw Error('Invalid release file.');
  if(r.files.includes(file)&&(!file.platform||labels[file.platform]!==file.label))throw Error('Invalid release platform.');
 }
 if(new Set([...r.files,...r.sources].map(f=>f.key)).size!==r.files.length+r.sources.length||!['blender-4.5.14.tar.xz','studio-source.tar.gz'].every(name=>r.sources.some(file=>file.filename===name)))throw Error('Missing or duplicate release source.');
 for(const update of r.updates??[]) {
  if(!updateTargets[update.target]||update.platform!==updateTargets[update.target]||labels[update.platform]!==update.label||!update.signature||update.signature.length>2048||!/^[A-Za-z0-9+/]+={0,2}$/.test(update.signature)||update.signature.length%4!==0)throw Error('Invalid signed update.');
  if(update.platform.startsWith('darwin')) {
   if(!update.filename.endsWith('.app.tar.gz')||[...r.files,...r.sources].some(file=>file.key===update.key))throw Error('Invalid Mac update bundle.');
  } else {
   const installer=r.files.find(file=>file.platform===update.platform);
   if(!installer||['key','url','filename','bytes','sha256'].some(key=>update[key as keyof ReleaseFile]!==installer[key as keyof ReleaseFile]))throw Error('Update does not match its installer.');
  }
 }
 return r;
}
export async function updateResponse(bindings:ReleaseBindings,target:string,arch:string,version:string):Promise<Response> {
 const headers={'Cache-Control':'no-store'};
 if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)||version.split('.').some(n=>!Number.isSafeInteger(Number(n))))return new Response('Invalid current version.',{status:400,headers});
 const platform=`${target}-${arch}`;
 if(!updateTargets[platform])return new Response(null,{status:204,headers});
 const release=await readRelease(bindings),update=release?.updates?.find(item=>item.target===platform);
 if(!release||!update)return new Response(null,{status:204,headers});
 const current=version.split('.').map(Number),latest=release.version.split('.').map(Number);
 const changed=latest.findIndex((part,index)=>part!==current[index]);
 if(changed===-1||latest[changed]<current[changed])return new Response(null,{status:204,headers});
 return Response.json({version:release.version,pub_date:release.publishedAt,notes:`Studio v${release.version}. Release notes: https://github.com/tana3d/studio/releases/tag/v${release.version}`,url:update.url,signature:update.signature},{headers});
}
export async function readRelease(bindings:ReleaseBindings,key='latest.json'):Promise<Release|null>{
 if(!bindings.RELEASES)return null;
 const object=await bindings.RELEASES.get(key);
 if(!object)return null;
 if(object.size>65536)throw Error('Release manifest is too large.');
 return validateRelease(JSON.parse(await object.text()));
}
export function releaseSize(bytes:number){return bytes>=1073741824?`${(bytes/1073741824).toFixed(1)} GB`:`${Math.ceil(bytes/1048576)} MB`;}
export function downloadRange(value:string|null,size:number):{offset:number;length:number}|null {
 if(!value)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);
 if(!match||(!match[1]&&!match[2]))throw Error('Invalid range.');
 const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
 const end=match[1]?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start||(!match[1]&&Number(match[2])<=0))throw Error('Unsatisfiable range.');
 return {offset:start,length:end-start+1};
}
export async function releaseDownload(bindings:ReleaseBindings,key:string,request:Request):Promise<Response>{
 const match=/^releases\/(\d+-\d+-[a-f\d]{12})\/([\w.-]+)$/.exec(key);
 if(!match||!bindings.RELEASES)return new Response('Not found.',{status:404});
 const release=await readRelease(bindings,`releases/${match[1]}/manifest.json`);
 const file=release&&[...release.files,...release.sources,...(release.updates??[])].find(file=>file.key===key);
 if(!file)return new Response('Not found.',{status:404});
 const metadata=await bindings.RELEASES.head(key);
 if(!metadata||metadata.size!==file.bytes)return new Response('Download unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});
 const headers=new Headers({'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${file.filename}"`,'Content-Length':String(metadata.size),'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable','ETag':metadata.httpEtag,'X-Checksum-SHA256':file.sha256,'X-Content-Type-Options':'nosniff'});
 const noneMatch=request.headers.get('If-None-Match');
 if(noneMatch&&(noneMatch==='*'||noneMatch.split(',').some(value=>value.trim().replace(/^W\//,'')===metadata.httpEtag)))return new Response(null,{status:304,headers});
 // HEAD never fetches or streams a potentially multi-gigabyte installer.
 if(request.method==='HEAD')return new Response(null,{headers});
 const ifRange=request.headers.get('If-Range');
 let range;
 try{range=downloadRange(!ifRange||ifRange===metadata.httpEtag?request.headers.get('Range'):null,metadata.size);}
 catch{return new Response(null,{status:416,headers:{'Content-Range':`bytes */${metadata.size}`,'Cache-Control':'no-store'}});}
 const object=await bindings.RELEASES.get(key,range?{range}:undefined);
 if(!object)return new Response('Download unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});
 if(range){headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${metadata.size}`);headers.set('Content-Length',String(range.length));}
 return new Response(object.body as unknown as ReadableStream,{status:range?206:200,headers});
}
