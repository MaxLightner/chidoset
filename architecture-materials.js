import * as THREE from './vendor/three.module.js';

// Stable procedural, tileable colour and tangent-space normal maps.
// Floor UVs are real world metres: one ceramic repeat = exactly 1 m × 1 m.
export const FLOOR_FINISHES=Object.freeze([
 {id:'ceramic-cream',label:'سرامیک کرم روشن',kind:'ceramic',color:[229,218,198],roughness:.27},
 {id:'ceramic-white',label:'سرامیک سفید',kind:'ceramic',color:[239,237,228],roughness:.22},
 {id:'ceramic-grey',label:'سرامیک خاکستری مات',kind:'ceramic',color:[176,176,171],roughness:.48},
 {id:'carpet-petrol',label:'موکت آبی نفتی',kind:'carpet',color:[35,78,87],roughness:.95},
 {id:'carpet-olive',label:'موکت زیتونی',kind:'carpet',color:[91,100,62],roughness:.94},
 {id:'carpet-burgundy',label:'موکت عنابی',kind:'carpet',color:[114,52,63],roughness:.94}
]);
export const WALL_FINISHES=Object.freeze([
 {id:'wall-ivory',label:'سفید استخوانی',kind:'wall',color:[231,225,211],roughness:.88},
 {id:'wall-cream',label:'کرم روشن',kind:'wall',color:[219,204,181],roughness:.88},
 {id:'wall-grey',label:'خاکستری گرم',kind:'wall',color:[184,182,175],roughness:.90},
 {id:'wall-white',label:'سفید',kind:'wall',color:[239,238,231],roughness:.89}
]);
export const floorFinish=id=>FLOOR_FINISHES.find(x=>x.id===id)||FLOOR_FINISHES[0];
export const wallFinish=id=>WALL_FINISHES.find(x=>x.id===id)||WALL_FINISHES[0];
const cache=new Map();
const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
const hash=(x,y,s)=>{let n=Math.imul(x+1,374761393)^Math.imul(y+1,668265263)^Math.imul(s+1,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
function textureData(finish){
 const n=256,colors=new Uint8Array(n*n*4),height=new Float32Array(n*n);
 const ceramic=finish.kind==='ceramic',carpet=finish.kind==='carpet';
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const k=y*n+x,q=k*4;
  // Non-periodic-looking but seam-safe micro-details: no broad gradients at tile edges.
  const grain=hash(x,y,7)-.5;
  const fiber=hash(x>>1,y>>1,13)-.5;
  const hair=carpet?Math.sin((x*.7+y*.47))*1.5:0;
  const line=carpet?Math.sin((x%4)*Math.PI/2)*1.3:0;
  const grout=ceramic&&(x<3||y<3||x>n-4||y>n-4);
  const tint=ceramic?grain*8+fiber*4:carpet?grain*19+fiber*14+hair+line:grain*9+fiber*2;
  const dim=grout?-.20:1;
  for(let channel=0;channel<3;channel++)colors[q+channel]=clamp((finish.color[channel]+tint)*dim);
  colors[q+3]=255;
  height[k]=grout?-.55:ceramic?grain*.12+fiber*.05:carpet?grain*.42+fiber*.23+line*.03:grain*.06;
 }
 const normals=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,q=i*4,xm=y*n+(x+n-1)%n,xp=y*n+(x+1)%n,ym=((y+n-1)%n)*n+x,yp=((y+1)%n)*n+x;
  const slope=carpet?2.2:ceramic?1.8:.8;
  const nx=(height[xm]-height[xp])*slope,ny=(height[ym]-height[yp])*slope,inv=1/Math.hypot(nx,ny,1);
  normals[q]=clamp((nx*inv*.5+.5)*255);normals[q+1]=clamp((ny*inv*.5+.5)*255);normals[q+2]=clamp((inv*.5+.5)*255);normals[q+3]=255;
 }
 return {colors,normals,n};
}
function makeTexture(data,n,color){
 const texture=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
 texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=4;texture.needsUpdate=true;
 return texture;
}
export function finishTextures(id){
 if(cache.has(id))return cache.get(id);
 const finish=[...FLOOR_FINISHES,...WALL_FINISHES].find(x=>x.id===id)||FLOOR_FINISHES[0];
 const {colors,normals,n}=textureData(finish);
 const maps={map:makeTexture(colors,n,true),normalMap:makeTexture(normals,n,false)};
 cache.set(id,maps);return maps;
}
export function finishMaterial(id){
 const finish=[...FLOOR_FINISHES,...WALL_FINISHES].find(x=>x.id===id)||FLOOR_FINISHES[0];
 const maps=finishTextures(finish.id);
 const tile=finish.kind==='ceramic';
 return new THREE.MeshPhysicalMaterial({
  ...maps,color:0xffffff,roughness:finish.roughness,metalness:0,ior:1.5,
  clearcoat:tile ? .72 : 0,clearcoatRoughness:tile ? .27 : 1,
  normalScale:new THREE.Vector2(finish.kind==='carpet' ? .85 : .38,finish.kind==='carpet' ? .85 : .38),
  side:THREE.DoubleSide,transparent:false,depthWrite:true,envMapIntensity:tile?1.65:.75
 });
}
// Preview is generated from the very same procedural texture, no external image requests.
export function finishPreviewDataUrl(id){
 if(typeof document==='undefined')return '';
 const {map}=finishTextures(id),c=document.createElement('canvas');c.width=c.height=64;
 const ctx=c.getContext('2d'),raw=map.image.data,src=new ImageData(new Uint8ClampedArray(raw),256,256);
 const tmp=document.createElement('canvas');tmp.width=tmp.height=256;tmp.getContext('2d').putImageData(src,0,0);
 ctx.drawImage(tmp,0,0,64,64);return c.toDataURL('image/png');
}
