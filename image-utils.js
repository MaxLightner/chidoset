// Normalize photos once before storage/upload; do not retain a second PNG copy.
export async function lightweightPhoto(blob,maxSide=1920){
 const image=await createImageBitmap(blob);
 try{
  const scale=Math.min(1,maxSide/Math.max(image.width,image.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('آماده‌سازی تصویر ممکن نیست.');
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return await new Promise((resolve,reject)=>canvas.toBlob(result=>result&&result.type==='image/webp'?resolve(result):reject(Error('تبدیل تصویر به WebP در این مرورگر ممکن نیست.')),'image/webp',.82));
 }finally{image.close();}
}

// Keep the original when it is already small, otherwise optimize before upload.
// A photo can be much larger than the storage limit as long as its output fits.
export async function prepareUploadPhoto(original,{maxBytes=1_000_000,maxSide=4096}={}){
 const browserReady=['image/jpeg','image/png','image/webp'].includes(original.type);
 if(original.size<maxBytes&&browserReady)return original;
 let image;
 try{image=await createImageBitmap(original);}catch{throw Error('این تصویر قابل خواندن نیست. لطفاً عکس دیگری انتخاب کن.');}
 try{
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d');
  if(!context)throw Error('آماده‌سازی تصویر در این مرورگر ممکن نیست.');
  const encode=(type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  const attempts=[[maxSide,.86],[maxSide,.76],[maxSide,.65],[3840,.68],[3200,.7],[2880,.65],[2560,.62],[2200,.59],[1920,.57],[1600,.53],[1280,.48],[1024,.43],[768,.38]];
  let smallest=null;
  for(const [side,quality] of attempts){
   const scale=Math.min(1,side/Math.max(image.width,image.height));
   canvas.width=Math.max(1,Math.round(image.width*scale));
   canvas.height=Math.max(1,Math.round(image.height*scale));
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
   context.drawImage(image,0,0,canvas.width,canvas.height);
   let encoded=await encode('image/webp',quality);
   if(!encoded||encoded.type!=='image/webp')encoded=await encode('image/jpeg',quality);
   if(!encoded||!['image/webp','image/jpeg'].includes(encoded.type))throw Error('فشرده‌سازی عکس در این مرورگر امکان‌پذیر نیست.');
   if(!smallest||encoded.size<smallest.size)smallest=encoded;
   if(encoded.size<maxBytes)break;
  }
  if(browserReady&&original.size<maxBytes&&original.size<=smallest.size)return original;
  if(smallest.size>=maxBytes)throw Error('حجم عکس پس از فشرده‌سازی هنوز زیاد است. لطفاً عکس کوچک‌تری انتخاب کن.');
  return smallest;
 }finally{image.close();}
}
