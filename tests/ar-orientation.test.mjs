import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {arLayoutOrientation,bindAROrientation} from '../ar-orientation.js';

test('landscape is determined from the viewport without locking XR orientation',()=>{
 assert.equal(arLayoutOrientation({width:390,height:844}),'portrait');
 assert.equal(arLayoutOrientation({width:844,height:390}),'landscape');
 assert.equal(arLayoutOrientation({width:1024,height:768}),'landscape');
 assert.equal(arLayoutOrientation({width:768,height:1024}),'portrait');
 assert.equal(arLayoutOrientation({width:600,height:600,angle:90}),'landscape');
 assert.equal(arLayoutOrientation({width:390,height:844,type:'landscape-primary',angle:90}),'landscape','XR may temporarily retain portrait viewport dimensions');
 assert.equal(arLayoutOrientation({width:844,height:390,type:'portrait-primary',angle:0}),'portrait','orientation sensor wins during transition');
 assert.equal(arLayoutOrientation({width:390,height:844,visualWidth:844,visualHeight:390}),'landscape');
});

test('a resize reflows AR controls in place without leaving the AR session',()=>{
 const events=new Map(),overlay={dataset:{}},view={innerWidth:390,innerHeight:844};
 view.addEventListener=(key,fn)=>events.set(key,fn);
 view.removeEventListener=key=>events.delete(key);
 view.requestAnimationFrame=fn=>{view.pendingFrame=fn;return 1;};
 view.cancelAnimationFrame=()=>{};
 view.setTimeout=fn=>{view.pendingTimer=fn;return 2;};
 view.clearTimeout=()=>{};
 const unbind=bindAROrientation(overlay,{view});
 assert.equal(overlay.dataset.uiOrientation,'portrait');
 view.innerWidth=844;view.innerHeight=390;events.get('resize')();view.pendingFrame();
 assert.equal(overlay.dataset.uiOrientation,'landscape');
 view.innerWidth=390;view.innerHeight=844;events.get('orientationchange')();view.pendingFrame();
 assert.equal(overlay.dataset.uiOrientation,'portrait');
 unbind();assert.equal(events.size,0);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/bindAROrientation\(\$\('#overlay'\)\)/);
 assert.doesNotMatch(readFileSync(new URL('../ar-orientation.js',import.meta.url),'utf8'),/endXRSession|requestARSession|renderer\.setSize|screen\.orientation\.lock/);
});

test('landscape AR toolbars take separate left and right lanes',()=>{
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/#overlay\[data-ui-orientation="landscape"\]\.floor-ready \.ar-dock\{[\s\S]*?flex-direction:column!important/);
 assert.match(css,/#overlay\[data-ui-orientation="landscape"\]\.floor-ready \.ar-tool-sheet\{[\s\S]*?left:auto!important;right:/);
 assert.match(css,/#overlay\[data-ui-orientation="landscape"\]\.floor-ready \.ar-bottom\.compact\{[\s\S]*?left:auto!important;right:/);
 assert.match(css,/#overlay\[data-ui-orientation="portrait"\]\.floor-ready \.ar-dock\{[\s\S]*?flex-direction:row!important/);
 assert.match(css,/#overlay\[data-ui-orientation="landscape"\]\.floor-ready \.ar-bottom\.compact\{[\s\S]*?overflow-x:auto!important/);
});
