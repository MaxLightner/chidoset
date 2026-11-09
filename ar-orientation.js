// Reflow the AR DOM overlay while WebXR keeps its active camera/session.
// No renderer restart or device orientation lock is necessary.
export function arLayoutOrientation({width,height,angle,type}={}){
 const w=Number(width),h=Number(height);
 if(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0){
  if(w>h+16)return 'landscape';
  if(h>w+16)return 'portrait';
 }
 if(/^landscape/.test(String(type||''))||angle===90||angle===270)return 'landscape';
 return 'portrait';
}

export function bindAROrientation(overlay,{view=window}={}){
 let frame=0,late=0;
 const update=()=>{
  frame=0;
  const viewport=view.visualViewport;
  const width=view.innerWidth||viewport?.width;
  const height=view.innerHeight||viewport?.height;
  const screen=view.screen?.orientation;
  const orientation=arLayoutOrientation({width,height,angle:screen?.angle,type:screen?.type});
  overlay.dataset.uiOrientation=orientation;
 };
 const queue=()=>{if(frame)return;frame=view.requestAnimationFrame(update);};
 const rotate=()=>{queue();view.clearTimeout(late);late=view.setTimeout(queue,180);};
 view.addEventListener('resize',queue,{passive:true});
 view.addEventListener('orientationchange',rotate,{passive:true});
 view.visualViewport?.addEventListener('resize',queue,{passive:true});
 view.screen?.orientation?.addEventListener?.('change',rotate);
 update();
 return ()=>{
  view.removeEventListener('resize',queue);
  view.removeEventListener('orientationchange',rotate);
  view.visualViewport?.removeEventListener('resize',queue);
  view.screen?.orientation?.removeEventListener?.('change',rotate);
  view.clearTimeout(late);if(frame)view.cancelAnimationFrame(frame);
 };
}
