// Temporary migration: accepts only exact reviewed binary patches by SHA-256.
// No arbitrary path, content, download, customer record or credential access.
import { get,list,put } from '@vercel/blob';
import { blobAuth } from './_blob-auth.js';
import { CATALOG } from './_shared.js';
import { validatePatch,patchCourse,sha256 } from './_engineer-course-patch.js';
export const config={api:{bodyParser:false}};
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^a-zа-яё0-9]/giu,'');
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 let chunks=[],size=0;
 try{
  for await(const chunk of req){size+=chunk.length;if(size>3*1024*1024)return res.status(413).json({error:'too_large'});chunks.push(chunk);}
  let files;try{files=validatePatch(req.query.batch,Buffer.concat(chunks));}catch{return res.status(403).json({error:'patch_not_authorized'});}
  const {blobs}=await list({limit:100,...blobAuth()});const report=[];
  // Validate every target before changing any one of them.
  const plans=[];
  for(const code of ['autocad','primavera','bundle']){
   const subset=code==='bundle'?files:files.filter(f=>f.code===code);if(!subset.length)continue;
   const matches=blobs.filter(b=>norm(b.pathname)===norm(CATALOG[code].blobPath));if(matches.length!==1)throw new Error('course_not_found');
   const current=await get(matches[0].pathname,{access:'private',useCache:false,...blobAuth()});if(current?.statusCode!==200)throw new Error('course_unreadable');
   const original=Buffer.from(await new Response(current.stream).arrayBuffer());
   const patched=patchCourse(original,subset);plans.push({code,path:matches[0].pathname,original,...patched});
  }
  for(const p of plans){
   if(p.changed){
    const backup='_course_backups/enru-v1/'+p.code+'/'+sha256(p.original)+'.zip';
    await put(backup,p.original,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/zip',...blobAuth()});
    await put(p.path,p.bytes,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/zip',...blobAuth()});
    const check=await get(p.path,{access:'private',useCache:false,...blobAuth()});
    if(check?.statusCode!==200||sha256(Buffer.from(await new Response(check.stream).arrayBuffer()))!==sha256(p.bytes))throw new Error('course_write_not_verified');
   }
   report.push({product:p.code,changed:p.changed,verified:p.verified});
  }
  return res.status(200).json({ok:true,batch:String(req.query.batch),report});
 }catch(e){return res.status(409).json({error:['course_revision_mismatch','course_files_mismatch','course_not_found','course_unreadable','course_write_not_verified'].includes(e.message)?e.message:'course_update_failed'});}
}
