const DRAFT='chido:draft:v1';
const SAVED='chido:custom-layouts:v1';
const safeJSON=(store,key)=>{try{return JSON.parse(store.getItem(key)||'null');}catch{return null;}};
const validScene=scene=>scene&&typeof scene==='object'&&Array.isArray(scene.items)&&scene.items.length<=64&&scene.spatial;
export function readDraft(store=globalThis.localStorage){
 const v=safeJSON(store,DRAFT);
 if(!v||!validScene(v.scene)||!Number.isFinite(v.updatedAt))return null;
 return v;
}
export function saveDraft({scene,room,layout,capacity,style,theme},store=globalThis.localStorage){
 if(!validScene(scene))throw Error('Invalid scene');
 const item={scene,room,layout,capacity,style,theme,updatedAt:Date.now()};
 store.setItem(DRAFT,JSON.stringify(item));return item;
}
export function clearDraft(store=globalThis.localStorage){store.removeItem(DRAFT);}
export function listCustomLayouts(store=globalThis.localStorage){
 const v=safeJSON(store,SAVED);
 return Array.isArray(v)?v.filter(x=>x&&validScene(x.scene)&&x.id&&x.name).slice(0,24):[];
}
export function saveCustomLayout({name,scene,room,layout,capacity,style,theme},store=globalThis.localStorage){
 if(!validScene(scene))throw Error('Invalid scene');
 const cleaned=String(name||'چیدمان دلخواه').trim().slice(0,70);
 const array=listCustomLayouts(store);const id='layout-'+Date.now()+'-'+Math.floor(Math.random()*10000);
 const item={id,name:cleaned,scene,room,layout,capacity,style,theme,createdAt:Date.now()};
 array.unshift(item);store.setItem(SAVED,JSON.stringify(array.slice(0,24)));return item;
}
export function removeCustomLayout(id,store=globalThis.localStorage){
 const items=listCustomLayouts(store).filter(x=>x.id!==id);store.setItem(SAVED,JSON.stringify(items));return items;
}

export function overwriteCustomLayout(id,record,store=globalThis.localStorage){
 const items=listCustomLayouts(store),index=items.findIndex(x=>x.id===id);
 if(index<0||!validScene(record.scene))throw Error('Saved layout not found');
 const old=items[index];items[index]={...old,...record,id:old.id,name:String(record.name||old.name).trim().slice(0,70),createdAt:old.createdAt,updatedAt:Date.now()};
 store.setItem(SAVED,JSON.stringify(items));return items[index];
}
