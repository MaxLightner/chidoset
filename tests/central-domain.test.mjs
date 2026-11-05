import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWrite,validateGlb} from '../central-domain.mjs';
import {registerCloudProducts,getCloudProduct} from '../cloud-product-registry.js';
import {assetMetadata} from '../asset-metadata.js';
import {Studio} from '../studio.js';
import {packProject,unpackProject} from '../project-services.js';
const id='4b950785-7e07-4ab8-b926-6c8870c276f3';
test('central validation discards client-provided roles, actors and code hashes',()=>{
 const value=validateWrite('company.save',{name:'Test',slug:'test-company',status:'active',max_layouts_per_set:3,max_colorways_per_set:5,actor_id:id,role:'platform_admin'});
 assert.equal(value.role,undefined);assert.equal(value.actor_id,undefined);
 const code=validateWrite('code.issue',{company_id:id,role:'company_admin',branch_id:id,days:7,code_hash:'fake'});
 assert.equal(code.branch_id,null);assert.equal(code.code_hash,undefined);
 assert.throws(()=>validateWrite('platform.grant',{id}));
});
test('invalid subscription ranges, product dimensions and duplicate set membership fail',()=>{
 assert.throws(()=>validateWrite('subscription.save',{company_id:id,plan_code:'pilot',status:'active',starts_at:'2026-12-01',ends_at:'2026-11-01'}));
 assert.throws(()=>validateWrite('product.save',{name:'Test',slug:'test-product',active:true,size_m:[NaN,1,1]}));
 assert.throws(()=>validateWrite('set.save',{company_id:id,name:'Test',status:'published',product_ids:[id,id]}));
});
function glb(json){let body=Buffer.from(JSON.stringify(json));body=Buffer.concat([body,Buffer.alloc((4-body.length%4)%4,32)]);const bytes=Buffer.alloc(20+body.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(body.length,12);bytes.writeUInt32LE(0x4e4f534a,16);body.copy(bytes,20);return bytes;}
test('GLB validation requires a consistent self-contained scene',()=>{
 assert.equal(validateGlb(glb({asset:{version:'2.0'},scenes:[{}]})),true);
 assert.throws(()=>validateGlb(glb({asset:{version:'2.0'},scenes:[{}],images:[{uri:'https://elsewhere.example/a.jpg'}]})));
 assert.throws(()=>validateGlb(new Uint8Array(3)));
 const invalid=glb({asset:{version:'2.0'},scenes:[{}]});invalid.writeUInt32LE(9999,8);assert.throws(()=>validateGlb(invalid));
});
test('uploaded models accept only scoped storage URLs and retain newer signed asset data',()=>{
 const p={catalog_index:32,name:'Uploaded chair',size_m:[.8,1,.8],asset_url:'https://zeeztpblibcqtxompvxa.supabase.co/storage/v1/object/sign/chido-assets/models/test.glb?token=test',signed_at:200,metadata:{category:'seating'}};
 registerCloudProducts([p]);assert.equal(getCloudProduct(32).name,p.name);assert.deepEqual(assetMetadata(32).collision.size,p.size_m);
 registerCloudProducts([{...p,name:'Stale',signed_at:100}]);assert.equal(getCloudProduct(32).name,p.name);
 registerCloudProducts([{...p,catalog_index:33,asset_url:'https://elsewhere.example/model.glb'}]);assert.equal(getCloudProduct(33),undefined);
 const fake={placementPoint:{x:1,z:2},selected:null,add(index,position){this.created={index,position};return this.created;},tryPlaceNew(){return true;},changed(){},setPlacementEnabled(){}};
 Studio.prototype.addAtMarker.call(fake,32);
 assert.equal(fake.created.position.y,.5);assert.equal(fake.created.index,32);
 const scene={items:[{index:32,position:[0,.5,0],rotation:0}],spatial:{}};
 assert.equal(unpackProject(packProject({scene})).scene.items[0].index,32);
});
