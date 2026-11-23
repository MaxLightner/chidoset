// CHIDO's authoritative static GLB envelope in glTF metres.
// Collider meshes, selection proxies and baked shadow planes are not furniture.
import * as THREE from './vendor/three.module.js';

const collisionName=/(^|[_\s.\-])(collision|collider|colmesh|coll)([_\s.\-]|$)/i;
const shadowName=/(^|[_\s.\-])(shadow|contactshadow|bakedshadow)([_\s.\-]|$)/i;
const round=value=>{const n=Math.round(value*100000)/100000;return Object.is(n,-0)?0:n;};

export function isModelHelper(node,root){
 for(let part=node;part;part=part.parent){
  const d=part.userData||{},name=String(part.name||'');
  if(d.tripo_prep_collision||d.tripo_prep_contact_shadow||
     d.chidoCollider||d.collisionProxy||d.chidoBakedShadow||
     collisionName.test(name)||shadowName.test(name))return true;
  if(part===root)break;
 }
 return false;
}

export function measureModelBounds(root,{sourceAssetPath=''}={}){
 if(!root?.traverse||!root?.updateMatrixWorld)throw Error('صحنه GLB معتبر نیست.');
 root.updateMatrixWorld(true);
 const box=new THREE.Box3(),partBox=new THREE.Box3();
 let meshCount=0,excludedHelpers=0;
 root.traverse(node=>{
  if(!node.isMesh||!node.geometry?.getAttribute?.('position'))return;
  if(isModelHelper(node,root)){excludedHelpers++;return;}
  let visible=true;for(let p=node;p;p=p.parent){if(p.visible===false){visible=false;break;}if(p===root)break;}
  if(!visible)return;
  const geometry=node.geometry;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  if(!geometry.boundingBox||geometry.boundingBox.isEmpty())return;
  partBox.copy(geometry.boundingBox).applyMatrix4(node.matrixWorld);
  if(![...partBox.min.toArray(),...partBox.max.toArray()].every(Number.isFinite))throw Error('مختصات مدل معتبر نیست.');
  box.union(partBox);meshCount++;
 });
 if(!meshCount||box.isEmpty())throw Error('مدل هیچ هندسه قابل نمایش و اندازه‌گیری ندارد.');
 const size=box.getSize(new THREE.Vector3());
 if(![size.x,size.y,size.z].every(x=>x>=.005&&x<=20))throw Error('ابعاد هندسه خارج از محدوده مجاز ۰.۵ سانتی‌متر تا ۲۰ متر است.');
 return {
  source:'glb_geometry_v1',unit:'m',size_m:size.toArray().map(round),
  min_m:box.min.toArray().map(round),max_m:box.max.toArray().map(round),
  mesh_count:meshCount,excluded_helpers:excludedHelpers,
  source_asset_path:sourceAssetPath||''
 };
}
