import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountSwipeActions} from '../src/swipe-actions.mjs';
function harness(){
 const hub=()=>({listeners:new Map(),addEventListener(t,f){const list=this.listeners.get(t)||[];list.push(f);this.listeners.set(t,list);},removeEventListener(t,f){this.listeners.set(t,(this.listeners.get(t)||[]).filter(x=>x!==f));},emit(t,e={}){for(const f of this.listeners.get(t)||[])f(e);}});
 const win=hub();win.innerWidth=375;win.CustomEvent=class {constructor(type,options){this.type=type;Object.assign(this,options);}};
 const doc=hub();doc.defaultView=win;doc.getSelection=()=>({type:'Caret'});doc.hidden=false;
 const root=hub();root.ownerDocument=doc;root.contains=()=>true;
 let captured=false;const events=[];
 const row={dataset:{},isConnected:true,busy:false,style:{setProperty(){},removeProperty(){}},matches(){return this.busy;},getAttribute(name){return name.includes('left')?'Dismiss':'Reply';},setPointerCapture(){captured=true;},hasPointerCapture(){return captured;},releasePointerCapture(){captured=false;},dispatchEvent(e){events.push(e.detail.direction);}};
 const target={closest(selector){return selector==='[data-ui-swipe]'?row:null;}};
 const point=(x,y,extra={})=>({clientX:x,clientY:y,pointerId:1,pointerType:'touch',isPrimary:true,target,...extra});
 const cleanup=mountSwipeActions(root);
 const start=()=>root.emit('pointerdown',point(180,100));
 return {root,doc,win,row,target,point,start,events,cleanup};
}
test('right and left commit only after a deliberate threshold',()=>{
 for(const distance of [-100,100]){const h=harness();h.start();h.root.emit('pointermove',h.point(180+distance,100));h.root.emit('pointerup',h.point(180+distance,100));assert.deepEqual(h.events,[distance>0?'right':'left']);h.cleanup();}
 const h=harness();h.start();h.root.emit('pointermove',h.point(230,100));h.root.emit('pointerup',h.point(230,100));assert.equal(h.events.length,0);h.cleanup();
});
test('implicit capture transfer from child does not cancel the row gesture',()=>{
 const h=harness();h.start();h.root.emit('pointermove',h.point(200,100));
 h.root.emit('lostpointercapture',h.point(200,100));
 h.root.emit('pointermove',h.point(280,100));h.root.emit('pointerup',h.point(280,100));assert.deepEqual(h.events,['right']);h.cleanup();
});
test('vertical motion, row capture loss and cancellation never commit',()=>{
 for(const cancel of ['vertical','lostpointercapture','pointercancel']){const h=harness();h.start();h.root.emit('pointermove',h.point(200,100));if(cancel==='vertical')h.root.emit('pointermove',h.point(280,170));else h.root.emit(cancel,h.point(220,100,{target:h.row}));h.root.emit('pointerup',h.point(280,100));assert.equal(h.events.length,0);h.cleanup();}
});
test('busy rows, screen edges, controls and non-touch pointers are excluded',()=>{
 for(const mode of ['busy','edge','control','mouse']){const h=harness();if(mode==='busy')h.row.busy=true;if(mode==='control')h.target.closest=s=>s==='[data-ui-swipe]'?h.row:{};h.root.emit('pointerdown',h.point(mode==='edge'?10:180,100,{pointerType:mode==='mouse'?'mouse':'touch'}));h.root.emit('pointermove',h.point(280,100));h.root.emit('pointerup',h.point(280,100));assert.equal(h.events.length,0);h.cleanup();}
});
test('multitouch, hidden views and teardown release listeners',()=>{
 for(const mode of ['multi','hidden','teardown']){const h=harness();h.start();h.root.emit('pointermove',h.point(200,100));if(mode==='multi')h.root.emit('pointerdown',h.point(210,100,{pointerId:2,isPrimary:false}));if(mode==='hidden'){h.doc.hidden=true;h.doc.emit('visibilitychange');}if(mode==='teardown')h.cleanup();h.root.emit('pointerup',h.point(280,100));assert.equal(h.events.length,0);h.cleanup();assert.ok([...h.root.listeners.values()].every(v=>v.length===0));}
});

test('native summaries require an explicit swipe start opt-in and taps stay native',()=>{
 for (const opted of [false,true]) {
  const h=harness(); const summary={hasAttribute:()=>opted};
  h.target.closest=s=>s==='[data-ui-swipe]'?h.row:s==='summary'?summary:null;
  h.start(); h.root.emit('pointermove',h.point(280,100)); h.root.emit('pointerup',h.point(280,100));
  assert.deepEqual(h.events,opted?['right']:[]); h.cleanup();
 }
 const h=harness();h.start();h.root.emit('pointerup',h.point(180,100));assert.deepEqual(h.events,[]);h.cleanup();
});
test('a committed summary swipe consumes its synthetic click without toggling details',()=>{
 const h=harness(); h.row.contains=()=>true;
 h.start();h.root.emit('pointermove',h.point(280,100));h.root.emit('pointerup',h.point(280,100));
 let prevented=false,stopped=false;h.root.emit('click',{target:h.target,preventDefault(){prevented=true},stopPropagation(){stopped=true}});
 assert.equal(prevented,true);assert.equal(stopped,true);h.cleanup();
});

test('the next intentional press and keyboard activation survive a prior swipe',()=>{
 for(const mode of ['press','keyboard']){
  const h=harness();h.row.contains=()=>true;h.start();h.root.emit('pointermove',h.point(280,100));h.root.emit('pointerup',h.point(280,100));
  if(mode==='press')h.root.emit('pointerdown',h.point(180,100,{pointerType:'mouse'}));
  let prevented=false;h.root.emit('click',{target:h.target,detail:mode==='keyboard'?0:1,preventDefault(){prevented=true},stopPropagation(){}});
  assert.equal(prevented,false);h.cleanup();
 }
});

test('selection created during an active gesture prevents commitment',()=>{
 for(const phase of ['move','release']){
  const h=harness();h.start();if(phase==='release')h.root.emit('pointermove',h.point(280,100));
  h.doc.getSelection=()=>({type:'Range'});if(phase==='move')h.root.emit('pointermove',h.point(280,100));h.root.emit('pointerup',h.point(280,100));assert.deepEqual(h.events,[]);h.cleanup();
 }
});
