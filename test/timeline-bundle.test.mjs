import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {installTimeline} from '../scripts/timeline-bundle.mjs';
test('optional timeline package validates integrity before changing its consumer',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ui-timeline-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const source=path.join(root,'source'),target=path.join(root,'target');fs.mkdirSync(source);fs.mkdirSync(target);
 for(const name of ['timeline.css','timeline.manifest.json'])fs.copyFileSync(new URL('../public/v1/'+name,import.meta.url),path.join(source,name));
 installTimeline(target,{source});assert.deepEqual(installTimeline(target,{source,check:true}).changed,[]);const before=fs.readFileSync(path.join(target,'timeline.css'),'utf8');
 fs.appendFileSync(path.join(source,'timeline.css'),'bad');assert.throws(()=>installTimeline(target,{source}),/integrity/);assert.equal(fs.readFileSync(path.join(target,'timeline.css'),'utf8'),before);
});
