import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {installBundle} from '../scripts/install.mjs';
import {buildSite} from '../scripts/build.mjs';
buildSite();
test('app packaging copies only validated UI assets and detects authored drift',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shared-ui-install-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const result=installBundle(directory);assert.equal(result.changed.length,5);assert.deepEqual(fs.readdirSync(directory).sort(),['bundle.json','icons.svg','manifest.json','runtime.js','styles.css']);
 const time=fs.statSync(path.join(directory,'styles.css')).mtimeMs;assert.equal(installBundle(directory).changed.length,0);assert.equal(fs.statSync(path.join(directory,'styles.css')).mtimeMs,time);assert.equal(installBundle(directory,{check:true}).checked,true);
 fs.appendFileSync(path.join(directory,'styles.css'),'button{color:green}');assert.throws(()=>installBundle(directory,{check:true}),/out of date: styles.css/);installBundle(directory);assert.equal(installBundle(directory,{check:true}).changed.length,0);
});
test('a corrupt canonical build cannot replace an app’s working bundle',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shared-ui-corrupt-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const source=path.join(directory,'source'),target=path.join(directory,'target');fs.cpSync(new URL('../public/v1',import.meta.url),source,{recursive:true});installBundle(target,{source});
 const before=fs.readFileSync(path.join(target,'bundle.json'));fs.appendFileSync(path.join(source,'styles.css'),'button{color:red}');assert.throws(()=>installBundle(target,{source}),/integrity failed/);assert.deepEqual(fs.readFileSync(path.join(target,'bundle.json')),before);
});
