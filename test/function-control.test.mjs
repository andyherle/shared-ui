import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function fixture(){
 class Target{listeners=new Map();addEventListener(t,f){const a=this.listeners.get(t)||new Set();a.add(f);this.listeners.set(t,a);}removeEventListener(t,f){this.listeners.get(t)?.delete(f);}dispatchEvent(e){for(const f of this.listeners.get(e.type)||[])f(e);}fire(type,extra={}){this.dispatchEvent({type,preventDefault(){},stopImmediatePropagation(){},...extra});}}
 const doc=new Target(),view=new Target(),input=new Target(),UI={};doc.defaultView=view;view.Event=class{constructor(type){this.type=type;}};
 Object.assign(input,{ownerDocument:doc,type:'number',value:'10',step:'0.1',min:'',max:'',dataset:{},classList:{add(){},remove(){}},focus(){doc.activeElement=this;},blur(){doc.activeElement=null;},select(){this.selected=true;},setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;}});
 Object.defineProperty(input,'valueAsNumber',{get(){return Number(this.value);}});
 vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
 const baseline=[...doc.listeners.values(),...view.listeners.values()].reduce((n,a)=>n+a.size,0);
 const changes=[];input.addEventListener('input',()=>changes.push(['input',input.value]));input.addEventListener('change',()=>changes.push(['change',input.value]));
 return {UI,doc,view,input,changes,baseline,down:()=>input.fire('pointerdown',{button:0,pointerId:1,pointerType:'mouse',clientX:100}),move:(x,extra={})=>input.fire('pointermove',{pointerId:1,clientX:x,...extra}),up:()=>input.fire('pointerup',{pointerId:1})};
}
test('numeric scrub streams native samples and commits once; click retains native typing',()=>{
 const f=fixture();f.UI.createFunctionControl(f.input);f.down();f.move(102);assert.equal(f.changes.length,0);f.up();assert.equal(f.input.selected,true);assert.equal(f.doc.activeElement,f.input);
 f.input.blur();f.down();f.move(110);f.move(120);f.up();assert.deepEqual(f.changes,[['input','11'],['input','12'],['change','12']]);assert.equal(f.input.capture,null);
});
test('modifiers are incremental and native bounds apply without precision truncation',()=>{
 const f=fixture();f.UI.createFunctionControl(f.input,{min:0,max:21});f.down();f.move(110);f.move(120,{altKey:true});assert.equal(f.input.value,'11.1');f.move(130,{shiftKey:true});assert.equal(f.input.value,'21');f.up();assert.equal(f.changes.at(-1)[0],'change');
});
for(const reason of ['Escape','pointercancel','hidden','dispose'])test(`${reason} restores the original value and releases the gesture`,()=>{
 const f=fixture(),helper=f.UI.createFunctionControl(f.input);f.down();f.move(120);
 if(reason==='Escape')f.doc.fire('keydown',{key:'Escape',target:{closest:()=>null}});if(reason==='pointercancel')f.input.fire(reason);if(reason==='hidden'){f.doc.visibilityState='hidden';f.doc.fire('visibilitychange');}if(reason==='dispose')helper.dispose();
 assert.equal(f.input.value,'10');assert.equal(f.input.capture,null);assert.equal(f.changes.filter(([type])=>type==='change').length,1);assert.equal(f.input.dataset.uiDragging,undefined);
 helper.dispose();assert.equal([...f.doc.listeners.values(),...f.view.listeners.values()].reduce((n,a)=>n+a.size,0),f.baseline);
});
test('focused, disabled, touch and readonly fields retain their native behavior',()=>{
 for(const mode of ['focused','disabled','readOnly','touch']){const f=fixture();f.UI.createFunctionControl(f.input);if(mode==='focused')f.input.focus();else if(mode!=='touch')f.input[mode]=true;f.input.fire('pointerdown',{button:0,pointerId:1,clientX:100,pointerType:mode==='touch'?'touch':'mouse'});f.move(120);f.up();assert.deepEqual(f.changes,[]);}
});

test('expression text remains editable while finite text values can scrub',()=>{
 const f=fixture();f.input.type='text';f.UI.createFunctionControl(f.input);f.input.value='=sin(time)';f.down();f.move(120);f.up();assert.equal(f.input.value,'=sin(time)');assert.deepEqual(f.changes,[]);
 f.input.value='1.23456789';f.down();f.move(110);f.up();assert.equal(f.input.value,'2.23456789');
 const g=fixture();g.UI.createFunctionControl(g.input,{canScrub:()=>false});g.down();g.move(120);g.up();assert.deepEqual(g.changes,[]);
});

test('optional step snapping keeps drag values on the declared keyboard grid',()=>{
 const f=fixture();f.input.type='text';f.input.value='1.23456789';f.UI.createFunctionControl(f.input,{step:()=>.01,min:0,snap:true});
 f.down();f.move(110);assert.equal(f.input.value,'1.33');
 f.move(111,{altKey:true});assert.equal(f.input.value,'1.331');
 f.up();assert.equal(f.changes.at(-1)[0],'change');
});

test('tiny steppers call the same increments without adding keyboard tab stops',()=>{
 const f=fixture(),calls=[];
 f.doc.createElement=tag=>{const attrs={},children=[],listeners=new Map();return {tagName:tag.toUpperCase(),children,dataset:{},append(node){children.push(node);},remove(){},setAttribute(k,v){attrs[k]=v;},getAttribute(k){return attrs[k];},addEventListener(k,cb){listeners.set(k,cb);},removeEventListener(k){listeners.delete(k);},fire(k,event={}){listeners.get(k)?.(event);}};};
 const arrows=f.UI.createNumberSteppers(f.input,{label:'Rotation',step:()=>.25,onStep:delta=>calls.push(delta)});
 assert.equal(arrows.element.children.length,2);assert.equal(arrows.element.children[0].tabIndex,-1);
 assert.equal(arrows.element.children[0].title,'Increase Rotation by 0.25');
 arrows.element.children[0].fire('click',{});arrows.element.children[1].fire('click',{shiftKey:true});assert.deepEqual(calls,[1,-10]);
 f.input.disabled=true;arrows.sync();assert.equal(arrows.element.children[0].disabled,true);arrows.element.children[0].fire('click',{});assert.deepEqual(calls,[1,-10]);arrows.dispose();
});

test('a displayed formula result scrubs the independent base at full precision',()=>{
 const f=fixture();f.input.type='text';f.input.value='99';f.UI.createFunctionControl(f.input,{getValue:()=>1.23456789});
 f.down();f.move(110);f.up();assert.equal(f.input.value,'2.23456789');assert.equal(f.changes.at(-1)[1],'2.23456789');
});
