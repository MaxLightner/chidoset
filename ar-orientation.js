// Reflow the AR DOM overlay while WebXR keeps its active camera/session.
// No renderer restart or device orientation lock is necessary.
export function arLayoutOrientation({width,height,visualWidth,visualHeight,angle,type,legacyAngle}={}){
 // During immersive AR, the CSS viewport may briefly retain its old dimensions.
 // The operating-system orientation is a stronger signal when available.
 if(/^landscape/.test(String(type||''))||angle===90||angle===270||legacyAngle===90||legacyAngle===-90)return 'landscape';
 if(/^portrait/.test(String(type||''))||angle===0||angle===180||legacyAngle===0||legacyAngle===180)return 'portrait';
 const vw=Number(visualWidth),vh=Number(visualHeight);
 if(Number.isFinite(vw)&&Number.isFinite(vh)&&vw>0&&vh>0){
  if(vw>vh+16)return 'landscape';
  if(vh>vw+16)return 'portrait';
 }
 const w=Number(width),h=Number(height);
 if(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0){
  if(w>h+16)return 'landscape';
  if(h>w+16)return 'portrait';
 }
 return 'portrait';
}

export function bindAROrientation(overlay,{view=window}={}){
 let frame=0,late=0;
 const update=()=>{
  frame=0;
  const viewport=view.visualViewport;
  const screen=view.screen?.orientation;
  const orientation=arLayoutOrientation({width:view.innerWidth,height:view.innerHeight,
   visualWidth:viewport?.width,visualHeight:viewport?.height,
   angle:screen?.angle,type:screen?.type,legacyAngle:view.orientation});
  if(overlay.dataset.uiOrientation!==orientation)overlay.dataset.uiOrientation=orientation;
 };
 const queue=()=>{if(frame)return;frame=view.requestAnimationFrame(update);};
 const rotate=()=>{queue();view.clearTimeout(late);late=view.setTimeout(queue,180);};
 view.addEventListener('resize',queue,{passive:true});
 view.addEventListener('orientationchange',rotate,{passive:true});
 view.visualViewport?.addEventListener('resize',queue,{passive:true});
 view.screen?.orientation?.addEventListener?.('change',rotate);
 const observer=view.ResizeObserver?new view.ResizeObserver(queue):null;
 observer?.observe(overlay);
 const poll=view.setInterval?.(()=>{if(!overlay.hidden)queue();},500);
 update();
 return ()=>{
  view.removeEventListener('resize',queue);
  view.removeEventListener('orientationchange',rotate);
  view.visualViewport?.removeEventListener('resize',queue);
  view.screen?.orientation?.removeEventListener?.('change',rotate);
  observer?.disconnect();if(poll!==undefined)view.clearInterval(poll);
  view.clearTimeout(late);if(frame)view.cancelAnimationFrame(frame);
 };
}
