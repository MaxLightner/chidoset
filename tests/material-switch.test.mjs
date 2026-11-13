import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {installBakedRoleTexture,installColorAO,applyRoleMaterial,roleMaterials,disposeRoleMaterials} from '../material-roles.js';

function shader(){
 return {uniforms:{},vertexShader:'#include <common>\n#include <uv_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};
}
test('repeated baked texture swaps update the already-compiled shader uniform',()=>{
 const original=new THREE.Texture(),first=new THREE.Texture(),second=new THREE.Texture();
 const material=new THREE.MeshBasicMaterial({map:original});
 const uniform=installBakedRoleTexture(material,first);
 const originalCompile=material.onBeforeCompile,compiled=shader();
 material.onBeforeCompile(compiled);
 assert.strictEqual(compiled.uniforms.chidoRoleMap,uniform);
 assert.strictEqual(compiled.uniforms.chidoRoleMap.value,first);
 installBakedRoleTexture(material,second);
 assert.strictEqual(material.map,original,'the baked base map must be preserved');
 assert.strictEqual(material.onBeforeCompile,originalCompile,'do not recreate a compiled shader on image swap');
 assert.strictEqual(compiled.uniforms.chidoRoleMap.value,second,'the live uniform must reference the new image');
});
test('fabric and wood can be swapped repeatedly and reset independently',async()=>{
 const originalLoad=THREE.TextureLoader.prototype.load,loaded=[];
 THREE.TextureLoader.prototype.load=function(url,callback){
  const texture=new THREE.Texture();texture.userData.url=url;loaded.push(url);
  queueMicrotask(()=>callback(texture));return texture;
 };
 const visual=new THREE.Group(),baseMaps={};
 try{
  for(const role of ['Fabric','Wood']){
   const map=new THREE.Texture(),m=new THREE.MeshBasicMaterial({map});
   baseMaps[role.toLowerCase()]=map;
   m.userData={tripo_prep_role:role,chido_baked_lighting_v1:true};
   const g=new THREE.PlaneGeometry();g.setAttribute('chidoTileUv',g.getAttribute('uv').clone());
   visual.add(new THREE.Mesh(g,m));
  }
  const get=role=>roleMaterials(visual).find(e=>e.role===role).material;
  assert.equal(await applyRoleMaterial(visual,'fabric',{source:'fabric:dark'}),true);
  const fabric=get('fabric'),fabricShader=shader();
  fabric.onBeforeCompile(fabricShader);
  const firstFabric=fabricShader.uniforms.chidoRoleMap.value;
  assert.equal(await applyRoleMaterial(visual,'fabric',{source:'fabric:creme'}),true);
  assert.notEqual(fabricShader.uniforms.chidoRoleMap.value,firstFabric);
  assert.strictEqual(fabricShader.uniforms.chidoRoleMap.value,fabric.userData.chidoRoleTexture);
  assert.strictEqual(fabric.map,baseMaps.fabric);
  assert.equal(await applyRoleMaterial(visual,'wood',{source:'wood:oak'}),true);
  const wood=get('wood'),woodShader=shader();wood.onBeforeCompile(woodShader);
  const firstWood=woodShader.uniforms.chidoRoleMap.value;
  assert.equal(await applyRoleMaterial(visual,'wood',{source:'wood:walnut'}),true);
  assert.notEqual(woodShader.uniforms.chidoRoleMap.value,firstWood);
  assert.strictEqual(wood.map,baseMaps.wood);
  assert.equal(await applyRoleMaterial(visual,'fabric',{source:'fabric:gray'}),true);
  assert.strictEqual(fabricShader.uniforms.chidoRoleMap.value,fabric.userData.chidoRoleTexture);
  assert.strictEqual(woodShader.uniforms.chidoRoleMap.value,wood.userData.chidoRoleTexture);
  assert.equal(await applyRoleMaterial(visual,'wood',null),true);
  assert.strictEqual(wood.map,baseMaps.wood);
  assert.equal(await applyRoleMaterial(visual,'wood',{source:'wood:black'}),true);
  assert.strictEqual(get('wood').map,baseMaps.wood);
  assert.equal(await applyRoleMaterial(visual,'fabric',null),true);
  assert.strictEqual(fabric.map,baseMaps.fabric);
  assert.equal(loaded.length,6);
 }finally{
  THREE.TextureLoader.prototype.load=originalLoad;
  disposeRoleMaterials(visual);
 }
});

test('recoloring PBR keeps model AO in the final color multiplication through swatch changes and reset',async()=>{
 const original=THREE.TextureLoader.prototype.load;
 THREE.TextureLoader.prototype.load=function(url,done){const t=new THREE.Texture();queueMicrotask(()=>done(t));return t;};
 try{
  const ao=new THREE.Texture(),m=new THREE.MeshStandardMaterial({map:null,color:0xffffff});
  m.userData={tripo_prep_role:'Wood',chido_baked_ao_v1:true};
  installColorAO(m,ao);
  const g=new THREE.PlaneGeometry();g.setAttribute('chidoTileUv',g.getAttribute('uv').clone());g.setAttribute('chidoAoUv',g.getAttribute('uv').clone());
  const visual=new THREE.Group();visual.add(new THREE.Mesh(g,m));
  for(const source of ['wood:oak','wood:walnut','wood:black'])assert.equal(await applyRoleMaterial(visual,'wood',{source}),true);
  const active=roleMaterials(visual)[0].material;
  assert.strictEqual(active.aoMap,null);assert.equal(active.map,null);
  const shaderWithSwatch=shader();
  active.onBeforeCompile(shaderWithSwatch);
  assert.strictEqual(shaderWithSwatch.uniforms.chidoColorAO.value,ao);
  assert.ok(shaderWithSwatch.uniforms.chidoRoleMap,'selected swatch must also be present');
  assert.equal(await applyRoleMaterial(visual,'wood',null),true);
  assert.strictEqual(active.aoMap,null);assert.equal(active.map,null);
  const shaderAfterReset=shader();
  active.onBeforeCompile(shaderAfterReset);
  assert.strictEqual(shaderAfterReset.uniforms.chidoColorAO.value,ao);
  assert.equal(shaderAfterReset.uniforms.chidoRoleMap,undefined);
  disposeRoleMaterials(visual);
 }finally{THREE.TextureLoader.prototype.load=original;}
});
