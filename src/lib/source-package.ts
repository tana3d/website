import { inspectModel, SOURCE_LIMIT } from './validation.ts';
import { modelMime } from './types.ts';

// Inspect ZIP directory records without inflating textures or allocating a copy
// of the whole upload in a Worker. Studio performs extraction and conversion.
export async function inspectHostedModel(file:File){
  const format=file.name.toLowerCase().split('.').at(-1);
  if(format==='glb')return {...await inspectModel(file),format:'glb' as const,mime:modelMime('glb')};
  if(!['blend','zip'].includes(format??'')||file.size<12||file.size>SOURCE_LIMIT)throw new Error('Upload a GLB, Blender file or Blender ZIP up to 80 MB.');
  const prefix=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(format==='blend'){
    const raw=new TextDecoder().decode(prefix.slice(0,7))==='BLENDER';
    const gzip=prefix[0]===31&&prefix[1]===139;
    const zstd=prefix[0]===40&&prefix[1]===181&&prefix[2]===47&&prefix[3]===253;
    if(!raw&&!gzip&&!zstd)throw new Error('This does not look like a Blender file.');
    return {format:'blend' as const,mime:modelMime('blend'),buffer:null,animations:[],rigged:0};
  }
  const tail=new DataView(await file.slice(Math.max(0,file.size-65557)).arrayBuffer());
  let end=-1;
  for(let i=tail.byteLength-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50&&i+22+tail.getUint16(i+20,true)===tail.byteLength){end=i;break;}
  if(end<0)throw new Error('The asset ZIP is incomplete or invalid.');
  const count=tail.getUint16(end+10,true),length=tail.getUint32(end+12,true),offset=tail.getUint32(end+16,true);
  if(tail.getUint16(end+4,true)||tail.getUint16(end+6,true)||tail.getUint16(end+8,true)!==count||!count||count>4096||length>2*1024*1024||offset+length>file.size-tail.byteLength+end)throw new Error('Upload one Blender asset package with at most 4,096 files.');
  const directory=new Uint8Array(await file.slice(offset,offset+length).arrayBuffer()),view=new DataView(directory.buffer);
  let cursor=0,blends=0,expanded=0;
  for(let i=0;i<count;i++){
    if(cursor+46>length||view.getUint32(cursor,true)!==0x02014b50)throw new Error('The asset ZIP directory is invalid.');
    const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),size=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),mode=view.getUint32(cursor+38,true)>>>16;
    const next=cursor+46+nameLength+extra+comment;if(next>length)throw new Error('The asset ZIP directory is incomplete.');
    const name=new TextDecoder().decode(directory.slice(cursor+46,cursor+46+nameLength));
    if(flags&1||![0,8].includes(method))throw new Error('Use a standard, unencrypted ZIP.');
    if(!name||name.length>500||name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.split('/').includes('..')||/^[a-z]:/i.test(name)||(mode&0o170000)===0o120000)throw new Error('The ZIP contains an unsafe file path or symbolic link.');
    expanded+=size;if(size>256*1024*1024||expanded>512*1024*1024)throw new Error('Keep the extracted package under 512 MB, with each file under 256 MB.');
    if(!name.split('/').includes('__MACOSX')&&name.toLowerCase().endsWith('.blend'))blends++;
    cursor=next;
  }
  if(cursor!==directory.length)throw new Error('The asset ZIP directory is invalid.');
  if(blends!==1)throw new Error('Include one .blend model and its textures in the ZIP.');
  return {format:'zip' as const,mime:modelMime('zip'),buffer:null,animations:[],rigged:0};
}
