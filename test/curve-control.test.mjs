import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(){
 class Node{
  children=[];listeners=new Map();attrs=new Map();style={};dataset={};value='';classList={add(){}};
  append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k);}
  addEventListener(t,f){const set=this.listeners.get(t)||new Set();set.add(f);this.listeners.set(t,set);}removeEventListener(t,f){this.listeners.get(t)?.delete(f);}
  fire(type,event={}){for(const fn of this.listeners.get(type)||[])fn({preventDefault(){},stopPropagation(){},...event});}
  setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}
  focus(){doc.activeElement=this;}setCustomValidity(s){this.validationMessage=s;}reportValidity(){}
  getBoundingClientRect(){return {left:0,top:0,width:300,height:176};}
 }
 const doc=Object.assign(new Node(),{activeElement:null,createElement:()=>new Node(),createElementNS:()=>new Node()}),UI={};
 vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set,console});
 const baseline=[...doc.listeners.values()].reduce((n,set)=>n+set.size,0);
 const changes=[],editor=UI.createCurveControl({label:'Envelope',document:doc,onChange:(points,commit)=>changes.push({points:Array.from(points),commit})});
 return {doc,changes,editor,baseline,handle:editor.element.children[0].children.find(n=>n.getAttribute('aria-label')==='Envelope handle 1'),input:editor.element.children[1].children[0].children[1]};
}
test('curve drag preserves its basis across inspections and Escape restores one committed gesture',()=>{
 const f=fixture();f.handle.fire('pointerdown',{button:0,pointerId:1});f.handle.fire('pointermove',{pointerId:1,clientX:150,clientY:84});
 assert.deepEqual(f.changes.at(-1),{points:[.5,.5,2/3,1],commit:false});
 f.editor.sync({points:[0,0,1,1]});f.handle.fire('keydown',{key:'Escape'});
 assert.deepEqual(f.changes.at(-1),{points:[1/3,0,2/3,1],commit:true});assert.equal(f.handle.capture,null);
 f.editor.dispose();assert.equal([...f.doc.listeners.values()].reduce((n,set)=>n+set.size,0),f.baseline);
});
test('curve exact fields preserve invalid drafts, accept precision, and commit Enter only once',()=>{
 const f=fixture();f.input.value='2';f.input.fire('input');f.input.fire('change');assert.ok(f.input.validationMessage);f.editor.sync({points:[.5,.5,.5,.5]});assert.equal(f.input.value,'2');
 f.input.value='.123456789';f.input.fire('input');f.input.fire('keydown',{key:'Enter'});assert.equal(f.changes.at(-1).points[0],.123456789);assert.equal(f.input.dataset.draft,undefined);const count=f.changes.length;f.input.fire('change');assert.equal(f.changes.length,count);f.editor.dispose();
});
