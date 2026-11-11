import test from 'node:test';
import assert from 'node:assert/strict';
import {zipPhotoFiles} from '../download-zip.js';

test('creates a ZIP with UTF-8 filenames and exact photo bytes',async()=>{
 const bytes=new Uint8Array([0,12,23,255,79,0,10]);
 const zip=zipPhotoFiles([{name:'مبل-نما.webp',bytes}]);
 const raw=new Uint8Array(await zip.arrayBuffer()),view=new DataView(raw.buffer);
 assert.equal(zip.type,'application/zip');
 assert.equal(view.getUint32(0,true),0x04034b50);
 const nameLength=view.getUint16(26,true),dataAt=30+nameLength;
 assert.deepEqual([...raw.slice(dataAt,dataAt+bytes.length)],[...bytes]);
 assert.equal(view.getUint32(raw.length-22,true),0x06054b50);
 assert.equal(view.getUint16(raw.length-22+10,true),1);
});

test('rejects an empty download',()=>{
 assert.throws(()=>zipPhotoFiles([]),/عکسی/);
});
