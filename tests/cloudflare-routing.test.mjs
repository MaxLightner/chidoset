import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../deploy/cloudflare-worker.mjs';

const route = async (url, method='GET') => {
  let requested;
  const response=await worker.fetch(new Request(url,{method}),{ASSETS:{fetch:async request=>{
    requested=new URL(request.url).pathname;
    return new Response('asset',{headers:{'Content-Type':'text/html'}});
  }}});
  return {response,requested};
};
test('production hosts select distinct website, application and admin entry points',async()=>{
  for(const [host,path] of [['chidoset.ir','/website/'],['app.chidoset.ir','/'],['admin.chidoset.ir','/central']]){
    const result=await route(`https://${host}/`);
    assert.equal(result.requested,path);
    assert.equal(result.response.headers.get('cache-control'),'no-store');
  }
});
test('canonical host redirects keep invite parameters and avoid mixing account origins',async()=>{
  const admin=await route('https://app.chidoset.ir/central.html?activate=1');
  assert.equal(admin.response.headers.get('location'),'https://admin.chidoset.ir/?activate=1');
  const company=await route('https://chidoset.ir/company.html?activate=1');
  assert.equal(company.response.headers.get('location'),'https://app.chidoset.ir/company.html?activate=1');
  const www=await route('https://www.chidoset.ir/?source=presentation');
  assert.equal(www.response.status,308);
  assert.equal(www.response.headers.get('location'),'https://chidoset.ir/?source=presentation');
});
test('shared assets keep their original paths; unfinished stores and unsafe methods do not become the marketing page',async()=>{
  assert.equal((await route('https://app.chidoset.ir/assets/models/chair.glb')).requested,'/assets/models/chair.glb');
  assert.equal((await route('https://chidoset.ir/website/app.js')).requested,'/website/app.js');
  assert.equal((await route('https://chidoset.ir/stores/example')).response.status,404);
  assert.equal((await route('https://admin.chidoset.ir/','POST')).response.status,405);
});
