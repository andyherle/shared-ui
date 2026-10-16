import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const module={exports:{}};
vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module,URL});

class Events {
  constructor(){this.listeners=new Map();}
  addEventListener(type,listener){const set=this.listeners.get(type)||new Set();set.add(listener);this.listeners.set(type,set);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
  fire(type,values={}){
    const event={type,target:this,button:0,pointerId:1,clientX:0,clientY:0,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};
    for(const listener of this.listeners.get(type)||[])listener({...event,currentTarget:this});
  }
}
class Element extends Events {
  constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.childNodes=[];this.dataset={};this.style={touchAction:''};this.attrs=new Map();this.colSpan=1;this.rowSpan=1;this.hidden=false;}
  get children(){return this.childNodes;}
  get cells(){return this.children.filter(node=>['TH','TD'].includes(node.tagName));}
  get rows(){return this.children.filter(node=>node.tagName==='TR');}
  get textContent(){return this._text||this.children.map(node=>node.textContent).join('');}
  set textContent(value){this._text=String(value);}
  append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.childNodes=node.parentElement.childNodes.filter(other=>other!==node);node.parentElement=this;this.childNodes.push(node);}}
  getBoundingClientRect(){const index=this.parentElement?.cells.indexOf(this)||0;return {left:index*100,right:(index+1)*100,width:100,top:0,bottom:24,height:24};}
  closest(selector){return selector==='button,a,input,select,textarea,[role=separator]'&&['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(this.tagName)?this:null;}
  setAttribute(name,value){this.attrs.set(name,String(value));}
  getAttribute(name){return this.attrs.get(name)??null;}
  hasAttribute(name){return this.attrs.has(name);}
  removeAttribute(name){this.attrs.delete(name);}
  focus(){this.ownerDocument.activeElement=this;}
  setPointerCapture(){}
  releasePointerCapture(){}
}
function fixture(){
  const doc=new Events();doc.visibilityState='visible';doc.defaultView=new Events();doc.defaultView.getComputedStyle=()=>({direction:'ltr'});
  const create=tag=>new Element(tag,doc),table=create('table'),head=create('thead'),heading=create('tr'),body=create('tbody'),row=create('tr');
  const ids=['entry','amount','documents'];for(const id of ids){const cell=create('th');cell.dataset.column=id;cell.textContent=id;heading.append(cell);const td=create('td');td.textContent=id;row.append(td);}
  head.append(heading);body.append(row);table.append(head,body);table.tHead=head;table.tBodies=[body];table.tFoot=null;
  const link=create('a');link.textContent='Open entry';row.cells[0].append(link);
  return {doc,table,heading,row,link,heads:Object.fromEntries(heading.cells.map(cell=>[cell.dataset.column,cell]))};
}
const order=row=>row.cells.map(cell=>cell.dataset.column||cell._text);

test('dragging a native heading moves existing cells and keeps the first column pinned',()=>{
  const f=fixture(),changes=[];const drag=module.exports.createColumnDrag(f.table,{pinFirst:true,onChange:state=>changes.push(state)});
  f.heads.entry.fire('pointerdown',{clientX:50});f.doc.fire('pointermove',{clientX:270});f.doc.fire('pointerup',{clientX:270});
  assert.deepEqual(order(f.heading),['entry','amount','documents']);
  f.heads.amount.fire('pointerdown',{clientX:150});f.doc.fire('pointermove',{clientX:270});f.doc.fire('pointerup',{clientX:270});
  assert.deepEqual(order(f.heading),['entry','documents','amount']);
  assert.deepEqual(order(f.row),['entry','documents','amount']);
  assert.equal(f.row.cells[0].children[0],f.link);
  assert.deepEqual(Array.from(changes.at(-1).order),['entry','documents','amount']);
  assert.equal(drag.state.order[2],'amount');
  drag.dispose();assert.deepEqual(order(f.heading),['entry','amount','documents']);
  assert.equal(f.heads.amount.hasAttribute('tabindex'),false);
  assert.equal(f.heads.amount.listeners.get('pointerdown').size,0);
});

test('Option arrows move a focused heading; resize controls and cancelled drags do not reorder',()=>{
  const f=fixture(),drag=module.exports.createColumnDrag(f.table,{pinFirst:true});
  const resize=new Element('button',f.doc);f.heads.amount.append(resize);
  f.heads.amount.fire('pointerdown',{target:resize,clientX:150});f.doc.fire('pointermove',{clientX:270});f.doc.fire('pointerup',{clientX:270});
  assert.deepEqual(order(f.heading),['entry','amount','documents']);
  f.heads.amount.fire('pointerdown',{clientX:150});f.doc.fire('pointermove',{clientX:270});f.doc.fire('pointercancel',{clientX:270});
  assert.deepEqual(order(f.heading),['entry','amount','documents']);
  f.heads.amount.fire('keydown',{key:'ArrowRight',altKey:true});
  assert.deepEqual(order(f.heading),['entry','documents','amount']);
  assert.equal(f.doc.activeElement,f.heads.amount);
  f.heads.amount.fire('keydown',{key:'ArrowLeft',altKey:true});
  assert.deepEqual(order(f.heading),['entry','amount','documents']);
  drag.dispose();
});

test('invalid saved order cannot lose columns; merged cells and duplicate IDs are rejected',()=>{
  const f=fixture(),drag=module.exports.createColumnDrag(f.table,{order:['documents','documents','unknown'],pinFirst:true});
  assert.deepEqual(order(f.heading),['entry','documents','amount']);drag.dispose();
  const duplicate=fixture();duplicate.heads.amount.dataset.column='entry';
  assert.throws(()=>module.exports.createColumnDrag(duplicate.table),/unique data-column/);
  const merged=fixture();merged.row.cells[0].colSpan=2;
  assert.throws(()=>module.exports.createColumnDrag(merged.table),/one cell per column/);
});
