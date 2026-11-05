// Counts payload bytes only; never retains URLs, request bodies or messages.
const keys=['http_sent','http_received','ws_sent','ws_received','requests','errors','model_loads','active_seconds'];
const blank=()=>Object.fromEntries(keys.map(k=>[k,0]));
const size=value=>typeof value==='string'?new TextEncoder().encode(value).length:value?.byteLength??value?.size??0;
let counters=blank(),config=null,pending=null,lastTick=Date.now(),sending=false;
const nativeFetch=globalThis.fetch?.bind(globalThis);
export function configureTelemetry(options){if(config?.userId!==options?.userId){counters=blank();pending=null;}config=options;}
function count(key,n){if(Number.isFinite(n)&&n>0)counters[key]+=Math.floor(n);}
if(nativeFetch&&globalThis.document){
 globalThis.fetch=async function(input,init){const url=String(input?.url||input);if(url.includes('/chido-metrics'))return nativeFetch(input,init);const track=!!config?.token;try{const response=await nativeFetch(input,init);if(track){count('requests',1);count('http_sent',size(init?.body));if(!response.ok)count('errors',1);if(/\.glb(?:[?#]|$)/i.test(url)&&response.ok)count('model_loads',1);if(response.body){const reader=response.clone().body.getReader();void(async()=>{try{for(;;){const r=await reader.read();if(r.done)break;count('http_received',r.value.byteLength);}}catch{}finally{reader.releaseLock();}})();}}return response;}catch(e){if(track){count('requests',1);count('errors',1);}throw e;}};
 const NativeWebSocket=globalThis.WebSocket;
 if(NativeWebSocket){globalThis.WebSocket=class extends NativeWebSocket{constructor(...args){super(...args);this.addEventListener('message',e=>{if(config?.token)count('ws_received',size(e.data));});}send(value){super.send(value);if(config?.token)count('ws_sent',size(value));}};}
 setInterval(()=>{const now=Date.now();if(config?.token&&document.visibilityState==='visible')count('active_seconds',Math.min(5,(now-lastTick)/1000));lastTick=now;},5000);
 setInterval(()=>void flushTelemetry(),30000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flushTelemetry(true);});
 globalThis.addEventListener('pagehide',()=>void flushTelemetry(true));
}
export async function flushTelemetry(keepalive=false){if(sending||!config?.token)return;const c=config; if(!pending){if(!keys.some(k=>counters[k]))return;pending={id:crypto.randomUUID(),client:c.client,...counters};counters=blank();}sending=true;try{const response=await nativeFetch(c.url,{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify(pending),keepalive});if(response.ok||[400,401,403,413].includes(response.status))pending=null;}catch{}finally{sending=false;}}
