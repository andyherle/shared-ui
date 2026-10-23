import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const mod={exports:{}};vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module:mod,URL});
function fixture(width=1100,withStatus=false){
 const listeners=new Set(),events=new Map();let disconnected=false;
 const view={addEventListener:(name,fn)=>{listeners.add(fn);if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener:(name,fn)=>{listeners.delete(fn);events.get(name)?.delete(fn);},ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){}disconnect(){disconnected=true;}}};
 const doc={hidden:false,defaultView:view,addEventListener:view.addEventListener,removeEventListener:view.removeEventListener};
 class Node{constructor(w=width){this.ownerDocument=doc;this.width=w;this.scrollWidth=w;this.dataset={};this.style={getPropertyValue(k){return this[k]||'';},setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};this.listeners={};this.children=[];this.attrs={};this.classes=new Set();this.classList={add:(...names)=>names.forEach(name=>this.classes.add(name))};}
  addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(v=>v!==fn);}fire(type,event={}){for(const fn of this.listeners[type]||[])fn({preventDefault(){},stopPropagation(){},...event});}focus(){}setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}
  getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
  append(node){node.remove();this.children.push(node);node.parentNode=this;}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
  insertBefore(node){this.append(node);}
  getBoundingClientRect(){return{width:this.width};}
 }
 doc.createElement=()=>new Node();doc.body=new Node();
 const container=new Node(),toolbar=new Node(400),zoom=new Node(130);container.append(toolbar);container.append(zoom);
 const status=withStatus?new Node(90):null;if(status)toolbar.append(status);
 const dock=mod.exports.createContextToolbar(toolbar,{container,zoom,status});
 return{doc,container,toolbar,zoom,status,dock,listeners,fire:(name,event)=>{for(const fn of [...events.get(name)||[]])fn(event);},get disconnected(){return disconnected;}};
}
test('context commands remain centered with a separate right-hand zoom slot in container coordinates',()=>{
 const f=fixture();assert.equal(f.dock.element.dataset.uiPosition,'container');assert.equal(f.toolbar.style.gridColumn,'2');assert.equal(f.zoom.style.gridColumn,'3');assert.equal(f.zoom.style.justifySelf,'end');assert.equal(f.zoom.style.width,'max-content');assert.equal(f.toolbar.style.maxWidth,'828px');
 const native=f.toolbar;f.dock.refresh();assert.equal(f.dock.element.children[0],native);f.dock.dispose();assert.equal(native.parentNode,f.container);assert.equal(f.zoom.parentNode,f.container);assert.equal(f.listeners.size,0);assert.equal(f.disconnected,true);
});
test('narrow containers reserve two non-overlapping rows instead of squeezing the commands under zoom',()=>{
 const f=fixture(390);assert.equal(f.toolbar.style.gridColumn,'1 / -1');assert.equal(f.toolbar.style.gridRow,'2');assert.equal(f.zoom.style.gridRow,'1');assert.equal(f.zoom.style.justifySelf,'center');assert.equal(f.toolbar.style.maxWidth,'390px');f.dock.dispose();
});

test('shared panel resize retains content, supports keyboard bounds and cancels pointer edits',()=>{
 const f=fixture(),panel=f.toolbar;const resize=mod.exports.createResizablePanel(panel,{container:f.container,value:320,min:240,max:600,minMain:400});const handle=resize.element;
 assert.equal(handle.getAttribute('role'),'separator');assert.equal(f.container.style['--ui-aside'],'320px');
 handle.fire('pointerdown',{button:0,pointerId:1,clientX:800});handle.fire('pointermove',{pointerId:1,clientX:700});assert.equal(resize.value,420);handle.fire('keydown',{key:'Escape'});assert.equal(resize.value,320);
 handle.fire('keydown',{key:'ArrowLeft'});assert.equal(resize.value,330);handle.fire('keydown',{key:'End'});assert.equal(resize.value,600);
 f.container.width=550;resize.refresh();assert.equal(handle.hidden,true);assert.equal(resize.value,240);resize.dispose();assert.equal(f.container.style['--ui-aside'],undefined);assert.equal(panel.parentNode,f.dock.element);f.dock.dispose();assert.equal(f.listeners.size,0);
});

