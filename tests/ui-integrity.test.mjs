import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {allowedCapacities} from '../layout-templates.js';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=name=>readFileSync(join(root,name),'utf8');

test('floor choice cannot trap immersive AR behind an HTML modal backdrop',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('style.css');
 assert.match(html,/id="whiteFloorDialog"[^>]*hidden/);
 assert.match(html,/role="dialog"/);
 assert.doesNotMatch(app,/whiteFloorDialog'\)\.showModal\(/);
 assert.doesNotMatch(app,/whiteFloorDialog'\)\.close\(/);
 assert.match(app,/whiteFloorDialog'\)\.hidden=true/);
 assert.match(css,/\.white-floor-prompt\{[^}]*pointer-events:auto/);
});

test('catalog uses pre-rendered small image files rather than a runtime WebGL context',()=>{
 const js=read('app.js');
 assert.match(js,/assets\/chido\/thumbs\/\$\{i\}\.jpg/);
 assert.match(js,/loading="lazy" decoding="async"/);
 assert.doesNotMatch(js,/catalogThumbnail\(/);
 for(let i=0;i<32;i++){
  const path=join(root,'assets','chido','thumbs',`${i}.jpg`);
  assert.ok(statSync(path).size<12000,`Thumbnail ${i} should remain lightweight`);
  const bytes=readFileSync(path);
  assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);
 }
});

test('tabletop lamps snap on every table model while the floor shadow remains visible',()=>{
 const studio=read('studio.js'),imports=read('imported-models.js'),html=read('index.html');
 assert.match(studio,/isTable\(table\.userData\.index\)/);
 assert.match(studio,/this\.whiteFloor\.renderOrder=-10/);
 assert.match(studio,/shadow\.renderOrder=-1/);
 assert.match(studio,/\[4,14,28\]\.includes\(mesh\.userData\.index\)/);
 assert.match(imports,/index===29\?\[Math\.max\(\.68,size\[0\]\)/);
 assert.match(imports,/transmission:\.24/);
 assert.match(html,/id="chidoMenuBlank"/);
 assert.match(read('app.js'),/id="startEmpty"/);
});

test('unique DOM IDs: camera fallback has a single input and label',()=>{
 const html=read('index.html');
 const ids=[...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m=>m[1]);
 const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
 assert.deepEqual(duplicates,[]);
 for(const id of ['cameraFallback','cameraImport','cameraShutter','cameraGallery']){
  assert.equal(ids.filter(x=>x===id).length,1);
 }
 assert.match(html,/<label\s+for=["']cameraImport["']/);
 assert.match(html,/<input\s+id=["']cameraImport["']\s+type=["']file["']/);
});

test('category tabs replace the separate layout page and AR begins from the card click',()=>{
 const html=read('index.html'),app=read('app.js'),spatial=read('spatial.js');
 for(const id of ['arArchitectureTool','arCalibrationTool','abCalibrationSheet','arRulerTool','arSettingsTool'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(html,/id="arMoveLayoutTool"/);
 assert.ok(app.includes("const variants=layoutOptions(space),saved=listCustomLayouts().filter(record=>record.room===space)"));
 assert.ok(app.includes("document.querySelectorAll('[data-layout]')"));
 assert.ok(app.includes("openLayoutForScanning(btn.dataset.layout)"));
 assert.ok(app.includes("pendingARSession=requestARSession("));
 assert.ok(app.includes("if(route==='layouts'){history.replaceState"));
 assert.ok(spatial.includes('this.layoutOffset.add(delta)'));
});
test('room capacities remain in template logic without the former preference controls',()=>{
 assert.deepEqual([...allowedCapacities('پذیرایی')],[5,7,9,11,13]);
 assert.deepEqual([...allowedCapacities('آشپزخانه')],[2,4,6,8]);
 assert.deepEqual([...allowedCapacities('ناهارخوری')],[2,4,6,8]);
 const app=read('app.js');
 assert.ok(app.includes('peopleCount=allowedCapacities(space)[0]'));
 assert.ok(!app.includes('class="room-prefs"'));
});
test('semantic features and three lamp variants are registered',()=>{
 const asset=read('asset-metadata.js'),studio=read('studio.js'),decor=read('decor.js');
 assert.match(asset,/indexes:\[4,6,14,15,28,29,30,5\]/);
 assert.match(studio,/setDiningCapacity\(count\)/);
 assert.match(studio,/setSofaCushions\(preset\)/);
 for(const token of ['index===14','index===15','lamp-visible-glow']){
  assert.ok(decor.includes(token));
 }
});

test('carpet has reusable real-size presets and retains rug design on resize',async()=>{
 const {RUG_SIZE_PRESETS}=await import('../asset-metadata.js');
 assert.ok(RUG_SIZE_PRESETS.length>=4);
 assert.deepEqual(RUG_SIZE_PRESETS.find(x=>x.id==='200x300').size,[3,.015,2]);
 assert.deepEqual(RUG_SIZE_PRESETS.find(x=>x.id==='300x400').size,[4,.015,3]);
 const app=read('app.js'),studio=read('studio.js');
 assert.match(app,/data-rug-size/);
 assert.match(app,/studio\.setRugSize\(preset\.size\)/);
 assert.match(studio,/setRugSize\(size\)/);
 assert.match(studio,/applyRugStyle\(next,current\)/);
});

test('collision controls and table/chair rigid-group motion are connected',()=>{
 const studio=read('studio.js');
 for(const token of ['moveGroupWithoutOverlap','rotateGroupWithoutOverlap','safeObjectMotion(mesh,desired)','safeObjectRotation(mesh,desired)','tryPlaceNew(mesh,previous']){
  assert.ok(studio.includes(token),token);
 }
 const pkg=JSON.parse(read('package.json'));
 assert.ok(pkg.scripts.check.includes('node --check collision.js'));
});

test('photo action uses WebXR camera frames without device screen sharing',()=>{
 const app=read('app.js'),xr=read('xr.js'),studio=read('studio.js');
 const capture=read('internal-camera-capture.js'),legacy=read('camera-capture.js');
 assert.ok(xr.includes("'camera-access'"));
 assert.ok(app.includes('studio.capturePhoto('));
 assert.ok(studio.includes('captureInternalAR('));
 assert.ok(capture.includes('getCameraImage('));
 assert.ok(capture.includes('renderObjectPixels('));
 assert.ok(!app.includes('captureARScreen('));
 assert.ok(!legacy.includes('getDisplayMedia'));
 const html=read('index.html');
 assert.ok(html.includes('WebXR Raw Camera Access'));
});

test('CHIDO keeps AR bottom dock and fixes contextual tools to the left',()=>{
 const html=read('index.html'),js=read('app.js'),css=read('style.css');
 for(const id of ['objectQuick','arDock','arBottomSave','arBottomOpen','quickPower','quickProps'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(css.includes('#overlay.floor-ready .ar-dock{'));
 assert.ok(css.includes('flex-direction:row!important'));
 assert.ok(css.includes('#overlay .object-quick{'));
 assert.ok(css.includes('left:max(7px'));
 assert.doesNotMatch(js,/quickSmoothed/);
 assert.ok(js.includes('function updateLampPowerControl()'));
});
test('rug dimensions and designs share one feature panel',()=>{
 const js=read('app.js'),begin=js.indexOf("}else if(i===7){",js.indexOf("}else if(mode==='features')"));
 const end=js.indexOf('else if(isTable(i)||isWallArt(i))',begin);
 assert.ok(begin>0&&end>begin);
 const rug=js.slice(begin,end);
 for(const part of ['تنظیمات فرش','RUG_SIZE_PRESETS.map','RUG_STYLES.map','data-rug-size','data-rug'])assert.ok(rug.includes(part),part);
});
test('saved layouts precede presets and typography is larger',()=>{
 const js=read('app.js'),css=read('style.css'),begin=js.indexOf("if(route==='spaces')");
 assert.ok(js.indexOf('class="saved-section"',begin)<js.indexOf('class="layout-feed"',begin));
 assert.ok(css.includes('.rooms-integrated .layout-feed{'));
 assert.ok(css.includes('body small,body .step'));
 assert.ok(css.includes('font-size:15px!important'));
});
test('expanded map can be collapsed from bottom right and rotates objects',()=>{
 const html=read('index.html'),js=read('minimap.js'),css=read('style.css');
 for(const id of ['data-map-left','data-map-right','data-map-angle','data-map-angle-value','data-map-expand'])assert.ok(html.includes(id));
 assert.ok(js.includes('this.angleInput.oninput'));
 assert.ok(js.includes('studio.rotate(next)'));
 assert.ok(css.includes('.ar-minimap.expanded .map-title [data-map-expand]'));
 assert.ok(css.includes('right:12px;bottom:10px'));
});

test('the CHIDO top menu opens in XR without immediately ending WebXR',()=>{
 const app=read('app.js'),html=read('index.html');
 for(const id of ['chidoMenuSheet','chidoMenuContinue','chidoMenuSaved','chidoMenuSave','chidoMenuHome'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/\$\('#homeAR'\)\.onclick=toggleChidoMenu/);
 assert.match(app,/function toggleChidoMenu\(\)/);
 assert.match(app,/\$\('#chidoMenuHome'\)\.onclick=async/);
});
test('map expansion overrides its compact width and 45-degree rotation applies consistently',()=>{
 const css=read('style.css'),map=read('minimap.js'),studio=read('studio.js'),html=read('index.html');
 assert.match(css,/#overlay \.ar-minimap\.expanded\{/);
 assert.match(css,/width:calc\(100% - 18px\)!important/);
 assert.match(css,/min-height:0!important/);
 assert.ok(map.includes('setExpanded(value)'));
 assert.ok(map.includes('collapse()'));
 assert.ok(map.includes('/Math.PI-45'));
 assert.ok(map.includes('/Math.PI+45'));
 assert.ok(studio.includes('mesh.rotation.y+Math.PI/4'));
 assert.ok(html.includes('چرخش ۴۵ درجه'));
});
test('photo preview covers the viewport and gallery fake action is explicit',()=>{
 const css=read('style.css'),app=read('app.js');
 assert.match(css,/width:max\(100vw,calc\(100dvh \* var\(--frame-ratio\)\)\)!important/);
 assert.ok(app.includes("effectiveCameraRatio($('#cameraRatio').value,window.innerWidth,window.innerHeight)"));
 assert.ok(app.includes('--frame-inverse-ratio'));
 assert.ok(app.includes('data-realistic-demo'));
 assert.ok(app.includes('پردازشی انجام نمی‌شود'));
});

test('CHIDO navigation waits for WebXR end and keeps the page open',()=>{
 const app=read('app.js'),studio=read('studio.js'),html=read('index.html');
 for(const id of ['homeAR','chidoMenuContinue','chidoMenuSaved','chidoMenuSave','chidoMenuHome'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/\$\('#homeAR'\)\.onclick=toggleChidoMenu/);
 assert.match(app,/\$\('#chidoMenuContinue'\)\.onclick=closeChidoMenu/);
 assert.match(app,/\$\('#chidoMenuSaved'\)\.onclick=\(\)=>/);
 assert.match(app,/\$\('#chidoMenuSave'\)\.onclick=\(\)=>/);
 assert.match(app,/\$\('#chidoMenuHome'\)\.onclick=async/);
 assert.ok(app.includes('homeExitRequested'));
 assert.ok(app.includes('queueMicrotask(finishChidoHomeExit)'));
 assert.ok(app.includes("history.replaceState(null,'',location.pathname+location.search+'#welcome')"));
 assert.ok(app.includes("try{previous.destroy();}catch(error)"));
 assert.ok(app.includes("if(homeExitBusy)return"));
 assert.doesNotMatch(app,/window\.close\(|location\.reload\(/);
 assert.ok(studio.includes("if(this.session===session)this.endSession()"));
 assert.ok(studio.includes("endSession(){if(!this.session)return"));
});

test('original five icon cards have independent shallow plus bars and a dense tablet grid',()=>{
 const app=read('app.js'),css=read('style.css');
 assert.match(app,/class="cards room-choice"/);
 assert.match(app,/class="room-tab-cell"/);
 assert.match(app,/data-new-space=/);
 assert.match(app,/svg\(key\)/);
 assert.match(css,/rooms-integrated \.layout-feed/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/@media\(max-width:540px\)/);
});
test('floor and wall selection exposes material palette and delete while wall placement confirms a preview',()=>{
 const html=read('index.html'),app=read('app.js'),architecture=read('architecture.js');
 for(const id of ['arSurfaceActions','arSurfaceDelete','arSurfaceMaterial','arArchitectureConfirm','arArchitectureCancel'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(app.includes("studio.architecture.setSelectedFinish("));
 assert.ok(app.includes("studio.architecture.deleteSelected()"));
 assert.ok(app.includes("studio?.architecture.confirmWall()"));
 assert.ok(architecture.includes("this.wallPreview=p"));
 assert.ok(architecture.includes("this.previewGroup"));
});
