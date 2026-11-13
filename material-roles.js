import {librarySwatch,librarySwatchThumbnail} from './asset-library.js?v=0.16.23';
import * as THREE from './vendor/three.module.js';
export const MATERIAL_ROLES=['fabric','wood','metal','glass'];
const SUPPORTED_ROLES=[...MATERIAL_ROLES,'detail'];
export const ROLE_LABELS={fabric:'پارچه',wood:'چوب',metal:'فلز',glass:'شیشه'};
export function materialRole(name){const lower=String(name||'').toLowerCase(),matches=MATERIAL_ROLES.filter(role=>lower.includes(role));if(!matches.length&&lower.includes('body'))return 'wood';if(!matches.length&&lower.includes('detail'))return 'detail';return matches.length===1?matches[0]:null;}
const fabricPresets=[['dark','آبی تیره'],['creme','کرم'],['gray','خاکستری']].map(([id,label])=>({source:'fabric:'+id,label,url:'assets/chido/'+id+'-fabric.jpg'}));
const woodColors={oak:[174,130,77],walnut:[95,58,35],black:[44,39,34]},woodLabels={oak:'بلوط روشن',walnut:'گردویی',black:'چوب تیره'},woodImages=new Map();
function woodImage(id){return librarySwatch('wood',id)||'assets/chido/wood-'+id+'.jpg?v=0.16.19';}
const surfaceColors={silver:[186,190,193],brass:[167,128,63],black:[49,51,52],clear:[245,248,247],smoke:[139,151,153]};
function surfaceImage(id){const key='surface:'+id;if(!woodImages.has(key)){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='rgb('+surfaceColors[id].join(',')+')';ctx.fillRect(0,0,64,64);woodImages.set(key,c.toDataURL('image/jpeg',.8));}return woodImages.get(key);}
function baseMaterialPresets(role){if(role==='fabric')return fabricPresets;if(role==='metal')return [['silver','نقره‌ای'],['brass','برنجی'],['black','مشکی']].map(([id,label])=>({source:'surface:'+id,label,url:surfaceImage(id)}));if(role==='glass')return [['clear','شفاف روشن'],['smoke','دودی']].map(([id,label])=>({source:'surface:'+id,label,url:surfaceImage(id)}));const woods=Object.keys(woodColors).map(id=>({source:'wood:'+id,label:woodLabels[id],url:woodImage(id)}));return role==='wood'?woods:[...fabricPresets,...woods];}
export function materialPresets(role){return baseMaterialPresets(role).map(p=>{const [kind,id]=p.source.split(':');return {...p,url:librarySwatchThumbnail(kind,id)||p.url};});}
const validSource=value=>typeof value==='string'&&(fabricPresets.some(p=>p.source===value)||Object.keys(woodColors).some(id=>'wood:'+id===value)||Object.keys(surfaceColors).some(id=>'surface:'+id===value)||(/^data:image\/(jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value)&&value.length<=90000));
export function copyMaterialStyles(styles){const out={};for(const role of SUPPORTED_ROLES){const style=styles?.[role]||(role==='wood'?styles?.body:null);if(validSource(style?.source))out[role]={source:style.source};}return out;}
function sourceURL(source){if(source.startsWith('surface:'))return surfaceImage(source.slice(8));if(source.startsWith('wood:'))return woodImage(source.slice(5));const preset=fabricPresets.find(p=>p.source===source);return preset?(librarySwatch('fabric',source.slice(7))||preset.url):source;}
export function roleMaterials(visual){
 const entries=[];visual?.traverse(node=>{if(node.isMesh&&node.geometry?.attributes.uv)for(const m of Array.isArray(node.material)?node.material:[node.material])if(m?.isMeshStandardMaterial||(m?.isMeshBasicMaterial&&m.userData.chido_baked_lighting_v1))entries.push({node,material:m,role:materialRole(m.userData.tripo_prep_role||m.name)});});
 const named=entries.some(e=>SUPPORTED_ROLES.concat('body').some(role=>String(e.material.name||'').toLowerCase().includes(role)));
 return entries.map(e=>({...e,role:e.role||(!named&&visual?.userData.legacyFabric?'fabric':null)}));
}
// Apply the authored model AO to the final color, not only to indirect lighting.
// The 0.15 lift is applied to the AO value before multiplying it with the swatch.
const colorAOStates=new WeakMap();
export function installColorAO(material,texture){
 if(!material||!texture)return;
 const existing=colorAOStates.get(material);
 if(existing){existing.texture=texture;existing.uniform.value=texture;return;}
 const baseCompile=material.onBeforeCompile;
 const baseCacheKey=material.customProgramCacheKey.bind(material);
 const state={texture,uniform:{value:texture}};
 colorAOStates.set(material,state);
 material.aoMap=null;
 material.onBeforeCompile=shader=>{
  baseCompile?.call(material,shader);
  shader.uniforms.chidoColorAO=state.uniform;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 chidoAoUv; varying vec2 vChidoAoUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nvChidoAoUv=chidoAoUv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D chidoColorAO; varying vec2 vChidoAoUv;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb *= clamp(texture2D(chidoColorAO,vChidoAoUv).r + 0.15, 0.0, 1.0);');
 };
 material.customProgramCacheKey=()=>baseCacheKey()+'-chido-color-ao-v1';
 material.needsUpdate=true;
}
const ownedMaterials=new WeakSet(),originals=new WeakMap(),states=new WeakMap(),presetTextures=new Map(),bakedRoleStates=new WeakMap();
function targets(visual,role){
 const entries=roleMaterials(visual).filter(e=>e.role===role),result=[];
 for(const {node,material} of entries){
  let m=material;
  if(!ownedMaterials.has(m)){
   m=material.clone();ownedMaterials.add(m);originals.set(m,material.clone());
   const ao=colorAOStates.get(material)?.texture;
   if(ao)installColorAO(m,ao);
   if(Array.isArray(node.material))node.material=node.material.map(x=>x===material?m:x);else node.material=m;
   material.dispose();
  }if(!result.includes(m))result.push(m);
 }return result;
}
function textureFor(source,role){
 const key=source+':'+role,shared=!source.startsWith('data:');
 if(shared&&presetTextures.has(key))return presetTextures.get(key);
 let texture,timer;const ready=new Promise((resolve,reject)=>{
  texture=new THREE.TextureLoader().load(sourceURL(source),()=>{clearTimeout(timer);resolve(texture);},undefined,error=>{clearTimeout(timer);reject(error);});
  timer=setTimeout(()=>reject(Error('بارگذاری تکسچر کامل نشد.')),30000);
 });
 texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.setScalar(role==='fabric'?4:1);texture.anisotropy=4;
 const entry={texture,ready,shared};ready.catch(()=>{if(presetTextures.get(key)===entry)presetTextures.delete(key);texture.dispose();});if(shared)presetTextures.set(key,entry);return entry;
}
// The GPU may retain the material's old shader uniforms even when onBeforeCompile
// is reassigned. Update the SAME uniform object on every material swatch change.
export function installBakedRoleTexture(material,texture){
 let state=bakedRoleStates.get(material);
 if(!state){
  state={uniform:{value:texture},texture:null};
  bakedRoleStates.set(material,state);
  const uniform=state.uniform;
  const baseCompile=material.onBeforeCompile;
  const baseCacheKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=shader=>{
   baseCompile?.call(material,shader);
   shader.uniforms.chidoRoleMap=uniform;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 chidoTileUv; varying vec2 vChidoTileUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nvChidoTileUv=chidoTileUv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D chidoRoleMap; varying vec2 vChidoTileUv;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor *= texture2D(chidoRoleMap,vChidoTileUv);');
  };
  material.customProgramCacheKey=()=>baseCacheKey()+'-chido-baked-role-v3';
  material.needsUpdate=true;
 }
 const old=state.texture;
 state.texture=texture;
 state.uniform.value=texture;
 material.userData.chidoRoleTexture=texture;
 if(old&&old!==texture)old.dispose();
 return state.uniform;
}
function clearBakedRoleTexture(material){
 const state=bakedRoleStates.get(material);
 if(state){
  state.uniform.value=null;
  state.texture?.dispose();
  bakedRoleStates.delete(material);
 }
 delete material.userData.chidoRoleTexture;
}
export async function applyRoleMaterial(visual,role,style){
 if(!SUPPORTED_ROLES.includes(role))return false;
 let groups=states.get(visual);if(!groups){groups=new Map();states.set(visual,groups);}
 const previous=groups.get(role),request={active:previous?.active};groups.set(role,request);
 const entries=roleMaterials(visual).filter(e=>e.role===role);if(style&&entries.some(e=>(e.material.userData.chido_baked_ao_v1||e.material.userData.chido_baked_lighting_v1)&&!e.node.geometry.getAttribute('chidoTileUv')))throw Error('UV_COLOR در فایل این مدل موجود نیست.');
 const materials=targets(visual,role);if(!materials.length)return false;
 visual.userData.roleMaterialOverrides??={};visual.userData.roleMaterialOverrides[role]=true;
 if(role==='fabric')visual.userData.fabricRequest=(visual.userData.fabricRequest||0)+1;
 if(!style){
  delete visual.userData.roleMaterialOverrides[role];
  for(const m of materials){
   const original=originals.get(m);if(!original)continue;
   const ao=colorAOStates.get(m)?.texture;
   clearBakedRoleTexture(m);
   m.copy(original);
   m.onBeforeCompile=original.onBeforeCompile;
   m.customProgramCacheKey=original.customProgramCacheKey;
   if(ao){colorAOStates.delete(m);installColorAO(m,ao);}
   m.needsUpdate=true;
  }
  if(request.active&&!request.active.shared)request.active.texture.dispose();
  request.active=null;
  return true;
 }
 if(!validSource(style.source))throw Error('تصویر متریال معتبر نیست.');
 const entry=textureFor(style.source,role);request.entry=entry;
 try{await entry.ready;}catch(error){if(groups.get(role)===request)request.entry=null;throw error;}
 if(groups.get(role)!==request||visual.userData.disposed){if(!entry.shared)entry.texture.dispose();return false;}
 for(const m of materials){if(m.userData.chido_baked_ao_v1||(m.isMeshBasicMaterial&&m.userData.chido_baked_lighting_v1)){const texture=entry.texture.clone();texture.repeat.set(1,1);texture.needsUpdate=true;installBakedRoleTexture(m,texture);continue;}m.map=entry.texture;m.color.set(0xffffff);if(role==='fabric'){m.roughness=.88;m.metalness=0;m.normalMap=null;m.bumpMap=null;m.metalnessMap=null;m.roughnessMap=null;}else if(role==='wood'){m.roughness=.55;m.metalness=0;}else if(role==='metal'){m.metalness=.9;m.roughness=.3;}m.needsUpdate=true;}
 if(request.active&&!request.active.shared)request.active.texture.dispose();request.active=entry;return true;
}
export function disposeRoleMaterials(visual){if(!visual)return;visual.userData.disposed=true;const groups=states.get(visual);if(groups)for(const item of groups.values())for(const entry of new Set([item?.active,item?.entry]))if(entry&&!entry.shared)entry.texture.dispose();groups?.clear();visual.traverse(node=>{for(const m of Array.isArray(node.material)?node.material:[node.material])if(m){clearBakedRoleTexture(m);originals.get(m)?.dispose();originals.delete(m);}});}
export function instanceMaterialMap(items){return {version:2,items:items.map(m=>({itemId:m.userData.id,index:m.userData.index,color:'#'+m.material.color.getHexString(),tint:m.userData.tint||null,fabric:m.userData.fabric||null,materialStyles:copyMaterialStyles(m.userData.materialStyles)}))};}
export async function applyInstanceMaterialMap(studio,map){
 let count=0;
 for(const mesh of [...studio.items]){
  const spec=map.items?.find(s=>s.itemId===mesh.userData.id&&s.index===mesh.userData.index);if(!spec)continue;
  if(mesh.userData.loadPromise)await mesh.userData.loadPromise;if(mesh.userData.disposed||!studio.items.includes(mesh))continue;
  const styles=copyMaterialStyles(spec.materialStyles);
  if(spec.tint)studio.tintItem(mesh,spec.tint);
  const visual=mesh.getObjectByName('imported-visual'),roles=new Set(roleMaterials(visual).map(e=>e.role));
  for(const role of SUPPORTED_ROLES)if(roles.has(role)&&(styles[role]||mesh.userData.materialStyles?.[role]))await studio.setMaterialStyle(role,styles[role]||null,mesh);
  if(spec.fabric&&!styles.fabric)studio.setSofaFabric(spec.fabric,mesh);
  count++;
 }studio.changed();return count;
}
export async function materialImage(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('یک عکس JPG، WebP یا PNG با حجم کمتر از ۱۲ مگابایت انتخاب کن.');
 const image=await createImageBitmap(file);try{const c=document.createElement('canvas');let data;for(const side of [512,256,128]){const scale=Math.min(1,side/Math.max(image.width,image.height));c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);data=c.toDataURL('image/jpeg',.76);if(data.length<=90000)return {source:data};}throw Error('سبک‌سازی تصویر ممکن نشد.');}finally{image.close();}
}


