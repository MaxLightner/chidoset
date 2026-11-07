import test from 'node:test';
import assert from 'node:assert/strict';
import {authStorage,rememberAccount,accountName} from '../auth-storage.js';
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
test('remembered session survives a new tab and keeps central and app accounts separate',()=>{
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();
 const app=authStorage('app'),central=authStorage('central');
 rememberAccount('app',true,'seller');app.setItem('app-token','session-a');
 rememberAccount('central',true,'manager');central.setItem('central-token','session-b');
 globalThis.sessionStorage=storage();
 assert.equal(app.getItem('app-token'),'session-a');assert.equal(central.getItem('central-token'),'session-b');assert.equal(accountName('app'),'seller');
 app.removeItem('app-token');assert.equal(app.getItem('app-token'),null);assert.equal(central.getItem('central-token'),'session-b');
});
test('unchecked remember migrates out of persistent storage and expires with the tab',()=>{
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();const store=authStorage('app');
 rememberAccount('app',true,'old');store.setItem('token','old-session');
 rememberAccount('app',false,'seller');store.setItem('token','new-session');
 assert.equal(localStorage.getItem('token'),null);assert.equal(localStorage.getItem('app-username'),null);assert.equal(store.getItem('token'),'new-session');
 globalThis.sessionStorage=storage();assert.equal(store.getItem('token'),null);assert.equal(accountName('app'),'');
});
