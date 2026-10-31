import * as THREE from './vendor/three.module.js';

// Horizontal FOV values. They describe a virtual perspective, not a phone lens.
export const WIDE_VIEW_FOV=Object.freeze({normal:60,wide:84,ultra:100});

export function verticalFovFromHorizontal(horizontalDegrees,aspect){
 if(!Number.isFinite(horizontalDegrees)||horizontalDegrees<=0||horizontalDegrees>=180||
    !Number.isFinite(aspect)||aspect<=0)throw RangeError('Invalid field of view or aspect ratio');
 return THREE.MathUtils.radToDeg(2*Math.atan(
  Math.tan(THREE.MathUtils.degToRad(horizontalDegrees)/2)/aspect));
}

// XRView.transform is already expressed in the active XRReferenceSpace.
// Copy it without applying scene scale, translation, or an artificial camera offset.
export function copyTrackedView(camera,viewerPose){
 const view=viewerPose?.views?.find(v=>v.eye==='none')||viewerPose?.views?.[0];
 const transform=view?.transform||viewerPose?.transform;
 const p=transform?.position,q=transform?.orientation;
 if(!p||!q||![p.x,p.y,p.z,q.x,q.y,q.z,q.w].every(Number.isFinite))return false;
 camera.position.set(p.x,p.y,p.z);
 camera.quaternion.set(q.x,q.y,q.z,q.w);
 camera.updateMatrixWorld(true);
 return true;
}

export class WideViewRenderer{
 constructor(scene,overlay){
  if(!overlay)throw Error('Wide View requires an active DOM overlay');
  this.scene=scene;this.overlay=overlay;
  this.camera=new THREE.PerspectiveCamera(60,1,.03,40);
  this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
  this.renderer.setClearColor('#e9e8e2',1);
  this.canvas=this.renderer.domElement;
  this.canvas.className='wide-view-canvas';
  this.canvas.setAttribute('aria-hidden','true');
  this.canvas.hidden=true;
  overlay.insertBefore(this.canvas,overlay.querySelector('#arSurface'));
  this.mode='ar';this.width=0;this.height=0;this.active=false;this.lost=false;
  this.canvas.addEventListener('webglcontextlost',event=>{
   event.preventDefault();this.lost=true;this.disable();
   this.onFailure?.('مرورگر بافت گرافیکی نمای واید را از دست داد. به AR معمولی برگشتیم.');
  });
 }
 setMode(mode){
  if(!Object.hasOwn(WIDE_VIEW_FOV,mode)||this.lost)throw Error('Wide View is unavailable');
  this.mode=mode;this.active=true;this.canvas.hidden=false;
  this.resize(true);
 }
 resize(force=false){
  if(!this.active)return;
  const rect=this.overlay.getBoundingClientRect();
  const width=Math.max(1,Math.round(rect.width||window.innerWidth));
  const height=Math.max(1,Math.round(rect.height||window.innerHeight));
  if(force||width!==this.width||height!==this.height){
   this.width=width;this.height=height;
   this.camera.aspect=width/height;
   this.renderer.setSize(width,height,false);
  }
  // Keep horizontal FOV fixed, including when a phone changes orientation.
  this.camera.fov=verticalFovFromHorizontal(WIDE_VIEW_FOV[this.mode],this.camera.aspect);
  this.camera.updateProjectionMatrix();
 }
 updatePose(pose){return this.active&&copyTrackedView(this.camera,pose);}
 draw(){
  if(!this.active||this.lost)return;
  this.resize();
  this.renderer.render(this.scene,this.camera);
 }
 disable(){this.active=false;this.mode='ar';this.canvas.hidden=true;}
 dispose(){this.disable();this.renderer.dispose();this.canvas.remove();}
}
