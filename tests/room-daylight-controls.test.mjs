import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';
import {SpatialState} from '../spatial.js';
import {defaultRoomPlan,roomPlanToArchitecture} from '../room-plan.js';
import {applyMetricFloorUV,FLOOR_TILE_METERS} from '../architecture-materials.js';
import {isCollisionHelper} from '../imported-models.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('floor textures keep metre-based density at every room size',()=>{
 const check=(width,depth,finish,repeats=4)=>{
  const geo=new THREE.BoxGeometry(width,.14,depth);
  const map={repeat:new THREE.Vector2(repeats,repeats)};
  applyMetricFloorUV(geo,finish,{map});
  const positions=geo.getAttribute('position'),uvs=geo.getAttribute('uv');
  for(let i=0;i<positions.count;i++){
   const expectedU=positions.getX(i)/(FLOOR_TILE_METERS[finish]*repeats);
   const expectedV=positions.getZ(i)/(FLOOR_TILE_METERS[finish]*repeats);
   assert.ok(Math.abs(uvs.getX(i)-expectedU)<.000002);
   assert.ok(Math.abs(uvs.getY(i)-expectedV)<.000002);
  }
  const density=uvs.getX(0)/positions.getX(0);
  geo.dispose();return density;
 };
 assert.ok(Math.abs(check(3.6,4,'parquet-oak')-check(13.8,12,'parquet-oak'))<.000002);
 assert.ok(Math.abs(check(3.6,4,'carpet-olive',1)-check(13.8,12,'carpet-olive',1))<.000002);
 assert.equal(FLOOR_TILE_METERS['ceramic-white'],1);
 assert.ok(FLOOR_TILE_METERS['carpet-olive']<1);
});

test('the authored room has a ceiling not higher than 3 metres',()=>{
 const plan=roomPlanToArchitecture(defaultRoomPlan());
 assert.equal(Math.max(...plan.walls.map(w=>w.height)),3);
 const arch=read('architecture.js');
 assert.match(arch,/height=3\.0/);
 assert.match(arch,/roof\.position\.y=height\+\.06/);
});

test('daylight enters from authored windows rather than point lighting the room',()=>{
 const arch=read('architecture.js');
 assert.match(arch,/const glazed=this\.data\.windows\.filter\(o=>o\.kind==='window'\)/);
 assert.match(arch,/new THREE\.DirectionalLight\(0xeef6ff/);
 assert.match(arch,/new THREE\.HemisphereLight\(0xe8f3ff/);
 assert.doesNotMatch(arch,/new THREE\.PointLight\(/);
 assert.match(arch,/applyMetricFloorUV\(geo,this\.data\.floorMaterial,material\)/);
 const gemini=read('gemini-room-materials.js');
 assert.match(gemini,/reflectedLight\.directSpecular = vec3\(0\.0\)/);
 assert.match(gemini,/envMapIntensity:wooden\?\.67/);
});

test('repeat placement keeps architecture tool selected',()=>{
 const src=read('minimap.js');
 const block=src.slice(src.indexOf('if(this.tool!==\'select\'){'),src.indexOf('const arch=e.target.closest'));
 assert.ok(block.includes('this.selectedArch=candidate.id'));
 assert.doesNotMatch(block,/this\.tool='select'/);
});

test('collision helpers are excluded from every render pass but remain pickable through layer 1',()=>{
 for(const name of ['collision','Tripo_Collider.001','chido-collision-mesh','Coll_Mesh'])
  assert.ok(isCollisionHelper({name}),name);
 assert.ok(isCollisionHelper({name:'part',userData:{tripo_prep_collision:true}}));
 assert.equal(isCollisionHelper({name:'sofa-upholstery'}),false);
 const imported=read('imported-models.js'),studio=read('studio.js');
 assert.match(imported,/proxy\.layers\.set\(1\)/);
 assert.match(imported,/if\(node\.userData\.chidoBakedShadow\)parent\.add\(node\)/);
 assert.match(studio,/this\.ray\.layers\.enable\(1\)/);
});

test('room visibility hides only architecture, while recenter keeps common scale',()=>{
 const s=Object.create(Studio.prototype);
 const root=new THREE.Group(),architecture={group:new THREE.Group()};
 root.add(architecture.group);
 const model=new SpatialState();
 const floorFrame=new THREE.Group();floorFrame.add(root);
 model.calibrate(2);
 const camera=new THREE.PerspectiveCamera(55,1,.1,30);
 camera.position.set(0,1.6,2);
 camera.lookAt(0,0,0);
 camera.updateMatrixWorld(true);
 Object.assign(s,{root,floorFrame,architecture,model,camera,session:{},tracking:true,roomPlan:defaultRoomPlan(),changed(){},activeCamera(){return camera;},syncSpatial(){this.model.apply(this.floorFrame,this.root);}});
 s.syncSpatial();
 const before=model.correction;
 assert.equal(s.setDesignedRoomVisible(false),true);
 assert.equal(architecture.group.visible,false);
 assert.equal(root.visible,true,'furniture stays visible while room is hidden');
 assert.equal(s.setDesignedRoomVisible(true),true);
 assert.equal(architecture.group.visible,true);
 assert.ok(s.moveRoomCenterToCrosshair());
 assert.equal(model.correction,before,'A/B calibration must be preserved');
 assert.ok(model.layoutOffset.length()<.00001,'crosshair intersection at floor origin');
});

test('selected materials are a vertical left-side UI, not in bottom AR dock',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('style.css');
 assert.doesNotMatch(html,/id="arMaterialTool"/);
 for(const id of ['arMaterialRail','arRoomVisibility','arMoveCenterTool','roomCenterReticle','roomCenterConfirm'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/mountMaterialPanel\(body,studio,mesh,\{notify:toast\}\)/);
 assert.match(css,/\.ar-material-rail\s*\{/);
 assert.match(css,/\.material-tabs\s*\{[\s\S]*?flex-direction:column/);
 assert.match(read('material-panel.js'),/class="role-icon"/);
});

test('Reinhard remains with natural reduced vibrance',()=>{
 const fx=read('gemini-postfx.js');
 assert.match(fx,/uContrast: \{ value: 1\.07 \}/);
 assert.match(fx,/uVibrance: \{ value: 0\.05 \}/);
 assert.match(read('effects.js'),/toneMapping=THREE\.ReinhardToneMapping/);
});
