import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {webcrypto} from 'node:crypto';
test('telemetry counts UTF-8 payloads and live messages without retaining their content',async()=>{
 const uploads=[],document={visibilityState:'visible',addEventListener(){}},NativeWebSocket=class extends EventTarget{send(){}};
 const context=vm.createContext({document,WebSocket:NativeWebSocket,TextEncoder,crypto:webcrypto,Date,setInterval(){},addEventListener(){},fetch:async(url,init)=>{if(String(url).includes('chido-metrics')){uploads.push(JSON.parse(init.body));return new Response('{}');}return new Response('سلام');}});
 const source=(await readFile(new URL('../telemetry.js',import.meta.url),'utf8')).replaceAll('export ','');vm.runInContext(source+'\nglobalThis.qa={configureTelemetry,flushTelemetry};',context);
 context.qa.configureTelemetry({userId:'a',token:'secret-token',url:'https://example.com/chido-metrics',key:'public',client:'app'});
 await context.fetch('https://example.com/model.glb',{body:'x'});await new Promise(setImmediate);const socket=new context.WebSocket();socket.send('سلام');socket.dispatchEvent(new MessageEvent('message',{data:'abc'}));await context.qa.flushTelemetry();
 assert.equal(uploads[0].http_received,8);assert.equal(uploads[0].http_sent,1);assert.equal(uploads[0].ws_sent,8);assert.equal(uploads[0].ws_received,3);assert.equal(uploads[0].model_loads,1);assert.equal(uploads[0].requests,1);assert.equal(uploads[0].errors,0);assert.doesNotMatch(JSON.stringify(uploads),/secret-token|سلام|example.com/);
 context.qa.configureTelemetry({userId:'b',token:'b-token',url:'https://example.com/chido-metrics',key:'public',client:'company'});await context.qa.flushTelemetry();assert.equal(uploads.length,1,'new identity never receives pending counters from another user');
});
