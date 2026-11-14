import * as THREE from './vendor/three.module.js';
import {loadEnvironmentHDR} from './environment-hdr.js';
export class EnvironmentEffects{
 constructor(scene,renderer){this.scene=scene;this.renderer=renderer;this.hemi=new THREE.HemisphereLight(0xffffff,0x817362,2.2);this.sun=new THREE.DirectionalLight(0xfff7e8,2.5);this.sun.position.set(2,4,3);this.cameraFill=new THREE.DirectionalLight(0xffffff,1.1);this.cameraFill.castShadow=false;this.rim=new THREE.DirectionalLight(0xfff5e8,.75);this.rim.castShadow=false;this.lightDirection=new THREE.Vector3();scene.add(this.hemi,this.sun,this.cameraFill,this.cameraFill.target,this.rim,this.rim.target);this.shadowDirection=new THREE.Vector3(2,4,3).normalize();this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-9;this.sun.shadow.camera.right=9;this.sun.shadow.camera.top=9;this.sun.shadow.camera.bottom=-9;this.sun.shadow.camera.near=.05;this.sun.shadow.camera.far=30;this.sun.shadow.normalBias=.018;this.sun.shadow.bias=-.0001;this.sun.shadow.radius=2;if(renderer.shadowMap){renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ReinhardToneMapping;renderer.toneMappingExposure=1.15;this.reset();this.loadIBL();}
 setRealShadows(enabled){if(this.renderer?.shadowMap)this.renderer.shadowMap.enabled=!!enabled;}
 updateCameraLight(camera,focus){camera.getWorldPosition(this.cameraFill.position);camera.getWorldDirection(this.lightDirection);this.cameraFill.target.position.copy(this.cameraFill.position).add(this.lightDirection);this.cameraFill.target.updateMatrixWorld(true);if(focus)focus.getWorldPosition(this.rim.target.position);else this.rim.target.position.set(0,0,0);this.lightDirection.copy(this.cameraFill.position).sub(this.rim.target.position);this.lightDirection.y=0;if(this.lightDirection.lengthSq()<.001)this.lightDirection.set(0,0,1);else this.lightDirection.normalize();this.rim.position.copy(this.rim.target.position).addScaledVector(this.lightDirection,-4);this.rim.position.x+=2;this.rim.position.y+=3;this.rim.target.updateMatrixWorld(true);}
 dispose(){this.reset();this.environmentTexture?.dispose();this.environmentTexture=null;this.scene.environment=null;this.renderer=null;}
 async loadIBL(){try{const texture=await loadEnvironmentHDR();if(!this.renderer)return texture.dispose();this.environmentTexture?.dispose();this.environmentTexture=texture;this.scene.environment=texture;this.scene.environmentIntensity=this.scene.userData?.roomIblIntensity??.42;this.hemi.intensity=.65;this.sun.intensity=this.sunRoomDirection?4.8*(this.roomDaylight??1):1.6;}catch(error){console.warn('Chido IBL unavailable; using direct lights',error);}}
 setRoomSun(plan,root){
  const first=plan?.elements?.find(e=>e.type?.startsWith('win_'));
  this.roomSunWindow=first?.id||null;
  this.roomDaylight=plan?.roomLook?.daylight??1;
  this.sunRoomRoot=root||null;
  const outward={north:[0,0,-1],south:[0,0,1],west:[-1,0,0],east:[1,0,0]}[first?.wall];
  this.sunRoomDirection=outward?new THREE.Vector3(outward[0]*.82,1.35,outward[2]*.82).normalize():null;
  if(this.sunRoomDirection){
   this.sun.color.set(0xfff7e8);
   this.sun.intensity=(this.environmentTexture?1.6:2.5)*3*this.roomDaylight;
  }else this.sun.intensity=this.environmentTexture?1.6:2.5;
 }
 updateShadowAnchor(anchor){
  if(!anchor)return;
  if(this.sunRoomDirection){
   this.shadowDirection.copy(this.sunRoomDirection);
   if(this.sunRoomRoot){this.sunRoomRoot.updateWorldMatrix(true,false);this.shadowDirection.transformDirection(this.sunRoomRoot.matrixWorld);}
  }
  this.sun.target.position.copy(anchor);this.sun.position.copy(anchor).addScaledVector(this.shadowDirection,9);this.sun.target.updateMatrixWorld(true);
 }
 reset(){
  this.session=null;
  this.lightState='نور ثابت صحنه';
  this.depthState='غیرفعال';
  this.hemi.intensity=this.environmentTexture?.65:2.2;
  this.sun.intensity=(this.environmentTexture?1.6:2.5)*(this.sunRoomDirection?3*(this.roomDaylight??1):1);
  this.sun.color.set(0xfff7e8);
 }
 async start(session){this.reset();this.session=session;}
 update(){/* No WebXR light estimation or real-world depth occlusion. */}

}
