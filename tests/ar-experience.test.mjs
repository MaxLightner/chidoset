import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Studio} from '../studio.js';
import {SpatialState} from '../spatial.js';
import {FURNITURE_SIZE_FACTOR} from '../furniture-scale.js';
import {RUG_STYLES,rugPreviewDataUrl} from '../rug-textures.js';

function fixture(){
 const s=Object.create(Studio.prototype);
 Object.assign(s,{model:new SpatialState(),root:new THREE.Group(),floorFrame:new THREE.Group(),ruler:new THREE.Group(),
  floorNet:new THREE.Group(),items:[],serial:0,photoMode:false,tracking:true,points:new Map(),
  measureTool:{group:new THREE.Group(),setCorrection(){},active:false},changed(){},
  makeLabel(){return new THREE.Sprite(new THREE.SpriteMaterial());},
 });
 s.floorFrame.add(s.root,s.ruler,s.floorNet);s.syncSpatial=()=>s.model.apply(s.floorFrame,s.root);
 return s;
}
test('each rug has an original unique tiny design and can change its map without DOM',()=>{
 assert.equal(RUG_STYLES.length,6);
 assert.equal(new Set(RUG_STYLES.map(x=>x.id)).size,6);
 const s=fixture(),rug=s.add(7);
 for(const style of RUG_STYLES){assert.equal(s.setRugStyle(style.id),true);assert.equal(rug.userData.rugStyle,style.id);}
 assert.equal(rugPreviewDataUrl('cream'),''); // headless test; browser draws 256x384 canvas
});
test('the marker is independent of the AR plane tracker and decides insertion point',()=>{
 const s=fixture();s.placementPoint=new THREE.Vector3(1.2,0,-2.4);
 const sofa=s.addAtMarker(0);
 assert.equal(sofa.position.x,1.2);assert.equal(sofa.position.z,-2.4);
 assert.equal(sofa.position.y,sofa.userData.height/2);
 assert.equal(sofa.children.some(x=>x.name==='contact-shadow'),false,'fake rectangular shadows must never be added');
});
test('selection highlights only selected mesh; copy and visibility preserve object identity',()=>{
 const s=fixture();const sofa=s.add(0);assert.ok(sofa.userData.edges.material.opacity>.1);
 const duplicate=s.duplicateSelected();assert.equal(s.items.length,2);
 assert.ok(duplicate.position.distanceTo(sofa.position)>.1);
 assert.equal(s.setItemVisible(duplicate.userData.id,false),true);
 assert.equal(duplicate.visible,false);assert.notEqual(s.selected,duplicate);
});
test('vase attaches to the top of a table and returns to floor after moving outside',()=>{
 const s=fixture();const table=s.add(10,new THREE.Vector3(0,.375,-2));
 const vase=s.add(4,new THREE.Vector3(0,.2,-2));s.snapVase(vase);
 assert.equal(vase.userData.attachment.id,table.userData.id);
 assert.ok(vase.position.y>.5);
 vase.position.x=4;s.snapVase(vase);
 assert.equal(vase.userData.attachment,null);
 assert.equal(vase.position.y,vase.userData.height/2);
});
test('sofa variants preserve logical dimensions and different seat upholstery',()=>{
 const s=fixture();const sofa=s.add(0);
 assert.equal(s.setSofaSeats(2),true);assert.ok(Math.abs(s.selected.userData.product.size[0]-1.62*FURNITURE_SIZE_FACTOR)<1e-9);
 assert.equal(s.selected.userData.seats,2);
 assert.equal(s.setSofaSeats(1),true);assert.equal(s.selected.userData.index,1);
 assert.equal(s.setSofaSeats(3),true);assert.equal(s.selected.userData.seats,3);
});
test('dining capacity updates both table width and real count of linked chairs',()=>{
 const s=fixture();s.seed('calm','ناهارخوری',4);
 s.select(s.items.find(x=>x.userData.index===10));
 assert.equal(s.setDiningCapacity(8),true);
 const table=s.items.find(x=>x.userData.index===10);
 assert.equal(table.userData.capacity,8);
 assert.ok(Math.abs(table.userData.product.size[0]-2.35*FURNITURE_SIZE_FACTOR)<1e-9);
 assert.equal(s.items.filter(x=>x.userData.tableId===table.userData.id).length,8);
});
