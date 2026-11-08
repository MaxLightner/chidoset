import * as THREE from './vendor/three.module.js';
export const SOFA_SHADOW_OPACITY=.30;
export const isSofaShadowProduct=(index,product)=>[0,1,3,22,23,24].includes(index)||product?.metadata?.kind==='sofa'||(product?.metadata?.category==='seating'&&/مبل|کاناپه|sofa/i.test(product.name||''));
// Material Lab v15: actual model footprint, oversized plane and a safe transparent border.
export function roundedShadowAlpha(x,z,width,depth){
 const radius=Math.min(width,depth)*.14,feather=Math.min(width,depth)*.28;
 const qx=Math.abs(x)-(width/2-radius),qz=Math.abs(z)-(depth/2-radius);
 const distance=Math.hypot(Math.max(qx,0),Math.max(qz,0))+Math.min(Math.max(qx,qz),0)-radius;
 const t=Math.max(0,Math.min(1,distance/feather));return SOFA_SHADOW_OPACITY*(1-t*t*(3-2*t));
}
export function modelLocalBounds(root,visual){
 root.updateWorldMatrix(true,true);const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),box=new THREE.Box3(),point=new THREE.Vector3();
 visual.traverse(node=>{if(!node.isMesh||!node.geometry||!node.visible)return;node.geometry.computeBoundingBox();const bounds=node.geometry.boundingBox;if(!bounds)return;const matrix=new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld);for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])box.expandByPoint(point.set(x,y,z).applyMatrix4(matrix));});
 return box;
}
export function createSofaShadow(width,depth,bottom,centerX=0,centerZ=0){
 const planeSize=new THREE.Vector2(width*2.4,depth*2.4);
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
  uniforms:{opacity:{value:SOFA_SHADOW_OPACITY},planeSize:{value:planeSize},halfSize:{value:new THREE.Vector2(width/2,depth/2)},radius:{value:Math.min(width,depth)*.14},feather:{value:Math.min(width,depth)*.28}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'precision highp float;varying vec2 vUv;uniform vec2 planeSize;uniform vec2 halfSize;uniform float radius;uniform float feather;uniform float opacity;void main(){vec2 p=(vUv-.5)*planeSize;vec2 q=abs(p)-(halfSize-vec2(radius));float d=length(max(q,0.))+min(max(q.x,q.y),0.)-radius;float alpha=opacity*(1.-smoothstep(0.,feather,d));if(alpha<.001)discard;gl_FragColor=vec4(0.,0.,0.,alpha);}'
 });
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(planeSize.x,planeSize.y),material);shadow.name='contact-shadow';shadow.rotation.x=-Math.PI/2;shadow.position.set(centerX,bottom+.008,centerZ);shadow.renderOrder=-1;shadow.userData.footprint=[width,depth];shadow.userData.labVersion=15;return shadow;
}
