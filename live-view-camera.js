import * as THREE from './vendor/three.module.js';

// A first-person virtual camera follows the tablet's tracked world pose.
// Its FOV is independent of the tablet/XR projection. No room overview,
// secondary camera, video frame, tablet marker or depth mask is involved.
export class LiveViewCamera{
 constructor(studio,{fov=92}={}){
  this.studio=studio;this.pose=null;this.hasPose=false;this.fov=fov;
  this.currentPosition=new THREE.Vector3();this.previousPosition=new THREE.Vector3();
  this.currentQuaternion=new THREE.Quaternion();this.previousQuaternion=new THREE.Quaternion();
  this.predictedPosition=new THREE.Vector3();this.predictedQuaternion=new THREE.Quaternion();
  this.deltaPosition=new THREE.Vector3();this.floorMatrix=new THREE.Matrix4();
  this.lastArrival=0;this.sampleInterval=60;this.lastFrame=0;
  this.previousFrame=studio.onFrame;
  studio.onFrame=(time,frame)=>{this.tick(time);this.previousFrame?.(time,frame);};
  this.setFov(fov);
 }
 setFov(degrees){
  this.fov=Math.max(65,Math.min(110,Number(degrees)||92));
  const camera=this.studio.camera;camera.fov=this.fov;camera.zoom=1;camera.near=.02;camera.far=120;
  camera.updateProjectionMatrix();return this.fov;
 }
 reset(){this.pose=null;this.hasPose=false;this.lastArrival=0;this.lastFrame=0;}
 setPose(state){
  if(!Array.isArray(state?.position)||state.position.length!==3||!state.position.every(Number.isFinite)||!Array.isArray(state.quaternion)||state.quaternion.length!==4||!state.quaternion.every(Number.isFinite))return false;
  const now=performance.now(),first=!this.hasPose;
  if(!first){
   this.previousPosition.copy(this.currentPosition);this.previousQuaternion.copy(this.currentQuaternion);
   const interval=now-this.lastArrival;
   if(Number.isFinite(interval)&&interval>=12&&interval<400)this.sampleInterval=THREE.MathUtils.lerp(this.sampleInterval,interval,.25);
  }
  this.currentPosition.fromArray(state.position);this.currentQuaternion.fromArray(state.quaternion).normalize();
  this.pose=state;this.lastArrival=now;this.hasPose=true;
  if(Array.isArray(state.floorPose)&&state.floorPose.length===16&&state.floorPose.every(Number.isFinite)){
   this.floorMatrix.fromArray(state.floorPose).decompose(this.studio.floorFrame.position,this.studio.floorFrame.quaternion,this.studio.floorFrame.scale);
   this.studio.floorFrame.updateMatrixWorld(true);
  }
  this.studio.root.visible=true;
  if(first){
   this.previousPosition.copy(this.currentPosition);this.previousQuaternion.copy(this.currentQuaternion);
   this.studio.camera.position.copy(this.currentPosition);this.studio.camera.quaternion.copy(this.currentQuaternion);
   this.studio.camera.updateMatrixWorld(true);
  }
  return true;
 }
 tick(time=performance.now()){
  if(!this.hasPose)return;
  const dt=this.lastFrame?Math.min(50,Math.max(1,time-this.lastFrame)):16;
  this.lastFrame=time;
  const elapsed=Math.max(0,performance.now()-this.lastArrival);
  const lead=Math.min(55,elapsed);
  const interval=Math.max(20,this.sampleInterval);
  const delta=this.deltaPosition.subVectors(this.currentPosition,this.previousPosition);
  // Limit prediction after a noisy tracking jump; extrapolate at most 4 m/s.
  const maxStep=interval*.004;
  if(delta.length()>maxStep)delta.setLength(maxStep);
  this.predictedPosition.copy(this.currentPosition).addScaledVector(delta,lead/interval);
  this.predictedQuaternion.copy(this.previousQuaternion).slerp(this.currentQuaternion,Math.min(1.6,1+lead/interval));
  const alpha=1-Math.exp(-dt/36),camera=this.studio.camera;
  camera.position.lerp(this.predictedPosition,alpha);
  camera.quaternion.slerp(this.predictedQuaternion,alpha);
  camera.updateMatrixWorld(true);
 }
 dispose(){this.studio.onFrame=this.previousFrame;}
}
