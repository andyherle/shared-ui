import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {manifest} from '../scripts/build.mjs';
const runtime=fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8');
const module={exports:{}};vm.runInNewContext(runtime,{module,URL});
const release=manifest('a{color:red}'),other=manifest('a{color:blue}');
class Events {
 listeners=new Map();
 addEventListener(type,fn){const list=this.listeners.get(type)||new Set();list.add(fn);this.listeners.set(type,list);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);return true;}
}
function environment({storage=new Map(),dataset={},request,channels=[],baselines=[]}={}){
 const timers=new Map();let timerID=0;const view=new Events(),doc=new Events(),links=[];
 const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 class Channel {constructor(name){this.name=name;channels.push(this);}postMessage(value){for(const item of channels)if(item!==this&&item.name===this.name&&!item.closed)item.onmessage?.({data:value});}close(){this.closed=true;}}
 Object.assign(view,{localStorage,BroadcastChannel:Channel,crypto:{randomUUID:()=>String(Math.random())},fetch:request||(async()=>({ok:true,text:async()=>JSON.stringify(release)})),AbortController,CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}},setTimeout:(fn,delay)=>{const id=++timerID;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
 Object.assign(doc,{defaultView:view,baseURI:'https://app.example/',visibilityState:'visible',querySelectorAll:selector=>selector==='link[data-ui-baseline],style[data-ui-baseline]'?baselines:[],documentElement:{dataset:{ui:'postvisual',...dataset}},head:{append(link){links.push(link);}},createElement:()=>({dataset:{},remove(){this.removed=true;}})});
 const instance=module.exports.mount(doc);
 return {doc,view,links,timers,instance,storage,channels,async next(){for(let i=0;i<10;i++)await Promise.resolve();},load(link=links.at(-1)){link.onload?.();},fail(link=links.at(-1)){link.onerror?.();},tick(){const entry=[...timers].find(([,value])=>value.delay===100);assert.ok(entry);timers.delete(entry[0]);entry[1].fn();}};
}
test('CSS swaps only after load, retains the working sheet on failure, and removes the previous update',async()=>{
 const e=environment();const first=e.instance.applyRelease(release);assert.equal(e.links[0].media,'not all');assert.equal(e.links[0].integrity,release.integrity);assert.equal(e.doc.documentElement.dataset.uiRevision,undefined);
 e.load();assert.equal(await first,true);assert.equal(e.links[0].media,'all');
 const failed=e.instance.applyRelease(other);e.fail();assert.equal(await failed,false);assert.equal(e.doc.documentElement.dataset.uiRevision,release.revision);assert.equal(e.links[0].removed,undefined);
 const next=e.instance.applyRelease(other);e.load();assert.equal(await next,true);assert.equal(e.links[0].removed,true);e.instance.dispose();
});
test('simultaneous refresh calls share one request and failed requests retain the working release',async()=>{
 let resolve,calls=0;const response=new Promise(r=>resolve=r);const e=environment({request:()=>{calls++;return response;}});
 const a=e.instance.refresh(),b=e.instance.refresh();assert.equal(calls,1);resolve({ok:true,text:async()=>JSON.stringify(release)});await e.next();e.load();assert.equal(await a,true);assert.equal(await b,true);e.instance.dispose();
 const offline=environment({dataset:{uiRevision:release.revision},request:async()=>{throw new Error('offline');}});assert.equal(await offline.instance.refresh(),false);assert.equal(offline.doc.documentElement.dataset.uiRevision,release.revision);assert.equal(offline.links.length,0);offline.instance.dispose();
});
test('disposing aborts pending fetches and stylesheet loads and closes all listeners and channels',async()=>{
 let signal;const e=environment({request:(_url,options)=>{signal=options.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));}});
 const pending=e.instance.refresh();e.instance.dispose();assert.equal(signal.aborted,true);assert.equal(await pending,false);assert.equal(e.timers.size,0);assert.ok(e.channels.every(c=>c.closed));assert.ok([...e.doc.listeners.values(),...e.view.listeners.values()].every(set=>set.size===0));
 const css=environment();const loaded=css.instance.applyRelease(release);css.instance.dispose();assert.equal(await loaded,false);assert.equal(css.links[0].removed,true);assert.equal(css.timers.size,0);
});
test('one visible view checks for updates and shares the validated stylesheet with other views',async()=>{
 const storage=new Map(),channels=[];let requests=0;const request=async()=>{requests++;return {ok:true,text:async()=>JSON.stringify(release)};};
 const a=environment({storage,channels,request}),b=environment({storage,channels,request});a.tick();b.tick();await a.next();assert.equal(requests,1);assert.equal(a.links.length,1);assert.equal(b.links.length,1);a.load();b.load();await a.next();
 assert.equal(a.doc.documentElement.dataset.uiRevision,release.revision);assert.equal(b.doc.documentElement.dataset.uiRevision,release.revision);a.instance.dispose();b.instance.dispose();
});
test('hidden views stop polling, release their lease, and resume without rebuilding the document',()=>{
 const e=environment();e.doc.visibilityState='hidden';e.doc.dispatchEvent({type:'visibilitychange'});assert.equal(e.timers.size,0);e.doc.visibilityState='visible';e.doc.dispatchEvent({type:'visibilitychange'});assert.ok([...e.timers.values()].some(t=>t.delay===50));e.instance.dispose();
});
test('lab themes stay per view and output documents do not opt in',()=>{
 const saved=new Map([['postvisual-ui-mode','light']]);const e=environment({storage:saved,dataset:{theme:'dark',uiThemeScope:'view'}});assert.equal(e.doc.documentElement.dataset.theme,'dark');e.instance.setMode('dark');assert.equal(saved.get('postvisual-ui-mode'),'light');e.instance.dispose();
 const output=environment({dataset:{ui:undefined}});assert.equal(output.timers.size,0);assert.equal(output.channels.length,0);output.instance.dispose();
});
test('untrusted style source and incompatible broadcasts are rejected',async()=>{
 assert.throws(()=>environment({dataset:{uiSource:'https://other.example/manifest.json'}}),/Unknown UI source/);
 const e=environment();e.channels[0].onmessage({data:{protocol:2}});await e.next();assert.equal(e.links.length,0);e.instance.dispose();
});
test('a newer bundled contract rejects older remote CSS without touching the working document',async()=>{
 const e=environment({dataset:{uiVersion:'1.1.0',uiRevision:release.revision}});
 assert.equal(await e.instance.applyRelease({...other,version:'1.0.9'}),false);assert.equal(e.links.length,0);assert.equal(e.doc.documentElement.dataset.uiRevision,release.revision);
 const next=e.instance.applyRelease({...other,version:'1.1.1'});e.load();assert.equal(await next,true);e.instance.dispose();
});

