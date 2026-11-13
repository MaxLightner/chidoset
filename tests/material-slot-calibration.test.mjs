import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {readFileSync} from 'node:fs';
import {Studio} from '../studio.js';
import {SpatialState} from '../spatial.js';
import {modelMaterialSlots} from '../material-roles.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('numbered slots correspond to distinct named glTF materials, not only category roles',()=>{
 const visual=new THREE.Group();
 const geometry=new THREE.BoxGeometry(1,1,1);
 const fabrics=['Fabric_Seat','Fabric_Back'].map(name=>new THREE.MeshStandardMaterial({name}));
 const wood=new THREE.MeshStandardMaterial({name:'Wood_Frame'});
 const first=new THREE.Mesh(geometry,[fabrics[0],fabrics[1]]);
 const second=new THREE.Mesh(geometry,wood);
 const third=new THREE.Mesh(geometry.clone(),fabrics[0].clone());
 visual.add(first,second,third);
 const slots=modelMaterialSlots(visual);
 assert.deepEqual(slots.map(slot=>slot.name),['Fabric_Seat','Fabric_Back','Wood_Frame']);
 assert.deepEqual(slots.map(slot=>slot.role),['fabric','fabric','wood']);
 assert.equal(slots[0].entries.length,2,'shared fabric material on separate mesh is one numbered material');
 assert.equal(slots[1].entries.length,1,'second fabric slot must remain separate');
 assert.equal(slots[2].entries.length,1);
});

test('A/B calibration updates actual room and sofa scale on the same root at 1m and 5m',()=>{
 const root=new THREE.Group(),floorFrame=new THREE.Group(),model=new SpatialState();
 floorFrame.add(root);
 const room=new THREE.Mesh(new THREE.BoxGeometry(6.8,3,5.8));
 const sofa=new THREE.Mesh(new THREE.BoxGeometry(2.1,.85,.9));
 root.add(room,sofa);
 const fake=Object.create(Studio.prototype);
 Object.assign(fake,{model,root,floorFrame,measureTool:{setCorrection(){}},
  changed(){},syncSpatial(){this.model.apply(this.floorFrame,this.root);}});
 fake.syncSpatial();
 const one=Studio.prototype.calibrate.call(fake,100);
 assert.equal(one.scale,4);
 assert.equal(root.scale.x,4);
 floorFrame.updateMatrixWorld(true);
 assert.ok(Math.abs(new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3()).x-27.2)<.00005);
 assert.ok(Math.abs(new THREE.Box3().setFromObject(sofa).getSize(new THREE.Vector3()).x-8.4)<.00005);
 const five=Studio.prototype.calibrate.call(fake,500);
 assert.equal(five.scale,.8);
 assert.equal(root.scale.x,.8);
 floorFrame.updateMatrixWorld(true);
 assert.ok(Math.abs(new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3()).x-5.44)<.00005);
 assert.ok(Math.abs(new THREE.Box3().setFromObject(sofa).getSize(new THREE.Vector3()).x-1.68)<.00005);
});

test('material slots open their own horizontal swatches and persist by numbered index',()=>{
 const panel=read('material-panel.js'),roles=read('material-roles.js'),studio=read('studio.js');
 assert.match(panel,/modelMaterialSlots\(visual\(\)\)/);
 assert.match(panel,/data-slot/);
 assert.match(panel,/material-slot-thumbnails/);
 assert.match(panel,/studio\.setMaterialSlotStyle\(index,style,mesh\)/);
 assert.match(roles,/export async function applyMaterialSlot/);
 assert.match(studio,/materialSlotStyles:structuredClone/);
 assert.match(studio,/restoreMaterialSlots\(mesh\)/);
 const style=read('style.css');
 assert.match(style,/\.material-slot-thumbnails\s*\{/);
 assert.match(style,/overflow-x:auto/);
});

test('reselecting the same architecture tool toggles it off, without ending after placement',()=>{
 const mini=read('minimap.js');
 assert.match(mini,/this\.tool=this\.tool===btn\.dataset\.planTool\?'select':btn\.dataset\.planTool/);
 const start=mini.slice(mini.indexOf('if(this.tool!==\'select\')'),mini.indexOf('const arch=e.target.closest'));
 assert.doesNotMatch(start,/this\.tool='select'/);
});

test('room templates panel is available but shared cross-app saving remains intentionally disabled',()=>{
 const html=read('index.html'),app=read('app.js'),minimap=read('minimap.js');
 assert.match(html,/data-plan-templates/);
 assert.match(html,/id="roomTemplatesPanel"/);
 assert.match(html,/disabled title="بعد از تکمیل ذخیره‌سازی مشترک/);
 assert.match(app,/function toggleRoomTemplates\(/);
 assert.match(minimap,/onTemplates\?\.\(\)/);
});

test('photo mode leaves the postprocessing path and therefore changes more than GTAO',()=>{
 const src=read('studio.js'),post=read('gemini-postfx.js');
 assert.match(src,/if\(enabled&&this\.wideMode!=='ar'\)\{this\.setWideView\('ar'\)/);
 assert.match(post,/GTAOPass/);
 assert.match(post,/UnrealBloomPass/);
 assert.match(post,/PunchShader/);
});
