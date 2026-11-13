import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';
import {ArchitectureLayer} from '../architecture.js';
import {defaultRoomPlan,normalizeRoomPlan,roomPlanToArchitecture} from '../room-plan.js';
import {FURNITURE_SIZE_FACTOR} from '../furniture-scale.js';
import {materialSlotDescriptors} from '../material-panel.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('one direct icon per real material at the top of the existing action stack',()=>{
 const html=read('index.html'),app=read('app.js'),panel=read('material-panel.js');
 const start=html.indexOf('id="objectQuick"'),end=html.indexOf('id="arDebugPanel"');
 const quick=html.slice(start,end);
 assert.ok(quick.indexOf('id="quickMaterialButtons"')<quick.indexOf('id="quickCopy"'));
 assert.ok(!quick.includes('id="quickMaterials"'));
 assert.ok(quick.includes('id="arMaterialRail"'));
 assert.match(app,/for\(const slot of slots\)/);
 assert.match(app,/button\.dataset\.materialSlot=String\(slot\.id\)/);
 assert.match(app,/activeQuickMaterialSlot=activeQuickMaterialSlot===slot\.id\?null:slot\.id/);
 assert.match(panel,/renderMaterialSlotThumbnails/);
 assert.doesNotMatch(panel,/type="file"/);
 assert.doesNotMatch(panel,/material-slot-buttons/);
 const visual=new THREE.Group();
 const geometry=new THREE.BoxGeometry(1,1,1);
 const cloth=new THREE.MeshStandardMaterial({name:'Fabric'});
 const wood=new THREE.MeshStandardMaterial({name:'Wood'});
 visual.add(new THREE.Mesh(geometry,[cloth,wood]));
 const fake=new THREE.Group();
 fake.userData={imported:true};visual.name='imported-visual';fake.add(visual);
 assert.deepEqual(materialSlotDescriptors(fake).map(x=>x.role),['fabric','wood']);
 const mono=new THREE.Group();mono.userData={imported:true};
 const part=new THREE.Group();part.name='imported-visual';part.add(new THREE.Mesh(geometry,cloth));mono.add(part);
 assert.equal(materialSlotDescriptors(mono).length,1);
});

test('catalogue reference 3-seater width is now 2.30m, with a single consistent furniture multiplier',()=>{
 assert.ok(Math.abs(1.8934*FURNITURE_SIZE_FACTOR-2.3)<1e-10);
 assert.ok(FURNITURE_SIZE_FACTOR<2.5/1.8934);
});

test('photo shutter icon remains while click only shows disabled notice',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.match(html,/id="arPhotoTool"/);
 assert.match(html,/id="arPhotoUnavailable"/);
 const start=app.indexOf("$('#arPhotoTool').onclick="),end=app.indexOf("$('#arRulerTool').onclick=",start);
 const handler=app.slice(start,end);
 assert.ok(handler.includes('arPhotoUnavailable'));
 assert.ok(!handler.includes('setPhotoMode(true)'));
});

test('TV settings only open after a 3D/AR ray hit; changing them keeps room root in place',()=>{
 const plan=defaultRoomPlan(),original=JSON.stringify(plan),arch={data:{designedRoom:true},refresh(){this.refreshes=(this.refreshes||0)+1;}};
 const fake=Object.create(Studio.prototype);
 Object.assign(fake,{roomPlan:plan,architecture:arch,roomPendingPlacement:false,root:{visible:true},changed(){}});
 assert.equal(fake.updateRoomTVSettings({tvChannel:'fireplace',consoleFinish:'nero',tvOn:false}),true);
 assert.equal(fake.roomPlan.tvChannel,'fireplace');
 assert.equal(arch.refreshes,1);
 assert.equal(fake.roomPendingPlacement,false);
 assert.equal(fake.root.visible,true);
 assert.notEqual(JSON.stringify(fake.roomPlan),original);
 const src=read('minimap.js'),app=read('app.js'),studio=read('studio.js');
 assert.doesNotMatch(src,/this\.options\.onTV\?\./);
 assert.match(studio,/this\.architecture\.pickTelevision\(this\.ray\)/);
 assert.match(app,/studio\.onTelevisionTap=\(\)=>showRoomTVPicker\(\)/);
 assert.doesNotMatch(app,/onTV:showRoomTVPicker/);
});

test('TV ray hit finds the real panel mesh',()=>{
 const a=Object.create(ArchitectureLayer.prototype),group=new THREE.Group();
 const tv=new THREE.Group();tv.userData={archKind:'tv',archId:'tv-123'};
 tv.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),new THREE.MeshBasicMaterial()));
 tv.position.set(0,1,-2);group.add(tv);group.updateMatrixWorld(true);
 Object.assign(a,{data:{designedRoom:true},group});
 const ray=new THREE.Raycaster(new THREE.Vector3(0,1,1),new THREE.Vector3(0,0,-1));
 assert.equal(a.pickTelevision(ray),'tv-123');
});

test('wide view is transparent behind windows, and glass remains reflective but nearly clear',()=>{
 const wide=read('wide-view.js'),arch=read('architecture.js');
 assert.match(wide,/WebGLRenderer\(\{antialias:true,alpha:true/);
 assert.match(wide,/setClearColor\('#e9e8e2',0\)/);
 assert.match(arch,/opacity:\.052/);
 assert.match(arch,/envMapIntensity:1\.65/);
 assert.match(arch,/clearcoat:\.9/);
});

test('plaster has denser procedural micro detail and real-world texture tiling',()=>{
 const mats=read('gemini-room-materials.js'),arch=read('architecture.js');
 assert.match(mats,/i<5400/);
 assert.match(arch,/u\/\(\.75\*rx\)/);
 assert.match(arch,/daylightFactors=\{north:1\.06,south:\.90/);
});

test('room settings actually update window lights, environment reflections and plaster relief',()=>{
 const fake=Object.create(Studio.prototype),look=defaultRoomPlan();
 const data=roomPlanToArchitecture(look),updates=[];
 const arch={data,applyRoomLookSettings(x){updates.push({...x});this.data.roomLook=x;return true;}};
 Object.assign(fake,{roomPlan:look,architecture:arch,scene:{},changed(){}});
 assert.equal(fake.updateRoomLookSettings({daylight:1.7,ibl:.75,plasterDetail:1.4}),true);
 assert.equal(fake.roomPlan.roomLook.daylight,1.7);
 assert.equal(fake.scene.environmentIntensity,.75);
 assert.equal(arch.data.roomLook.plasterDetail,1.4);
 assert.equal(updates.length,1);
 assert.equal(roomPlanToArchitecture(normalizeRoomPlan(fake.roomPlan)).roomLook.ibl,.75);
 const html=read('index.html'),app=read('app.js');
 for(const id of ['roomDaylightIntensity','roomIblIntensity','roomPlasterDetail'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(app,/studio\?\.setRoomLookSettings/);
});

test('GTAO only uses architectural walls in its normal/depth buffer and excludes sofa silhouettes',()=>{
 const fx=read('gemini-postfx.js');
 assert.match(fx,/gtaoPass\._renderOverride=\(render,material,target,color,alpha\)=>/);
 assert.match(fx,/camera\.layers\.set\(2\)/);
 assert.match(fx,/render\.render\(scene,camera\)/);
 assert.match(fx,/fullDepth\.texture/);
 assert.match(fx,/radius:1\.08/);
 assert.match(fx,/visibleWall/);
});
