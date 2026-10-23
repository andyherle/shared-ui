import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8');
const start=source.indexOf('  function blocksViewportTools('),end=source.indexOf('  function createZoom(group',start);
const create=vm.runInNewContext('(()=>{'+source.slice(start,end)+';return createZoomFeedback;})()',{
 zoomDocks:new WeakMap(),adoptAction(node,{label}){node.label.textContent=label;},setText(node,text){node.textContent=text;}
});
function environment(){
 const events=()=>({listeners:new Map(),addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);},removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);},dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);}});
 let next=0;const timers=new Map(),view=events(),doc=events();
 Object.assign(view,{setTimeout(fn,delay){const id=++next;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}});
 Object.assign(doc,{defaultView:view,hidden:false,overlays:[],querySelectorAll(){return this.overlays;},body:{append(){}},createElement(){return Object.assign(events(),{style:{setProperty(name,value){this[name]=value;}},dataset:{},label:{},children:[],setAttribute(){},querySelector(){return this.label;},append(child){this.children.push(child);},remove(){this.removed=true;}});}});
 const api=create(doc),fire=type=>doc.dispatchEvent({type});
 return{api,doc,view,timers,fire,expire(){for(const [id,{fn}]of [...timers]){timers.delete(id);fn();}}};
}
test('zoom activity reveals changed values without keeping controls visible for repeated redraws',()=>{
 const e=environment(),node=e.api.element;e.api.show(100);assert.equal(node.style['--ui-idle-opacity'],'0');assert.equal(e.timers.size,0);
 e.api.show(110);assert.equal(node.style['--ui-idle-opacity'],'1');assert.equal(e.timers.size,1);const first=[...e.timers.keys()][0];assert.equal(e.timers.get(first).delay,1200);
 e.api.show(110);assert.equal([...e.timers.keys()][0],first);
 e.api.show(120);assert.equal(e.timers.has(first),false);assert.equal(e.timers.size,1);
 e.expire();assert.equal(node.style['--ui-idle-opacity'],'0');assert.equal(node.children[1].label.textContent,'120%');assert.equal(e.timers.size,0);
 node.children[1].dispatchEvent({type:'click'});assert.equal(node.style['--ui-idle-opacity'],'1');e.api.dispose();
});
test('overlays and hidden views cancel zoom activity and resume idle without changing zoom',()=>{
 const e=environment();e.api.show(100);e.api.show(110);e.doc.hidden=true;e.fire('visibilitychange');assert.equal(e.api.element.hidden,true);assert.equal(e.timers.size,0);
 e.api.show(120);assert.equal(e.timers.size,0);e.doc.hidden=false;e.fire('visibilitychange');assert.equal(e.api.element.hidden,false);assert.equal(e.api.element.style['--ui-idle-opacity'],'0');
 e.api.show(130);e.doc.overlays=[{getClientRects:()=>[{}],closest:()=>null,matches:()=>false}];e.fire('toggle');assert.equal(e.api.element.hidden,true);assert.equal(e.timers.size,0);
 e.doc.overlays=[];e.fire('close');assert.equal(e.api.element.hidden,false);assert.equal(e.api.element.style['--ui-idle-opacity'],'0');e.api.dispose();
});
test('zoom activity belongs to each document and releases timers through page lifecycle',()=>{
 const a=environment(),b=environment();assert.equal(create(a.doc),a.api);a.api.show(100);b.api.show(100);a.api.show(110);assert.equal(a.timers.size,1);assert.equal(b.timers.size,0);
 a.view.dispatchEvent({type:'pagehide',persisted:true});assert.equal(a.timers.size,0);assert.equal(a.api.element.removed,undefined);
 a.view.dispatchEvent({type:'pageshow'});assert.equal(a.api.element.style['--ui-idle-opacity'],'0');a.api.show(120);a.api.dispose();a.api.dispose();assert.equal(a.timers.size,0);assert.equal(a.api.element.removed,true);
 assert.ok([...a.doc.listeners.values(),...a.view.listeners.values()].every(list=>list.size===0));a.api.show(130);assert.equal(a.timers.size,0);b.api.dispose();
});
