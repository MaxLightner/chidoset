import * as THREE from './vendor/three.module.js';
import {CATALOG} from './catalog-data.js?v=0.16.16';
export {CATALOG};
export const wrappedAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function pairAngle(a,b){return Math.atan2(-(b.z-a.z),b.x-a.x);}
export class SpatialState{
 constructor(){this.origin=new THREE.Vector3();this.anchorYaw=0;this.heightOffset=0;this.locked=true;this.a=new THREE.Vector3(0,0,.7);this.b=new THREE.Vector3(4,0,.7);this.correction=1;this.actualLength=null;this.layoutOffset=new THREE.Vector3();this.layoutYaw=0;}
 get length(){return this.a.distanceTo(this.b);}
 get yaw(){return pairAngle(this.a,this.b);}
 get height(){return this.origin.y+this.heightOffset;}
 get plane(){return new THREE.Plane(new THREE.Vector3(0,1,0),-this.height);}
 lock(point){this.origin.copy(point);this.anchorYaw=0;this.locked=true;}
 setAnchorTranslation(point,yaw=this.anchorYaw){if(this.locked){this.origin.copy(point);if(Number.isFinite(yaw))this.anchorYaw=yaw;}}
 setHeight(meters){if(!Number.isFinite(meters)||Math.abs(meters)>2)throw Error('اصلاح ارتفاع باید بین ۲۰۰− و ۲۰۰ سانتی‌متر باشد.');this.heightOffset=meters;}
 moveA(point){const delta=point.clone().sub(this.a);delta.y=0;this.a.add(delta);this.b.add(delta);this.layoutOffset.add(delta);}
 moveB(point){const next=point.clone();next.y=0;if(next.distanceTo(this.a)<.1||next.distanceTo(this.a)>20)return false;const before=this.yaw;this.b.copy(next);const change=wrappedAngle(this.yaw-before),c=Math.cos(change),s=Math.sin(change),dx=this.layoutOffset.x-this.a.x,dz=this.layoutOffset.z-this.a.z;this.layoutOffset.set(this.a.x+dx*c+dz*s,0,this.a.z-dx*s+dz*c);this.layoutYaw+=change;return true;}
 calibrate(actualMeters){if(!Number.isFinite(actualMeters)||actualMeters<.1||actualMeters>20)throw Error('طول واقعی را بین ۱۰ و ۲۰۰۰ سانتی‌متر وارد کن.');
  // If XR reports m units for a real r-meter span, a nominal P-meter product needs P*m/r XR units.
  const scale=this.length/actualMeters;if(!Number.isFinite(scale)||scale<=0)throw Error('ضریب اندازه معتبر نیست.');const change=scale/this.correction;this.layoutOffset.x=this.a.x+(this.layoutOffset.x-this.a.x)*change;this.layoutOffset.z=this.a.z+(this.layoutOffset.z-this.a.z)*change;this.correction=scale;this.actualLength=actualMeters;return scale;
 }
 resetCalibration(){const change=1/this.correction;this.layoutOffset.x=this.a.x+(this.layoutOffset.x-this.a.x)*change;this.layoutOffset.z=this.a.z+(this.layoutOffset.z-this.a.z)*change;this.correction=1;this.actualLength=null;}
 apply(floorFrame,layout){floorFrame.position.copy(this.origin);floorFrame.position.y+=this.heightOffset;floorFrame.rotation.set(0,this.anchorYaw,0);layout.position.copy(this.layoutOffset);layout.rotation.set(0,this.layoutYaw,0);layout.scale.setScalar(this.correction);floorFrame.updateMatrixWorld(true);}
 snapshot(){return {a:this.a.toArray(),b:this.b.toArray(),correction:this.correction,actualLength:this.actualLength,heightOffset:this.heightOffset,layoutOffset:this.layoutOffset.toArray(),layoutYaw:this.layoutYaw};}
 restore(state){if(!state)return;this.a.fromArray(state.a);this.b.fromArray(state.b);this.correction=state.correction;this.actualLength=state.actualLength;this.heightOffset=state.heightOffset;this.layoutOffset.fromArray(state.layoutOffset||state.a||[0,0,0]);this.layoutYaw=state.layoutYaw??this.yaw;}
}
