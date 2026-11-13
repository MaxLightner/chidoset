import test from 'node:test';
import assert from 'node:assert/strict';
import {requestARSession,explainXR,xrError} from '../xr.js';
test('full AR asks for hit-test and controls without unused optional features',async()=>{let args;const session={};const root={};const xr={requestSession:async(...v)=>{args=v;return session;}};assert.equal(await requestARSession(xr,root),session);assert.equal(args[0],'immersive-ar');assert.deepEqual(args[1].requiredFeatures,['hit-test','dom-overlay']);assert.equal(args[1].domOverlay.root,root);assert.deepEqual(args[1].optionalFeatures,['anchors','plane-detection','camera-access']);});
test('lightweight AR still requires a visible DOM overlay for floor controls',async()=>{
 let options;
 await requestARSession({requestSession:async(mode,o)=>{options=o;}},{},true);
 assert.deepEqual(options.requiredFeatures,['hit-test','dom-overlay']);
 assert.deepEqual(options.optionalFeatures,['anchors','plane-detection','camera-access']);
});
test('request failure preserves browser reason and stage without an automatic retry',async()=>{let calls=0;const error=new DOMException('The specified session configuration is not supported.','NotSupportedError');await assert.rejects(requestARSession({requestSession:async()=>{calls++;throw error;}},{}),e=>e.name==='NotSupportedError'&&e.message===error.message&&e.xrStage==='request-session');assert.equal(calls,1);});
test('graphics failures and permission rejection produce distinct explanations',()=>{const denied=explainXR(xrError(new DOMException('Permission denied','NotAllowedError'),'request-session'));const graphics=explainXR(xrError(new Error('Unable to make WebGL context XR compatible'),'renderer'));assert.notEqual(denied.message,graphics.message);assert.equal(graphics.stage,'renderer');assert.equal(graphics.detail,'Unable to make WebGL context XR compatible');});
test('missing WebXR API gets an availability error',async()=>{await assert.rejects(requestARSession(undefined,{}),e=>e.xrStage==='availability');});



test('unsupported overlay reports a meaningful visible-UI error',()=>{
 const info=explainXR(xrError(new Error('domOverlayState missing'),'overlay'));
 assert.match(info.message,/پنل کنترل/);
 assert.equal(info.stage,'overlay');
});
