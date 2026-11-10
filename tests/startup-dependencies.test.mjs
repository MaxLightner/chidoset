import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '../vendor/supabase-js-2.119.0.mjs';
import * as QRCode from '../vendor/qrcode-1.5.4.mjs';

test('application, account and live viewer code do not need an external module CDN',()=>{
 const seen=new Set();
 function visit(url){
  const identity=new URL(url);identity.search='';
  if(seen.has(identity.href))return;
  seen.add(identity.href);
  const source=readFileSync(identity,'utf8');
  const imports=[...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+[^;\n]*?from\s*['"]([^'"]+)['"]/g),...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)];
  for(const [,name] of imports){
   assert.ok(!/^https?:/.test(name),'external startup module: '+name);
   if(name.startsWith('.'))visit(new URL(name,identity));
  }
 }
 for(const entry of ['app-bootstrap.js','login.js','central.js','live-viewer.js'])visit(new URL('../'+entry,import.meta.url));
 assert.ok(seen.size>20,'check the transitive application graph');
});

test('local client initializes a signed-out session without a network request',async()=>{
 let requests=0;
 const client=createClient('https://example.supabase.co','public-test-key',{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:()=>{requests++;throw Error('unexpected startup request');}}
 });
 assert.equal((await client.auth.getSession()).data.session,null);
 assert.equal(requests,0);
});

test('QR generation uses the local module and produces an SVG',async()=>{
 const svg=await QRCode.toString('https://chidoset.ir/live-viewer.html',{type:'svg',width:240});
 assert.match(svg,/<svg\b/);
 assert.match(svg,/viewBox=/);
});
