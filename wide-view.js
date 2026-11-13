import {rendererPolicy} from './renderer-policy.js';
import * as THREE from './vendor/three.module.js';

// Horizontal FOV values. They describe a virtual perspective, not a phone lens.
export const WIDE_VIEW_FOV=Object.freeze({normal:60,wide:84,ultra:100});
// The physical portrait viewport makes a 100-degree horizontal view almost 138 degrees tall.
// Limit only the *virtual vertical framing* in Natural mode; never stretch the geometry.
export const NATURAL_VERTICAL_CAP=Object.freeze({normal:98,wide:110,ultra:120});

export function verticalFovFromHorizontal(horizontalDegrees,aspect){
 if(!Number.isFinite(horizontalDegrees)||horizontalDegrees<=0||horizontalDegrees>=180||
    !Number.isFinite(aspect)||aspect<=0)throw RangeError('Invalid field of view or aspect ratio');
 return THREE.MathUtils.radToDeg(2*Math.atan(
  Math.tan(THREE.MathUtils.degToRad(horizontalDegrees)/2)/aspect));
}

// Preserve exact horizontal FOV when Natural is off or in landscape.
// On a portrait screen, Natural mode sacrifices some horizontal coverage to keep a
// rectilinear, undistorted image and a less extreme vertical perspective.
export function wideViewProjection(mode,aspect,natural=true){
 if(!Object.hasOwn(WIDE_VIEW_FOV,mode))throw RangeError('Invalid Wide View mode');
 const requestedHorizontal=WIDE_VIEW_FOV[mode];
 const requestedVertical=verticalFovFromHorizontal(requestedHorizontal,aspect);
 const vertical=natural&&aspect<1?Math.min(requestedVertical,NATURAL_VERTICAL_CAP[mode]):requestedVertical;
 const horizontal=THREE.MathUtils.radToDeg(2*Math.atan(
  Math.tan(THREE.MathUtils.degToRad(vertical)/2)*aspect));
 return {horizontal,vertical,requestedHorizontal,limited:vertical<requestedVertical-1e-7};
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
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  // Match Gemini's color pipeline and physically based soft shadows in the
  // virtual tracked view. This renderer never replaces the XR pose source.
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ReinhardToneMapping;
  this.renderer.toneMappingExposure=1.45;
  this.renderer.shadowMap.enabled=true;
  this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.setPixelRatio(Math.min(1.25,rendererPolicy({coarse:!!globalThis.matchMedia?.('(pointer:coarse)').matches,pixelRatio:window.devicePixelRatio||1}).pixelRatio));
  this.renderer.setClearColor('#e9e8e2',1);
  this.canvas=this.renderer.domElement;
  this.canvas.className='wide-view-canvas';
  this.canvas.setAttribute('aria-hidden','true');
  this.canvas.hidden=true;
  overlay.insertBefore(this.canvas,overlay.querySelector('#arSurface'));
  this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;});
  this.mode='ar';this.natural=true;this.width=0;this.height=0;this.active=false;this.lost=false;
  this.horizontalFov=0;this.verticalFov=0;this.limited=false;
  this.canvas.addEventListener('webglcontextlost',event=>{
   event.preventDefault();this.lost=true;this.disable();
   this.onFailure?.('مرورگر بافت گرافیکی نمای واید را از دست داد. به AR معمولی برگشتیم.');
  });
 }
 setMode(mode,{natural=true}={}){
  if(!Object.hasOwn(WIDE_VIEW_FOV,mode)||this.lost)throw Error('Wide View is unavailable');
  this.mode=mode;this.natural=natural;this.active=true;this.canvas.hidden=false;
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
  const projection=wideViewProjection(this.mode,this.camera.aspect,this.natural);
  const changed=Math.abs(this.horizontalFov-projection.horizontal)>.05||
   Math.abs(this.verticalFov-projection.vertical)>.05||this.limited!==projection.limited;
  this.horizontalFov=projection.horizontal;this.verticalFov=projection.vertical;
  this.limited=projection.limited;
  this.camera.fov=projection.vertical;
  this.camera.updateProjectionMatrix();
  if(changed)this.onProjectionChange?.(projection);
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
