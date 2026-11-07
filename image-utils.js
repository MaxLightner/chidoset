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
