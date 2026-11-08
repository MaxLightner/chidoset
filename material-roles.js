import * as THREE from './vendor/three.module.js';
export const MATERIAL_ROLES=['fabric','body','detail'];
export const ROLE_LABELS={fabric:'پارچه',body:'بدنه و پایه',detail:'جزئیات'};
export function materialRole(name){const matches=MATERIAL_ROLES.filter(role=>String(name||'').toLowerCase().includes(role));return matches.length===1?matches[0]:null;}
const fabricPresets=[['dark','آبی تیره'],['creme','کرم'],['gray','خاکستری']].map(([id,label])=>({source:'fabric:'+id,label,url:'assets/chido/'+id+'-fabric.jpg'}));
const woodColors={oak:[174,130,77],walnut:[95,58,35],black:[44,39,34]},woodLabels={oak:'بلوط روشن',walnut:'گردویی',black:'چوب تیره'},woodImages=new Map();
function woodImage(id){
 if(!woodImages.has(id)){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),image=ctx.createImageData(256,256),base=woodColors[id];
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,grain=Math.sin(x*.22+Math.sin(y*.025)*2)*8+Math.sin(x*.83+y*.013)*3;for(let k=0;k<3;k++)image.data[i+k]=Math.max(0,Math.min(255,base[k]+grain));image.data[i+3]=255;}
  ctx.putImageData(image,0,0);woodImages.set(id,c.toDataURL('image/jpeg',.8));
 }return woodImages.get(id);
}
export function materialPresets(role){if(role==='fabric')return fabricPresets;const woods=Object.keys(woodColors).map(id=>({source:'wood:'+id,label:woodLabels[id],url:woodImage(id)}));return role==='body'?woods:[...fabricPresets,...woods];}
const validSource=value=>typeof value==='string'&&(fabricPresets.some(p=>p.source===value)||Object.keys(woodColors).some(id=>'wood:'+id===value)||(/^data:image\/(jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value)&&value.length<=90000));
export function copyMaterialStyles(styles){const out={};for(const role of MATERIAL_ROLES)if(validSource(styles?.[role]?.source))out[role]={source:styles[role].source};return out;}
function sourceURL(source){if(source.startsWith('wood:'))return woodImage(source.slice(5));return fabricPresets.find(p=>p.source===source)?.url||source;}
export function roleMaterials(visual){
 const entries=[];visual?.traverse(node=>{if(node.isMesh&&node.geometry?.attributes.uv)for(const m of Array.isArray(node.material)?node.material:[node.material])if(m?.isMeshStandardMaterial)entries.push({node,material:m,role:materialRole(m.name)});});
 const named=entries.some(e=>MATERIAL_ROLES.some(role=>String(e.material.name||'').toLowerCase().includes(role)));
 return entries.map(e=>({...e,role:e.role||(!named&&visual?.userData.legacyFabric?'fabric':null)}));
}
const ownedMaterials=new WeakSet(),originals=new WeakMap(),states=new WeakMap(),presetTextures=new Map();
function targets(visual,role){
 const entries=roleMaterials(visual).filter(e=>e.role===role),result=[];
 for(const {node,material} of entries){
  let m=material;
  if(!ownedMaterials.has(m)){
   m=material.clone();ownedMaterials.add(m);originals.set(m,material.clone());
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
export async function applyRoleMaterial(visual,role,style){
 if(!MATERIAL_ROLES.includes(role))return false;
 let groups=states.get(visual);if(!groups){groups=new Map();states.set(visual,groups);}
 const previous=groups.get(role),request={active:previous?.active};groups.set(role,request);
 const materials=targets(visual,role);if(!materials.length)return false;
 visual.userData.roleMaterialOverrides??={};visual.userData.roleMaterialOverrides[role]=true;
 if(role==='fabric')visual.userData.fabricRequest=(visual.userData.fabricRequest||0)+1;
 if(!style){for(const m of materials){m.copy(originals.get(m));m.needsUpdate=true;}if(request.active&&!request.active.shared)request.active.texture.dispose();request.active=null;return true;}
 if(!validSource(style.source))throw Error('تصویر متریال معتبر نیست.');
 const entry=textureFor(style.source,role);request.entry=entry;
 try{await entry.ready;}catch(error){if(groups.get(role)===request)request.entry=null;throw error;}
 if(groups.get(role)!==request||visual.userData.disposed){if(!entry.shared)entry.texture.dispose();return false;}
 for(const m of materials){m.map=entry.texture;m.color.set(0xffffff);if(role==='fabric'){m.roughness=.88;m.metalness=0;m.normalMap=null;m.bumpMap=null;m.metalnessMap=null;m.roughnessMap=null;}else if(role==='body'){m.roughness=.55;m.metalness=0;}m.needsUpdate=true;}
 if(request.active&&!request.active.shared)request.active.texture.dispose();request.active=entry;return true;
}
export function disposeRoleMaterials(visual){if(!visual)return;visual.userData.disposed=true;const groups=states.get(visual);if(groups)for(const item of groups.values())for(const entry of new Set([item?.active,item?.entry]))if(entry&&!entry.shared)entry.texture.dispose();groups?.clear();visual.traverse(node=>{for(const m of Array.isArray(node.material)?node.material:[node.material])if(m){originals.get(m)?.dispose();originals.delete(m);}});}
export function instanceMaterialMap(items){return {version:2,items:items.map(m=>({itemId:m.userData.id,index:m.userData.index,color:'#'+m.material.color.getHexString(),tint:m.userData.tint||null,fabric:m.userData.fabric||null,materialStyles:copyMaterialStyles(m.userData.materialStyles)}))};}
export async function applyInstanceMaterialMap(studio,map){
 let count=0;
 for(const mesh of [...studio.items]){
  const spec=map.items?.find(s=>s.itemId===mesh.userData.id&&s.index===mesh.userData.index);if(!spec)continue;
  if(mesh.userData.loadPromise)await mesh.userData.loadPromise;if(mesh.userData.disposed||!studio.items.includes(mesh))continue;
  const styles=copyMaterialStyles(spec.materialStyles);
  if(spec.tint)studio.tintItem(mesh,spec.tint);
  const visual=mesh.getObjectByName('imported-visual'),roles=new Set(roleMaterials(visual).map(e=>e.role));
  for(const role of MATERIAL_ROLES)if(roles.has(role)&&(styles[role]||mesh.userData.materialStyles?.[role]))await studio.setMaterialStyle(role,styles[role]||null,mesh);
  if(spec.fabric&&!styles.fabric)studio.setSofaFabric(spec.fabric,mesh);
  count++;
 }studio.changed();return count;
}
export async function materialImage(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('یک عکس JPG، WebP یا PNG با حجم کمتر از ۱۲ مگابایت انتخاب کن.');
 const image=await createImageBitmap(file);try{const c=document.createElement('canvas');let data;for(const side of [512,256,128]){const scale=Math.min(1,side/Math.max(image.width,image.height));c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);data=c.toDataURL('image/jpeg',.76);if(data.length<=90000)return {source:data};}throw Error('سبک‌سازی تصویر ممکن نشد.');}finally{image.close();}
}
