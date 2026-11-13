// Shared, read-only storage index. Existing hardcoded assets remain a fallback.
const items=new Map();let pending;
export function assetPath(path){
 if(typeof path!=='string'||!/^assets\/(library|chido)\//.test(path)||/[\\?#%<>"'&\x00-\x1f]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'))return null;
 return path;
}
export function acceptAssetLibrary(doc){
 if(doc?.version!==1||!Array.isArray(doc.items))throw Error('Unsupported asset library');
 const next=new Map();
 for(const item of doc.items){
  if(typeof item.id!=='string'||!['model','fabric','wood'].includes(item.kind)||typeof item.name!=='string'||next.has(item.id))throw Error('Invalid asset record');
  if(!item.files||Object.values(item.files).some(p=>!assetPath(p)))throw Error('Invalid library path');
  next.set(item.id,{...item,files:{...item.files}});
 }
 items.clear();for(const [id,item]of next)items.set(id,item);
 return items.size;
}
export function loadAssetLibrary(){
 if(!pending)pending=fetch(new URL('./assets/library/index.json',import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(6000)}).then(r=>{if(!r.ok)throw Error('Library unavailable');return r.json();}).then(acceptAssetLibrary).catch(()=>{pending=null;return 0;});
 return pending;
}
export const libraryModel=index=>[...items.values()].find(i=>i.kind==='model'&&i.catalog_index===index);
export const libraryThumbnail=index=>{const i=libraryModel(index);return i&&i.status!=='deleted'?assetPath(i.files.thumbnail):null;};
export const libraryHidden=index=>['archived','deleted'].includes(libraryModel(index)?.status);
export function librarySwatch(kind,id){const item=items.get('legacy-'+kind+'-'+id);return item&&item.status!=='deleted'?assetPath(item.files.color):null;}
if(typeof document!=='undefined')void loadAssetLibrary();
