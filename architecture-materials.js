import * as THREE from './vendor/three.module.js';
import {geminiFloorMaterial,geminiPlasterMaterial} from './gemini-room-materials.js?v=0.18.8';

// Stable procedural, tileable colour and tangent-space normal maps.
// Floor UVs are real world metres: one ceramic repeat = exactly 1 m × 1 m.
export const FLOOR_FINISHES=Object.freeze([
 {id:'parquet-oak',label:'پارکت بلوط · Gemini',kind:'gemini-floor',geminiKey:'oak',color:[201,162,118],roughness:.44},
 {id:'parquet-walnut',label:'پارکت گردو · Gemini',kind:'gemini-floor',geminiKey:'walnut',color:[109,71,48],roughness:.42},
 {id:'stone-marble',label:'سنگ مرمر · Gemini',kind:'gemini-floor',geminiKey:'marble',color:[236,234,228],roughness:.22},
 {id:'polished-concrete',label:'بتن صیقلی · Gemini',kind:'gemini-floor',geminiKey:'concrete',color:[156,163,175],roughness:.55},
 {id:'ceramic-cream',label:'سرامیک کرم روشن',kind:'ceramic',color:[229,218,198],roughness:.27},
 {id:'ceramic-white',label:'سرامیک سفید',kind:'ceramic',color:[239,237,228],roughness:.22},
 {id:'ceramic-grey',label:'سرامیک خاکستری مات',kind:'ceramic',color:[176,176,171],roughness:.48},
 {id:'carpet-petrol',label:'موکت آبی نفتی',kind:'carpet',color:[35,78,87],roughness:.95},
 {id:'carpet-olive',label:'موکت زیتونی',kind:'carpet',color:[91,100,62],roughness:.94},
 {id:'carpet-burgundy',label:'موکت عنابی',kind:'carpet',color:[114,52,63],roughness:.94}
]);
export const WALL_FINISHES=Object.freeze([
 {id:'gemini-wall-warm',label:'سفید گچی گرم · Gemini',kind:'gemini-wall',color:[244,239,230],hex:'#f4efe6',roughness:.86},
 {id:'gemini-wall-cream',label:'کرم استخوانی · Gemini',kind:'gemini-wall',color:[232,222,203],hex:'#e8decb',roughness:.86},
 {id:'gemini-wall-grey',label:'طوسی روشن · Gemini',kind:'gemini-wall',color:[216,218,223],hex:'#d8dadf',roughness:.86},
 {id:'gemini-wall-beige',label:'بژ سنگی · Gemini',kind:'gemini-wall',color:[213,207,194],hex:'#d5cfc2',roughness:.86},
 {id:'gemini-wall-sage',label:'سبز مریم‌گلی · Gemini',kind:'gemini-wall',color:[207,216,207],hex:'#cfd8cf',roughness:.86},
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
 if(finish.kind==='gemini-floor')return geminiFloorMaterial(finish.geminiKey);
 if(finish.kind==='gemini-wall')return geminiPlasterMaterial(finish.hex);
 const maps=finishTextures(finish.id);
 const tile=finish.kind==='ceramic';
 const material=new THREE.MeshPhysicalMaterial({
  ...maps,color:0xffffff,roughness:finish.kind==='carpet'?1:finish.roughness,metalness:0,ior:1.5,
  specularIntensity:finish.kind==='carpet'?0:1,
  clearcoat:tile ? .72 : 0,clearcoatRoughness:tile ? .27 : 1,
  normalScale:new THREE.Vector2(finish.kind==='carpet' ? .85 : .38,finish.kind==='carpet' ? .85 : .38),
  side:THREE.DoubleSide,transparent:false,depthWrite:true,envMapIntensity:finish.kind==='carpet'?0:tile?1.65:.75
 });
 if(finish.kind==='carpet'){
  material.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
    'outgoingLight *= 1.0 - 0.12 * pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=> 'chido-carpet-dark-grazing-v1';
 }
 return material;
}
// Preview is generated from the very same procedural texture, no external image requests.
export function finishPreviewDataUrl(id){
 if(typeof document==='undefined')return '';
 const finish=[...FLOOR_FINISHES,...WALL_FINISHES].find(x=>x.id===id)||FLOOR_FINISHES[0];
 if(finish.kind.startsWith('gemini-')){
  const material=finishMaterial(id),canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.drawImage(material.map.image,0,0,64,64);
  if(finish.kind==='gemini-wall'){ctx.globalCompositeOperation='multiply';ctx.fillStyle=finish.hex;ctx.fillRect(0,0,64,64);ctx.globalCompositeOperation='source-over';}
  material.dispose();return canvas.toDataURL('image/png');
 }
 const {map}=finishTextures(id),c=document.createElement('canvas');c.width=c.height=64;
 const ctx=c.getContext('2d'),raw=map.image.data,src=new ImageData(new Uint8ClampedArray(raw),256,256);
 const tmp=document.createElement('canvas');tmp.width=tmp.height=256;tmp.getContext('2d').putImageData(src,0,0);
 ctx.drawImage(tmp,0,0,64,64);return c.toDataURL('image/png');
}

// Room floors share metre-accurate texture density regardless of room dimensions.
// The canvas pattern itself may repeat multiple times, so compensate for its
// texture.repeat values when writing UVs; do not mutate cached texture objects.
export const FLOOR_TILE_METERS=Object.freeze({
 'parquet-oak':.72,'parquet-walnut':.72,
 'stone-marble':1.2,'polished-concrete':.9,
 'ceramic-cream':1,'ceramic-white':1,'ceramic-grey':1,
 'carpet-petrol':.4,'carpet-olive':.4,'carpet-burgundy':.4
});
export function applyMetricFloorUV(geometry,finishId,material){
 const position=geometry?.getAttribute?.('position'),uv=geometry?.getAttribute?.('uv');
 if(!position||!uv)return geometry;
 const period=FLOOR_TILE_METERS[finishId]||1;
 const repeats=material?.map?.repeat;
 const sx=period*Math.max(.001,repeats?.x||1),sz=period*Math.max(.001,repeats?.y||1);
 for(let i=0;i<position.count;i++)uv.setXY(i,position.getX(i)/sx,position.getZ(i)/sz);
 uv.needsUpdate=true;return geometry;
}
