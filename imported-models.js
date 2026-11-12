import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {getCloudProduct} from './cloud-product-registry.js';
import {materialRole} from './material-roles.js?v=0.16.19';
import {loadModelBytes} from './model-asset-cache.js?v=0.16.17';

// All units are metres. Native Blender GLB dimensions are preserved; the
// quarter-turn only makes the long side of a sofa/table follow local X.
export const IMPORTED_MODELS=Object.freeze({
 32:{file:'mani--maniset--tak--e3585876.glb',yaw:0,kind:'sofa'},
 1000:{file:'SheenChair.glb',yaw:0,kind:'chair'},
 22:{file:'sofaA1.glb',yaw:Math.PI/2,kind:'sofa'},
 23:{file:'SofaC1.glb',yaw:Math.PI/2,kind:'sofa'},
 24:{file:'sofab1.glb',yaw:Math.PI/2,kind:'sofa'},
 25:{file:'desks2.glb',yaw:Math.PI/2,kind:'table'},
 26:{file:'desks1.glb',yaw:0,kind:'table'},
 27:{file:'minidesk1.glb',yaw:Math.PI/2,kind:'glass-table'},
 28:{file:'lamp1.glb',yaw:0,kind:'table-lamp'},
 29:{file:'Lamp2.glb',yaw:0,kind:'floor-lamp'},
 30:{file:'decor1.glb',yaw:Math.PI/2,kind:'candles'},
 31:{file:'rug.glb',yaw:0,kind:'rug'}
});
const loader=new GLTFLoader();
const cache=new Map();
export const SOFA_FABRICS=Object.freeze([
 {id:'dark',label:'آبی تیره',file:'dark-fabric.jpg'},
 {id:'creme',label:'کرم',file:'creme-fabric.jpg'},
 {id:'gray',label:'خاکستری',file:'gray-fabric.jpg'}
]);
const SOFA_AO=Object.freeze({22:'sofa-3-ao.jpg',23:'sofa-2-ao.jpg',24:'sofa-1-ao.jpg'});
const textureLoader=new THREE.TextureLoader();
const fabricCache=new Map();
// GLB uv coordinates follow glTF image orientation (top-left origin).
// TextureLoader flips external JPEGs by default, unlike GLTFLoader.
// Explicitly align both the AO atlas and the independently tiled fabrics.
export function configureSofaTexture(texture,file,repeat=4){
 const isAO=file.startsWith('sofa-')&&file.endsWith('-ao.jpg');
 texture.flipY=false;
 texture.colorSpace=isAO?THREE.NoColorSpace:THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=isAO?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
 texture.repeat.set(isAO?1:repeat,isAO?1:repeat);
 texture.anisotropy=8;
 return texture;
}
function loadFabric(file,repeat=4){
 const key=file+':'+repeat;
 if(!fabricCache.has(key)){
  let resolve,reject,timer;const ready=new Promise((ok,fail)=>{resolve=ok;reject=fail;});ready.catch(()=>{});
  const fail=error=>{clearTimeout(timer);if(fabricCache.get(key)===texture)fabricCache.delete(key);reject(error);};
  const texture=textureLoader.load(new URL('./assets/chido/'+file+'?v=0.16.17',import.meta.url).href,value=>{clearTimeout(timer);resolve(value);},undefined,fail);
  timer=setTimeout(()=>fail(Error('مهلت بارگذاری پارچه تمام شد؛ متریال اصلی مدل حفظ شد.')),45000);
  texture.userData.ready=ready;
  configureSofaTexture(texture,file,repeat);
  fabricCache.set(key,texture);
 }
 return fabricCache.get(key);
}
export function preloadSofaTextures(index,id='dark'){if(!SOFA_AO[index])return Promise.resolve();const fabric=SOFA_FABRICS.find(f=>f.id===id)||SOFA_FABRICS[0];return Promise.all([loadFabric(fabric.file).userData.ready,loadFabric(SOFA_AO[index],1).userData.ready]);}
export async function applySofaFabric(model,id='dark',index=22){
 if(model.userData.roleMaterialOverrides?.fabric)return false;
 const fabric=SOFA_FABRICS.find(x=>x.id===id)||SOFA_FABRICS[0];
 model.userData.fabric=fabric.id;
 const request=(model.userData.fabricRequest||0)+1;model.userData.fabricRequest=request;model.userData.fabricState='loading';
 try{await preloadSofaTextures(index,id);}catch(error){if(model.userData.fabricRequest===request)model.userData.fabricState='error';console.warn('Fabric unavailable; preserving GLB materials',error);return false;}
 if(model.userData.disposed)return false;
 // AO belongs to the model, even when a newer/custom fabric won the color request.
 if(SOFA_AO[index])model.traverse(object=>{
  if(!object.isMesh||!object.geometry.attributes.uv)return;
  if(!object.geometry.attributes.uv2)object.geometry.setAttribute('uv2',object.geometry.attributes.uv.clone());
  for(const m of Array.isArray(object.material)?object.material:[object.material])if(m?.isMeshStandardMaterial&&materialRole(m.name)==='fabric'){m.aoMap=loadFabric(SOFA_AO[index],1);m.aoMapIntensity=1.15;m.needsUpdate=true;}
 });
 if(model.userData.fabricRequest!==request||model.userData.roleMaterialOverrides?.fabric)return false;
 model.userData.fabricState='ready';
 let named=false;model.traverse(object=>{for(const m of Array.isArray(object.material)?object.material:[object.material])if(['fabric','wood','metal','glass','body','detail'].some(role=>String(m?.name||'').toLowerCase().includes(role)))named=true;});
 model.traverse(object=>{
  if(!object.isMesh||object.userData.collisionProxy||object.name==='chido-contact-shadow')return;
  if(!object.geometry.attributes.uv)return;
  // AO uses the native, untiled UV; cloth alone repeats 4 times on each axis.
  if(!object.geometry.attributes.uv2)object.geometry.setAttribute('uv2',object.geometry.attributes.uv.clone());
  const materials=Array.isArray(object.material)?object.material:[object.material];
  markBakedRoleMaterials(materials,!!colorUV);
  for(const material of materials){
   if(!material?.isMeshStandardMaterial||(named&&materialRole(material.name)!=='fabric'))continue;
   material.map=loadFabric(fabric.file,4);
   material.aoMap=loadFabric(SOFA_AO[index],1);
   material.aoMapIntensity=1.15;
   // Imported baked roughness/metallic/normal maps are not fabric maps.
   material.normalMap=null;material.bumpMap=null;
   material.metalnessMap=null;material.roughnessMap=null;
   material.color.set(0xffffff);
   material.roughness=.88;
   material.metalness=0;
   material.needsUpdate=true;
  }
 });
 return true;
}
export const isImportedModel=index=>Object.hasOwn(IMPORTED_MODELS,index)||!!getCloudProduct(index);
export const isImportedLight=index=>index===28||index===29;
export const isImportedNoShadow=index=>[28,29,30,31].includes(index);
function source(file,onProgress){
 let entry=cache.get(file);
 if(!entry){
  entry={listeners:new Set(),progress:null,promise:null};
  if(onProgress)entry.listeners.add(onProgress);
  const notify=state=>{entry.progress=state;for(const listener of entry.listeners)try{listener(state);}catch(error){console.warn('GLB progress listener failed',error);}};
  const url=file.startsWith('https://')?file:new URL('./assets/chido/'+file+'?v=0.16.17',import.meta.url).href;
  entry.promise=loadModelBytes(url,notify).then(bytes=>loader.parseAsync(bytes,new URL('.',url).href)).then(gltf=>{notify({loaded:entry.progress?.total||entry.progress?.loaded||1,total:entry.progress?.total||entry.progress?.loaded||1,progress:1,fromCache:!!entry.progress?.fromCache});return gltf;}).catch(error=>{cache.delete(file);throw error;});
  cache.set(file,entry);
 }else if(onProgress){
  entry.listeners.add(onProgress);if(entry.progress)onProgress(entry.progress);
 }
 return entry.promise;
}
export function markBakedRoleMaterials(materials,hasPhysicalColorUV){
 if(!hasPhysicalColorUV)return;
 for(const material of materials||[]){
  if(material?.isMeshBasicMaterial&&material.userData?.tripo_prep_role&&materialRole(material.userData.tripo_prep_role))material.userData.chido_baked_lighting_v1=true;
 }
}
// The grayscale baked AO exported as Unlit baseColor is NOT the user's color.
export function normalizeBakedAO(material,hasColorUV){
 if(!hasColorUV||!material?.isMeshBasicMaterial||!material.map||!materialRole(material.userData?.tripo_prep_role))return material;
 const mask=material.map.clone();mask.colorSpace=THREE.NoColorSpace;mask.channel=0;mask.wrapS=mask.wrapT=THREE.ClampToEdgeWrapping;mask.needsUpdate=true;
 const role=materialRole(material.userData.tripo_prep_role);
 const pbr=new THREE.MeshStandardMaterial({name:material.name,color:0xffffff,map:null,aoMap:mask,aoMapIntensity:1,metalness:0,roughness:role==='wood'?.58:.88,side:material.side,transparent:material.transparent,opacity:material.opacity,alphaTest:material.alphaTest,depthWrite:material.depthWrite});
 pbr.userData={...material.userData,chido_baked_ao_v1:true};
 material.dispose();return pbr;
}
function configureMeshes(model,index){
 model.traverse(object=>{
  if(!object.isMesh)return;
  // The original material maps, transmission, alpha and PBR values remain intact.
  object.castShadow=false;object.receiveShadow=false;
  object.geometry=object.geometry.clone();
  if(Array.isArray(object.material))object.material=object.material.map(m=>m.clone());
  else if(object.material)object.material=object.material.clone();
  if(object.userData.tripo_prep_collision){object.visible=false;object.userData.chidoCollider=true;return;}
  if(object.userData.tripo_prep_contact_shadow){
   object.userData.chidoBakedShadow=true;object.material.depthWrite=false;object.material.toneMapped=false;object.renderOrder=-1;return;
  }
  let uvOwner=object;while(uvOwner&&!uvOwner.userData.chido_color_uv_v1)uvOwner=uvOwner.parent;
  const colorUV=uvOwner?.userData.chido_color_uv_v1;
  if(colorUV){const attr=object.geometry.getAttribute(colorUV.uvSet===0?'uv':'uv'+colorUV.uvSet);if(attr)object.geometry.setAttribute('chidoTileUv',attr);}
  const convert=m=>normalizeBakedAO(m,!!object.geometry.getAttribute('chidoTileUv'));
  if(Array.isArray(object.material))object.material=object.material.map(convert);
  else object.material=convert(object.material);
  // The packed JPEG shadow texture in Tripo Prep's glTF is exposed as a
  // baseColor map; remap it to alphaMap on an unlit black surface in Chido.
  if(/^CHIDO_SHADOW_PLANE(?:\\.\\d+)?$/i.test(object.name)){
   const previous=Array.isArray(object.material)?object.material[0]:object.material;
   const mask=previous?.map;
   if(!mask){object.visible=false;console.warn('Baked shadow mask not found:',object.name);return;}
   mask.colorSpace=THREE.NoColorSpace;mask.flipY=false;
   mask.wrapS=mask.wrapT=THREE.ClampToEdgeWrapping;mask.needsUpdate=true;
   object.material=new THREE.MeshBasicMaterial({name:'Chido Baked Shadow',color:0x000000,
    alphaMap:mask,transparent:true,opacity:1,depthWrite:false,
    side:THREE.DoubleSide,toneMapped:false});
   previous?.dispose();
   object.userData.chidoBakedShadow=true;
   object.castShadow=false;object.receiveShadow=false;
   object.renderOrder=-1;
   return;
  }
  if(index===29&&/sphere/i.test(object.name)){
   const prior=Array.isArray(object.material)?object.material[0]:object.material;
   // Frosted, visibly solid glass: the previous 96% transmission made the
   // globes almost disappear in AR against the live camera.
   object.material=new THREE.MeshPhysicalMaterial({color:0xfff0d8,roughness:.2,metalness:0,transmission:.24,thickness:.08,ior:1.45,transparent:true,opacity:.94,depthWrite:false,side:THREE.DoubleSide,clearcoat:.35});
   prior?.dispose();
  }
  const materials=Array.isArray(object.material)?object.material:[object.material];
  for(const material of materials){
   if(!material)continue;
   if(index===31){material.normalMap=null;material.bumpMap=null;material.normalScale?.set(0,0);material.bumpScale=0;material.needsUpdate=true;}
   if(index===29&&/sphere/i.test(object.name)){
    material.color?.set(0xfff0d8);material.metalness=0;material.roughness=.2;
    material.transmission=.24;material.thickness=.08;material.ior=1.45;
    material.transparent=true;material.opacity=.94;material.depthWrite=false;material.needsUpdate=true;
   }
   material.userData.nativeEmissive=material.emissive?.clone();
   material.userData.nativeEmissiveIntensity=material.emissiveIntensity??0;
   if(material.transparent || (material.transmission??0)>0){
    material.depthWrite=false;
    material.needsUpdate=true;
   }
  }
 });
}
function addLampLight(model,index,size){
 const light=new THREE.PointLight(0xffd5a3,0,3.6,2);
 light.name='chido-imported-point-light';
 light.position.set(0,index===29?size[1]*.33:size[1]*.17,0);
 light.castShadow=false;
 model.add(light);
 // Lamp2 contains a separate spherical bulb; only that material should emit.
 if(index===29){
  model.traverse(object=>{
   if(!object.isMesh||!/sphere/i.test(object.name))return;
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!material?.emissive)continue;
    material.userData.nativeEmissive=new THREE.Color(0xffd5a3);
    material.userData.nativeEmissiveIntensity=1.5;
   }
  });
 }
}
export function createImportedModel(index,size,fabric='dark'){
 const uploaded=getCloudProduct(index);
 const spec=uploaded?{file:uploaded.asset_url,yaw:0,kind:'uploaded'}:IMPORTED_MODELS[index];
 if(!spec)throw Error('Unknown GLB catalog index '+index);
 // Invisible 12-triangle mesh also serves as the simple collision/picking proxy.
 // A larger invisible hit target makes the slim standing lamp easy to select
 // without changing its true dimensions or its floor collision footprint.
 const pickSize=index===29?[Math.max(.68,size[0]),size[1],Math.max(.68,size[2])]:size;
 const proxy=new THREE.Mesh(new THREE.BoxGeometry(...pickSize),
  new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}));
 proxy.name='chido-model-'+spec.file;
 proxy.userData.imported=true;
 proxy.userData.collisionProxy=proxy;
 proxy.userData.assetSource=spec.file;
 if(SOFA_AO[index])void preloadSofaTextures(index,fabric).catch(()=>{});
 proxy.userData.loadStartedAt=performance.now();
 proxy.userData.loadPromise=source(spec.file,state=>{proxy.userData.loadProgress=state;proxy.userData.onLoadProgress?.(state);}).then(gltf=>{
  if(proxy.userData.disposed)return;
  const visual=gltf.scene.clone(true);
  configureMeshes(visual,index);
  // Do not include the intentionally padded shadow plane in model bounds.
  const bakedShadows=[];
  visual.traverse(node=>{if(node.userData.chidoBakedShadow){bakedShadows.push(node);node.visible=false;}});
  const helpers=[];visual.traverse(node=>{if(node.userData.chidoBakedShadow||node.userData.chidoCollider)helpers.push([node,node.parent]);});
  for(const [node,parent] of helpers)parent.remove(node);
  visual.userData.legacyFabric=!!SOFA_AO[index];
  visual.rotation.y=spec.yaw;
  visual.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(visual);
  if(uploaded){
   const actual=box.getSize(new THREE.Vector3());
   visual.scale.set(size[0]/Math.max(.00001,actual.x),size[1]/Math.max(.00001,actual.y),size[2]/Math.max(.00001,actual.z));
   visual.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(visual);
  }else if([28,29].includes(index)&&box.getSize(new THREE.Vector3()).y>0){
   const uniformScale=size[1]/box.getSize(new THREE.Vector3()).y;
   visual.scale.setScalar(uniformScale);
   visual.updateMatrixWorld(true);
   box=new THREE.Box3().setFromObject(visual);
  }
  const center=box.getCenter(new THREE.Vector3());
  visual.position.x-=center.x;
  visual.position.z-=center.z;
  visual.position.y-=box.min.y+size[1]/2;
  visual.name='imported-visual';
  for(const [node,parent] of helpers)parent.add(node);
  proxy.add(visual);
  const collider=helpers.find(([node])=>node.userData.chidoCollider)?.[0];
  if(collider){visual.updateMatrixWorld(true);const cb=new THREE.Box3().setFromObject(collider);proxy.userData.authoredCollisionSize=cb.getSize(new THREE.Vector3()).toArray();}
  for(const shadow of bakedShadows)shadow.visible=true;
  if(SOFA_AO[index])applySofaFabric(visual,proxy.userData.fabric||'dark',index);
  if(isImportedLight(index))addLampLight(proxy,index,size);
  proxy.userData.modelLoaded=true;proxy.userData.loadDurationMs=performance.now()-proxy.userData.loadStartedAt;
  proxy.userData.onModelReady?.();
 }).catch(error=>{
  if(proxy.userData.disposed)return;
  proxy.userData.loadError=String(error?.message||error);
  proxy.material.opacity=0;
  proxy.material.color.set('#cf654b');
  proxy.userData.onModelError?.(error);
 });
 return proxy;
}
