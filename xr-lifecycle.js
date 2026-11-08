// A device's end event can precede Three.js restoring its framebuffer.
export function bindXRExit(session,driver,finish,observe=()=>{}){
 let ended=false,finished=false,timer;
 const dispose=()=>{clearTimeout(timer);session.removeEventListener('end',onDeviceEnd);driver.removeEventListener('sessionend',onDriverEnd);};
 const check=()=>{if(finished||!ended)return;if(driver.isPresenting){timer=setTimeout(check,32);return;}finished=true;dispose();finish();};
 const note=stage=>{try{observe(stage);}catch{}};
 const onDeviceEnd=()=>{note('device-end-event');ended=true;queueMicrotask(check);};
 const onDriverEnd=()=>{note('renderer-end-event');ended=true;check();};
 session.addEventListener('end',onDeviceEnd,{once:true});driver.addEventListener('sessionend',onDriverEnd);
 return {dispose(){finished=true;dispose();}};
}
