import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(){
 let doc;
 class Node {
  constructor(){this.ownerDocument=doc;this.attrs=new Map();this.listeners=new Map();this.children=[];this.dataset={};this.style={};this.value='';}
  setAttribute(k,v){this.attrs.set(k,v);}getAttribute(k){return this.attrs.get(k)??null;}removeAttribute(k){this.attrs.delete(k);}
  append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
  before(n){n.remove();const p=this.parentElement;n.parentElement=p;p.children.splice(p.children.indexOf(this),0,n);}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}}
  replaceChildren(){for(const n of this.children)n.parentElement=null;this.children=[];}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}scrollIntoView(){}
  focus(){doc.activeElement=this;this.fire('focus');}
  addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f);}
  removeEventListener(t,f){this.listeners.get(t)?.delete(f);}
  dispatchEvent(e){for(const f of this.listeners.get(e.type)||[])f(e);}
  fire(type,extra={}){this.dispatchEvent({type,preventDefault(){},...extra});}
 }
 doc=new Node();doc.createElement=()=>new Node();doc.defaultView=new Node();doc.defaultView.crypto={randomUUID:()=> 'fixture'};
 doc.defaultView.Event=class{constructor(type,options){this.type=type;Object.assign(this,options);}};doc.defaultView.CustomEvent=doc.defaultView.Event;
 const UI={};vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
 const baseline=[...doc.listeners.values()].reduce((n,set)=>n+set.size,0);
 const parent=new Node(),input=new Node(),selected=[];parent.append(input);
 const control=UI.createCombobox(input,{options:[{value:'new',label:'New board'},{value:'existing',label:'NASA practice'}],onSelect:item=>selected.push(item.value)});
 return {doc,input,parent,control,selected,baseline,list:control.element.children.find(n=>n.getAttribute('role')==='listbox')};
}
test('an exact typed label stays filtered; reopening selected choices shows every option',()=>{
 const f=fixture();f.input.focus();f.input.value='NASA practice';f.input.fire('input');assert.equal(f.list.children.length,1);
 f.input.fire('keydown',{key:'ArrowDown'});f.input.fire('keydown',{key:'Enter'});assert.deepEqual(f.selected,['existing']);
 f.control.open();assert.equal(f.list.children.length,2);f.control.dispose();assert.equal(f.parent.children[0],f.input);
 assert.equal([...f.doc.listeners.values()].reduce((n,set)=>n+set.size,0),f.baseline);for(const listeners of f.input.listeners.values())assert.equal(listeners.size,0);
});
test('composition and unknown text never select the first enum option',()=>{
 const f=fixture();f.input.focus();f.input.fire('compositionstart');f.input.value='NASA practice';f.input.fire('input');f.input.fire('keydown',{key:'Enter',isComposing:true});assert.deepEqual(f.selected,[]);
 f.input.fire('compositionend');assert.equal(f.list.children.length,1);f.input.fire('keydown',{key:'ArrowDown'});f.input.fire('keydown',{key:'Enter'});assert.deepEqual(f.selected,['existing']);
 f.input.value='unlisted';f.input.fire('input');f.input.fire('keydown',{key:'Enter'});assert.deepEqual(f.selected,['existing']);f.control.dispose();
});
