import test from 'node:test';import assert from 'node:assert/strict';
import {StudioCache,sceneStateKey} from '../studio-cache.js';
import {Studio} from '../studio.js';
import {rendererPolicy} from '../renderer-policy.js';
test('ordinary navigation keeps exactly the same renderer and never disposes it',()=>{
 let sleeps=0,destroys=0;const studio={renderer:{xr:{isPresenting:false}},suspend(){sleeps++;},destroy(){destroys++;}};const cache=new StudioCache();
 for(let i=0;i<10;i++){cache.park(studio,'company:user');assert.equal(cache.take('company:user'),studio);}
 assert.equal(sleeps,10);assert.equal(destroys,0);
});
test('parked content cannot be resumed by a different account or during an XR session',()=>{
 let destroys=0;const studio={renderer:{xr:{isPresenting:false}},suspend(){},destroy(){destroys++;}},cache=new StudioCache();
 cache.park(studio,'one');assert.equal(cache.take('two'),null);assert.equal(destroys,1);
 studio.renderer.xr.isPresenting=true;assert.throws(()=>cache.park(studio,'one'),/active XR/);
});
test('scene comparison ignores rotating signed URLs but catches an edited layout',()=>{
 const a={items:[{index:22,position:[0,0,0]}],spatial:{locked:true},cloudProducts:[{asset_url:'old'}]},b={...a,cloudProducts:[{asset_url:'new'}]};
 assert.equal(sceneStateKey(a),sceneStateKey(b));assert.notEqual(sceneStateKey(a),sceneStateKey({...a,items:[{index:22,position:[1,0,0]}]}));
});
test('touch render budget avoids persistent buffers and caps pixel/XR resolution',()=>{
 assert.deepEqual(rendererPolicy({coarse:true,pixelRatio:3}),{antialias:false,preserveDrawingBuffer:false,pixelRatio:1,xrScale:.75});
 assert.equal(rendererPolicy({pixelRatio:2}).pixelRatio,1.5);
});

test('detached or suspended view never resizes a framebuffer to zero, and hidden launch view never draws',()=>{
 const studio=Object.create(Studio.prototype);studio.suspended=true;studio.host={clientWidth:0,clientHeight:0};studio.renderer={setSize(){throw Error('unexpected allocation');}};studio.resize();
 studio.suspended=false;studio.resize();studio.host.classList={contains:name=>name==='ar-launch-stage'};studio.frame(0);
});
