import { inflateRawSync,deflateRawSync } from 'node:zlib';
export function readZip(bytes){
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('invalid_zip');
  const count=bytes.readUInt16LE(end+10);let offset=bytes.readUInt32LE(end+16),total=0;const entries=[];
  if(count>2000)throw new Error('zip_too_many_entries');
  for(let i=0;i<count;i++){
    if(bytes.readUInt32LE(offset)!==0x02014b50)throw new Error('invalid_zip_entry');
    const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),size=bytes.readUInt32LE(offset+20),expanded=bytes.readUInt32LE(offset+24),nameLength=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32),local=bytes.readUInt32LE(offset+42);
    const name=bytes.subarray(offset+46,offset+46+nameLength).toString('utf8');
    if(flags&1||!name||name.startsWith('/')||name.split(/[\\/]/).includes('..')||expanded>64*1024*1024)throw new Error('unsafe_zip');
    total+=expanded;if(total>256*1024*1024)throw new Error('zip_too_large');
    if(bytes.readUInt32LE(local)!==0x04034b50)throw new Error('invalid_zip_local');
    const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);const data=bytes.subarray(start,start+size);
    const raw=method===0?data:method===8?inflateRawSync(data,{maxOutputLength:64*1024*1024}):null;
    if(!raw||raw.length!==expanded)throw new Error('unsupported_zip');
    entries.push({name,data:raw});offset+=46+nameLength+extra+comment;
  }
  if(new Set(entries.map(x=>x.name)).size!==entries.length)throw new Error('duplicate_zip_names');
  return entries;
}
export function writeZip(entries){
  const chunks=[],central=[];let offset=0;
  for(const {name,data} of entries){
    const n=Buffer.from(name),compressed=deflateRawSync(data);let crc=0xffffffff;
    for(const b of data){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
    const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(0x800,6);l.writeUInt16LE(8,8);l.writeUInt32LE(crc,14);l.writeUInt32LE(compressed.length,18);l.writeUInt32LE(data.length,22);l.writeUInt16LE(n.length,26);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);offset+=l.length+n.length+compressed.length;
    chunks.push(l,n,compressed);central.push(c,n);
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directory,end]);
}
