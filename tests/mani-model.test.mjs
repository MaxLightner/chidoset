import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {roleMaterials,installBakedRoleTexture,materialPresets} from '../material-roles.js';
import {isFloorSolid} from '../collision.js';
import {IMPORTED_MODELS,markBakedRoleMaterials,normalizeBakedAO,configureMeshes} from '../imported-models.js';
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
test('Mani tagged baked RGBA shadow receives the requested -0.5 alpha adjustment',()=>{
 const bytes=readFileSync(new URL('../assets/chido/'+IMPORTED_MODELS[32].file,import.meta.url));
 const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 const exportedShadow=json.nodes.find(n=>n.extras?.tripo_prep_shadow_baked&&n.mesh!==undefined);
 assert.equal(exportedShadow.extras.tripo_prep_contact_shadow,true,'the real GLB uses the early shadow branch');
 const texture=new THREE.Texture();
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
 mesh.userData.tripo_prep_contact_shadow=true;
 const root=new THREE.Group();root.add(mesh);
 configureMeshes(root,32);
 assert.equal(mesh.userData.chidoBakedShadow,true);
 assert.equal(mesh.material.transparent,true);
 assert.equal(mesh.material.depthWrite,false);
 assert.equal(mesh.material.toneMapped,false);
 const shader={fragmentShader:'#include <alphamap_fragment>'};
 mesh.material.onBeforeCompile(shader);
 assert.ok(shader.fragmentShader.includes('diffuseColor.a = clamp(diffuseColor.a - 0.5, 0.0, 1.0);'));
 assert.ok(mesh.material.customProgramCacheKey().includes('minus-0.5'));
});
test('baked AO multiplies final color with a +0.15 lift instead of affecting only indirect light',()=>{
 const tex=new THREE.Texture();tex.colorSpace=THREE.SRGBColorSpace;
 const mat=new THREE.MeshBasicMaterial({color:0x555555,map:tex});mat.userData.tripo_prep_role='Fabric';
 const pbr=normalizeBakedAO(mat,true);
 assert.equal(pbr.isMeshStandardMaterial,true);
 assert.equal(pbr.map,null);
 assert.equal(pbr.aoMap,null);
 assert.equal(pbr.color.getHex(),0xffffff);
 assert.equal(pbr.userData.chido_baked_ao_v1,true);
 const shader={uniforms:{},vertexShader:'#include <common>\\n#include <uv_vertex>',fragmentShader:'#include <common>\\n#include <map_fragment>'};
 pbr.onBeforeCompile(shader);
 assert.equal(shader.uniforms.chidoColorAO.value.colorSpace,THREE.NoColorSpace);
 assert.equal(shader.uniforms.chidoColorAO.value.channel,0);
 assert.ok(shader.fragmentShader.includes('diffuseColor.rgb *= clamp(texture2D(chidoColorAO,vChidoAoUv).r + 0.15'));
});
test('baked unlit Fabric and Wood materials are exposed as independent selectable roles',()=>{
 const visual=new THREE.Group();
 for(const role of ['Fabric','Wood']){
  const material=new THREE.MeshBasicMaterial({map:new THREE.Texture()});material.userData={tripo_prep_role:role};
  const geometry=new THREE.PlaneGeometry();geometry.setAttribute('chidoTileUv',geometry.getAttribute('uv').clone());
  visual.add(new THREE.Mesh(geometry,material));
  markBakedRoleMaterials([material],true);
 }
 assert.deepEqual(roleMaterials(visual).map(entry=>entry.role).sort(),['fabric','wood']);
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
test('three color-only wood textures are genuine 1024px JPEGs within a mobile budget',()=>{
 const presets=materialPresets('wood');assert.equal(presets.length,3);
 for(const p of presets){
  const b=readFileSync(new URL('../'+p.url,import.meta.url));
  assert.equal(b.readUInt16BE(0),0xffd8);
  assert.ok(b.length<200000,'color texture should stay below 200 KB');
  const marker=b.indexOf(Buffer.from([0xff,0xc0]));
  assert.ok(marker>=0,'JPEG baseline frame missing');
  assert.equal(b.readUInt16BE(marker+5),1024);
  assert.equal(b.readUInt16BE(marker+7),1024);
 }
});
