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
try{
 await Promise.all(accounts.filter(a=>a.role==='company_admin'||a.username==='sell1').map(async a=>{
  const page=await pageFor();page.on('requestfailed',r=>console.log('NETWORK',new URL(r.url()).pathname,r.failure()?.errorText));await page.route('**/scene.js?*',route=>route.fulfill({contentType:'application/javascript',body:`import {Studio as RealStudio,palette} from '${base}/studio.js?v=0.13.3';export {palette};export class Studio extends RealStudio{constructor(...args){super(...args);globalThis.__qaStudio=this;}}`}));
  await appLogin(page,a);console.log('LOGIN READY',a.role);await page.locator('#startEmpty').click();await page.locator('#startAR:not([disabled])').waitFor({timeout:60000});
  await page.evaluate(()=>{const s=globalThis.__qaStudio;s.add(22);s.add(25).position.x=1.7;});
  await page.waitForFunction(()=>globalThis.__qaStudio.items.every(m=>m.userData.modelLoaded||m.userData.loadError),null,{timeout:120000});const loads=await page.evaluate(()=>globalThis.__qaStudio.items.map(m=>({index:m.userData.index,loaded:!!m.userData.modelLoaded,error:m.userData.loadError||null})));console.log('MODELS',a.role,JSON.stringify(loads));assert.ok(loads.every(m=>m.loaded));
  await page.waitForFunction(()=>globalThis.__qaStudio.items.filter(m=>[22,23,24].includes(m.userData.index)).every(m=>m.getObjectByName('imported-visual')?.userData.fabricState==='ready'),null,{timeout:60000});
  const result=await page.evaluate(async()=>{const s=globalThis.__qaStudio,sofa=s.items.find(m=>m.userData.index===22),table=s.items.find(m=>m.userData.index===25),shadow=sofa.getObjectByName('contact-shadow');let ready=true;sofa.getObjectByName('imported-visual').traverse(o=>{if(o.isMesh&&o.material?.map)ready&&=!!o.material.map.image?.width;});const {ReinhardToneMapping}=await import('./vendor/three.module.js');return {shadow:shadow?.userData.labVersion,tableShadow:!!table.getObjectByName('contact-shadow'),ready,reinhard:s.renderer.toneMapping===ReinhardToneMapping,fill:s.effects.cameraFill.intensity};});
  assert.deepEqual(result,{shadow:15,tableShadow:false,ready:true,reinhard:true,fill:1.1});
  await page.locator('#preview3D').click();await page.screenshot({path:path.join(artifacts,'render-'+a.role+'.png'),fullPage:true});
  for(let i=0;i<3;i++){
   await page.evaluate(()=>{const s=globalThis.__qaStudio;globalThis.__retained=s;s.session={};document.querySelector('#overlay').hidden=false;s.endSession();});
   await page.locator('#startAR:not([disabled])').waitFor();assert.equal(await page.evaluate(()=>globalThis.__qaStudio===globalThis.__retained),true);assert.equal(await page.locator('#viewport canvas').count(),1);assert.equal(await page.locator('#overlay').isVisible(),false);
  }
  await page.waitForFunction(()=>{const key=[...Object.keys(localStorage),...Object.keys(sessionStorage)].find(k=>k.startsWith('chido:recovery:v2:'));return key&&JSON.parse(localStorage.getItem(key)||sessionStorage.getItem(key)).scene.items.length===2;});
  if(a.role==='branch')assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('chido:recovery:v2:'))),false);
  await page.reload();await page.locator('#startAR:not([disabled])').waitFor({timeout:60000});await page.waitForFunction(()=>globalThis.__qaStudio.items.length===2&&globalThis.__qaStudio.items.every(m=>m.userData.modelLoaded),null,{timeout:60000});assert.deepEqual(await page.evaluate(()=>globalThis.__qaStudio.items.map(m=>m.userData.index)),[22,25]);
  // A legacy procedural draft must not reappear if the new recovery record is absent.
  await page.evaluate(()=>{const scene=globalThis.__qaStudio.exportState();scene.items=[{...scene.items[0],index:0}];for(const store of [localStorage,sessionStorage])for(const k of Object.keys(store))if(k.startsWith('chido:recovery:v2:'))store.removeItem(k);localStorage.setItem('chido:draft:v1',JSON.stringify({scene,updatedAt:Date.now()}));globalThis.__qaStudio.items=[];});
  await page.reload();await page.locator('#startAR:not([disabled])').waitFor({timeout:60000});assert.equal(await page.evaluate(()=>globalThis.__qaStudio.items.length),0);
  await page.context().close();console.log('PASS real GLBs, textures, v15 sofa-only shadow, retained renderer, scoped refresh and legacy draft rejection: '+a.role);
 }));
 assert.deepEqual(errors,[]);console.log('AR RENDER RECOVERY QA PASSED');
}finally{await browser.close();await new Promise(r=>server.close(r));}
