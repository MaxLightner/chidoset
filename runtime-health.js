// Local-only lifecycle breadcrumbs survive a tab/process restart. No tokens or account data.
const key='chido:runtime-health:v1';
const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}};
const previous=read();let current=[];
export function recordRuntime(stage,renderer){
 const entry={stage,time:Date.now()};
 if(renderer){entry.textures=renderer.info?.memory?.textures||0;entry.geometries=renderer.info?.memory?.geometries||0;entry.programs=renderer.info?.programs?.length||0;entry.xr=!!renderer.xr?.isPresenting;}
 current=current.concat(entry).slice(-24);try{localStorage.setItem(key,JSON.stringify(current));}catch{}
}
export const runtimeHealth=()=>({previous,current:[...current]});
