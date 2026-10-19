import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {debugAssets,installDebugBundle,DEBUG_BUDGET} from '../scripts/debug-bundle.mjs';
import {compactCSS} from '../scripts/build.mjs';
const context=vm.createContext({SharedUI:{}});vm.runInContext(fs.readFileSync(new URL('../src/debug.js',import.meta.url),'utf8'),context);
const m=context.SharedUI.debugModel;
const plain=value=>JSON.parse(JSON.stringify(value));
test('debug packets reject unsupported versions and never invent values',()=>{
 assert.throws(()=>m.normalize({version:2}));
 const packet=m.normalize({version:1,channels:[{id:'x',value:Infinity,samples:[{x:1,value:3},{x:0,value:0},{x:1,value:7},{x:2,value:null}]},{id:'flag',value:false}]});
 assert.equal(packet.channels[0].value,null);assert.equal(packet.channels[1].kind,'boolean');
 assert.deepEqual(plain(packet.channels[0].samples),[{x:0,value:0},{x:1,value:7},{x:2,value:null}]);
 assert.deepEqual(plain(m.extent(packet.channels)),[0,2]);
});
test('decimation preserves spikes and null gaps without mutating samples',()=>{
 const points=Array.from({length:1000},(_,x)=>({x,value:x===401?123:x===502?null:0}));const before=JSON.stringify(points),out=m.decimate(points,80);
 assert(out.some(p=>p.value===123));assert(out.some(p=>p.value===null));assert.equal(out[0].x,0);assert.equal(out.at(-1).x,999);assert.equal(JSON.stringify(points),before);
});
test('packet bounds, duplicate IDs and explicit range labels',()=>{
 const packet=m.normalize({version:1,channels:Array.from({length:600},(_,i)=>({id:'c'+i,value:i,samples:[{x:0,value:2}]}))});
 assert.equal(packet.channels.length,512);assert(packet.notices.length);assert.deepEqual(plain(m.range(packet.channels[0])),[1.5,2.5]);
 assert.equal(m.normalize({version:1,channels:[{id:'x',value:1},{id:'x',value:2}]}).channels.length,1);
});
test('machine listing is a projection of actual records, not invented G code',()=>{
 const line=m.programLine({x:24,op:'CUE',fields:{gate:false,amount:0},text:'editorial'},0,'F');
 assert.match(line,/N00001.*F\s*24.*CUE.*gate=false.*amount=0.*editorial/);
 assert.doesNotMatch(line,/G01|M701/);
});
test('optional debug bundle validates integrity before any installation',()=>{
 const root=new URL('..',import.meta.url).pathname,files=debugAssets(root,compactCSS),temp=fs.mkdtempSync(path.join(os.tmpdir(),'shared-debug-test-'));
 try{const source=path.join(temp,'source'),target=path.join(temp,'target');fs.mkdirSync(source);
  for(const [name,content]of files)fs.writeFileSync(path.join(source,path.basename(name)),content);
  const result=installDebugBundle(target,{source});assert(result.sizes.css<=DEBUG_BUDGET.css);assert.equal(installDebugBundle(target,{source,check:true}).changed.length,0);
  const before=fs.readFileSync(path.join(target,'debug.js'));fs.appendFileSync(path.join(source,'debug.js'),'changed');assert.throws(()=>installDebugBundle(target,{source}),/integrity/);assert(fs.readFileSync(path.join(target,'debug.js')).equals(before));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
