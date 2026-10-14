import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {createStyleLabServer} from '../scripts/serve.mjs';
import {buildSite} from '../scripts/build.mjs';
const root=path.resolve(import.meta.dirname,'..');
buildSite();
test('local host serves only public assets with validators, ranges, and a safe refresh endpoint',async t=>{
 const server=createStyleLabServer({watch:false});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.closeAllConnections();server.close();});const base=`http://127.0.0.1:${server.address().port}`;
 const get=(url,options)=>fetch(base+url,options);
 const health=await (await get('/health')).json();assert.equal(health.ok,true);assert.equal(health.service,'shared-ui');
 const page=await get('/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/script-src 'self';/);assert.match(await page.text(),/Style Lab/);
 for(const url of ['/src/tokens.json','/README.md','/.git/config','/%2e%2e/README.md','/assets/../../package.json'])assert.equal((await get(url)).status,404);
 const manifest=await (await get('/v1/manifest.json')).json();const css=await get('/v1/'+manifest.stylesheet);const bytes=Buffer.from(await css.arrayBuffer());
 assert.equal(manifest.version,JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version);
 assert.equal('sha384-'+createHash('sha384').update(bytes).digest('base64'),manifest.integrity);assert.match(css.headers.get('cache-control'),/immutable/);assert.equal(css.headers.get('access-control-allow-origin'),'*');
 assert.equal((await get('/v1/'+manifest.stylesheet,{headers:{'if-none-match':css.headers.get('etag')}})).status,304);
 assert.equal((await get('/v1/styles.css',{method:'HEAD'})).headers.get('content-type'),'text/css; charset=utf-8');
 const media=await get('/assets/sample.mp4',{headers:{range:'bytes=0-19'}});assert.equal(media.status,206);assert.equal((await media.arrayBuffer()).byteLength,20);assert.match(media.headers.get('content-range'),/^bytes 0-19\//);
 assert.equal((await get('/assets/sample.mp4',{headers:{range:'bytes=99999999-'}})).status,416);
 assert.equal((await get('/refresh',{method:'POST'})).status,403);
 assert.equal((await get('/refresh',{method:'POST',headers:{'x-ui-lab':'refresh',origin:'https://unrelated.test'}})).status,403);
 assert.equal((await get('/refresh',{method:'POST',headers:{'x-ui-lab':'refresh'}})).status,200);
 assert.equal((await get('/v1/styles.css',{method:'DELETE'})).status,405);
});
test('build errors do not replace the last working manifest or stylesheet',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shared-ui-build-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'src'),path.join(directory,'src'),{recursive:true});buildSite(directory);
 const before=fs.readFileSync(path.join(directory,'public/v1/manifest.json'),'utf8');
 fs.writeFileSync(path.join(directory,'src/icons.json'),' {"bad-icon":["javascript:bad"]}');assert.throws(()=>buildSite(directory),/Invalid icon path/);
 assert.equal(fs.readFileSync(path.join(directory,'public/v1/manifest.json'),'utf8'),before);
});

test('invalid browser code cannot replace the working lab release',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shared-ui-code-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'src'),path.join(directory,'src'),{recursive:true});buildSite(directory);
 const before=fs.readFileSync(path.join(directory,'public/lab.js'),'utf8');
 fs.writeFileSync(path.join(directory,'src/lab.js'),'(() => { broken syntax');assert.throws(()=>buildSite(directory),SyntaxError);
 assert.equal(fs.readFileSync(path.join(directory,'public/lab.js'),'utf8'),before);
});
