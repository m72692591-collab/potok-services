import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {mobileCourseZip,windowsAndMobileZip,mobileSupported} from '../api/_mobile-course-zip.js';
import {CATALOG} from '../api/_shared.js';
function zipList(buf){
  const out=[];let i=0;
  while(i<buf.length&&buf.readUInt32LE(i)===0x04034b50){
    const method=buf.readUInt16LE(i+8),size=buf.readUInt32LE(i+18);
    const n=buf.readUInt16LE(i+26),extra=buf.readUInt16LE(i+28);
    const name=buf.subarray(i+30,i+30+n).toString('utf8');
    const start=i+30+n+extra;
    const zipped=buf.subarray(start,start+size);
    out.push({name,content:method===8?inflateRawSync(zipped):zipped});
    i=start+size;
  }
  if(buf.readUInt32LE(i)!==0x02014b50)throw Error('central_directory_missing');
  return out;
}
test('all three Windows packages now include distinct phone courses',()=>{
  for(const code of ['autocad','primavera','bundle']){
    assert.equal(mobileSupported(code),true);
    const items=zipList(windowsAndMobileZip(code,Buffer.from('WINDOWS_ZIP_BYTES')));
    assert.equal(items.length,3);
    assert.equal(items[0].name,'01_Windows_original_course.zip');
    assert.equal(items[0].content.toString(),'WINDOWS_ZIP_BYTES');
    assert.match(items[1].content.toString('utf8'),/<html/);
    assert.match(items[2].content.toString('utf8'),/две версии/);
    assert.equal(zipList(mobileCourseZip(code)).length,1);
  }
});
test('pre-existing item prices unchanged, no new mobile SKUs',()=>{
  assert.equal(CATALOG.autocad.price,1990);
  assert.equal(CATALOG.primavera.price,2490);
  assert.equal(CATALOG.bundle.price,3490);
  assert.equal(CATALOG.starter.price,490);
  assert.equal('cad_mobile' in CATALOG,false);
});
test('mobile archives not available for unlisted products',()=>{
  assert.equal(mobileSupported('starter'),false);
  assert.throws(()=>mobileCourseZip('unlisted'),/mobile_course_unavailable/);
});
