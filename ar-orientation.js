// Reflow the AR DOM overlay while WebXR keeps its active camera/session.
// No renderer restart or device orientation lock is necessary.
export function arLayoutOrientation({width,height,visualWidth,visualHeight,angle,type,legacyAngle,motionOrientation}={}){
 // Some AR browsers lock the reported screen orientation for an immersive session.
 // A stable gravity reading can still tell us which edge of the tablet is down.
 if(motionOrientation==='landscape'||motionOrientation==='portrait')return motionOrientation;
 const vw=Number(visualWidth),vh=Number(visualHeight);
 const w=Number(width),h=Number(height);
 const fromSize=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&a>0&&b>0
  ?a>b+16?'landscape':b>a+16?'portrait':null:null;
 const visual=fromSize(vw,vh),layout=fromSize(w,h);
 const device=/^landscape/.test(String(type||''))||angle===90||angle===270||legacyAngle===90||legacyAngle===-90?'landscape'
  :/^portrait/.test(String(type||''))||angle===0||angle===180||legacyAngle===0||legacyAngle===180?'portrait':null;
 // If both browser viewports actually rotated, don't let a stale WebXR screen lock veto them.
 if(visual&&visual===layout)return visual;
 // Conversely, the DOM viewport may lag while the device orientation changes.
 return device||visual||layout||'portrait';
}

export function bindAROrientation(overlay,{view=window}={}){
 let frame=0,late=0;
 let motionOrientation=null,motionCandidate=null,motionCount=0;
 const update=()=>{
  frame=0;
  const viewport=view.visualViewport;
  const screen=view.screen?.orientation;
  const orientation=arLayoutOrientation({width:view.innerWidth,height:view.innerHeight,
   visualWidth:viewport?.width,visualHeight:viewport?.height,
   angle:screen?.angle,type:screen?.type,legacyAngle:view.orientation,motionOrientation});
  if(overlay.dataset.uiOrientation!==orientation)overlay.dataset.uiOrientation=orientation;
 };
 const queue=()=>{if(frame)return;frame=view.requestAnimationFrame(update);};
 const rotate=()=>{
  // Let the platform orientation take over whenever it does report a rotation.
  motionOrientation=null;motionCandidate=null;motionCount=0;
  queue();view.clearTimeout(late);late=view.setTimeout(queue,180);
 };
 const motion=event=>{
  if(overlay.hidden)return;
  const gravity=event.accelerationIncludingGravity;
  if(!gravity)return;
  const x=Math.abs(Number(gravity.x)),y=Math.abs(Number(gravity.y)),z=Math.abs(Number(gravity.z));
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return;
  // Ignore flat poses, where gravity cannot distinguish portrait and landscape.
  if(Math.max(x,y)<5.5||Math.max(x,y)<z*1.1)return;
  const next=x>y*1.5?'landscape':y>x*1.5?'portrait':null;
  if(!next){motionCandidate=null;motionCount=0;return;}
  motionCount=next===motionCandidate?motionCount+1:1;motionCandidate=next;
  if(motionCount>=6&&motionOrientation!==next){motionOrientation=next;queue();}
 };
 view.addEventListener('resize',queue,{passive:true});
 view.addEventListener('orientationchange',rotate,{passive:true});
 view.addEventListener('devicemotion',motion,{passive:true});
 view.visualViewport?.addEventListener('resize',queue,{passive:true});
 view.screen?.orientation?.addEventListener?.('change',rotate);
 const observer=view.ResizeObserver?new view.ResizeObserver(queue):null;
 observer?.observe(overlay);
 const poll=view.setInterval?.(()=>{if(!overlay.hidden)queue();},500);
 update();
 return ()=>{
  view.removeEventListener('resize',queue);
  view.removeEventListener('orientationchange',rotate);
  view.removeEventListener('devicemotion',motion);
  view.visualViewport?.removeEventListener('resize',queue);
  view.screen?.orientation?.removeEventListener?.('change',rotate);
  observer?.disconnect();if(poll!==undefined)view.clearInterval(poll);
  view.clearTimeout(late);if(frame)view.cancelAnimationFrame(frame);
 };
}
