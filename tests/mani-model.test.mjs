import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {roleMaterials,installBakedRoleTexture,materialPresets} from '../material-roles.js';
import {isFloorSolid} from '../collision.js';
import {IMPORTED_MODELS} from '../imported-models.js';
test('Mani baked model includes authored shadow, collider, physical UV and independent roles',()=>{
 assert.equal(isFloorSolid(32),true);
 const b=readFileSync(new URL('../assets/chido/'+IMPORTED_MODELS[32].file,import.meta.url));
 const d=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 assert.ok(d.nodes.some(n=>n.extras?.tripo_prep_collision&&n.mesh!==undefined));
 assert.ok(d.nodes.some(n=>n.extras?.tripo_prep_shadow_baked&&n.mesh!==undefined));
 assert.ok(d.nodes.some(n=>n.extras?.chido_color_uv_v1?.tileCm===70));
 assert.ok(d.meshes.some(m=>m.primitives.some(p=>p.attributes.TEXCOORD_1!==undefined)));
 for(const role of ['Fabric','Wood'])assert.ok(d.materials.some(m=>m.extras?.tripo_prep_role===role&&m.extensions?.KHR_materials_unlit));
});
test('baked material roles preserve lighting map while a separate tiled map is installed',()=>{
 const visual=new THREE.Group(),light=new THREE.Texture(),cloth=new THREE.Texture();
 const m=new THREE.MeshBasicMaterial({map:light});m.userData={tripo_prep_role:'Fabric',chido_baked_lighting_v1:true};
 const g=new THREE.PlaneGeometry();g.setAttribute('chidoTileUv',g.getAttribute('uv').clone());visual.add(new THREE.Mesh(g,m));
 assert.deepEqual(roleMaterials(visual).map(e=>e.role),['fabric']);
 installBakedRoleTexture(m,cloth);assert.equal(m.map,light);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <uv_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};m.onBeforeCompile(shader);
 assert.equal(shader.uniforms.chidoRoleMap.value,cloth);assert.match(shader.vertexShader,/chidoTileUv/);assert.match(shader.fragmentShader,/diffuseColor \*= texture2D/);
});
test('three bundled wood textures are lightweight JPEGs and available without canvas',()=>{
 const presets=materialPresets('wood');assert.equal(presets.length,3);
 for(const p of presets){const b=readFileSync(new URL('../'+p.url,import.meta.url));assert.equal(b.readUInt16BE(0),0xffd8);assert.ok(b.length<20000);}
});
