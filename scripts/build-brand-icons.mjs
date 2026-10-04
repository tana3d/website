import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// Export sizes from the original generated mark, preserving its alpha channel.
const master='public/brand/tana-master.png';
const output='public/brand';
await mkdir(output,{recursive:true});
for(const size of [16,32,48,64,128,180,192,256,512,1024]){
  await sharp(master).resize(size,size).png().toFile(`${output}/tana-${size}.png`);
}
await sharp(master).resize(64,64).png().toFile('public/favicon.png');
await sharp(master).resize(180,180).png().toFile('public/apple-touch-icon.png');

// ICO permits PNG frames, including the full alpha channel.
const sizes=[16,32,48,256];
const frames=await Promise.all(sizes.map(size=>sharp(master).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+16*frames.length);
header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=header.length;
frames.forEach((frame,index)=>{
  const pos=6+index*16;
  header[pos]=sizes[index]===256?0:sizes[index];header[pos+1]=header[pos];
  header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);
  header.writeUInt32LE(frame.length,pos+8);header.writeUInt32LE(offset,pos+12);
  offset+=frame.length;
});
const ico=Buffer.concat([header,...frames]);
await writeFile(`${output}/tana.ico`,ico);
await writeFile('public/favicon.ico',ico);

if(process.platform==='darwin'){
  const iconset='.tmp/tana.iconset';
  await mkdir(iconset,{recursive:true});
  for(const size of [16,32,128,256,512]){
    await sharp(master).resize(size,size).png().toFile(`${iconset}/icon_${size}x${size}.png`);
    await sharp(master).resize(size*2,size*2).png().toFile(`${iconset}/icon_${size}x${size}@2x.png`);
  }
  execFileSync('iconutil',['-c','icns',iconset,'-o',`${output}/tana.icns`]);
}
console.log('Tana brand icons exported.');
