import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function fixture(){
 class Node{
  children=[];listeners=new Map();attributes=new Map();style={};dataset={};hidden=false;
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
  setAttribute(n,v){this.attributes.set(n,String(v));}getAttribute(n){return this.attributes.get(n)??null;}removeAttribute(n){this.attributes.delete(n);}
  addEventListener(n,f){const set=this.listeners.get(n)||new Set();set.add(f);this.listeners.set(n,set);}removeEventListener(n,f){this.listeners.get(n)?.delete(f);}
  fire(n,extra={}){let prevented=false,stopped=false;for(const f of this.listeners.get(n)||[])f({preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;},...extra});return {prevented,stopped};}
  getBoundingClientRect(){return {left:8,top:80,bottom:120,width:300};}contains(node){return this.children.includes(node);}remove(){}
 }
 const doc=new Node(),view=new Node();doc.defaultView=view;doc.body=new Node();doc.createElement=()=>new Node();view.crypto={randomUUID:()=>String(Math.random())};view.innerWidth=360;view.innerHeight=800;
 const UI={};vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
 const input=new Node();input.ownerDocument=doc;const selected=[];
 const controller=UI.createTextSuggestions(input,{onSelect:item=>selected.push(item)});
 return {doc,input,controller,selected};
}
test('keyboard suggestion choice owns Enter while open and releases all listeners',()=>{
 const f=fixture();f.controller.show([{label:'One',link:'[[One]]'},{label:'Two',link:'[[Two]]'}]);
 assert.equal(f.input.getAttribute('aria-expanded'),'true');
 assert.equal(f.controller.element.style.width,'300px');
 f.input.fire('keydown',{key:'ArrowDown'});
 const result=f.input.fire('keydown',{key:'Enter'});assert.equal(result.prevented,true);assert.equal(result.stopped,true);
 assert.equal(f.selected[0].link,'[[Two]]');assert.equal(f.controller.element.hidden,true);
 assert.equal(f.input.fire('keydown',{key:'Enter'}).prevented,false);
 f.controller.dispose();assert.equal(f.input.getAttribute('role'),null);assert.equal([...f.input.listeners.values()].reduce((n,x)=>n+x.size,0),0);
});
test('IME, Escape, outside dismissal and hidden documents never commit',()=>{
 const f=fixture(),items=[{label:'One'}];f.controller.show(items);
 assert.equal(f.input.fire('keydown',{key:'Enter',isComposing:true}).prevented,false);
 f.input.fire('keydown',{key:'Escape'});assert.equal(f.selected.length,0);
 f.controller.show(items);f.doc.fire('pointerdown',{target:{}});assert.equal(f.controller.element.hidden,true);
 f.controller.show(items);f.doc.visibilityState='hidden';f.doc.fire('visibilitychange');assert.equal(f.controller.element.hidden,true);
 f.controller.show(items);assert.equal(f.controller.element.hidden,true);
});
