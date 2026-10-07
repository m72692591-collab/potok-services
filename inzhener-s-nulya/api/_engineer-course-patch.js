import { createHash } from 'node:crypto';
import { readZip,writeZip } from './_engineer-zip.js';
import { PATCHES } from './_engineer-course-patch-manifest.js';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function validatePatch(batch,body){
 const spec=PATCHES[String(batch)];if(!spec||body.length>3*1024*1024||sha256(body)!==spec.sha256)throw new Error('patch_not_authorized');
 const entries=readZip(body);if(entries.length!==spec.files.length)throw new Error('patch_invalid');
 return spec.files.map((f,i)=>{const e=entries.find(x=>x.name===String(i));if(!e||sha256(e.data)!==f.after)throw new Error('patch_invalid');return {...f,data:e.data};});
}
export function patchCourse(bytes,files){
 const counts=new Map(files.map(f=>[f.name,0]));let changed=0;
 function walk(raw,depth=0){
  const entries=readZip(raw);let edited=false;
  for(const entry of entries){
   const candidates=files.filter(f=>entry.name.normalize('NFC').endsWith(f.name.split('/').pop().normalize('NFC')));
   if(candidates.length){
    const hash=sha256(entry.data);const f=candidates.find(f=>hash===f.before||hash===f.after);
    if(!f)throw new Error('course_revision_mismatch');counts.set(f.name,counts.get(f.name)+1);
    if(hash===f.before){entry.data=f.data;changed++;edited=true;}
   }else if(depth<2&&entry.name.toLowerCase().endsWith('.zip')){
    const nested=walk(entry.data,depth+1);if(nested!==entry.data){entry.data=nested;edited=true;}
   }
  }
  return edited?writeZip(entries):raw;
 }
 const result=walk(bytes);if([...counts.values()].some(n=>n!==1))throw new Error('course_files_mismatch');
 return {bytes:result,changed,verified:files.length};
}
