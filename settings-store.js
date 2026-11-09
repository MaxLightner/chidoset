// Versioned, device-local preferences. A future account adapter can implement the same get/set contract.
const KEY='chido:settings:v1';
export const DEFAULT_SETTINGS=Object.freeze({
 lighting:true,shadows:true,brightness:1,gamma:1,occlusion:true,grid:true,camera:true,units:'cm'
});
const limits={brightness:[.55,1.8],gamma:[.75,1.35]};
export function normalizeSettings(source={}){
 const value=source&&typeof source==='object'?source:{},s={...DEFAULT_SETTINGS};
 for(const key of ['lighting','shadows','occlusion','grid','camera'])if(typeof value[key]==='boolean')s[key]=value[key];
 for(const key of Object.keys(limits))if(Number.isFinite(Number(value[key])))s[key]=Math.min(limits[key][1],Math.max(limits[key][0],Number(value[key])));
 if(['cm','m','in'].includes(value.units))s.units=value.units;
 return s;
}
export function readSettings(store=globalThis.localStorage){try{return normalizeSettings(JSON.parse(store.getItem(KEY)||'{}'));}catch{return normalizeSettings();}}
export function saveSettings(next,store=globalThis.localStorage){const normalized=normalizeSettings(next);store.setItem(KEY,JSON.stringify(normalized));return normalized;}
export function displayDimension(meters,units='cm'){
 const n=Number(meters);
 if(!Number.isFinite(n))return '—';
 const factor=units==='m'?1:units==='in'?39.37007874015748:100;
 const v=n*factor;
 return new Intl.NumberFormat('fa-IR',{maximumFractionDigits:units==='m'?2:1}).format(v)+' '+(units==='m'?'متر':units==='in'?'اینچ':'سانتی‌متر');
}
