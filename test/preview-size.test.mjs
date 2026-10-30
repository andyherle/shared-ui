import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Same small DOM model used by shape-browser.test.mjs. No layout simulation:
// these tests check native control state, retained nodes and listener ownership.
function fixture(){
  class Node {
    constructor(tag='div'){this.tagName=tag;this.className='';this.children=[];this.style={};this.dataset={};this.attrs=new Map();this.listeners=new Map();this.value='';this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');}};}
    setAttribute(key,value){this.attrs.set(key,String(value));}getAttribute(key){return this.attrs.get(key)??null;}removeAttribute(key){this.attrs.delete(key);}
    append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
    insertBefore(node,before){node.remove();node.parentElement=this;const i=this.children.indexOf(before);if(i<0)this.children.push(node);else this.children.splice(i,0,node);}
    remove(){if(this.parentElement){const parent=this.parentElement;parent.children.splice(parent.children.indexOf(this),1);this.parentElement=null;}}
    replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
    matches(selector){return selector==='[data-item-id]'?this.dataset.itemId!==undefined:selector.startsWith('.')?this.className.split(/\s+/).includes(selector.slice(1)):this.tagName===selector;}
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==fn));}
    emit(type,event={}){for(const fn of this.listeners.get(type)||[])fn({target:this,preventDefault(){},stopPropagation(){},...event});}
    focus(){this.ownerDocument.activeElement=this;}
  }
  const doc=new Node('document');doc.activeElement=null;doc.createElement=tag=>Object.assign(new Node(tag),{ownerDocument:doc});
  const observed=[],released=[],UI={
    adoptAction(node,options){node.textContent=options.label;node.setAttribute('aria-label',options.label);node.action=options;},
    setActionLabel(node,label){node.textContent=label;},
    observeActions:node=>observed.push(node),releaseActions:node=>released.push(node),
  };
  vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
  UI.observeActions=node=>observed.push(node);UI.releaseActions=node=>released.push(node);
  const root=doc.createElement('div');root.className='host';return {UI,root,doc,observed,released};
}
const cards=[{id:'one',label:'First scene',image:'data:image/png;base64,AA=='},{id:'two',label:'Second scene',image:'data:image/png;base64,AA=='}];

test('preview size uses labelled native controls and reports each user change once',()=>{
  const {UI,root}=fixture(),changes=[],control=UI.createPreviewSizeControl({root,sprite:'icons.svg',onChange:value=>changes.push(value)});
  const input=root.querySelector('input'),[smaller,larger]=root.querySelectorAll('button');
  assert.equal(input.type,'range');assert.equal(input.className,'ui-range');
  assert.equal(input.getAttribute('aria-label'),'Preview size');assert.equal(input.getAttribute('aria-valuetext'),'160 pixels');
  assert.deepEqual([input.min,input.max,input.step,input.value],['96','320','16','160']);
  assert.equal(smaller.getAttribute('aria-label'),'Smaller previews');assert.equal(larger.getAttribute('aria-label'),'Larger previews');
  assert.equal(smaller.action.icon,'minus');assert.equal(larger.action.icon,'plus');assert.equal(larger.action.sprite,'icons.svg');
  assert.deepEqual(changes,[]);
  larger.emit('click');assert.equal(control.value,176);assert.deepEqual(changes,[176]);
  input.value='224';input.emit('input');input.emit('change');assert.equal(control.value,224);assert.deepEqual(changes,[176,224]);
  smaller.emit('click');assert.equal(input.value,'208');assert.deepEqual(changes,[176,224,208]);
  input.value='999';input.emit('input');assert.equal(control.value,320);assert.equal(larger.disabled,true);
  larger.emit('click');assert.deepEqual(changes,[176,224,208,320]);
  input.value='1';input.emit('input');assert.equal(control.value,96);assert.equal(smaller.disabled,true);
  assert.equal(root.style.zoom,undefined);assert.equal(input.style.transform,undefined);
  control.dispose();
});

