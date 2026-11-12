// The AR tablet and the read-only web viewer use the same immutable GLB bytes.
const CACHE_NAME='chido-models-v1';
const MAX_MODELS=48;
export function modelCacheKey(url){
 const parsed=new URL(url,globalThis.location?.href||'https://maxlightner.github.io/chidoset/');
 const version=parsed.searchParams.get('v')||'';
 const identity=parsed.origin+parsed.pathname+(version?'?v='+version:'');
 return new URL('__chido-glb-cache__/'+encodeURIComponent(identity),globalThis.location?.origin||'https://maxlightner.github.io').href;
}
function validGLB(bytes){
 if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<20)return false;
 const view=new DataView(bytes);
 return view.getUint32(0,true)===0x46546c67&&view.getUint32(4,true)===2&&view.getUint32(8,true)===bytes.byteLength;
}
export async function loadModelBytes(url,onProgress=()=>{}){
 let cache=null,cacheKey=null;
 try{if(globalThis.caches){cache=await caches.open(CACHE_NAME);cacheKey=modelCacheKey(url);}}
 catch(error){console.warn('GLB persistent cache unavailable',error);}
 if(cache){
  try{
   const hit=await cache.match(cacheKey);
   if(hit){
    const bytes=await hit.arrayBuffer();
    if(validGLB(bytes)){onProgress?.({loaded:bytes.byteLength,total:bytes.byteLength,progress:1,fromCache:true});return bytes;}
    await cache.delete(cacheKey);
   }
  }catch(error){console.warn('GLB cache read failed',error);}
 }
 const response=await fetch(url,{mode:'cors',cache:'force-cache'});
 if(!response.ok)throw Error('GLB download failed ('+response.status+')');
 const cacheResponse=cache?response.clone():null;
 const total=Number(response.headers.get('content-length'))||0;
 let bytes;
 if(response.body?.getReader){
  const reader=response.body.getReader(),chunks=[];let loaded=0;
  while(true){
   const {done,value}=await reader.read();if(done)break;
   if(!value?.byteLength)continue;
   chunks.push(value);loaded+=value.byteLength;
   onProgress?.({loaded,total:total||null,progress:total?Math.min(1,loaded/total):null,fromCache:false});
  }
  const joined=new Uint8Array(loaded);let offset=0;
  for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
  bytes=joined.buffer;
 }else{
  bytes=await response.arrayBuffer();
  onProgress?.({loaded:bytes.byteLength,total:total||null,progress:total?Math.min(1,bytes.byteLength/total):null,fromCache:false});
 }
 if(!validGLB(bytes))throw Error('Invalid GLB model data');
 onProgress?.({loaded:bytes.byteLength,total:total||bytes.byteLength,progress:1,fromCache:false});
 if(cache&&cacheResponse)void (async()=>{
  try{await cache.put(cacheKey,cacheResponse);const keys=await cache.keys();for(const old of keys.slice(0,Math.max(0,keys.length-MAX_MODELS)))await cache.delete(old);}
  catch(error){console.warn('GLB persistent cache write failed',error);}
 })();
 return bytes;
}
