import * as THREE from './vendor/three.module.js';
import {loadEnvironmentHDR} from './environment-hdr.js';
export class EnvironmentEffects{
 constructor(scene,renderer){this.scene=scene;this.renderer=renderer;this.occlusionMesh=null;this.hemi=new THREE.HemisphereLight(0xffffff,0x817362,2.2);this.sun=new THREE.DirectionalLight(0xfff7e8,2.5);this.sun.position.set(2,4,3);scene.add(this.hemi,this.sun);this.shadowDirection=new THREE.Vector3(2,4,3).normalize();this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-5;this.sun.shadow.camera.right=5;this.sun.shadow.camera.top=5;this.sun.shadow.camera.bottom=-5;this.sun.shadow.camera.near=.05;this.sun.shadow.camera.far=20;this.sun.shadow.normalBias=.018;this.sun.shadow.bias=-.0001;this.sun.shadow.radius=2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;this.reset();this.loadIBL();}
 async loadIBL(){try{const texture=await loadEnvironmentHDR();if(!this.renderer)return texture.dispose();this.environmentTexture?.dispose();this.environmentTexture=texture;this.scene.environment=texture;this.scene.environmentIntensity=.42;this.hemi.intensity=.65;this.sun.intensity=1.6;}catch(error){console.warn('Chido IBL unavailable; using direct lights',error);}}
 updateShadowAnchor(anchor){if(!anchor)return;this.sun.target.position.copy(anchor);this.sun.position.copy(anchor).addScaledVector(this.shadowDirection,6);this.sun.target.updateMatrixWorld(true);}
 reset(){if(this.occlusionMesh){if(this.occlusionMesh.isObject3D)this.scene.remove(this.occlusionMesh);this.occlusionMesh.visible=false;this.occlusionMesh=null;}this.session=null;this.probe=null;this.lightState='ثابت';this.depthState='خاموش';this.lastLight=0;this.slowSince=null;this.depthDisabled=false;this.hemi.intensity=this.environmentTexture?.userData?.chidoHDR?.65:2.2;this.sun.intensity=this.environmentTexture?.userData?.chidoHDR?1.6:2.5;this.sun.color.set(0xfff7e8);}
 async start(session,options){this.reset();this.session=session;this.options=options;if(options.depth)this.depthState=session.enabledFeatures?.includes('depth-sensing')?'در انتظار داده':'پشتیبانی نشد';
  if(options.light&&session.requestLightProbe){try{const probe=await session.requestLightProbe();if(this.session!==session)return;this.probe=probe;this.lightState='در انتظار نور';}catch{if(this.session===session)this.lightState='ثابت (fallback)';}}
 }
 update(frame,time,fps){
  if(this.probe&&time-this.lastLight>120){this.lastLight=time;try{const estimate=frame.getLightEstimate(this.probe);if(estimate){const i=estimate.primaryLightIntensity,max=Math.max(i.x,i.y,i.z,1);this.sun.color.setRGB(i.x/max,i.y/max,i.z/max);this.sun.intensity=THREE.MathUtils.clamp(max,.3,4);const d=estimate.primaryLightDirection;this.shadowDirection.set(d.x,d.y,d.z).normalize();this.hemi.intensity=this.environmentTexture?.65:1.5;this.lightState='تخمین محیط';}}catch{this.probe=null;this.lightState='ثابت (fallback)';}}
  if(this.options?.depth&&this.session?.enabledFeatures?.includes('depth-sensing')){
   try{
    const hasDepth=this.renderer.xr.hasDepthSensing?.()??true;
    const mesh=hasDepth?this.renderer.xr.getDepthSensingMesh?.():null;
    if(mesh){
     if(fps>0&&fps<24){this.slowSince??=time;if(time-this.slowSince>3000)this.depthDisabled=true;}else this.slowSince=null;
     if(this.occlusionMesh!==mesh){if(this.occlusionMesh?.isObject3D)this.scene.remove(this.occlusionMesh);this.occlusionMesh=mesh;if(mesh.isObject3D)this.scene.add(mesh);}
     mesh.renderOrder=-100;if(mesh.material){mesh.material.depthTest=true;mesh.material.depthWrite=true;mesh.material.colorWrite=false;}
     mesh.visible=!this.depthDisabled;
     this.depthState=this.depthDisabled?'خاموش (افت سرعت)':'عمق فعال (در انتظار آزمون پوشانندگی)';
    }else this.depthState='در انتظار داده عمق';
   }catch{this.depthState='پشتیبانی یا اجرا ناموفق';}
  }
 }
}
