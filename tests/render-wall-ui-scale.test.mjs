import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG} from '../catalog-data.js';
import {FURNITURE_SIZE_FACTOR,scaledFurnitureSize,sourceFurnitureSize} from '../furniture-scale.js';
import {RenderQualityGovernor} from '../render-quality-governor.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('main imported 3-seater becomes exactly 2.3 m wide; all furniture dimensions share identical scale',()=>{
 const original=CATALOG[22].size,actual=scaledFurnitureSize(original);
 assert.ok(Math.abs(actual[0]-2.3)<1e-8);
 assert.ok(Math.abs(actual[1]/original[1]-FURNITURE_SIZE_FACTOR)<1e-10);
 assert.ok(Math.abs(actual[2]/original[2]-FURNITURE_SIZE_FACTOR)<1e-10);
 for(const product of CATALOG){
  const resized=scaledFurnitureSize(product.size);
  assert.ok(resized.every((n,i)=>Math.abs(n/product.size[i]-FURNITURE_SIZE_FACTOR)<1e-9));
 }
 assert.deepEqual(sourceFurnitureSize(actual,FURNITURE_SIZE_FACTOR).map(n=>+n.toFixed(6)),original.map(n=>+n.toFixed(6)));
});

test('studio scales ALL mesh visuals and their physical footprints but not architecture or XR A/B calibration',()=>{
 const studio=read('studio.js');
 assert.match(studio,/const product=\{\.\.\.baseProduct,size:scaledFurnitureSize\(sourceSize\)\}/);
 assert.match(studio,/mesh\.scale\.multiplyScalar\(FURNITURE_SIZE_FACTOR\)/);
 assert.match(studio,/authoredCollisionSize\?\.map\(v=>v\*mesh\.scale\.x\)/);
 assert.match(studio,/furnitureScaleFactor:FURNITURE_SIZE_FACTOR/);
 assert.match(studio,/sourceFurnitureSize\(x\.size/);
 assert.doesNotMatch(read('room-plan.js'),/FURNITURE_SIZE_FACTOR/);
 assert.doesNotMatch(read('spatial.js'),/FURNITURE_SIZE_FACTOR/);
});

test('GTAO samples room walls only: longer radius, full-scene occluders, visible wall depth mask',()=>{
 const fx=read('gemini-postfx.js'),arch=read('architecture.js');
 assert.match(fx,/radius:1\.08/);
 assert.match(fx,/gtaoPass\.normalMaterial\.side=THREE\.DoubleSide/);
 assert.match(fx,/installWallOnlyGTAO/);
 assert.match(fx,/camera\.layers\.set\(2\)/);
 assert.match(fx,/visibleWall=/);
 assert.match(fx,/abs\(sceneDepth-wallDepth\)/);
 assert.match(fx,/scene\.overrideMaterial=depthMaterial/);
 assert.match(arch,/mesh\.layers\.enable\(2\)/);
 assert.match(arch,/surface\.receiveShadow=!this\.data\.designedRoom/);
 assert.match(arch,/daylightFactors=\{north:/);
 assert.match(arch,/wallMat\.normalScale\.set\(\.56\*/);
});

test('slow FPS lowers GPU effects one step at a time and later restores them',()=>{
 const g=new RenderQualityGovernor({slowMs:800,fastMs:1500,cooldownMs:200,threshold:20,recovery:28});
 let time=0,changeCount=0;
 for(let i=0;i<90;i++){time+=1000/15;if(g.update(time))changeCount++;}
 assert.equal(g.level,3);
 assert.equal(changeCount,3);
 const slowLevel=g.level;
 for(let i=0;i<370;i++){time+=1000/60;g.update(time);}
 assert.equal(g.level,0,'sustained 60 FPS must restore full quality');
 assert.equal(slowLevel,3);
 const changes=g.setEnabled(false);
 assert.equal(changes,false);
 assert.equal(g.enabled,false);
});

test('adaptive post effects never modify furniture shading, scene units, camera or Reinhard',()=>{
 const fx=read('gemini-postfx.js'),wide=read('wide-view.js'),app=read('app.js'),html=read('index.html');
 assert.match(fx,/samples:level>=1\?12:24/);
 assert.match(fx,/bloomPass\.enabled=level<2/);
 assert.match(fx,/baseRatio\*\(level>=3\?\.82:1\)/);
 assert.doesNotMatch(fx,/toneMappingExposure\s*=/);
 assert.match(wide,/this\.qualityGovernor\.update\(performance\.now\(\)\)/);
 assert.match(wide,/this\.renderer\.toneMapping=THREE\.ReinhardToneMapping/);
 assert.match(html,/id="autoRenderQuality"/);
 assert.match(app,/onRenderQualityChange/);
});

test('material icon sits INSIDE existing object quick menu and opens attached square horizontal swatches',()=>{
 const html=read('index.html'),css=read('style.css'),app=read('app.js');
 const start=html.indexOf('id="objectQuick"'),end=html.indexOf('id="arDebugPanel"');
 const panel=html.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(panel,/id="quickCopy"/);
 assert.match(panel,/id="quickMaterialButtons"/);
 assert.match(panel,/id="arMaterialRail"/);
 assert.equal((html.match(/id="arMaterialRail"/g)||[]).length,1);
 assert.equal((html.match(/class="ar-material-rail"/g)||[]).length,0);
 assert.match(css,/\.object-quick \.quick-material-popover\{/);
 assert.match(css,/\.material-slot-thumbnails img\{[\s\S]*?width:83px!important;height:83px!important/);
 assert.match(css,/overflow-x:auto/);
 assert.match(app,/button\.dataset\.materialSlot=String\(slot\.id\)/);
 assert.match(app,/renderMaterialSlotThumbnails\(body,studio,mesh,slot/);
});
