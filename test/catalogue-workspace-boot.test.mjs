import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('standalone catalogue workspace and colour demos boot without private IIFE aliases',()=>{
  const source=fs.readFileSync(new URL('../src/lab.js',import.meta.url),'utf8');
  const nodes=new Map(['context-demo-actions','context-demo','context-demo-zoom','resize-demo-panel','resize-demo','colour-wheel'].map(id=>[id,{id,children:[]}]))
  nodes.get('context-demo-actions').children=[{textContent:'Text'}];
  const calls=[],cleanup=[];
  const kit={adoptAction(){},createContextToolbar(element){calls.push(element.id);return{dispose(){calls.push('dispose toolbar');}};},createResizablePanel(element){calls.push(element.id);return{dispose(){calls.push('dispose panel');}};},createColorWheel({root,multiple}){assert.equal(multiple,true);calls.push(root.id);}};
  vm.runInNewContext(source.slice(source.indexOf("{const toolbar=document.getElementById('context-demo-actions')")),{window:{SharedUI:kit,addEventListener(type,handler){assert.equal(type,'pagehide');cleanup.push(handler);}},document:{getElementById:id=>nodes.get(id)}});
  assert.deepEqual(calls,['context-demo-actions','resize-demo-panel','colour-wheel']);
  cleanup.forEach(fn=>fn());
  assert.deepEqual(calls.slice(-2),['dispose toolbar','dispose panel']);
});
