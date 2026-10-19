import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function fixture() {
  class Events {
    listeners = new Map();
    addEventListener(type, fn) { const group=this.listeners.get(type)||new Set(); group.add(fn); this.listeners.set(type,group); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    fire(type, event={}) { for(const fn of this.listeners.get(type)||[]) fn(event); }
  }
  const doc=new Events(), view=new Events(), frames=new Map(); let next=0;
  class Node extends Events {
    constructor() { super(); this.ownerDocument=doc; this.children=[]; this.classes=new Set(); this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)}; }
    get parentNode() { return this.parentElement; }
    append(node) { node.remove(); this.children.push(node); node.parentElement=this; }
    remove() { if(this.parentElement) { const list=this.parentElement.children; list.splice(list.indexOf(this),1); this.parentElement=null; } }
    before(node) { node.remove(); const parent=this.parentElement; parent.children.splice(parent.children.indexOf(this),0,node); node.parentElement=parent; }
    after(node) { node.remove(); const parent=this.parentElement; parent.children.splice(parent.children.indexOf(this)+1,0,node); node.parentElement=parent; }
    contains(node) { return node===this || this.children.some(child=>child.contains(node)); }
  }
  let observer;
  Object.assign(view,{getComputedStyle:()=>({fontSize:'16px'}),requestAnimationFrame:fn=>{frames.set(++next,fn); return next;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class { constructor(fn){this.fn=fn; observer=this;} observe(){this.observing=true;} disconnect(){this.observing=false;} }});
  Object.assign(doc,{defaultView:view,documentElement:{dataset:{}},visibilityState:'visible',createComment:()=>new Node()});
  const UI={refreshActions(){}};
  vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
  const header=new Node(), source=new Node(), target=new Node(), control=new Node(), after=new Node();
  header.clientWidth=900; header.append(source); header.append(target); source.append(control); source.append(after);
  const flush=()=>{const work=[...frames.values()];frames.clear();for(const fn of work)fn();};
  return {UI,doc,view,header,source,target,control,after,flush,get observer(){return observer;},frames};
}

test('secondary controls retain identity, values and handlers across narrow and wide containers',()=>{
  const f=fixture(); f.control.value='rating'; let calls=0; f.control.addEventListener('change',()=>calls++);
  const slot=f.UI.createAdaptiveSlot(f.control,{container:f.header,target:f.target}); f.flush();
  assert.equal(f.target.hidden,true);
  f.header.clientWidth=390; slot.refresh(); f.flush();
  assert.equal(f.target.children[0],f.control); assert.equal(f.target.hidden,false); assert.equal(f.control.value,'rating');
  f.control.fire('change'); assert.equal(calls,1);
  f.header.clientWidth=900; slot.refresh(); f.flush();
  assert.equal(f.control.parentNode,f.source); assert.equal(f.source.children.at(-1),f.after); assert.equal(f.target.hidden,true);
  slot.dispose(); assert.deepEqual(f.source.children,[f.control,f.after]);
});

test('focused edits defer relocation, hidden views suspend, and disposal releases pending work',()=>{
  const f=fixture(), initial=[...f.doc.listeners.values(),...f.view.listeners.values()].reduce((sum,group)=>sum+group.size,0), slot=f.UI.createAdaptiveSlot(f.control,{container:f.header,target:f.target}); f.flush();
  f.doc.activeElement=f.control; f.header.clientWidth=390; slot.refresh(); f.flush(); assert.equal(f.control.parentNode,f.source);
  f.doc.activeElement=null; f.control.fire('focusout'); f.flush(); assert.equal(f.control.parentNode,f.target);
  f.doc.visibilityState='hidden'; f.doc.fire('visibilitychange'); assert.equal(f.observer.observing,false);
  f.header.clientWidth=900; slot.refresh(); assert.equal(f.frames.size,0);
  f.doc.visibilityState='visible'; f.doc.fire('visibilitychange'); f.flush(); assert.equal(f.control.parentNode,f.source);
  slot.refresh(); slot.dispose(); assert.equal(f.frames.size,0); assert.equal(f.observer.observing,false);
  assert.equal([...f.doc.listeners.values(),...f.view.listeners.values()].reduce((sum,group)=>sum+group.size,0),initial);
});

test('a destination outside the toolbar is rejected before changing controls',()=>{
  const f=fixture(), other=fixture();
  assert.throws(()=>f.UI.createAdaptiveSlot(f.control,{container:f.header,target:other.target}),/one toolbar/);
  assert.deepEqual(f.source.children,[f.control,f.after]);
});
