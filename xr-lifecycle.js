// A device's end event can precede Three.js restoring its framebuffer.
export function bindXRExit(session,driver,finish){
 let ended=false,finished=false,timer;
 const dispose=()=>{clearTimeout(timer);session.removeEventListener('end',onDeviceEnd);driver.removeEventListener('sessionend',onDriverEnd);};
 const check=()=>{if(finished||!ended)return;if(driver.isPresenting){timer=setTimeout(check,32);return;}finished=true;dispose();finish();};
 const onDeviceEnd=()=>{ended=true;queueMicrotask(check);};
 const onDriverEnd=()=>{ended=true;check();};
 session.addEventListener('end',onDeviceEnd,{once:true});driver.addEventListener('sessionend',onDriverEnd);
 return {dispose(){finished=true;dispose();}};
}
export function releaseAfterPaint(release){
 let done=false;
 const run=()=>{if(done)return;done=true;clearTimeout(fallback);try{release();}catch(error){console.warn('Deferred scene cleanup',error);}};
 const fallback=setTimeout(run,500);
 if(globalThis.requestAnimationFrame)requestAnimationFrame(()=>requestAnimationFrame(run));
 else setTimeout(run,0);
}
