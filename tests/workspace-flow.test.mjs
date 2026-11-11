import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWorkspace} from '../workspace-domain.mjs';

const id='12c492f0-7201-4a1f-9d84-12c492f07201';

test('model review is explicit, with a reason required for revisions',()=>{
 assert.deepEqual(validateWorkspace('request.review',{id,decision:'approve'}),{id,decision:'approve',body:''});
 assert.throws(()=>validateWorkspace('request.review',{id,decision:'revision',body:'نه'}),/طول/);
 assert.equal(validateWorkspace('request.review',{id,decision:'revision',body:'قسمت پایه اصلاح شود'}).decision,'revision');
});

test('agent passwords reject non-ASCII characters',()=>{
 const base={branch_id:id,display_name:'محمد احمدی',login_name:'seller11',status:'active'};
 assert.throws(()=>validateWorkspace('showroom.create',{...base,password:'passwordفارسی123'}),/انگلیسی/);
 assert.equal(validateWorkspace('showroom.create',{...base,password:'English123!'}).login_name,'seller11');
});

test('photos must remain strictly below one megabyte',()=>{
 const photo={object_path:`${id}/${id}/${id}.webp`,filename:'front.webp',mime_type:'image/webp',caption:''};
 assert.equal(validateWorkspace('media.register',{...photo,bytes:999999}).bytes,999999);
 assert.throws(()=>validateWorkspace('media.register',{...photo,bytes:1000000}),/محدوده/);
});
