import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {getCloudProduct} from './cloud-product-registry.js';
import {libraryModel,assetPath} from './asset-library.js';
import {materialRole,installColorAO} from './material-roles.js?v=0.19.0';
import {loadModelBytes} from './model-asset-cache.js?v=0.19.0';
import {extractModelHelpers,isCollisionHelper,isShadowHelper} from './model-contract.js?v=0.19.0';

const loader=new GLTFLoader();
const cache=new Map();
const validSize=size=>Array.isArray(size)&&size.length===3&&size.every(n=>Number.isFinite(n)&&n>0);

function resolveModelAsset(index){
 const uploaded=getCloudProduct(index);
 if(uploaded?.asset_url)return {url:uploaded.asset_url,name:uploaded.name,metadata:uploaded.metadata||{}};
 const record=libraryModel(index),path=assetPath(record?.files?.glb);
 if(path)return {url:new URL(path,import.meta.url).href,name:record.name,metadata:{}};
 throw Error('فایل GLB این محصول در کتابخانه پیدا نشد.');
}
export const isImportedModel=index=>!!getCloudProduct(index)||!!libraryModel(index);

function source(url,onProgress){
 let entry=cache.get(url);
 if(!entry){
  entry={listeners:new Set(),progress:null,promise:null};
  if(onProgress)entry.listeners.add(onProgress);
  const notify=state=>{
   entry.progress=state;
   for(const listener of entry.listeners)try{listener(state);}catch(error){console.warn('GLB progress listener failed',error);}
  };
  entry.promise=loadModelBytes(url,notify)
   .then(bytes=>loader.parseAsync(bytes,new URL('.',url).href))
   .then(gltf=>{
    notify({loaded:entry.progress?.total||entry.progress?.loaded||1,total:entry.progress?.total||entry.progress?.loaded||1,progress:1,fromCache:!!entry.progress?.fromCache});
    return gltf;
   }).catch(error=>{cache.delete(url);throw error;});
  cache.set(url,entry);
 }else if(onProgress){
  entry.listeners.add(onProgress);
  if(entry.progress)onProgress(entry.progress);
 }
 return entry.promise;
}

export function normalizeBakedAO(material,hasColorUV){
 if(!hasColorUV||!material?.isMeshBasicMaterial||!material.map||!materialRole(material.userData?.tripo_prep_role))return material;
 const mask=material.map.clone();
 mask.colorSpace=THREE.NoColorSpace;mask.channel=0;
 mask.wrapS=mask.wrapT=THREE.ClampToEdgeWrapping;mask.needsUpdate=true;
 const role=materialRole(material.userData.tripo_prep_role);
 const pbr=new THREE.MeshStandardMaterial({
  name:material.name,color:0xffffff,map:null,metalness:0,
  roughness:role==='wood'?.58:.88,side:material.side,
  transparent:material.transparent,opacity:material.opacity,
  alphaTest:material.alphaTest,depthWrite:material.depthWrite
 });
 pbr.userData={...material.userData,chido_baked_ao_v1:true};
 installColorAO(pbr,mask);
 material.dispose();
 return pbr;
}
export function applyBakedShadowAlpha(material){
 if(!material)return;
 material.depthWrite=false;material.toneMapped=false;material.transparent=true;
 material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <alphamap_fragment>',
   '#include <alphamap_fragment>\\ndiffuseColor.a = clamp(diffuseColor.a - 0.5, 0.0, 1.0);'
  );
 };
 material.customProgramCacheKey=()=> 'chido-baked-shadow-alpha-minus-0.5';
 material.needsUpdate=true;
}
const inside=(node,roots)=>roots.some(root=>node===root||(()=>{for(let p=node.parent;p;p=p.parent)if(p===root)return true;return false;})());
function disposeHelper(node){
 node.traverse(part=>{
  part.geometry?.dispose();
  const materials=part.material?(Array.isArray(part.material)?part.material:[part.material]):[];
  for(const material of materials)material?.dispose();
 });
}
function configureShadowMesh(object){
 const previous=Array.isArray(object.material)?object.material:[object.material];
 const next=previous.map(material=>{
  const mask=material?.alphaMap||material?.map;
  if(!mask){applyBakedShadowAlpha(material);return material;}
  mask.colorSpace=THREE.NoColorSpace;mask.flipY=false;
  mask.wrapS=mask.wrapT=THREE.ClampToEdgeWrapping;mask.needsUpdate=true;
  const shadow=new THREE.MeshBasicMaterial({
   name:'Chido Baked Shadow',color:0x000000,alphaMap:mask,
   transparent:true,opacity:1,depthWrite:false,
   side:THREE.DoubleSide,toneMapped:false
  });
  applyBakedShadowAlpha(shadow);material?.dispose();return shadow;
 });
 object.material=Array.isArray(object.material)?next:next[0];
 object.userData.chidoBakedShadow=true;
 object.castShadow=false;object.receiveShadow=false;object.renderOrder=-1;
}
export function configureMeshes(model){
 const collisionRoots=[],shadowRoots=[];
 model.traverse(node=>{
  if(isCollisionHelper(node))collisionRoots.push(node);
  if(isShadowHelper(node))shadowRoots.push(node);
 });
 for(const node of collisionRoots){node.userData.chidoCollider=true;node.visible=false;}
 for(const node of shadowRoots)node.userData.chidoBakedShadow=true;
 model.traverse(object=>{
  if(!object.isMesh)return;
  object.castShadow=false;object.receiveShadow=false;
  object.geometry=object.geometry.clone();
  if(Array.isArray(object.material))object.material=object.material.map(material=>material?.clone()||material);
  else if(object.material)object.material=object.material.clone();
  if(inside(object,collisionRoots)){
   object.visible=false;object.layers.set(1);object.userData.chidoCollider=true;return;
  }
  if(inside(object,shadowRoots)){
   object.userData.chidoBakedShadow=true;configureShadowMesh(object);return;
  }
  let uvOwner=object;
  while(uvOwner&&!uvOwner.userData.chido_color_uv_v1)uvOwner=uvOwner.parent;
  const colorUV=uvOwner?.userData.chido_color_uv_v1;
  if(colorUV){
   const attr=object.geometry.getAttribute(colorUV.uvSet===0?'uv':'uv'+colorUV.uvSet);
   if(attr)object.geometry.setAttribute('chidoTileUv',attr);
  }
  if(object.geometry.attributes.uv&&!object.geometry.attributes.chidoAoUv)
   object.geometry.setAttribute('chidoAoUv',object.geometry.attributes.uv.clone());
  const convert=material=>normalizeBakedAO(material,!!object.geometry.getAttribute('chidoTileUv'));
  if(Array.isArray(object.material))object.material=object.material.map(convert);
  else object.material=convert(object.material);
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!material)continue;
   material.userData.nativeEmissive=material.emissive?.clone();
   material.userData.nativeEmissiveIntensity=material.emissiveIntensity??0;
   if(material.transparent||(material.transmission??0)>0){
    material.depthWrite=false;material.needsUpdate=true;
   }
  }
 });
 return model;
}

