import {deflateRawSync} from 'node:zlib';
import {MOBILE_COURSE_HTML} from './_mobile-course-assets.js';

const NAMES={autocad:'AutoCAD_dlya_telefona_21_dney.html',primavera:'Primavera_P6_dlya_telefona_14_dney.html',bundle:'AutoCAD_i_Primavera_dlya_telefona.html'};
export const mobileSupported=code=>Object.hasOwn(NAMES,code);
function crc32(buf){
  let crc=0xffffffff;
  for(const b of buf){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
export function mobileCourseZip(code){
  if(!mobileSupported(code))throw new Error('mobile_course_unavailable');
  const filename=Buffer.from(NAMES[code]),raw=Buffer.from(MOBILE_COURSE_HTML[code],'utf8'),compressed=deflateRawSync(raw);
  const crc=crc32(raw);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);
  local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(filename.length,26);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);
  central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw.length,24);
  central.writeUInt16LE(filename.length,28);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
  end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(local.length+filename.length+compressed.length,16);
  return Buffer.concat([local,filename,compressed,central,filename,end]);
}