test('a validated replacement retires the marked bundled UI sheet only after load',async()=>{
 const baseline={removed:false,remove(){this.removed=true;}};const e=environment({baselines:[baseline]});
 const failed=e.instance.applyRelease(other);assert.equal(baseline.removed,false);e.fail();assert.equal(await failed,false);assert.equal(baseline.removed,false);
 const accepted=e.instance.applyRelease(release);assert.equal(baseline.removed,false);e.load();assert.equal(await accepted,true);assert.equal(baseline.removed,true);
 const unavailable=e.instance.applyRelease(other);e.fail();assert.equal(await unavailable,false);assert.equal(e.links[1].removed,undefined);e.instance.dispose();
});

function geometryEnvironment(){
 const doc=new Events(),view=new Events();doc.defaultView=view;doc.visibilityState='visible';view.getComputedStyle=node=>({direction:'ltr',position:node.style.position||'static'});view.getSelection=()=>'';
 const element=tag=>Object.assign(new Events(),{tagName:tag.toUpperCase(),ownerDocument:doc,style:{},dataset:{},children:[],attrs:{},classList:{add(){}},textContent:'',append(child){this.children.push(child);child.parent=this;},prepend(child){this.children.unshift(child);child.parent=this;},remove(){this.parent.children=this.parent.children.filter(child=>child!==this);},setAttribute(key,value){this.attrs[key]=value;},getAttribute(key){return this.attrs[key];},querySelector(){return null;},focus(){doc.activeElement=this;},setPointerCapture(){},releasePointerCapture(){}});
 doc.createElement=element;const table=element('table');const heads=[0,1,2].map(i=>{const head=element('th');head.colSpan=1;head.textContent='Column '+i;head.getBoundingClientRect=()=>{const group=table.children.find(n=>n.tagName==='COLGROUP');return {width:group?parseFloat(group.children[i].style.width)/100*600:200};};return head;});table.tHead={rows:[{cells:heads}]};
 return {doc,view,element,table,heads};
}
function fire(node,type,values={}){const event={type,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...values};node.dispatchEvent(event);return event;}
test('column boundaries redistribute adjacent widths, cancel safely and dispose without changing table semantics',()=>{
 const e=geometryEnvironment(),changes=[];const resize=module.exports.createColumnResize(e.table,{onChange:value=>changes.push(value)}),handle=e.heads[0].children[0];
 assert.equal(e.table.style.width,'100%');assert.equal(e.heads[2].children.length,0);assert.equal(handle.attrs.role,'separator');
 assert.equal(e.table.style.minWidth,'600px');
 fire(handle,'pointerdown',{button:0,clientX:200,pointerId:1});fire(e.doc,'pointermove',{clientX:250,pointerId:1});assert.deepEqual(Array.from(resize.widths,Math.round),[250,150,200]);
 const cancel=fire(handle,'keydown',{key:'Escape'});assert.equal(cancel.stopped,true);assert.deepEqual(Array.from(resize.widths,Math.round),[200,200,200]);assert.equal(changes.length,0);
 fire(handle,'keydown',{key:'ArrowRight'});assert.deepEqual(Array.from(resize.widths,Math.round),[210,190,200]);assert.equal(changes.length,1);
 fire(handle,'pointerdown',{button:0,clientX:200,pointerId:2});fire(e.doc,'pointermove',{clientX:500,pointerId:2});assert.ok(resize.widths[1]>=72);e.doc.visibilityState='hidden';fire(e.doc,'visibilitychange');assert.deepEqual(Array.from(resize.widths,Math.round),[210,190,200]);
 resize.dispose();resize.dispose();assert.equal(e.table.children.length,0);assert.equal(e.heads[0].children.length,0);assert.ok([...e.doc.listeners.values(),...e.view.listeners.values(),...handle.listeners.values()].every(set=>set.size===0));
});
test('saved column widths remain the scrollable table floor on a phone',()=>{
 const e=geometryEnvironment();const resize=module.exports.createColumnResize(e.table,{widths:[220,150,180]});
 assert.equal(e.table.style.width,'100%');assert.equal(e.table.style.minWidth,'550px');
 resize.dispose();assert.equal(e.table.style.minWidth,undefined);
});
test('hidden sheet columns do not reserve width or get resize handles',()=>{
 const e=geometryEnvironment();e.heads[1].hidden=true;
 const resize=module.exports.createColumnResize(e.table,{widths:[220,180]});
 assert.equal(e.table.style.minWidth,'400px');
 assert.equal(e.heads[1].children.length,0);
 assert.equal(resize.widths.length,2);
 resize.dispose();
});
test('shared lightbox uses native close, skips editable keyboard navigation and restores opener focus',()=>{
 const e=geometryEnvironment(),dialog=e.element('dialog'),opener=e.element('button');opener.isConnected=true;dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;fire(dialog,'close');};let navigated=0,closed=0;
 const box=module.exports.createLightbox(dialog,{onNavigate:direction=>navigated+=direction,onClose:()=>closed++});box.open(opener);assert.equal(dialog.open,true);
 fire(dialog,'keydown',{key:'ArrowRight',target:{closest:()=>null}});assert.equal(navigated,1);fire(dialog,'keydown',{key:'ArrowRight',target:{closest:()=>({})}});assert.equal(navigated,1);
 box.close();assert.equal(dialog.open,false);assert.equal(closed,1);assert.equal(e.doc.activeElement,opener);assert.equal(dialog.style.display,'');box.dispose();assert.ok([...dialog.listeners.values(),...e.view.listeners.values()].every(set=>set.size===0));
});
