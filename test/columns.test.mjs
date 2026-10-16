import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const module={exports:{}};
vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module,URL});

class Element {
  constructor(tag,doc){
    this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.childNodes=[];this.dataset={};
    this.attrs=new Map();this.listeners=new Map();this.colSpan=1;this.rowSpan=1;this.hidden=false;
  }
  get children(){return this.childNodes.filter(node=>node.tagName!=='#TEXT');}
  get cells(){return this.children.filter(node=>['TH','TD'].includes(node.tagName));}
  get rows(){return this.children.filter(node=>node.tagName==='TR');}
  get classList(){return {contains:name=>this.className?.split(' ').includes(name)||false,
    add:name=>{this.className=[...new Set([...(this.className||'').split(' ').filter(Boolean),name])].join(' ');}};}
  get textContent(){return this.tagName==='#TEXT'?this.value||'':this.childNodes.map(node=>node.textContent).join('');}
  set textContent(value){if(this.tagName==='#TEXT'){this.value=String(value);return;}const node=new Element('#text',this.ownerDocument);node.value=String(value);this.replaceChildren(node);}
  append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.childNodes=node.parentElement.childNodes.filter(other=>other!==node);node.parentElement=this;this.childNodes.push(node);}}
  prepend(node){this.append(node);this.childNodes=[node,...this.childNodes.filter(other=>other!==node)];}
  replaceChildren(...nodes){for(const node of this.childNodes)node.parentElement=null;this.childNodes=[];this.append(...nodes);}
  matches(selector){return selector.split(',').some(part=>part.trim().toUpperCase()===this.tagName);}
  closest(selector){if(selector==='button[data-column-move]')return this.tagName==='BUTTON'&&this.dataset.columnMove?this:this.parentElement?.closest(selector)||null;return null;}
  contains(other){return this===other||this.children.some(child=>child.contains(other));}
  querySelector(selector){
    if(selector===':scope > .ui-disclosure-body')return this.children.find(node=>node.classList.contains('ui-disclosure-body'))||null;
    if(selector===':scope > .ui-label')return this.children.find(node=>node.classList.contains('ui-label'))||null;
    if(selector===':scope > svg')return this.children.find(node=>node.tagName==='SVG')||null;
    if(selector==='use')return this.querySelectorAll('use')[0]||null;
    return null;
  }
  querySelectorAll(selector){
    const out=[];const match=node=>selector==='.ui-actions'?node.classList.contains('ui-actions'):
      selector==='[data-column-visible]'?Boolean(node.dataset.columnVisible):
      selector==='[data-column-move]'?Boolean(node.dataset.columnMove):
      selector==='use'?node.tagName==='USE':false;
    const walk=node=>{for(const child of node.children){if(match(child))out.push(child);walk(child);}};walk(this);return out;
  }
  setAttribute(name,value){this.attrs.set(name,String(value));}
  getAttribute(name){return this.attrs.get(name)||null;}
  hasAttribute(name){return this.attrs.has(name);}
  focus(){this.ownerDocument.activeElement=this;}
  addEventListener(type,listener){const list=this.listeners.get(type)||new Set();list.add(listener);this.listeners.set(type,list);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
  fire(type,target){for(const listener of this.listeners.get(type)||[])listener({type,target});}
}

function fixture(){
  const doc={baseURI:'https://app.example/ledger',createElement(tag){return new Element(tag,doc);},createElementNS(_ns,tag){return new Element(tag,doc);}};
  const table=doc.createElement('table'),head=doc.createElement('thead'),heading=doc.createElement('tr'),bodySection=doc.createElement('tbody');
  const ids=['entry','amount','documents'];for(const id of ids){const cell=doc.createElement('th');cell.dataset.column=id;cell.textContent=id;heading.append(cell);}
  head.append(heading);table.tHead=head;table.tBodies=[bodySection];table.tFoot=null;table.append(head,bodySection);
  const row=doc.createElement('tr'),link=doc.createElement('a');link.textContent='Open entry';
  for(const id of ids){const cell=doc.createElement('td');cell.textContent=id;row.append(cell);}
  row.cells[0].append(link);bodySection.append(row);
  const details=doc.createElement('details'),summary=doc.createElement('summary'),panel=doc.createElement('div');panel.className='ui-disclosure-body ui-stack';details.append(summary,panel);
  return {table,details,heading,row,link,panel};
}

test('native column chooser hides and reorders existing cells, then restores the table',()=>{
  const f=fixture(),changes=[];
  const manager=module.exports.createColumnManager(f.table,f.details,{order:['entry','documents','amount'],hidden:['documents'],pinFirst:true,sprite:'/icons.svg',onChange:state=>changes.push(state)});
  assert.deepEqual(f.heading.cells.map(cell=>cell.dataset.column),['entry','documents','amount']);
  assert.equal(f.heading.cells[1].hidden,true);assert.equal(f.row.cells[1].hidden,true);
  assert.equal(f.row.cells[0].children.at(-1),f.link);
  const move=f.panel.querySelectorAll('[data-column-move]').find(button=>button.dataset.columnMove==='amount'&&button.dataset.direction==='-1');
  f.panel.fire('click',move);
  assert.deepEqual(f.heading.cells.map(cell=>cell.dataset.column),['entry','amount','documents']);
  assert.equal(f.table.ownerDocument.activeElement?.dataset.columnMove,'amount');
  assert.equal(changes.length,1);assert.equal(changes[0].order[1],'amount');
  const checkbox=f.panel.querySelectorAll('[data-column-visible]').find(input=>input.dataset.columnVisible==='documents');
  checkbox.checked=true;f.panel.fire('change',checkbox);
  assert.equal(f.heading.cells[2].hidden,false);assert.equal(f.row.cells[2].hidden,false);
  assert.equal(changes.length,2);assert.equal(f.row.cells[0].children.at(-1),f.link);
  manager.dispose();assert.deepEqual(f.heading.cells.map(cell=>cell.dataset.column),['entry','amount','documents']);
  assert.equal(f.heading.cells.every(cell=>!cell.hidden),true);
  assert.equal(f.panel.listeners.get('click').size,0);assert.equal(f.panel.listeners.get('change').size,0);
});

test('column chooser rejects merged cells and duplicate column identities',()=>{
  const duplicate=fixture();duplicate.heading.cells[1].dataset.column='entry';
  assert.throws(()=>module.exports.createColumnManager(duplicate.table,duplicate.details),/unique data-column/);
  const merged=fixture();merged.row.cells[0].colSpan=2;
  assert.throws(()=>module.exports.createColumnManager(merged.table,merged.details),/one cell per column/);
});

test('invalid saved column state cannot drop a column',()=>{
  const f=fixture();const manager=module.exports.createColumnManager(f.table,f.details,{order:'entry',hidden:['entry','amount','documents'],pinFirst:true,sprite:'/icons.svg'});
  assert.deepEqual(f.heading.cells.map(cell=>cell.dataset.column),['entry','amount','documents']);
  assert.equal(f.heading.cells[0].hidden,false);
  manager.dispose();
});
