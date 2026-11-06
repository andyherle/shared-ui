import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(){
  class Node {
    constructor(tag='div'){this.tagName=tag;this.className='';this.children=[];this.style={};this.dataset={};this.attrs=new Map();this.listeners=new Map();this.value='';this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');}};}
    setAttribute(key,value){this.attrs.set(key,String(value));}getAttribute(key){return this.attrs.get(key)??null;}removeAttribute(key){this.attrs.delete(key);}
    append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
    insertBefore(node,before){node.remove();node.parentElement=this;const i=this.children.indexOf(before);if(i<0)this.children.push(node);else this.children.splice(i,0,node);}
    remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}}
    replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
    matches(selector){return selector==='[data-item-id]'?this.dataset.itemId!==undefined:selector.startsWith('.')?this.className.split(/\s+/).includes(selector.slice(1)):this.tagName===selector;}
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==fn));}
    emit(type,event={}){for(const fn of this.listeners.get(type)||[])fn({target:this,preventDefault(){},stopPropagation(){},...event});}
    focus(){this.ownerDocument.activeElement=this;}
    getBoundingClientRect(){const card=this.closest('[data-item-id]'),i=card?.parentElement?.children.indexOf(card)||0;return {left:(i%2)*100,top:Math.floor(i/2)*100,width:100,height:100};}
  }
  const doc=new Node('document');doc.activeElement=null;doc.createElement=tag=>Object.assign(new Node(tag),{ownerDocument:doc});const UI={adoptAction(node,{label}){node.textContent=label;},setActionLabel(node,label){node.textContent=label;}};
  vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
  const root=doc.createElement('div');root.className='host';return {UI,root,doc};
}
const shapes=[{id:'bird',label:'Bird crest',pack:'Wildlife',tags:['closed','avian'],image:'data:image/png;base64,AA=='},{id:'dam',label:'Arch dam',pack:'Infrastructure',tags:['outline'],image:'data:image/png;base64,AA=='},{id:'sensor',label:'Sensor',pack:'Infrastructure',tags:['signal'],image:'data:image/png;base64,AA=='}];

test('shape search combines terms and packs without selecting or replacing the input',()=>{
  const {UI,root}=fixture(),selected=[],browser=UI.createShapeBrowser({root,onSelect:id=>selected.push(id)});browser.update(shapes,'bird');
  const search=root.querySelector('input'),pack=root.querySelector('select'),visible=()=>root.querySelectorAll('[data-item-id]').map(item=>item.dataset.itemId);
  assert.deepEqual(visible(),['bird','dam','sensor']);search.value='avian closed';search.emit('input');assert.deepEqual(visible(),['bird']);
  search.value='';search.emit('input');pack.value='Infrastructure';pack.emit('change');assert.deepEqual(visible(),['dam','sensor']);assert.deepEqual(selected,[]);
  browser.update(shapes,'dam');assert.equal(root.querySelector('input'),search);assert.equal(pack.value,'Infrastructure');assert.equal(root.querySelector('.ui-media-button').getAttribute('aria-pressed'),'true');
  browser.dispose();assert.equal(root.children.length,0);assert.equal(root.className,'host');assert.equal(search.listeners.get('input').length,0);
});

test('native preview keys move focus and Enter with one search match selects once',async()=>{
  const {UI,root,doc}=fixture(),selected=[],browser=UI.createShapeBrowser({root,onSelect:id=>selected.push(id)});browser.update(shapes,'bird');
  const search=root.querySelector('input'),gallery=root.children[1];search.emit('keydown',{key:'ArrowDown'});assert.equal(doc.activeElement.closest('[data-item-id]').dataset.itemId,'bird');
  gallery.emit('keydown',{target:doc.activeElement,key:'ArrowRight'});assert.equal(doc.activeElement.closest('[data-item-id]').dataset.itemId,'dam');
  gallery.emit('keydown',{target:doc.activeElement,key:'End'});assert.equal(doc.activeElement.closest('[data-item-id]').dataset.itemId,'sensor');assert.deepEqual(selected,[]);
  search.value='avian';search.emit('input');search.emit('keydown',{key:'Enter'});await Promise.resolve();assert.deepEqual(selected,['bird']);
  search.value='missing';search.emit('input');assert.match(root.querySelector('output').textContent,/No shapes match/);browser.dispose();
});

test('busy selection blocks duplicates and failed apply keeps the previous selected shape',async()=>{
  const {UI,root}=fixture();let reject,calls=0;const browser=UI.createShapeBrowser({root,onSelect:()=>{calls++;return new Promise((_,no)=>{reject=no;});}});browser.update(shapes,'bird');
  const buttons=root.querySelectorAll('.ui-media-button');buttons[1].emit('click');buttons[1].emit('click');assert.equal(calls,1);assert.equal(root.getAttribute('aria-busy'),'true');
  reject(new Error('Apply failed'));await new Promise(resolve=>setImmediate(resolve));assert.equal(root.getAttribute('aria-busy'),'false');assert.equal(root.querySelector('output').textContent,'Apply failed');assert.equal(buttons[0].getAttribute('aria-pressed'),'true');browser.dispose();
});

test('two browsers keep separate search, selected shape and lifecycle state',()=>{
  const {UI,root,doc}=fixture(),other=doc.createElement('div'),a=UI.createShapeBrowser({root}),b=UI.createShapeBrowser({root:other});a.update(shapes,'bird');b.update(shapes,'dam');
  const search=root.querySelector('input');search.value='avian';search.emit('input');assert.equal(root.querySelectorAll('[data-item-id]').length,1);assert.equal(other.querySelectorAll('[data-item-id]').length,3);assert.equal(other.querySelectorAll('.ui-media-button')[1].getAttribute('aria-pressed'),'true');
  a.dispose();assert.equal(other.querySelectorAll('[data-item-id]').length,3);b.dispose();
});

test('preview size changes layout without selecting a shape or replacing rendered images',()=>{
  const {UI,root}=fixture(),selected=[],browser=UI.createShapeBrowser({root,onSelect:id=>selected.push(id)});browser.update(shapes,'bird');
  const slider=root.querySelectorAll('input').find(input=>input.type==='range'),gallery=root.children[1],image=root.querySelector('img');
  assert.equal(slider.value,'80');assert.equal(slider.getAttribute('aria-valuetext'),'80 pixels');
  slider.value='144';slider.emit('input');assert.match(gallery.style.gridTemplateColumns,/144px/);assert.equal(slider.getAttribute('aria-valuetext'),'144 pixels');
  assert.equal(root.querySelector('img'),image);assert.equal(root.querySelector('.ui-media-button').getAttribute('aria-pressed'),'true');assert.deepEqual(selected,[]);
  browser.dispose();assert.equal(slider.listeners.get('input').length,0);
});
