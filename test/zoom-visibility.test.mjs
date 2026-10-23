import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8');
const start=source.indexOf('  function blocksViewportTools('),end=source.indexOf('  function createZoomFeedback(',start);
const blocks=vm.runInNewContext('('+source.slice(start,end).trim()+')');
function overlay({rendered=true,hidden=false,expanded=false}={}){return{getClientRects:()=>rendered?[{}]:[],closest:()=>hidden?{}:null,matches:()=>expanded};}
test('viewport tools ignore hidden and inline expanded controls while visible overlays block them',()=>{
 assert.equal(blocks(overlay({rendered:false})),false);
 assert.equal(blocks(overlay({hidden:true})),false);
 assert.equal(blocks(overlay({expanded:true})),false);
 assert.equal(blocks(overlay()),true);
});
