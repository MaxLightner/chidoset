/* Tiny ZIP STORE writer for the customer's already-compressed JPEG/WebP photos.
   All bytes are fetched before the download is offered; no external ZIP dependency. */
const encoder=new TextEncoder();
const table=new Uint32Array(256);
for(let i=0;i<256;i++){let n=i;for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;table[i]=n>>>0;}
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function put16(view,pos,value){view.setUint16(pos,value,true);}
function put32(view,pos,value){view.setUint32(pos,value,true);}
const safeName=(name,index)=>`${String(index+1).padStart(2,'0')}-${String(name||'photo.jpg').replace(/[\\/\x00-\x1f:*?"<>|]/g,'-').slice(0,100)}`;

export function zipPhotoFiles(files){
 if(!files.length)throw Error('عکسی برای دریافت وجود ندارد.');
 const local=[],central=[];let offset=0;
 for(let i=0;i<files.length;i++){
  const item=files[i],name=encoder.encode(safeName(item.name,i)),bytes=item.bytes instanceof Uint8Array?item.bytes:new Uint8Array(item.bytes),crc=crc32(bytes);
  const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);put32(v,0,0x04034b50);put16(v,4,20);put16(v,6,0x800);put16(v,8,0);put32(v,14,crc);put32(v,18,bytes.length);put32(v,22,bytes.length);put16(v,26,name.length);h.set(name,30);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);put32(cv,0,0x02014b50);put16(cv,4,20);put16(cv,6,20);put16(cv,8,0x800);put16(cv,10,0);put32(cv,16,crc);put32(cv,20,bytes.length);put32(cv,24,bytes.length);put16(cv,28,name.length);put32(cv,42,offset);c.set(name,46);
  local.push(h,bytes);central.push(c);offset+=h.length+bytes.length;
 }
 const centralBytes=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);put32(v,0,0x06054b50);put16(v,8,files.length);put16(v,10,files.length);put32(v,12,centralBytes);put32(v,16,offset);
 return new Blob([...local,...central,end],{type:'application/zip'});
}

export async function downloadRequestPhotos(items,filename,onProgress=()=>{}){
 if(!items.length)throw Error('برای این درخواست هنوز عکسی ثبت نشده است.');
 const files=[];
 for(const item of items){
  if(!item.url)throw Error('دسترسی به عکس موجود نیست؛ پنل را به‌روزرسانی کن.');
  const response=await fetch(item.url,{credentials:'omit'});
  if(!response.ok)throw Error('دریافت عکس‌ها از فضای ذخیره‌سازی ناموفق بود.');
  files.push({name:item.filename||'photo.jpg',bytes:new Uint8Array(await response.arrayBuffer())});onProgress(files.length,items.length);
 }
 const blob=zipPhotoFiles(files),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename.replace(/[^\w\u0600-\u06ff.()-]+/g,'-')+'.zip';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 return {files:files.length,bytes:blob.size};
}