// Exact GLB material slots, independent of high-level Fabric/Wood/Metal roles.
// A named material stays one slot across multiple child meshes; different
// Blender material names remain independent even when their roles match.
export function modelMaterialSlots(visual){
 const slots=[],byKey=new Map();
 visual?.traverse(node=>{
  if(!node.isMesh||!node.geometry?.attributes?.uv||node.userData?.chidoCollider||
    node.userData?.collisionProxy||node.userData?.chidoBakedShadow)return;
  const materials=Array.isArray(node.material)?node.material:[node.material];
  materials.forEach((material,index)=>{
   if(!material||(!material.isMeshStandardMaterial&&!material.isMeshPhysicalMaterial&&!(material.isMeshBasicMaterial&&material.userData.chido_baked_lighting_v1)))return;
   const name=String(material.name||'').trim();
   const key=name?'name:'+name:'unnamed:'+(material.map?.uuid||material.uuid);
   let slot=byKey.get(key);
   if(!slot){
    const inferred=materialRole(material.userData?.tripo_prep_role||name);
    slot={id:slots.length,key,name:name||'متریال '+(slots.length+1),
      role:inferred&&MATERIAL_ROLES.includes(inferred)?inferred:visual?.userData.legacyFabric?'fabric':'wood',entries:[]};
    slots.push(slot);byKey.set(key,slot);
   }
   slot.entries.push({node,material,index});
  });
 });
 return slots;
}
const slotOriginals=new WeakMap(),slotRequests=new WeakMap();
export async function applyMaterialSlot(visual,index,style){
 const slot=modelMaterialSlots(visual)[index];
 if(!slot)return false;
 if(style&&!validSource(style.source))throw Error('تکسچر انتخاب‌شده معتبر نیست.');
 let requests=slotRequests.get(visual);
 if(!requests){requests=new Map();slotRequests.set(visual,requests);}
 const ticket={};requests.set(slot.key,ticket);
 let texture=null;
 if(style){
  const entry=textureFor(style.source,slot.role);
  await entry.ready;
  if(requests.get(slot.key)!==ticket||visual.userData.disposed)return false;
  texture=entry.texture;
 }
 for(const {material:m,node} of slot.entries){
  if(!slotOriginals.has(m))slotOriginals.set(m,{
   map:m.map,color:m.color?.clone(),roughness:m.roughness,metalness:m.metalness,
   normalMap:m.normalMap,roughnessMap:m.roughnessMap,metalnessMap:m.metalnessMap,
   onBeforeCompile:m.onBeforeCompile,customProgramCacheKey:m.customProgramCacheKey
  });
  const original=slotOriginals.get(m);
  if(!style){
   clearBakedRoleTexture(m);
   m.map=original.map;
   if(original.color&&m.color)m.color.copy(original.color);
   if(original.roughness!==undefined)m.roughness=original.roughness;
   if(original.metalness!==undefined)m.metalness=original.metalness;
   m.normalMap=original.normalMap;m.roughnessMap=original.roughnessMap;m.metalnessMap=original.metalnessMap;
   m.onBeforeCompile=original.onBeforeCompile;
   m.customProgramCacheKey=original.customProgramCacheKey;
  }else if(m.userData.chido_baked_ao_v1||m.userData.chido_baked_lighting_v1){
   if(!node.geometry.getAttribute('chidoTileUv'))
    throw Error('این متریال به UV_COLOR جداگانه نیاز دارد.');
   const copy=texture.clone();copy.repeat.setScalar(1);copy.needsUpdate=true;
   installBakedRoleTexture(m,copy);
  }else{
   m.map=texture;
   if(m.color)m.color.set(0xffffff);
   if(slot.role==='fabric'){m.roughness=.88;m.metalness=0;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;}
   if(slot.role==='wood'){m.roughness=.55;m.metalness=0;}
   if(slot.role==='metal'){m.roughness=.3;m.metalness=.9;}
  }
  m.needsUpdate=true;
 }
 return true;
}
