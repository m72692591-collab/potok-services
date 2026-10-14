import {deflateRawSync} from 'node:zlib';
import {MOBILE_COURSE_HTML} from './_mobile-course-assets.js';
const NAMES={autocad:'AutoCAD_dlya_telefona_21_dney.html',primavera:'Primavera_P6_dlya_telefona_14_dney.html',bundle:'AutoCAD_i_Primavera_dlya_telefona.html'};
export const mobileSupported=code=>Object.hasOwn(NAMES,code);
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0;}
export function zipEntries(entries){
  if(!Array.isArray(entries)||entries.length<1||entries.length>10)throw new Error('zip_entries_invalid');
  const localParts=[],centralParts=[];let offset=0;
  for(const entry of entries){
    const name=Buffer.from(String(entry.name),'utf8'),raw=Buffer.isBuffer(entry.content)?entry.content:Buffer.from(entry.content);
    if(name.length===0||name.length>255||!/^[-\w.]+$/.test(name.toString()))throw new Error('zip_entry_name_invalid');
    const compressed=deflateRawSync(raw),crc=crc32(raw);
    const local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    localParts.push(local,name,compressed);centralParts.push(central,name);
    offset+=local.length+name.length+compressed.length;
  }
  const centrals=Buffer.concat(centralParts),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(centrals.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...localParts,centrals,end]);
}
export function mobileCourseZip(code){
  if(!mobileSupported(code))throw new Error('mobile_course_unavailable');
  return zipEntries([{name:NAMES[code],content:MOBILE_COURSE_HTML[code]}]);
}
export function windowsAndMobileZip(code,windowsArchive){
  if(!mobileSupported(code))return windowsArchive;
  return zipEntries([{name:'01_Windows_original_course.zip',content:windowsArchive},{name:NAMES[code],content:MOBILE_COURSE_HTML[code]},{name:'OPEN_ME_FIRST.txt',content:'Инженер с нуля / один товар, две версии.\n1. На компьютере распакуйте 01_Windows_original_course.zip.\n2. На телефоне откройте HTML-файл в браузере, интернет после сохранения не нужен.\n3. CAD-полигон и CPM-редактор учебные; программ Autodesk AutoCAD и Oracle Primavera P6 в комплекте нет.\n'}]);
}
