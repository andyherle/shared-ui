import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function fixture(onCommit=async()=>{}){
 const doc={activeElement:null,addEventListener(){},querySelectorAll(){return [];}};
 class Node{
  children=[];listeners=new Map();attributes=new Map();style={};dataset={};value='';selectionStart=0;hidden=false;
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
  setAttribute(n,v){this.attributes.set(n,String(v));}getAttribute(n){return this.attributes.get(n)??null;}
  addEventListener(n,f){const set=this.listeners.get(n)||new Set();set.add(f);this.listeners.set(n,set);}removeEventListener(n,f){this.listeners.get(n)?.delete(f);}
  fire(n,extra={}){for(const f of this.listeners.get(n)||[])f({preventDefault(){},stopPropagation(){},...extra});}
  focus(){doc.activeElement=this;}setCustomValidity(s){this.validationMessage=s;}
  setRangeText(s,a,b){this.value=this.value.slice(0,a)+s+this.value.slice(b);this.selectionStart=a+s.length;}
 }
 doc.createElement=()=>new Node();doc.defaultView={crypto:{randomUUID:()=>String(Math.random())}};
 const UI={adoptAction(node,{label}){node.setAttribute('aria-label',label);}};
 vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
 const editor=UI.createExpressionEditor({label:'Rotation',document:doc,suggestions:[{insert:'base'},{insert:'sin(time)'},{insert:'signal("kick")'}],onCommit});
 return {doc,editor,input:editor.input,choices:editor.element.children[1],type(s){editor.input.value=s;editor.input.selectionStart=s.length;editor.input.fire('input');}};
}
test('multiline editor completes the token at the caret and preserves surrounding text',()=>{
 const f=fixture();f.type('base + si');assert.equal(f.choices.children.length,2);
 f.input.fire('keydown',{key:'ArrowDown'});f.input.fire('keydown',{key:'Tab'});
 assert.equal(f.input.value,'base + sin(time)');assert.equal(f.choices.hidden,true);
 f.type('base\n+ si');f.input.fire('compositionstart');assert.equal(f.choices.hidden,true);
 f.input.fire('keydown',{key:'Tab',isComposing:true});assert.equal(f.input.value,'base\n+ si');
 f.input.fire('compositionend');assert.equal(f.choices.children.length,2);
});
test('drafts survive inspections, rejection is retryable and clear uses the same commit path',async()=>{
 const calls=[];let reject=true;const f=fixture(async value=>{calls.push(value);if(reject)throw new Error('Invalid expression');});
 f.editor.sync({expression:'base',base:2,value:2});f.type('base + sin(time)');
 f.editor.sync({expression:'base',base:3,value:3});assert.equal(f.input.value,'base + sin(time)');
 await assert.rejects(f.editor.flush(),/Invalid expression/);assert.equal(f.input.dataset.draft,'true');assert.equal(f.input.validationMessage,'Invalid expression');
 reject=false;await f.editor.flush();assert.equal(f.input.dataset.draft,undefined);
 f.editor.element.children[2].children[1].children[0].fire('click');await f.editor.flush();assert.equal(calls.at(-1),null);
});
test('pending commits preserve newer typing and Escape restores the accepted source',async()=>{
 let done;const f=fixture(()=>new Promise(r=>{done=r;}));f.editor.sync({expression:'base',base:1,value:1});f.type('base + 1');const p=f.editor.flush();f.type('base + 2');done();await p;
 assert.equal(f.input.dataset.draft,'true');assert.equal(f.input.value,'base + 2');
 f.input.fire('keydown',{key:'Escape'});assert.equal(f.input.value,'base + 1');assert.equal(f.editor.element.hidden,true);
 f.editor.dispose();assert.equal([...f.input.listeners.values()].reduce((n,x)=>n+x.size,0),0);
});
