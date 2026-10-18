import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {installBundle} from '../scripts/install.mjs';
import {buildSite} from '../scripts/build.mjs';
import {auditBundle,discoverBundles} from '../scripts/audit-consumers.mjs';
buildSite();
test('app packaging copies only validated UI assets and detects authored drift',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shared-ui-install-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const result=installBundle(directory);assert.equal(result.changed.length,5);assert.deepEqual(fs.readdirSync(directory).sort(),['bundle.json','icons.svg','manifest.json','runtime.js','styles.css']);
 const time=fs.statSync(path.join(directory,'styles.css')).mtimeMs;assert.equal(installBundle(directory).changed.length,0);assert.equal(fs.statSync(path.join(directory,'styles.css')).mtimeMs,time);assert.equal(installBundle(directory,{check:true}).checked,true);
 fs.appendFileSync(path.join(directory,'styles.css'),'button{color:green}');assert.throws(()=>installBundle(directory,{check:true}),/out of date: styles.css/);installBundle(directory);assert.equal(installBundle(directory,{check:true}).changed.length,0);
});
test('a corrupt canonical build cannot replace an app’s working bundle',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shared-ui-corrupt-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const source=path.join(directory,'source'),target=path.join(directory,'target');fs.mkdirSync(source);for(const name of ['styles.css','runtime.js','icons.svg','manifest.json'])fs.copyFileSync(new URL('../public/v1/'+name,import.meta.url),path.join(source,name));installBundle(target,{source});
 const before=fs.readFileSync(path.join(target,'bundle.json'));fs.appendFileSync(path.join(source,'styles.css'),'button{color:red}');assert.throws(()=>installBundle(target,{source}),/integrity failed/);assert.deepEqual(fs.readFileSync(path.join(target,'bundle.json')),before);
});

test('catalogue advertises its bundled style contract to reject older CSS',()=>{
 const page=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const release=JSON.parse(fs.readFileSync(new URL('../public/v1/manifest.json',import.meta.url),'utf8'));
 assert.ok(page.includes(`data-ui-version="${release.version}"`));
 assert.ok(page.includes(`data-ui-revision="${release.revision}"`));
 const runtime=fs.readFileSync(new URL('../public/v1/runtime.js',import.meta.url),'utf8');assert.ok(runtime.includes('UI.captureLayout='));assert.ok(runtime.includes('UI.auditControls='));
});

test('consumer audit discovers bundles and separates valid older releases from authored drift',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shared-ui-audit-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const target=path.join(directory,'app/ui'),source=path.join(directory,'release');installBundle(target);installBundle(source);
 assert.deepEqual(discoverBundles(directory),[target,source].sort());assert.deepEqual(auditBundle(target).errors,[]);assert.deepEqual(auditBundle(target).stale,[]);
 fs.appendFileSync(path.join(source,'runtime.js'),'\n/* new release */');const stale=auditBundle(target,{source});assert.deepEqual(stale.errors,[]);assert.deepEqual(stale.stale,['runtime.js']);
 fs.appendFileSync(path.join(target,'styles.css'),'button{color:red}');assert.match(auditBundle(target).errors.join(' '),/Generated file drift: styles.css.*integrity/);
});

test('combined CommonJS bundle preserves the native action API beside floating helpers',()=>{
 const sandbox={module:{exports:{}},URL};
 vm.runInNewContext(fs.readFileSync(new URL('../public/v1/runtime.js',import.meta.url),'utf8'),sandbox);
 for(const name of ['adoptAction','setActionLabel','reserveText','createFloatingPanel'])assert.equal(typeof sandbox.module.exports[name],'function',name);
});
