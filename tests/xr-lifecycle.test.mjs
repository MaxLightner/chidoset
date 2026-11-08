import test from 'node:test';
import assert from 'node:assert/strict';
import {bindXRExit,releaseAfterPaint} from '../xr-lifecycle.js';
test('device end waits for the renderer to restore its framebuffer, and completes once',async()=>{
 const session=new EventTarget(),driver=new EventTarget();driver.isPresenting=true;let calls=0;
 const binding=bindXRExit(session,driver,()=>calls++);
 session.dispatchEvent(new Event('end'));await Promise.resolve();assert.equal(calls,0);
 driver.isPresenting=false;driver.dispatchEvent(new Event('sessionend'));assert.equal(calls,1);
 driver.dispatchEvent(new Event('sessionend'));session.dispatchEvent(new Event('end'));assert.equal(calls,1);binding.dispose();
});
test('retiring a scene cancels pending XR completion callbacks',async()=>{
 const session=new EventTarget(),driver=new EventTarget();driver.isPresenting=true;let called=false;
 const binding=bindXRExit(session,driver,()=>called=true);session.dispatchEvent(new Event('end'));binding.dispose();driver.isPresenting=false;
 driver.dispatchEvent(new Event('sessionend'));await Promise.resolve();assert.equal(called,false);
});
test('heavy scene release leaves a paint opportunity for the home page',()=>{
 const original=globalThis.requestAnimationFrame,frames=[];globalThis.requestAnimationFrame=fn=>frames.push(fn);let disposed=false;
 try{releaseAfterPaint(()=>disposed=true);assert.equal(disposed,false);frames.shift()();assert.equal(disposed,false);frames.shift()();assert.equal(disposed,true);}finally{globalThis.requestAnimationFrame=original;}
});
