import test from 'node:test';
import assert from 'node:assert/strict';
import {createARLifecycle} from '../website/ar-lifecycle.js';
test('website browser XR exit and later exit button release UI exactly once',async()=>{
 let releases=0,requests=0;const session=new EventTarget();session.end=async()=>{requests++;session.dispatchEvent(new Event('end'));};
 const lifecycle=createARLifecycle(()=>releases++);lifecycle.attach(session);
 session.dispatchEvent(new Event('end'));await lifecycle.stop();
 assert.equal(lifecycle.ended,true);assert.equal(releases,1);assert.equal(requests,0);
});
test('website exit ends a hidden XR session even if browser omits end event',async()=>{
 let releases=0,requests=0;const session=new EventTarget();session.visibilityState='hidden';session.end=async()=>{requests++;};
 const lifecycle=createARLifecycle(()=>releases++);lifecycle.attach(session);await lifecycle.stop();await lifecycle.stop();
 assert.equal(requests,1);assert.equal(releases,1);assert.equal(lifecycle.ended,true);
});
