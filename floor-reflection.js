import * as THREE from './vendor/three.module.js';

// Low-resolution planar *screen reflection* of actual in-scene furniture.
// WebXR is rendered without postprocessing; this dedicated pass is throttled
// and disabled automatically if render-target creation fails.
export class FloorReflection {
 constructor(renderer,scene){
  this.renderer=renderer;this.scene=scene;this.target=new THREE.WebGLRenderTarget(384,384,{depthBuffer:true});
  this.camera=new THREE.PerspectiveCamera();this.texMatrix=new THREE.Matrix4();
  this.frame=0;this.busy=false;this.failed=false;this.surface=null;this.overlay=null;
  this.bias=new THREE.Matrix4().set(.5,0,0,.5, 0,.5,0,.5, 0,0,.5,.5, 0,0,0,1);
 }
 attach(surface,group){
  this.detach();if(!surface)return;
  this.surface=surface;
  const material=new THREE.ShaderMaterial({
   transparent:true,depthWrite:false,side:THREE.DoubleSide,
   uniforms:{tMirror:{value:this.target.texture},mirrorMatrix:{value:this.texMatrix},strength:{value:.34},texel:{value:1/384}},
   vertexShader:`uniform mat4 mirrorMatrix;varying vec4 projected;void main(){vec4 world=modelMatrix*vec4(position,1.0);projected=mirrorMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
   fragmentShader:`precision mediump float;uniform sampler2D tMirror;uniform float strength;uniform float texel;varying vec4 projected;
    void main(){vec2 uv=projected.xy/projected.w;
     if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0)discard;
     vec3 c=texture2D(tMirror,uv).rgb*.36;
     c+=texture2D(tMirror,uv+vec2(texel*1.5,0.0)).rgb*.16;
     c+=texture2D(tMirror,uv-vec2(texel*1.5,0.0)).rgb*.16;
     c+=texture2D(tMirror,uv+vec2(0.0,texel*1.5)).rgb*.16;
     c+=texture2D(tMirror,uv-vec2(0.0,texel*1.5)).rgb*.16;
     gl_FragColor=vec4(c,strength);
    }`
  });
  this.overlay=new THREE.Mesh(surface.geometry.clone(),material);
  this.overlay.position.copy(surface.position);this.overlay.position.y+=.009;
  this.overlay.renderOrder=surface.renderOrder+1;group.add(this.overlay);
  surface.onBeforeRender=(renderer,scene,camera)=>this.update(camera);
 }
 detach(){
  if(this.surface)this.surface.onBeforeRender=()=>{};
  if(this.overlay){this.overlay.parent?.remove(this.overlay);this.overlay.geometry.dispose();this.overlay.material.dispose();}
  this.surface=null;this.overlay=null;
 }
 update(camera){
  if(this.busy||this.failed||!this.surface||!this.overlay||++this.frame%3!==0)return;
  const renderer=this.renderer,base=camera.isArrayCamera?(camera.cameras?.[0]||camera):camera;
  if(!base?.isPerspectiveCamera)return;
  this.busy=true;
  const surface=this.surface,overlay=this.overlay,wasSurface=surface.visible,wasOverlay=overlay.visible;
  const previousXR=renderer.xr.enabled,previousTarget=renderer.getRenderTarget();
  try{
   const floorPoint=surface.getWorldPosition(new THREE.Vector3());
   const floorNormal=new THREE.Vector3(0,1,0).transformDirection(surface.matrixWorld).normalize();
   const camPos=base.getWorldPosition(new THREE.Vector3()),dir=base.getWorldDirection(new THREE.Vector3());
   const dist=camPos.clone().sub(floorPoint).dot(floorNormal);if(Math.abs(dist)<.05)return;
   const mirrorPos=camPos.clone().addScaledVector(floorNormal,-2*dist);
   const mirrorDir=dir.addScaledVector(floorNormal,-2*dir.dot(floorNormal));
   const mirrorUp=new THREE.Vector3(0,1,0).applyQuaternion(base.getWorldQuaternion(new THREE.Quaternion()));
   mirrorUp.addScaledVector(floorNormal,-2*mirrorUp.dot(floorNormal));
   const mirror=this.camera;
   mirror.position.copy(mirrorPos);mirror.up.copy(mirrorUp);mirror.lookAt(mirrorPos.clone().add(mirrorDir));mirror.updateMatrixWorld();
   mirror.projectionMatrix.copy(base.projectionMatrix);mirror.projectionMatrixInverse.copy(base.projectionMatrixInverse);
   this.texMatrix.copy(this.bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
   surface.visible=false;overlay.visible=false;renderer.xr.enabled=false;
   renderer.setRenderTarget(this.target);renderer.clear();renderer.render(this.scene,mirror);
  }catch(error){this.failed=true;console.warn('Chido floor reflection pass unavailable; IBL remains active',error);}
  finally{
   try{renderer.setRenderTarget(previousTarget);}catch{}
   renderer.xr.enabled=previousXR;surface.visible=wasSurface;overlay.visible=wasOverlay;this.busy=false;
  }
 }
 dispose(){this.detach();this.target.dispose();}
}
