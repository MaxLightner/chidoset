import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const accounts=await new Promise(resolve=>{let s='';process.stdin.setEncoding('utf8');if(process.stdin.isTTY)process.stdin.setRawMode(true);console.log('Ready for accounts (hidden).');process.stdin.on('data',chunk=>{s+=chunk;if(/[\r\n]/.test(s)){if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();resolve(JSON.parse(s.trim()));}});});
const root=path.resolve(import.meta.dirname,'..'),artifacts=path.resolve(root,'../navigation-qa');await mkdir(artifacts,{recursive:true});
const mime={'.js':'application/javascript','.mjs':'application/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{try{let url=new URL(req.url,'http://localhost').pathname;if(url.endsWith('/'))url+='index.html';const file=path.resolve(root,'.'+decodeURIComponent(url));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.CHIDO_QA_BASE||'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const errors=[];
async function pageFor(options={}){const context=await browser.newContext(options);context.setDefaultTimeout(60000);context.setDefaultNavigationTimeout(90000);const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});return page;}
async function appLogin(page,a,remember=true){await page.goto(base+'/index.html#welcome',{waitUntil:'domcontentloaded'});await page.locator('#accountUsername').fill(a.username);await page.locator('#accountPassword').fill(a.password);await page.locator('#appRemember').setChecked(remember);await page.locator('#accountLoginForm [type=submit]').click();await page.locator('#welcome').waitFor({timeout:60000});}
async function siteLogin(a){const page=await pageFor();await page.goto(base+'/login.html');await page.locator('#siteUsername').fill(a.username);await page.locator('#sitePassword').fill(a.password);await page.locator('#siteLoginForm [type=submit]').click();await page.locator(a.role==='central'?'#workspace':'#companyDashboard').waitFor({state:'visible',timeout:60000});return page;}
let releaseTextures;const texturesGate=new Promise(resolve=>releaseTextures=resolve);
try{
 const page=await pageFor();await page.route('**/scene.js?*',route=>route.fulfill({contentType:'application/javascript',body:`import {Studio as RealStudio,palette} from '${base}/studio.js?v=0.13.3';export {palette};export class Studio extends RealStudio{constructor(...args){super(...args);globalThis.__qaStudio=this;}}`}));
 await page.route('**/assets/chido/*.jpg?*',async route=>{await texturesGate;await route.continue();});
 await appLogin(page,accounts[0]);await page.locator('#startEmpty').click();await page.locator('#startAR:not([disabled])').waitFor();
 await page.evaluate(()=>globalThis.__qaStudio.add(22));
 await page.waitForFunction(()=>globalThis.__qaStudio.items[0]?.userData.modelLoaded,null,{timeout:45000});
 const initial=await page.evaluate(()=>{const s=globalThis.__qaStudio,m=s.items[0],visual=m.getObjectByName('imported-visual');let nativeImage=false;visual.traverse(n=>{if(n.isMesh&&(n.material?.map?.image?.width||n.material?.normalMap?.image?.width||n.material?.roughnessMap?.image?.width))nativeImage=true;});return {nativeImage,fabricState:visual.userData.fabricState,modelMs:Math.round(m.userData.loadDurationMs)};});
 console.log('INITIAL',initial);assert.equal(initial.nativeImage,true);assert.equal(initial.fabricState,'loading');console.log('PASS real GLB is visible with its native material while external fabrics are blocked',initial.modelMs+'ms');
 console.log('CATALOG durations',await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/rest/v1/sets')).map(r=>Math.round(r.duration))));
 releaseTextures();await page.waitForFunction(()=>globalThis.__qaStudio.items[0].getObjectByName('imported-visual').userData.fabricState==='ready');console.log('PASS external fabric applies after download');
 await page.evaluate(async()=>{
  const s=globalThis.__qaStudio,{bindXRExit}=await import('./xr-lifecycle.js');s.renderer.setAnimationLoop(null);s.renderer.xr.isPresenting=true;
  const session=new EventTarget();session.end=()=>new Promise(resolve=>{session.dispatchEvent(new Event('end'));setTimeout(()=>{s.renderer.xr.isPresenting=false;s.renderer.xr.dispatchEvent({type:'sessionend'});resolve();},80);});
  s.session=session;s.xrExitBinding=bindXRExit(session,s.renderer.xr,()=>s.endSession());
  s.wideView={disable(){throw Error('simulated optional cleanup failure');}};
  const destroy=s.destroy.bind(s);s.destroy=()=>{globalThis.__destroySawWelcome=!!document.querySelector('#welcome');destroy();};
  document.querySelector('#overlay').hidden=false;document.querySelector('#chidoMenuHome').click();
 });
 await page.locator('#welcome').waitFor();await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>globalThis.__destroySawWelcome),undefined);assert.equal(await page.locator('#overlay').isVisible(),false);assert.deepEqual(errors,[]);console.log('PASS renderer-first exit ordering, optional cleanup failure, home remains visible without GPU disposal, no refresh');
 console.log('PROGRESSIVE MODEL AND XR EXIT QA PASSED');
}finally{releaseTextures();await browser.close();await new Promise(r=>server.close(r));}