test('context tools stay centered and bounded while a container shrinks and grows',()=>{
 const f=fixture();assert.equal(f.toolbar.style.position,'static');assert.equal(f.toolbar.style.inset,'auto');assert.equal(f.toolbar.classes.has('ui-inline'),true);assert.equal(f.toolbar.style.width,'max-content');assert.equal(f.toolbar.style.justifySelf,'center');
 f.dock.element.width=320;f.dock.refresh();assert.equal(f.toolbar.style.maxWidth,'320px');assert.equal(f.zoom.style.gridRow,'1');assert.equal(f.toolbar.style.gridRow,'2');assert.equal(f.zoom.style.justifySelf,'center');
 f.dock.element.width=1100;f.dock.refresh();assert.equal(f.toolbar.style.maxWidth,'828px');assert.equal(f.zoom.style.gridRow,'1');assert.equal(f.toolbar.style.gridColumn,'2');assert.equal(f.zoom.style.justifySelf,'end');f.dock.dispose();
});

test('selection status owns a separate row and restores its original location',()=>{
 const f=fixture(1800,true);assert.equal(f.toolbar.style.maxWidth,'1200px');assert.equal(f.toolbar.style.gridRow,'2');assert.notEqual(f.status.parentNode,f.toolbar);assert.equal(f.status.parentNode.style.whiteSpace,'nowrap');
 f.dock.element.width=390;f.dock.refresh();assert.equal(f.toolbar.style.gridRow,'3');assert.equal(f.zoom.style.gridRow,'2');f.toolbar.hidden=true;f.dock.refresh();assert.equal(f.status.parentNode.hidden,true);f.dock.dispose();assert.equal(f.status.parentNode,f.toolbar);
});

test('back-forward page hiding preserves the dock and restores its container bounds',()=>{const f=fixture();const parent=f.toolbar.parentNode;f.fire('pagehide',{persisted:true});assert.equal(f.toolbar.parentNode,parent);assert.equal(f.disconnected,false);f.dock.element.width=390;f.fire('pageshow',{persisted:true});assert.equal(f.toolbar.style.maxWidth,'390px');f.fire('pagehide',{persisted:false});assert.equal(f.toolbar.parentNode,f.container);assert.equal(f.disconnected,true);});

test('panel layout subtracts safe padding, restores preferred width after resize and restores authored state',()=>{
 const f=fixture(1000);f.doc.defaultView.getComputedStyle=()=>({paddingLeft:'20px',paddingRight:'20px'});f.container.setAttribute('data-ui-resize-layout','authored');f.container.style.setProperty('--ui-aside','300px');
 f.toolbar.getBoundingClientRect=()=>({left:600,right:980,width:380});f.container.getBoundingClientRect=()=>({left:0,width:f.container.width});
 const resize=mod.exports.createResizablePanel(f.toolbar,{container:f.container,min:240,max:600,minMain:400,value:500});
 assert.equal(f.container.getAttribute('data-ui-resize-layout'),'side');assert.equal(resize.element.style.left,'594px');
 f.container.width=670;resize.refresh();assert.equal(resize.value,240);assert.equal(f.container.getAttribute('data-ui-resize-layout'),'stack');
 f.container.width=1100;resize.refresh();assert.equal(resize.value,500);assert.equal(f.container.getAttribute('data-ui-resize-layout'),'side');
 resize.dispose();assert.equal(f.container.getAttribute('data-ui-resize-layout'),'authored');assert.equal(f.container.style.getPropertyValue('--ui-aside'),'300px');f.dock.dispose();
});


test('overlay hiding zoom preserves the command slot and restores the same bounds',()=>{
 const f=fixture();const cap=f.toolbar.style.maxWidth,row=f.toolbar.style.gridRow,column=f.toolbar.style.gridColumn;
 f.zoom.hidden=true;f.zoom.width=0;f.dock.refresh();assert.equal(f.toolbar.style.maxWidth,cap);assert.equal(f.toolbar.style.gridRow,row);assert.equal(f.toolbar.style.gridColumn,column);
 f.zoom.hidden=false;f.zoom.width=130;f.dock.refresh();assert.equal(f.toolbar.style.maxWidth,cap);f.dock.dispose();
});
