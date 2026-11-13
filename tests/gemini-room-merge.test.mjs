import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultRoomPlan,normalizeRoomPlan,roomPlanToArchitecture} from '../room-plan.js';
import {LiveMiniMap} from '../minimap.js';
import {FLOOR_FINISHES,WALL_FINISHES} from '../architecture-materials.js';
import {GEMINI_FLOOR_KEYS,GEMINI_TV_CHANNELS} from '../gemini-room-materials.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Gemini finish presets preserve oak walnut marble concrete and plaster choices',()=>{
 for(const key of ['oak','walnut','marble','concrete'])assert.ok(GEMINI_FLOOR_KEYS.includes(key));
 for(const name of ['parquet-oak','parquet-walnut','stone-marble','polished-concrete'])
  assert.ok(FLOOR_FINISHES.some(f=>f.id===name),name);
 assert.ok(WALL_FINISHES.filter(f=>f.kind==='gemini-wall').length>=5);
 assert.equal(defaultRoomPlan().tvChannel,'nature');
 assert.equal(roomPlanToArchitecture(defaultRoomPlan()).floorMaterial,'parquet-oak');
 assert.equal(roomPlanToArchitecture(defaultRoomPlan()).wallMaterial,'gemini-wall-warm');
});

test('Gemini TV material options are preserved in valid room plans',()=>{
 assert.deepEqual([...GEMINI_TV_CHANNELS],['nature','fireplace','abstract']);
 const state=normalizeRoomPlan({...defaultRoomPlan(),tvChannel:'fireplace',tvOn:false,consoleFinish:'nero'});
 assert.equal(state.tvChannel,'fireplace');
 assert.equal(roomPlanToArchitecture(state).tvSettings.on,false);
 assert.equal(roomPlanToArchitecture(state).tvSettings.consoleFinish,'nero');
});

test('opening hit area overrides wall resize, while near-edge region refuses panning',()=>{
 const editor=Object.create(LiveMiniMap.prototype);
 const plan={...defaultRoomPlan(),elements:[{id:'door-one',type:'door',wall:'north',u:3.4}]};
 assert.equal(editor.roomElementAt({x:0,z:-plan.d/2+.29},plan)?.id,'door-one');
 assert.equal(editor.nearWall({x:0,z:-plan.d/2+.29},plan),null);
 assert.equal(editor.nearRoomEdge({x:0,z:-plan.d/2+.54},plan),true);
 assert.equal(editor.nearRoomEdge({x:0,z:0},plan),false);
});

test('Gemini source algorithms and three.js GTAO/Bloom passes are bundled locally',async()=>{
 const module=await import('../gemini-postfx.js');
 assert.equal(typeof module.createGeminiPostFX,'function');
 const src=read('gemini-postfx.js');
 for(const token of ['GTAOPass','UnrealBloomPass','OutputPass','radius:.36','samples:24','uVibrance'])assert.ok(src.includes(token),token);
 const wide=read('wide-view.js');
 assert.ok(wide.includes("import('./gemini-postfx.js"));
 assert.ok(wide.includes('ReinhardToneMapping'));
 assert.ok(wide.includes('toneMappingExposure=1.45'));
});

test('scanner floor grid and extra planar reflection cannot remain active after AR floor reveal',()=>{
 const scene=read('studio.js'),architecture=read('architecture.js');
 assert.match(scene,/if\(t>=1\)\{this\.revealStart=null;this\.floorNet\.visible=false;\}/);
 assert.ok(scene.includes('this.architecture?.setReflectionAllowed(false)'));
 assert.ok(architecture.includes('this.reflectionAllowed&&this.floorMesh'));
});

test('two-row CAD toolbar does not require horizontal scrolling and retains finish pickers',()=>{
 const html=read('index.html'),css=read('room-designer.css'),app=read('app.js');
 assert.match(html,/class="room-design-row room-design-row-main"/);
 assert.match(html,/class="room-design-row room-design-row-actions"/);
 assert.match(html,/data-plan-tool-select/);
 assert.match(html,/id="roomFinishPicker"/);
 assert.match(css,/grid-template-rows:repeat\(2,40px\)!important/);
 assert.match(css,/scroll-snap-type:none!important/);
 assert.ok(app.includes('showRoomTVPicker'));
 assert.ok(app.includes('function cycleRoomFinish(kind)'));
});

test('Gemini tone mapping stays Reinhard and retains restrained punch',()=>{
 const studio=read('studio.js'),wide=read('wide-view.js'),fx=read('gemini-postfx.js');
 for(const src of [studio,wide]){
  assert.match(src,/toneMapping=THREE\.ReinhardToneMapping/);
  assert.match(src,/toneMappingExposure=1\.45/);
 }
 assert.match(fx,/uContrast:\s*\{ value:\s*1\.12/);
 assert.match(fx,/uVibrance:\s*\{ value:\s*0\.16/);
});

test('room CAD exposes a full architecture row with touch-sized tablet controls',()=>{
 const html=read('index.html'),css=read('room-designer.css');
 assert.match(html,/class="room-design-row room-design-row-architecture"/);
 assert.match(html,/<span>طول اتاق<\/span>/);
 assert.match(html,/<span>عرض اتاق<\/span>/);
 for(const kind of ['door','kitchen','tv','win_tall_1','win_tall_25','win_std_2'])
  assert.match(html,new RegExp('data-plan-tool="'+kind+'"'));
 assert.match(css,/grid-template-rows:repeat\(3,43px\)!important/);
 assert.match(css,/font-size:15px!important/);
});

test('authored room hides generated labels, glowing selection and legacy scan overlays',()=>{
 const studio=read('studio.js');
 assert.match(studio,/const label=null;/);
 assert.match(studio,/if\(mesh&&!this\.roomPlan&&!mesh\.userData\.selectionHalo\)/);
 assert.match(studio,/!this\.roomPlan&&this\.selected\?\.userData\.edges/);
 assert.match(studio,/this\.ruler\.visible=show&&this\.model\.locked&&\(!this\.roomPlan\|\|this\.roomCalibrationGuides\)/);
 assert.doesNotMatch(studio,/this\.model\.resetCalibration\(\);\s*this\.model\.layoutOffset\.set\(0,0,0\)/);
});


test('A/B ruler stays hidden in room viewing, appears in scale editor and never resets calibration on placement',()=>{
 const studio=read('studio.js'),app=read('app.js');
 assert.match(studio,/setRoomCalibrationGuides\(enabled\)/);
 assert.match(studio,/this\.roomCalibrationGuides=!!enabled/);
 assert.match(app,/studio\?\.setRoomCalibrationGuides\(!\$\('#abCalibrationSheet'\)\.hidden\)/);
 assert.match(app,/studio\?\.setRoomCalibrationGuides\(false\)/);
 const block=studio.slice(studio.indexOf(' placeDesignedRoom(){'),studio.indexOf(' moveRoomFurniture('));
 assert.doesNotMatch(block,/resetCalibration\(/);
 assert.doesNotMatch(block,/layoutOffset\.set\(/);
 assert.match(block,/this\.syncSpatial\(\)/);
});
