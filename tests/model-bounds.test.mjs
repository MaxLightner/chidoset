import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {isModelHelper,measureModelBounds} from '../model-bounds.js';

function model(){
 const root=new THREE.Group();
 const sofa=new THREE.Mesh(new THREE.BoxGeometry(2.3,.9,.95));
 sofa.name='Fabric_Seat';sofa.position.y=.45;root.add(sofa);
 const collider=new THREE.Mesh(new THREE.BoxGeometry(8,5,8));
 collider.name='CHIDO_Collision';root.add(collider);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(10,10));
 shadow.name='CHIDO_SHADOW_PLANE';root.add(shadow);
 return {root,sofa,collider,shadow};
}

test('glTF Bounding Box excludes collision and baked-shadow helper meshes',()=>{
 const {root,sofa,collider,shadow}=model();
 assert.equal(isModelHelper(sofa,root),false);
 assert.equal(isModelHelper(collider,root),true);
 assert.equal(isModelHelper(shadow,root),true);
 const box=measureModelBounds(root,{sourceAssetPath:'assets/chido/model.glb'});
 assert.deepEqual(box.size_m,[2.3,.9,.95]);
 assert.deepEqual(box.min_m,[-1.15,0,-.475]);
 assert.deepEqual(box.max_m,[1.15,.9,.475]);
 assert.equal(box.mesh_count,1);
 assert.equal(box.excluded_helpers,2);
 assert.equal(box.source_asset_path,'assets/chido/model.glb');
});

test('Bounding Box derives from real world transforms rather than hand-entered catalogue dimensions',()=>{
 const {root}=model();root.scale.set(1.5,1,2);
 const box=measureModelBounds(root);
 assert.deepEqual(box.size_m,[3.45,.9,1.9]);
});

test('invisible meshes and nested collision groups do not enlarge an asset',()=>{
 const {root}=model(),extra=new THREE.Mesh(new THREE.BoxGeometry(9,9,9));
 extra.visible=false;root.add(extra);
 const group=new THREE.Group();group.userData.tripo_prep_collision=true;
 group.add(new THREE.Mesh(new THREE.BoxGeometry(19,19,19)));root.add(group);
 assert.deepEqual(measureModelBounds(root).size_m,[2.3,.9,.95]);
});

test('an empty or helper-only GLB cannot claim verified measurements',()=>{
 const root=new THREE.Group();
 assert.throws(()=>measureModelBounds(root),/هندسه/);
 const helper=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));helper.name='CHIDO_SHADOW_PLANE';root.add(helper);
 assert.throws(()=>measureModelBounds(root),/هندسه/);
});
