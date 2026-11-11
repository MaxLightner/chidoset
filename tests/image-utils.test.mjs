import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareUploadPhoto} from '../image-utils.js';

function mockCanvas({webp=true,sizes=[300_000]}={}){
 const originalBitmap=globalThis.createImageBitmap,originalDocument=globalThis.document;
 let calls=0,closed=0;
 globalThis.createImageBitmap=async()=>({width:4200,height:2800,close(){closed++;}});
 globalThis.document={createElement:()=>({width:0,height:0,getContext(){return {fillRect(){},drawImage(){},set fillStyle(_){} };},toBlob(callback,type){const size=sizes[Math.min(calls++,sizes.length-1)];callback(new Blob([new Uint8Array(size)],{type:type==='image/webp'&&!webp?'image/png':type}));}})};
 return {stats:()=>({calls,closed}),restore(){globalThis.createImageBitmap=originalBitmap;globalThis.document=originalDocument;}};
}

test('keeps source photographs under one megabyte unchanged',async()=>{
 const original=new Blob([new Uint8Array(500_000)],{type:'image/jpeg'});
 assert.equal(await prepareUploadPhoto(original),original);
});

test('converts large photos to WebP under one megabyte and releases the decoded image',async()=>{
 const mock=mockCanvas();
 try{
  const original=new Blob([new Uint8Array(10_000_000)],{type:'image/jpeg'});
  const output=await prepareUploadPhoto(original);
  assert.equal(output.type,'image/webp');assert.equal(output.size,300_000);
  assert.deepEqual(mock.stats(),{calls:1,closed:1});
 }finally{mock.restore();}
});

test('falls back to JPEG when browser cannot encode WebP',async()=>{
 const mock=mockCanvas({webp:false});
 try{
  const original=new Blob([new Uint8Array(9_000_000)],{type:'image/png'});
  const output=await prepareUploadPhoto(original);
  assert.equal(output.type,'image/jpeg');assert.equal(mock.stats().closed,1);
 }finally{mock.restore();}
});

test('retries with smaller images until the output meets the upload limit',async()=>{
 const mock=mockCanvas({sizes:[1_200_000,850_000]});
 try{
  const original=new Blob([new Uint8Array(12_000_000)],{type:'image/jpeg'});
  const output=await prepareUploadPhoto(original);
  assert.equal(output.size,850_000);assert.equal(mock.stats().calls,2);
 }finally{mock.restore();}
});

test('reports a clear error when even the compressed image is too large',async()=>{
 const mock=mockCanvas({sizes:[1_200_000]});
 try{
  const original=new Blob([new Uint8Array(12_000_000)],{type:'image/jpeg'});
  await assert.rejects(prepareUploadPhoto(original),/حجم عکس پس از فشرده‌سازی/);
  assert.equal(mock.stats().closed,1);
 }finally{mock.restore();}
});
