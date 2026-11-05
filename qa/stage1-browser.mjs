import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const fixtures=await new Promise(resolve=>{
 let buffer='';process.stdin.setEncoding('utf8');if(process.stdin.isTTY)process.stdin.setRawMode(true);
 console.log('Ready for QA fixture JSON (hidden).');
 process.stdin.on('data',chunk=>{buffer+=chunk;if(buffer.includes('\n')||buffer.includes('\r')){if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();resolve(JSON.parse(buffer.trim()));}});
});
const root=path.resolve(import.meta.dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.hdr':'application/octet-stream'};
const server=createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error();const data=await readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const contexts=[];const errors=[];
async function pageFor(){const context=await browser.newContext({viewport:{width:1280,height:900}});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});page.on('requestfailed',r=>console.error('Request failed:',new URL(r.url()).origin,r.failure()?.errorText));return page;}
const a=fixtures.find(x=>x.slug.endsWith('-a')&&x.role==='company_admin');
const branchFixture=fixtures.find(x=>x.slug.endsWith('-a')&&x.role==='branch');
const other=fixtures.find(x=>x.slug.endsWith('-b')&&x.role==='branch');
const email='qa-'+randomBytes(8).toString('hex')+'@example.com';
const password=randomBytes(24).toString('hex')+'aA9!';
let host,guest,manager;
try{
 manager=await pageFor();await manager.goto(base+'/website/');
 await manager.locator('[data-action="login"]').first().click();await manager.waitForURL('**/portal.html#company-access');
 await manager.locator('#companyInviteCode').fill(a.code);await manager.locator('#companyAdminEmail').fill(email);await manager.locator('#companyAdminPassword').fill(password);
 await manager.locator('#companyActivationForm button[type=submit]').click();
 await manager.locator('#companyDashboard').waitFor({state:'visible',timeout:45000});
 assert.match(await manager.locator('#dashboardCompanyName').innerText(),/QA Stage 1 A/);
 console.log('PASS website -> manager activation -> real dashboard');
 await manager.reload();await manager.locator('#companyDashboard').waitFor({state:'visible',timeout:30000});
 console.log('PASS manager session persists after reload');
 const saved=await manager.evaluate(async setId=>{
  const c=await import('/chido-cloud.js?v=0.10.0');
  const record=await c.saveOfficialLayout({setId,name:'QA official layout',room:'پذیرایی',capacity:5,sceneState:null});
  const color=await c.saveOfficialColorway({setId,name:'QA colorway',materialMap:{'0':{color:'#244957'}}});
  return {layoutId:record.id,colorId:color.id};
 },a.set_id);
 console.log('PASS manager saves official layout and colorway');
 host=await pageFor();await host.goto(base+'/index.html#access');
 await host.locator('#branchActivationCode').fill(branchFixture.code);await host.locator('#branchActivationForm button[type=submit]').click();
 await host.waitForURL('**/#welcome', {timeout:45000}).catch(async()=>{await host.waitForFunction(()=>location.hash==='#welcome',{},{timeout:1000});});
 await host.evaluate(async()=>{globalThis.cloud=await import('/chido-cloud.js?v=0.10.0');});
 const catalog=await host.evaluate(async company=>{const sets=await cloud.loadCompanySets(company);return {sets:sets.length,products:sets[0]?.products.length,layouts:sets[0]?.layouts.length};},a.company_id);
 assert.deepEqual(catalog,{sets:1,products:32,layouts:1});
 const replay=await host.evaluate(async code=>{try{await cloud.activateBranch(code);return false;}catch{return true;}},branchFixture.code);assert.equal(replay,true);
 console.log('PASS branch UI activation, 32 products, official records, one-time code');
 const denied=await host.evaluate(async values=>{
  const user=(await cloud.supabase.auth.getUser()).data.user;
  const cross=await cloud.supabase.from('sets').select('id').eq('company_id',values.otherCompany);
  const save=await cloud.supabase.from('layouts').insert({set_id:values.setId,name:'Forbidden branch save',created_by:user.id});
  const tenant=await cloud.supabase.from('live_sessions').insert({company_id:values.company,branch_id:values.otherBranch,host_user_id:user.id,guest_token_hash:crypto.randomUUID(),expires_at:new Date(Date.now()+60000).toISOString()});
  return {cross:cross.data?.length,save:!!save.error,tenant:!!tenant.error};
 },{otherCompany:other.company_id,setId:a.set_id,company:a.company_id,otherBranch:other.branch_id});
 assert.deepEqual(denied,{cross:0,save:true,tenant:true});
 console.log('PASS branch write denied and cross-company read/session denied');
 const live=await host.evaluate(async()=>{
  const {Studio}=await import('/scene.js?v=0.10.0');
  const mount=document.createElement('div');mount.style.cssText='position:fixed;inset:0;width:900px;height:700px';document.body.append(mount);
  const s=globalThis.qaStudio=new Studio(mount,()=>{});s.seed();s.model.origin.set(1,-.4,-2);s.model.anchorYaw=.3;s.syncSpatial();
  const camera=s.cameraSnapshot();const scene=s.exportLiveState();
  const live=await cloud.createLiveSession({sceneState:scene,cameraState:camera});
  return {id:live.id,url:live.url,camera,floorPose:scene.floorPose,count:scene.items.length};
 });
 guest=await pageFor();await guest.goto(live.url);await guest.locator('#guestState.connected').waitFor({timeout:45000});
 await guest.evaluate(async()=>{
  const {Studio}=await import('/scene.js?v=0.10.0');const original=Studio.prototype.applyExternalCameraState;
  Studio.prototype.applyExternalCameraState=function(state){const result=original.call(this,state);globalThis.guestSnapshot={camera:this.cameraSnapshot(),floorPose:this.floorFrame.matrixWorld.toArray(),count:this.items.length};return result;};
 });
 await guest.waitForFunction(()=>globalThis.guestSnapshot,{},{timeout:15000});
 const snapshot=await guest.evaluate(()=>guestSnapshot);
 assert.equal(snapshot.count,live.count);assert.deepEqual(snapshot.camera.projectionMatrix,live.camera.projectionMatrix);
 snapshot.floorPose.forEach((n,i)=>assert.ok(Math.abs(n-live.floorPose[i])<1e-8));
 assert.equal(await guest.locator('canvas').count(),1);
 console.log('PASS guest renders host scene, floor transform and exact camera projection');
 const guestDenied=await guest.evaluate(async id=>{
  const c=await import('/chido-cloud.js?v=0.10.0');
  const write=await c.supabase.from('live_session_scenes').update({scene_state:{hacked:true}}).eq('session_id',id).select();
  const sets=await c.supabase.from('sets').select('id');const products=await c.supabase.from('products').select('id');
  return {written:write.data?.length||0,sets:sets.data?.length||0,products:products.data?.length||0};
 },live.id);assert.deepEqual(guestDenied,{written:0,sets:0,products:0});
 console.log('PASS guest cannot write or read company catalog');
 // A guest tab on the manager origin must use independent session storage.
 const shared=await manager.context().newPage();await shared.goto(live.url);await shared.locator('#guestState.connected').waitFor({timeout:30000});
 await manager.reload();await manager.locator('#companyDashboard').waitFor({state:'visible',timeout:30000});await shared.close();
 console.log('PASS guest link preserves manager login in same browser');
 await guest.context().setOffline(true);await new Promise(r=>setTimeout(r,4000));
 assert.equal(await guest.locator('canvas').count(),1);
 await host.evaluate(async id=>{const camera=qaStudio.cameraSnapshot();camera.position[0]+=1;camera.timestamp=Date.now();await cloud.publishLiveCamera(id,camera);},live.id);
 await guest.context().setOffline(false);
 await guest.waitForFunction(x=>globalThis.guestSnapshot?.camera.position[0]===x,live.camera.position[0]+1,{timeout:20000});
 console.log('PASS transient offline retains scene and reconnect restores latest camera');
 await manager.evaluate(async values=>{const c=await import('/chido-cloud.js?v=0.10.0');await c.archiveOfficialLayout(values.layoutId);await c.archiveOfficialColorway(values.colorId);},saved);
 const remaining=await host.evaluate(async company=>{const s=await cloud.loadCompanySets(company);return [s[0].layouts.length,s[0].colorways.length];},a.company_id);assert.deepEqual(remaining,[0,0]);
 console.log('PASS archived official records disappear from branch library');
 await host.evaluate(async id=>{await cloud.stopLiveSession(id);},live.id);
 await guest.locator('#guestState').filter({hasText:'پایان نمایش'}).waitFor({timeout:20000});assert.equal(await guest.locator('canvas').count(),0);
 console.log('PASS host revocation ends guest access and removes canvas');
 await manager.locator('#companySignOut').click();await manager.locator('#companyLoginForm').waitFor({state:'visible'});
 console.log('PASS manager logout');
 assert.deepEqual(errors,[],'Unexpected browser errors');console.log('ALL STAGE 1 BROWSER CHECKS PASSED');
}catch(error){console.error('QA FAILED:',error.message);for(const page of [manager,host,guest].filter(Boolean)){console.error('Page:',new URL(page.url()).pathname);for(const selector of ['#activationMessage','#loginMessage','#accessMessage','#guestMessage']){if(await page.locator(selector).count())console.error(selector,await page.locator(selector).innerText());}}process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.close(r));}