test('programmatic size updates are quiet by default and disposal releases only owned UI',()=>{
  const {UI,root,doc,observed,released}=fixture(),hostChild=doc.createElement('span'),changes=[];root.append(hostChild);
  const control=UI.createPreviewSizeControl({root,value:117,min:100,max:133,step:10,onChange:value=>changes.push(value)});
  const input=root.querySelector('input'),buttons=root.querySelectorAll('button'),group=input.parentElement;
  assert.equal(control.value,120);assert.deepEqual(changes,[]);
  control.setValue(132);assert.equal(control.value,130);assert.equal(buttons[1].disabled,true);assert.deepEqual(changes,[]);
  control.setValue(101,{notify:true});assert.equal(control.value,100);assert.deepEqual(changes,[100]);
  control.setValue(100,{notify:true});assert.deepEqual(changes,[100]);
  assert.throws(()=>control.setValue(NaN),/finite number/);assert.throws(()=>control.setValue('160px'),/finite number/);
  assert.equal(observed[0],group);control.dispose();control.dispose();
  assert.deepEqual(root.children,[hostChild]);assert.equal(root.className,'host');assert.deepEqual(released,[group]);
  for(const node of [input,...buttons])assert.ok([...node.listeners.values()].every(list=>list.length===0));
  input.value='120';input.emit('input');buttons[1].emit('click');control.setValue(120,{notify:true});
  assert.equal(control.value,100);assert.deepEqual(changes,[100]);
});

test('catalogue resizing retains cards, images, selection and focus, including a late width setter',()=>{
  const {UI,root,doc}=fixture(),selected=[];root.style.gridTemplateColumns='repeat(2,1fr)';
  const catalogue=UI.createPreviewCatalogue({root,onSelect:id=>selected.push(id)});catalogue.update(cards,'two');
  const first=root.children[0],image=root.querySelector('img'),focused=root.children[1].querySelector('.ui-media-button');focused.focus();
  for(const width of ['160px','12rem','1.5em','.5rem']){
    catalogue.setMinColumnWidth(width);assert.ok(root.style.gridTemplateColumns.includes(width));
    assert.equal(root.children[0],first);assert.equal(root.querySelector('img'),image);assert.equal(doc.activeElement,focused);assert.equal(focused.getAttribute('aria-pressed'),'true');
  }
  for(const value of ['0px','-1px','160','50%','auto','calc(100% - 1px)','1px);color:red','Infinitypx'])assert.throws(()=>catalogue.setMinColumnWidth(value),/px, rem or em/);
  assert.deepEqual(selected,[]);catalogue.dispose();assert.equal(root.style.gridTemplateColumns,'repeat(2,1fr)');assert.equal(root.className,'host');
  catalogue.setMinColumnWidth('200px');catalogue.update(cards,'one');assert.equal(root.style.gridTemplateColumns,'repeat(2,1fr)');assert.equal(root.children.length,0);
  root.style.gridTemplateColumns='1fr';catalogue.dispose();assert.equal(root.style.gridTemplateColumns,'1fr','Repeated disposal must not overwrite later host changes');
});

test('a host can wire the shared size control to a retained catalogue without selection changes',()=>{
  const {UI,root,doc}=fixture(),toolbar=doc.createElement('div'),selected=[];
  const catalogue=UI.createPreviewCatalogue({root,minColumnWidth:'160px',onSelect:id=>selected.push(id)});catalogue.update(cards,'one');
  const control=UI.createPreviewSizeControl({root:toolbar,onChange:value=>catalogue.setMinColumnWidth(`${value}px`)}),image=root.querySelector('img');
  toolbar.querySelectorAll('button')[1].emit('click');assert.match(root.style.gridTemplateColumns,/176px/);assert.equal(root.querySelector('img'),image);assert.deepEqual(selected,[]);
  control.dispose();catalogue.dispose();assert.equal(root.style.gridTemplateColumns,undefined);
  for(const options of [{min:0},{max:50},{step:0},{max:Infinity}])assert.throws(()=>UI.createPreviewSizeControl({root:toolbar,...options}),/bounded/);
  assert.equal(toolbar.children.length,0);
});