export function createImportedModel(index,placeholderSize=[1,1,1]){
 const spec=resolveModelAsset(index);
 const initial=validSize(placeholderSize)?[...placeholderSize]:[1,1,1];
 const proxy=new THREE.Mesh(
  new THREE.BoxGeometry(...initial),
  new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false})
 );
 proxy.name='chido-model-'+index;
 proxy.layers.set(1);proxy.castShadow=false;proxy.receiveShadow=false;
 proxy.userData.imported=true;proxy.userData.collisionProxy=proxy;
 proxy.userData.assetSource=spec.url;proxy.userData.assetMetadata=spec.metadata;
 proxy.userData.loadStartedAt=performance.now();
 proxy.userData.modelBounds={size:initial,center:[0,0,0],estimated:true};
 proxy.userData.loadPromise=source(spec.url,state=>{
  proxy.userData.loadProgress=state;proxy.userData.onLoadProgress?.(state);
 }).then(gltf=>{
  if(proxy.userData.disposed)return;
  const visual=gltf.scene.clone(true);
  configureMeshes(visual);
  const helpers=extractModelHelpers(visual),bounds=helpers.bounds;
  if(bounds.isEmpty())throw Error('در فایل GLB هندسه قابل نمایش پیدا نشد.');
  const modelSize=bounds.getSize(new THREE.Vector3());
  if(!validSize(modelSize.toArray()))throw Error('ابعاد هندسه GLB معتبر نیست.');
  const center=bounds.getCenter(new THREE.Vector3());
  // Blender's origin is expected at the bottom centre. This translation only
  // normalizes a misplaced origin; the model's authored scale is never changed.
  visual.position.sub(center);
  visual.name='imported-visual';
  proxy.add(visual);proxy.updateMatrixWorld(true);

  const collisionBox=new THREE.Box3();
  for(const {node,parent} of helpers.collisionNodes){
   if(!parent)continue;
   parent.add(node);proxy.updateMatrixWorld(true);
   collisionBox.union(new THREE.Box3().setFromObject(node));
   parent.remove(node);disposeHelper(node);
  }
  for(const {node,parent} of helpers.shadowNodes){
   if(!parent)continue;
   parent.add(node);node.visible=true;
   node.traverse(part=>{
    if(part.isMesh){part.userData.chidoBakedShadow=true;part.castShadow=false;part.receiveShadow=false;}
   });
  }
  proxy.updateMatrixWorld(true);
  proxy.geometry.dispose();
  proxy.geometry=new THREE.BoxGeometry(...modelSize.toArray());
  const size=modelSize.toArray();
  proxy.userData.modelBounds={size,center:[0,0,0],estimated:false};
  if(!collisionBox.isEmpty()){
   const collisionCenter=collisionBox.getCenter(new THREE.Vector3());
   const collisionSize=collisionBox.getSize(new THREE.Vector3());
   proxy.userData.authoredCollisionBounds={center:collisionCenter.toArray(),size:collisionSize.toArray()};
  }else proxy.userData.authoredCollisionBounds=null;
  let hasLight=false;
  visual.traverse(node=>{
   if(node.isLight)hasLight=true;
   if(node.isMesh)for(const material of Array.isArray(node.material)?node.material:[node.material])
    if(material?.emissive&&material.emissiveIntensity>0)hasLight=true;
  });
  proxy.userData.modelFeatures={hasLight};
  proxy.userData.modelLoaded=true;
  proxy.userData.loadDurationMs=performance.now()-proxy.userData.loadStartedAt;
  proxy.userData.onModelReady?.();
 }).catch(error=>{
  if(proxy.userData.disposed)return;
  proxy.userData.loadError=String(error?.message||error);
  proxy.material.opacity=0;proxy.material.color.set('#cf654b');
  proxy.userData.onModelError?.(error);
 });
 return proxy;
}
