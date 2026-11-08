import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve(import.meta.dirname,'..');
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  let name=new URL(req.url,'http://127.0.0.1').pathname;
  if(name.endsWith('/'))name+='index.html';
  const file=path.resolve(root,'.'+decodeURIComponent(name));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:820}});
 const browserErrors=[];
 page.on('pageerror',e=>browserErrors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const {Studio}=await import('/studio.js?v=0.14.2');
  const host=document.createElement('div');
  host.style.cssText='position:fixed;inset:0;background:#d7d4cb;z-index:10000;';
  document.body.append(host);
  const studio=new Studio(host,()=>{});
  const chair=studio.addAtMarker(1000);
  if(!chair)return {error:'Placement returned null'};
  await chair.userData.loadPromise;
  const visual=chair.getObjectByName('imported-visual');
  const fabrics=[],meshes=[];
  visual?.traverse(o=>{
   if(!o.isMesh)return;
   meshes.push(o.name);
   for(const material of (Array.isArray(o.material)?o.material:[o.material])){
    if((material?.sheen??0)>0||material?.sheenColorMap||material?.sheenRoughnessMap)
     fabrics.push({name:material.name,sheen:material.sheen,isPhysical:material.isMeshPhysicalMaterial,
       textured:!!material.map,normal:!!material.normalMap});
   }
  });
  const bounds=visual?new (await import('/vendor/three.module.js')).Box3().setFromObject(visual).getSize(new (await import('/vendor/three.module.js')).Vector3()):null;
  studio.renderer.render(studio.scene,studio.camera);
  return {placed:chair.userData.index,loaded:!!chair.userData.modelLoaded,
   error:chair.userData.loadError||null,meshCount:meshes.length,
   fabrics,bounds:bounds?.toArray(),webgl:!!studio.renderer.getContext()};
 });
 console.log(JSON.stringify(result,null,2));
 assert.equal(result.error,null);
 assert.equal(result.placed,1000);
 assert.equal(result.loaded,true);
 assert.ok(result.meshCount>=4);
 assert.ok(result.fabrics.some(f=>f.isPhysical&&f.sheen>0&&f.textured));
 assert.ok(result.webgl);
 assert.deepEqual(browserErrors,[]);
 console.log('PASS SheenChair added at AR marker, GLB rendered with physical sheen materials');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
