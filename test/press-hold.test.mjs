import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function fixture(){
  class Node{listeners=new Map();isConnected=true;addEventListener(type,fn){const values=this.listeners.get(type)||[];values.push(fn);this.listeners.set(type,values);}removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==fn));}emit(type,event={}){for(const fn of [...this.listeners.get(type)||[]])fn(event);}}
  const doc=new Node(),view=new Node(),root=new Node(),target=new Node(),timers=new Map();let serial=0,held=0;
  root.ownerDocument=doc;doc.defaultView=view;view.setTimeout=fn=>{timers.set(++serial,fn);return serial;};view.clearTimeout=id=>timers.delete(id);
  const UI={};vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc});
  const baseline=new Map([root,doc,view].map(node=>[node,new Map([...node.listeners].map(([type,list])=>[type,list.length]))]));
  const api=UI.createPressHold(root,{onHold(){held++;}}),event={button:0,pointerType:'touch',pointerId:1,isPrimary:true,target,clientX:10,clientY:20};
  return{doc,view,root,target,timers,api,event,baseline,get held(){return held;},fire(){const next=timers.entries().next().value;assert(next);timers.delete(next[0]);next[1]();}};
}
test('a hold consumes exactly its following pointer click and retains keyboard activation',()=>{
 const h=fixture();h.root.emit('pointerdown',h.event);h.fire();assert.equal(h.held,1);let prevented=0;
 const click={target:h.target,detail:0,preventDefault(){prevented++;},stopImmediatePropagation(){}};h.view.emit('click',click);assert.equal(prevented,0);
 h.view.emit('click',{...click,detail:1});assert.equal(prevented,1);h.view.emit('click',{...click,detail:1});assert.equal(prevented,1);h.api.dispose();assert.equal(h.timers.size,0);
});
test('scroll intent, another pointer, cancellation, hidden views and blur cancel holds',()=>{
 for(const cancel of [h=>h.doc.emit('pointermove',{...h.event,clientX:30}),h=>h.doc.emit('pointerdown',{...h.event,pointerId:2}),h=>h.doc.emit('pointercancel',h.event),h=>{h.doc.hidden=true;h.doc.emit('visibilitychange');},h=>h.view.emit('blur')]){
   const h=fixture();h.root.emit('pointerdown',h.event);cancel(h);assert.equal(h.timers.size,0);assert.equal(h.held,0);h.api.dispose();
 }
});
test('mouse input, secondary fingers and disposal never leave pending work',()=>{
 const h=fixture();h.root.emit('pointerdown',{...h.event,pointerType:'mouse'});h.root.emit('pointerdown',{...h.event,isPrimary:false});assert.equal(h.timers.size,0);
 h.root.emit('pointerdown',h.event);h.api.dispose();h.api.dispose();assert.equal(h.timers.size,0);for(const node of [h.root,h.doc,h.view])for(const [type,list] of node.listeners)assert.equal(list.length,h.baseline.get(node).get(type)||0);
});
