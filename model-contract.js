import * as THREE from './vendor/three.module.js';

const COLLISION_NAME=/(^|[\\s._-])(collision|collider|coll)(?=$|[\\s._-])/i;
const SHADOW_NAME=/^CHIDO_SHADOW_PLANE(?:\\.\\d+)?$/i;
const flag=value=>value===true||value===1||value==='true';

export function isCollisionHelper(node){
 const data=node?.userData||{};
 return flag(data.tripo_prep_collision)||flag(data.chidoCollider)||flag(data.chido_collision)||COLLISION_NAME.test(node?.name||'');
}
export function isShadowHelper(node){
 const data=node?.userData||{};
 return flag(data.tripo_prep_contact_shadow)||flag(data.chidoBakedShadow)||SHADOW_NAME.test(node?.name||'')||node?.name==='chido-contact-shadow';
}
const descendantOf=(node,ancestor)=>{
 for(let parent=node?.parent;parent;parent=parent.parent)if(parent===ancestor)return true;
 return false;
};
const topLevel=nodes=>nodes.filter(node=>!nodes.some(other=>other!==node&&descendantOf(node,other)));

export function extractModelHelpers(root){
 const collisionCandidates=[],shadowCandidates=[];
 root.traverse(node=>{
  if(isCollisionHelper(node))collisionCandidates.push(node);
  if(isShadowHelper(node))shadowCandidates.push(node);
 });
 const collisionRoots=topLevel(collisionCandidates);
 const shadowRoots=topLevel(shadowCandidates).filter(node=>
  !collisionRoots.some(collider=>node===collider||descendantOf(node,collider)||descendantOf(collider,node))
 );
 const detach=nodes=>nodes.map(node=>{
  const parent=node.parent;
  if(parent)parent.remove(node);
  return {node,parent};
 });
 const collisionNodes=detach(collisionRoots),shadowNodes=detach(shadowRoots);
 root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root);
 const restore=entries=>{
  for(const {node,parent} of entries)if(parent&&!node.parent)parent.add(node);
  root.updateMatrixWorld(true);
 };
 return {
  bounds,collisionNodes,shadowNodes,
  restoreCollisionNodes:()=>restore(collisionNodes),
  restoreShadowNodes:()=>restore(shadowNodes),
  restore:()=>{restore(collisionNodes);restore(shadowNodes);}
 };
}
