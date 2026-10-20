import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const mod={exports:{}};vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module:mod,URL});
function fixture(width=1100){
 const listeners=new Set();let disconnected=false;
 const view={addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn),ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){}disconnect(){disconnected=true;}}};
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
 const dock=mod.exports.createContextToolbar(toolbar,{container,zoom});
 return{doc,container,toolbar,zoom,dock,listeners,get disconnected(){return disconnected;}};
}
test('context commands remain centered with a separate right-hand zoom slot in container coordinates',()=>{
 const f=fixture();assert.equal(f.dock.element.dataset.uiPosition,'container');assert.equal(f.toolbar.style.gridColumn,'2');assert.equal(f.zoom.style.gridColumn,'3');assert.equal(f.zoom.style.justifySelf,'end');assert.equal(f.toolbar.style.maxWidth,'816px');
 const native=f.toolbar;f.dock.refresh();assert.equal(f.dock.element.children[0],native);f.dock.dispose();assert.equal(native.parentNode,f.container);assert.equal(f.zoom.parentNode,f.container);assert.equal(f.listeners.size,0);assert.equal(f.disconnected,true);
});
test('narrow containers reserve two non-overlapping rows instead of squeezing the commands under zoom',()=>{
 const f=fixture(390);assert.equal(f.toolbar.style.gridColumn,'1 / -1');assert.equal(f.toolbar.style.gridRow,'1');assert.equal(f.zoom.style.gridRow,'2');assert.equal(f.toolbar.style.maxWidth,'390px');f.dock.dispose();
});

test('shared panel resize retains content, supports keyboard bounds and cancels pointer edits',()=>{
 const f=fixture(),panel=f.toolbar;const resize=mod.exports.createResizablePanel(panel,{container:f.container,value:320,min:240,max:600,minMain:400});const handle=resize.element;
 assert.equal(handle.getAttribute('role'),'separator');assert.equal(f.container.style['--ui-aside'],'320px');
 handle.fire('pointerdown',{button:0,pointerId:1,clientX:800});handle.fire('pointermove',{pointerId:1,clientX:700});assert.equal(resize.value,420);handle.fire('keydown',{key:'Escape'});assert.equal(resize.value,320);
 handle.fire('keydown',{key:'ArrowLeft'});assert.equal(resize.value,330);handle.fire('keydown',{key:'End'});assert.equal(resize.value,600);
 f.container.width=550;resize.refresh();assert.equal(handle.hidden,true);assert.equal(resize.value,240);resize.dispose();assert.equal(f.container.style['--ui-aside'],undefined);assert.equal(panel.parentNode,f.dock.element);f.dock.dispose();assert.equal(f.listeners.size,0);
});

test('context tools stay centered and bounded while a container shrinks and grows',()=>{
 const f=fixture();assert.equal(f.toolbar.classes.has('ui-inline'),true);assert.equal(f.toolbar.style.width,'max-content');assert.equal(f.toolbar.style.justifySelf,'center');
 f.dock.element.width=320;f.dock.refresh();assert.equal(f.toolbar.style.maxWidth,'320px');assert.equal(f.zoom.style.gridRow,'2');
 f.dock.element.width=1100;f.dock.refresh();assert.equal(f.toolbar.style.maxWidth,'816px');assert.equal(f.zoom.style.gridRow,'1');assert.equal(f.toolbar.style.gridColumn,'2');f.dock.dispose();
});
