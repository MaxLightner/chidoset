// Bounded, local-only diagnostics. No scene, account, auth or network payloads.
const key='chido:runtime-health:v2';
export const DIAGNOSTIC_VERSION='0.13.5';
const read=()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.slice(-3):[];}catch{return [];}};
const previous=read();
const run={version:DIAGNOSTIC_VERSION,started:Date.now(),device:globalThis.navigator?.userAgent||'',events:[]};
let storageAvailable=true,installed=false;
const safe=value=>String(value||'').replace(/https?:\/\/[^\s)]+/g,url=>{const frame=url.match(/([\w.-]+\.m?js)(?:\?[^\s:]*)?:(\d+):(\d+)$/);return frame?frame[1]+':'+frame[2]+':'+frame[3]:'[url]';}).replace(/[\w.+-]+@[\w.-]+/g,'[email]').replace(/eyJ[\w.-]+/g,'[token]').replace(/(password|authorization|access_token|refresh_token)\s*[:=]\s*\S+/gi,'$1=[removed]').slice(0,1200);
export function recordRuntime(stage,renderer,details){
 try{
  const entry={stage,time:Date.now()};
  if(renderer){entry.textures=renderer.info?.memory?.textures||0;entry.geometries=renderer.info?.memory?.geometries||0;entry.programs=renderer.info?.programs?.length||0;entry.xr=!!renderer.xr?.isPresenting;}
  if(details)entry.detail=safe(details);
  run.events.push(entry);run.events=run.events.slice(-100);
  try{localStorage.setItem(key,JSON.stringify([...previous.slice(-2),run]));}catch{storageAvailable=false;}
 }catch{} // Diagnostics must never interrupt an exit or a renderer callback.
}
export function recordRuntimeError(stage,error){recordRuntime(stage,null,[error?.name,error?.message||error,error?.stack].filter(Boolean).join('\n'));}
export const runtimeHealth=()=>({version:DIAGNOSTIC_VERSION,storageAvailable,previous:previous.at(-1)?.events||[],current:[...run.events],runs:run.events.length?[...previous.slice(-2),run]:read()});
export function installRuntimeDiagnostics(){
 if(installed)return;installed=true;
 recordRuntime('page-start');
 window.addEventListener('error',event=>{
  if(event.target!==window){recordRuntime('resource-error',null,event.target?.tagName||'resource');return;}
  recordRuntimeError('javascript-error',event.error||event.message);
 },true);
 window.addEventListener('unhandledrejection',event=>recordRuntimeError('unhandled-rejection',event.reason));
 window.addEventListener('pagehide',event=>recordRuntime('page-hide',null,'persisted='+event.persisted));
 window.addEventListener('pageshow',event=>recordRuntime('page-show',null,'persisted='+event.persisted));
 document.addEventListener('visibilitychange',()=>recordRuntime('visibility',null,document.visibilityState));
}
