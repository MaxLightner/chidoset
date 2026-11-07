import test from 'node:test';
import assert from 'node:assert/strict';
import {endXRSession} from '../xr-end.js';
test('an unresolved device end request releases the waiting UI with a bounded error',async()=>{
 await assert.rejects(endXRSession({end:()=>new Promise(()=>{})},15),/مرورگر/);
});
test('normal and already-failed XR end requests settle without waiting for the timeout',async()=>{
 assert.equal(await endXRSession({end:async()=>true},1000),true);
 await assert.rejects(endXRSession({end:async()=>{throw Error('already ended');}},1000),/already ended/);
});
