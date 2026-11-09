import {lightweightPhoto} from './image-utils.js';
let database;
export function db(){if(database)return database;database=new Promise((resolve,reject)=>{const r=indexedDB.open('chido-gallery',1);r.onupgradeneeded=()=>r.result.createObjectStore('images',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('گالری در پنجرهٔ دیگری باز است؛ آن را ببند.'));});return database;}
async function transact(mode,action){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('images',mode);const request=action(tx.objectStore('images'));let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('ذخیره انجام نشد.'));});}
export const photos=()=>transact('readonly',s=>s.getAll());
export const removePhoto=id=>transact('readwrite',s=>s.delete(id));
export async function savePhoto(blob,kind){const photo=await lightweightPhoto(blob);return transact('readwrite',s=>s.put({id:crypto.randomUUID(),blob:photo,kind,date:Date.now()}));}
