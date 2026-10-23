import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createDevPreviews,injectSource,APPS} from '../scripts/dev-previews.mjs';

async function harness(t,handler,startFixture){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'preview-hardening-')),assets=path.join(root,'public/v1');fs.mkdirSync(assets,{recursive:true});
 for(const [name,content]of Object.entries({'manifest.json':JSON.stringify({version:'1.17.0',revision:'a'.repeat(64)}),'styles.css':'body{}','runtime.js':'/* current */','icons.svg':'<svg/>'}))fs.writeFileSync(path.join(assets,name),content);
 const upstream=http.createServer(handler||((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><head></head><body>Fixture</body></html>');}));
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const origin=`http://127.0.0.1:${upstream.address().port}`;
 const manager=createDevPreviews({root,startFixture:startFixture||async function(){return {origin,processChild:{exitCode:null}};}});
 const server=http.createServer((req,res)=>{if(!manager.handle(req,res)){res.writeHead(404);res.end();}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await manager.close();server.closeAllConnections();server.close();upstream.closeAllConnections();upstream.close();fs.rmSync(root,{recursive:true,force:true});});
 return {root,assets,manager,server,upstream,origin,base:`http://127.0.0.1:${server.address().port}`};
}
function raw(base,requestPath,headers={}){
 return new Promise((resolve,reject)=>{
  const req=http.request(base,{path:requestPath,headers},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();
 });
}

test('source previews reuse one app, preserve native requests and overlay only shared assets',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'source-preview-test-'));fs.mkdirSync(path.join(root,'public/v1'),{recursive:true});
 const assets=path.join(root,'public/v1');const manifest={version:'1.14.0',revision:'a'.repeat(64),stylesheet:'styles.'+'a'.repeat(64)+'.css'};
 for(const [name,content]of Object.entries({'manifest.json':JSON.stringify(manifest),'styles.css':'body{}','runtime.js':'/* current source */','icons.svg':'<svg/>'}))fs.writeFileSync(path.join(assets,name),content);
 const requests=[];const upstream=http.createServer((req,res)=>{requests.push({url:req.url,method:req.method,host:req.headers.host,origin:req.headers.origin,cookie:req.headers.cookie,fetchSite:req.headers['sec-fetch-site']});if(req.url==='/redirect'){res.writeHead(303,{Location:`http://${req.headers.host}/next`,'Set-Cookie':'fixture=rich; Path=/; HttpOnly'});res.end();return;}res.setHeader('Content-Type','text/html');res.end('<html data-ui="personal" data-ui-version="1.0.0"><head></head><body><textarea>Keep me</textarea></body></html>');});upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 let starts=0;const manager=createDevPreviews({root,startFixture:async()=>{starts++;await new Promise(r=>setTimeout(r,20));return {origin:`http://127.0.0.1:${upstream.address().port}`,processChild:{exitCode:null}};}});
 const server=http.createServer((req,res)=>{if(!manager.handle(req,res)){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 t.after(()=>{manager.close();server.closeAllConnections();server.close();upstream.closeAllConnections();upstream.close();fs.rmSync(root,{recursive:true,force:true});});
 assert.equal((await fetch(base+'/previews')).status,200);
 assert.equal((await fetch(base+'/previews/portal/open')).status,404);
 assert.equal((await fetch(base+'/previews/portal/open',{method:'POST',headers:{origin:'https://foreign.test'}})).status,403);
 assert.equal(await new Promise(resolve=>{const req=http.request(base+'/previews/portal/open',{method:'POST',headers:{host:'foreign.test'}},res=>{res.resume();resolve(res.statusCode);});req.end();}),403);
 const launched=await Promise.all([1,2].map(()=>fetch(base+'/previews/portal/open',{method:'POST',redirect:'manual'})));
 assert.equal(starts,1);assert.equal(launched[0].headers.get('location'),launched[1].headers.get('location'));
 const preview=new URL(launched[0].headers.get('location')).origin;
 const page=await(await fetch(preview)).text();assert.match(page,/data-ui-version="1.14.0"/);assert.match(page,/live.js/);assert.match(page,/<textarea>Keep me<\/textarea>/);
 for(const prefix of ['/assets/shared-ui','/gui/shared-ui','/shared-ui','/static/shared-ui','/ui/shared-ui'])assert.equal(await(await fetch(preview+prefix+'/runtime.js')).text(),'/* current source */');
 assert.deepEqual(await(await fetch(preview+'/__shared_ui_dev/assets/manifest.json')).json(),manifest);
 const redirect=await fetch(preview+'/redirect',{method:'POST',redirect:'manual',headers:{origin:preview,cookie:'fixture=rich','sec-fetch-site':'same-site'}});assert.equal(redirect.headers.get('location'),'/next');assert.match(redirect.headers.get('set-cookie'),/fixture=rich/);assert.equal(requests.at(-1).method,'POST');assert.equal(requests.at(-1).fetchSite,'same-origin');assert.equal(requests.at(-1).origin,`http://127.0.0.1:${upstream.address().port}`);
 const stream=await fetch(preview+'/__shared_ui_dev/events');const reader=stream.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/data: .*"code"/);
 fs.writeFileSync(path.join(assets,'runtime.js'),'/* edited */');manager.changed();const next=new TextDecoder().decode((await reader.read()).value);assert.notEqual(JSON.parse(first.slice(6)).code,JSON.parse(next.slice(6)).code);await reader.cancel();
 assert.equal((await fetch(preview+'/sw.js')).status,404);
});

test('source identity replaces installed update source and stale baseline integrity',()=>{
 const html=injectSource('<html data-ui="personal" data-ui-source="https://old" data-ui-version="1.0.0"><head><link rel="stylesheet" href="/shared-ui/styles.css" data-ui-baseline integrity="old"></head></html>',{version:'1.14.0',revision:'new'});
 assert.doesNotMatch(html,/https:\/\/old|integrity="old"/);assert.equal((html.match(/data-ui-source=/g)||[]).length,1);
});

test('preview requests reject malformed paths, mismatched loopback hosts and cross-origin mutations',async t=>{
 const {manager,base}=await harness(t),session=await manager.launch(APPS[0]),preview=new URL(session.url).origin;
 for(const origin of [base,preview]){
  for(const pathname of ['http://[','//[','/%E0%A4%A'])assert.equal(await raw(origin,pathname),400);
  assert.equal(await raw(origin,origin===base?'/previews':'/',{host:'127.0.0.1:1'}),403);
  assert.equal((await fetch(origin+(origin===base?'/previews':'/'),{headers:{'sec-fetch-site':'cross-site'}})).status,403);
 }
 assert.equal((await fetch(base+'/previews/portal/open',{method:'POST',headers:{'sec-fetch-site':'same-site'}})).status,403);
 assert.equal((await fetch(preview)).status,200);
 assert.equal((await fetch(base+'/previews')).status,200);
});

test('preview origins must be exact loopback HTTP endpoints before proxy creation',async t=>{
 let origin;const {manager}=await harness(t,null,async()=>({origin,processChild:{exitCode:null}}));
 for(origin of ['https://127.0.0.1:1234','http://example.test:1234','http://127.0.0.1:1234/path','http://user:secret@127.0.0.1:1234','http://127.0.0.1:1234/?query'])
  await assert.rejects(manager.launch(APPS[0]),/exact loopback/);
});

test('signal-terminated previews restart and closed launchers never start another fixture',async t=>{
 let origin,starts=0;const children=[];
 const fixture=await harness(t,null,async()=>{starts++;const processChild={exitCode:null,signalCode:null};children.push(processChild);return {origin,processChild};});
 origin=fixture.origin;
 const first=await fixture.manager.launch(APPS[0]);children[0].signalCode='SIGTERM';
 const second=await fixture.manager.launch(APPS[0]);assert.equal(starts,2);assert.notEqual(first.url,second.url);
 await fixture.manager.close();await assert.rejects(fixture.manager.launch(APPS[0]),/closed/);assert.equal(starts,2);
});

test('shutdown during a pending launch cannot publish a late proxy',async t=>{
 let complete;const {manager,origin}=await harness(t,null,()=>new Promise(resolve=>{complete=resolve;}));
 const pending=manager.launch(APPS[0]);const rejected=assert.rejects(pending,/closed/);
 await manager.close();complete({origin,processChild:{exitCode:null}});await rejected;
});

test('missing or malformed source assets return errors without crashing the preview host',async t=>{
 const {root,assets,manager}=await harness(t),preview=new URL((await manager.launch(APPS[0])).url).origin;
 const privateFile=path.join(root,'private.txt');fs.writeFileSync(privateFile,'private bytes');fs.unlinkSync(path.join(assets,'styles.css'));fs.symlinkSync(privateFile,path.join(assets,'styles.css'));
 const asset=await fetch(preview+'/__shared_ui_dev/assets/styles.css');assert.equal(asset.status,404);assert.doesNotMatch(await asset.text(),/private bytes/);
 fs.writeFileSync(path.join(assets,'manifest.json'),'{');
 assert.equal((await fetch(preview+'/__shared_ui_dev/events')).status,503);
 assert.equal((await fetch(preview)).status,503);
 fs.writeFileSync(path.join(assets,'manifest.json'),JSON.stringify({version:'1.17.0',revision:'a'.repeat(64)}));
 assert.equal((await fetch(preview)).status,200);
});

test('preview event streams reject HEAD, cap subscribers, and release capacity on disconnect',async t=>{
 const {manager}=await harness(t),preview=new URL((await manager.launch(APPS[0])).url).origin;
 assert.equal((await fetch(preview+'/__shared_ui_dev/events',{method:'HEAD'})).status,405);
 const streams=await Promise.all(Array.from({length:64},()=>fetch(preview+'/__shared_ui_dev/events')));
 t.after(()=>Promise.all(streams.map(stream=>stream.body.cancel().catch(()=>{}))));
 assert.ok(streams.every(stream=>stream.status===200));
 assert.equal((await fetch(preview+'/__shared_ui_dev/events')).status,503);
 await streams[0].body.cancel();
 // Observe the actual disconnect before checking capacity; no arbitrary delay.
 for(let attempt=0;attempt<20;attempt++){
  const response=await fetch(preview+'/__shared_ui_dev/events');
  if(response.status===200){await response.body.cancel();return;}
  await response.body.cancel();await new Promise(resolve=>setImmediate(resolve));
 }
 assert.fail('Closed subscriber did not release its capacity');
});

test('truncated upstream responses do not crash the proxy and HEAD keeps native metadata',async t=>{
 const {manager}=await harness(t,(req,res)=>{
  res.setHeader('Content-Type','text/html');res.setHeader('Content-Length','50');
  if(req.url==='/broken'){res.write('<html>');setImmediate(()=>res.destroy());}
  else res.end(' '.repeat(50));
 });
 const preview=new URL((await manager.launch(APPS[0])).url).origin;
 await assert.rejects(async()=>{const response=await fetch(preview+'/broken');await response.text();});
 const head=await fetch(preview,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'50');
 assert.equal((await fetch(preview)).status,200);
});

test('real owned fixture children restart in fresh scratch and shutdown waits for forced termination',async t=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'preview-owned-child-')),root=path.join(workspace,'shared-ui'),app=path.join(workspace,'aura');
 fs.mkdirSync(root);
 for(const name of ['control','mcp','runtime','shared','packages'])fs.mkdirSync(path.join(app,name),{recursive:true});
 fs.writeFileSync(path.join(app,'control/host.mjs'),`import http from 'node:http';
 process.on('SIGTERM',()=>{});
 http.createServer((req,res)=>res.end('synthetic fixture')).listen(Number(process.env.AURA_CONTROL_PORT),'127.0.0.1');
 `);
 const manager=createDevPreviews({root});
 t.after(async()=>{await manager.close();fs.rmSync(workspace,{recursive:true,force:true});if(manager.logDirectory)fs.rmSync(manager.logDirectory,{recursive:true,force:true});});
 const first=await manager.launch(APPS.find(app=>app.id==='aura'));
 const firstExit=once(first.processChild,'exit');first.processChild.kill('SIGKILL');await firstExit;
 const second=await manager.launch(APPS.find(app=>app.id==='aura'));
 assert.notEqual(first.processChild.pid,second.processChild.pid);
 const secondExit=once(second.processChild,'exit');await manager.close();
 assert.deepEqual(await secondExit,[null,'SIGKILL']);
 await assert.rejects(manager.launch(APPS[1]),/closed/);
});
