import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openPDF} from '../src/pdf-preview.mjs';

function fixture({fail=false,wait=false}={}){
  let options,destroyed=0,zoomDisposed=0,resolveLoad;
  const listeners=new Map(),canvases=[],rendered=[];
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.attrs={};this.ownerDocument=doc;this.clientWidth=320;}
    append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parent=this;}
    replaceChildren(...nodes){this.children=[];this.append(...nodes);}
    setAttribute(name,value){this.attrs[name]=value;}
    removeAttribute(name){delete this.attrs[name];delete this[name];}
    addEventListener(type,fn){this[type]=fn;}
    querySelectorAll(tag){return this.children.flatMap(node=>[...(node.tag===tag?[node]:[]),...node.querySelectorAll(tag)]);}
    getContext(){return{};}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  }
  const view={devicePixelRatio:2,requestAnimationFrame:fn=>fn(),cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type),SharedUI:{adoptAction(button,{label}){button.label=label;},createZoom(_root,options){view.zoom=options;return{dispose(){zoomDisposed++;}};}}};
  const doc={baseURI:'https://ledger.example/',defaultView:view,createElement(tag){const e=new Element(tag);if(tag==='canvas')canvases.push(e);return e;}};
  const root=new Element('section');
  const pdf={numPages:3,async getPage(number){return{getViewport:({scale})=>({width:612*scale,height:792*scale}),render(){rendered.push(number);return{promise:fail?Promise.reject(new TypeError('unsupported canvas operation')):Promise.resolve(),cancel(){}};},getTextContent:async()=>({items:[{str:'Synthetic page '+number}]}),cleanup(){}};}};
  const sdk={GlobalWorkerOptions:{},AnnotationMode:{ENABLE:1},getDocument(input){options=input;return{promise:wait?new Promise(resolve=>{resolveLoad=resolve;}):Promise.resolve(pdf),destroy(){destroyed++;}};}};
  const controller=new AbortController(),original=new Uint8Array([37,80,68,70]).buffer;
  return{root,view,doc,sdk,controller,original,canvases,rendered,listeners,get options(){return options;},get destroyed(){return destroyed;},get zoomDisposed(){return zoomDisposed;},resolve(){resolveLoad(pdf);},start(source=original){return openPDF(root,source,{signal:controller.signal,assetBase:'https://ledger.example/pdfjs/',sprite:'/ui/icons.svg',loadLibrary:async()=>sdk});}};
}

test('verified bytes stay intact; pinned assets, disabled scripting and single-page navigation are shared',async()=>{
 const f=fixture();await f.start();assert.equal(f.original.byteLength,4);assert.notEqual(f.options.data.buffer,f.original);
 assert.equal(f.options.isEvalSupported,false);assert.equal(f.options.enableXfa,false);assert.equal(f.sdk.GlobalWorkerOptions.workerSrc,'https://ledger.example/pdfjs/pdf.worker.min.mjs');
 assert.deepEqual(f.rendered,[1]);const controls=f.root.children[0];assert.equal(controls.children[0].disabled,true);
 controls.children[2].click();for(let i=0;i<10;i++)await Promise.resolve();assert.deepEqual(f.rendered,[1,2]);
 f.view.zoom.onChange(1.5);for(let i=0;i<10;i++)await Promise.resolve();assert.deepEqual(f.rendered,[1,2,2]);
 f.controller.abort();assert.equal(f.destroyed,1);assert.equal(f.zoomDisposed,1);assert.ok(f.canvases.every(c=>c.width===0));
});

test('render failure releases worker and zoom before the native fallback; close removes its source',async()=>{
 const f=fixture({fail:true});await f.start('https://ledger.example/document?version=exact#page=2');
 assert.equal(f.destroyed,1);assert.equal(f.zoomDisposed,1);const frame=f.root.children[1];assert.equal(frame.tag,'iframe');assert.match(frame.src,/version=exact/);
 f.controller.abort();assert.equal(frame.src,undefined);assert.ok(!f.root.children.includes(frame));
});

test('verified-byte failures propagate to the host retry UI',async()=>{
 const f=fixture({fail:true});await assert.rejects(f.start(),/unsupported canvas/);assert.equal(f.destroyed,1);
});

test('closing during loading and history caching do not reopen or prematurely destroy previews',async()=>{
 const f=fixture({wait:true}),opened=f.start();await Promise.resolve();f.controller.abort();f.resolve();await opened;assert.equal(f.root.children.length,0);assert.equal(f.destroyed,1);
 const g=fixture();await g.start();g.listeners.get('pagehide')({persisted:true});assert.equal(g.destroyed,0);g.listeners.get('pagehide')({persisted:false});assert.equal(g.destroyed,1);
});

test('published optional module is generated from the editable source',()=>{
 assert.equal(fs.readFileSync(new URL('../src/pdf-preview.mjs',import.meta.url),'utf8'),fs.readFileSync(new URL('../public/v1/pdf-preview.mjs',import.meta.url),'utf8'));
});
