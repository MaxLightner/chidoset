// The AR tablet and the read-only web viewer use the same immutable GLB bytes.
// CacheStorage survives page reloads; unlike a signed Supabase URL, its key does
// not change when a short-lived access token is renewed.
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

export async function loadModelBytes(url){
 let cache=null,cacheKey=null;
 try{
  if(globalThis.caches){cache=await caches.open(CACHE_NAME);cacheKey=modelCacheKey(url);}
 }catch(error){console.warn('GLB persistent cache unavailable',error);}
 if(cache){
  try{
   const hit=await cache.match(cacheKey);
   if(hit){const bytes=await hit.arrayBuffer();if(validGLB(bytes))return bytes;await cache.delete(cacheKey);}
  }catch(error){console.warn('GLB cache read failed',error);}
 }
 const response=await fetch(url,{mode:'cors',cache:'force-cache'});
 if(!response.ok)throw Error('GLB download failed ('+response.status+')');
 const bytes=await response.clone().arrayBuffer();
 if(!validGLB(bytes))throw Error('Invalid GLB model data');
 if(cache)void (async()=>{
  try{
   await cache.put(cacheKey,response);
   const keys=await cache.keys();
   for(const old of keys.slice(0,Math.max(0,keys.length-MAX_MODELS)))await cache.delete(old);
  }catch(error){console.warn('GLB persistent cache write failed',error);}
 })();
 return bytes;
}
