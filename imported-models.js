import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

// All units are metres. Native Blender GLB dimensions are preserved; the
// quarter-turn only makes the long side of a sofa/table follow local X.
export const IMPORTED_MODELS=Object.freeze({
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
  const texture=textureLoader.load(new URL('./assets/chido/'+file+'?v=0.6.0',import.meta.url).href);
  configureSofaTexture(texture,file,repeat);
  fabricCache.set(key,texture);
 }
 return fabricCache.get(key);
}
export function applySofaFabric(model,id='dark',index=22){
 const fabric=SOFA_FABRICS.find(x=>x.id===id)||SOFA_FABRICS[0];
 model.userData.fabric=fabric.id;
 model.traverse(object=>{
  if(!object.isMesh||object.userData.collisionProxy||object.name==='chido-contact-shadow')return;
  if(!object.geometry.attributes.uv)return;
  // AO uses the native, untiled UV; cloth alone repeats 4 times on each axis.
  if(!object.geometry.attributes.uv2)object.geometry.setAttribute('uv2',object.geometry.attributes.uv.clone());
  const materials=Array.isArray(object.material)?object.material:[object.material];
  for(const material of materials){
   if(!material?.isMeshStandardMaterial)continue;
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
}
export const isImportedModel=index=>Object.hasOwn(IMPORTED_MODELS,index);
export const isImportedLight=index=>index===28||index===29;
export const isImportedNoShadow=index=>[28,29,30,31].includes(index);
const source=(file)=>{
 if(!cache.has(file)){
  const url=new URL('./assets/chido/'+file+(['sofaA1.glb','SofaC1.glb','sofab1.glb'].includes(file)?'?v=0.6.0':''),import.meta.url).href;
  cache.set(file,loader.loadAsync(url).catch(error=>{cache.delete(file);throw error;}));
 }
 return cache.get(file);
};
function configureMeshes(model,index){
 model.traverse(object=>{
  if(!object.isMesh)return;
  // The original material maps, transmission, alpha and PBR values remain intact.
  object.castShadow=false;object.receiveShadow=false;
  object.geometry=object.geometry.clone();
  if(Array.isArray(object.material))object.material=object.material.map(m=>m.clone());
  else if(object.material)object.material=object.material.clone();
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
export function createImportedModel(index,size){
 const spec=IMPORTED_MODELS[index];
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
 proxy.userData.loadPromise=source(spec.file).then(gltf=>{
  if(proxy.userData.disposed)return;
  const visual=gltf.scene.clone(true);
  configureMeshes(visual,index);
  visual.rotation.y=spec.yaw;
  visual.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(visual);
  if([28,29].includes(index)&&box.getSize(new THREE.Vector3()).y>0){
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
  proxy.add(visual);
  if(SOFA_AO[index])applySofaFabric(visual,proxy.userData.fabric||'dark',index);
  if(isImportedLight(index))addLampLight(proxy,index,size);
  proxy.userData.modelLoaded=true;
  proxy.userData.onModelReady?.();
 }).catch(error=>{
  if(proxy.userData.disposed)return;
  proxy.userData.loadError=String(error?.message||error);
  proxy.material.opacity=.2;
  proxy.material.color.set('#cf654b');
  proxy.userData.onModelError?.(error);
 });
 return proxy;
}
