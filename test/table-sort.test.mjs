import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const module={exports:{}};vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module,URL});
class Node {
 constructor(name,doc){this.name=name;this.ownerDocument=doc;this.childNodes=[];this.attrs=new Map();this.dataset={};}
 listeners=new Map();
 addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler);}
 removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
 fire(type){for(const handler of this.listeners.get(type)||[])handler({});}
 classList={remove:(...names)=>{this.className=(this.className||'').split(/\s+/).filter(name=>!names.includes(name)).join(' ');},contains:(name)=>(this.className||'').split(/\s+/).includes(name),add:(name)=>{this.className=[...new Set((this.className||'').split(/\s+/).filter(Boolean).concat(name))].join(' ');}};
 matches(selector){return selector.split(',').includes(this.name);}
 append(...nodes){for(const node of nodes){if(node.parent)node.parent.childNodes=node.parent.childNodes.filter(n=>n!==node);node.parent=this;this.childNodes.push(node);}}
 prepend(node){this.append(node);this.childNodes=[node,...this.childNodes.filter(n=>n!==node)];}
 replaceChildren(...nodes){for(const n of this.childNodes)n.parent=null;this.childNodes=[];this.append(...nodes);}
 querySelectorAll(selector){if(selector===':scope > [data-ui-text]')return this.childNodes.filter(n=>n.hasAttribute('data-ui-text'));return [];}
 removeAttribute(k){this.attrs.delete(k);}
 querySelector(selector){if(selector==='[data-ui-feedback]')return this.childNodes.find(n=>n.dataset.uiFeedback); if(selector.startsWith('[data-ui-zoom='))return this.childNodes.find(n=>n.getAttribute('data-ui-zoom')===selector.slice(14,-1));if(selector===':scope > [data-ui-current]')return this.childNodes.find(n=>n.hasAttribute('data-ui-current'));if(selector===':scope > .ui-label'||selector===':scope > .ui-dynamic')return this.childNodes.find(n=>(n.className||'').split(' ').includes(selector.slice(10)));if(selector===':scope > svg')return this.childNodes.find(n=>n.name==='svg');return this.childNodes.find(n=>n.name===selector);}
 remove(){if(this.parent)this.parent.childNodes=this.parent.childNodes.filter(n=>n!==this);this.parent=null;}
 setAttribute(k,v){this.ownerDocument.writes=(this.ownerDocument.writes||0)+1;this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)??null;}hasAttribute(k){return this.attrs.has(k);}
 get textContent(){return this.name==='#text'?this.value||'':this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v){if(this.name==='#text')this.value=String(v);else{const t=new Node('#text',this.ownerDocument);t.value=String(v);this.replaceChildren(t);}}
}

function fixture(){
 const doc={baseURI:'https://app.example/',createElement:n=>new Node(n,doc),createElementNS:(_ns,n)=>new Node(n,doc),defaultView:new Node('window')};
 const table=doc.createElement('table'),head=doc.createElement('tr'),body=doc.createElement('tbody');
 Object.defineProperty(head,'cells',{get(){return this.childNodes;}});Object.defineProperty(body,'rows',{get(){return this.childNodes;}});
 table.tHead={rows:[head]};table.tBodies=[body];
 for(const [id,label,type]of [['date','Date',''],['amount','Amount','number'],['name','Name','']]){const th=doc.createElement('th');th.dataset.column=id;th.dataset.uiSortType=type;th.textContent=label;head.append(th);}
 for(const [date,amount,name]of [['2026-01-02','10.00 CAD','B'],['2026-01-03','−2.00 CAD','A'],['','1,000.00 CAD','C']]){
  const row=doc.createElement('tr');Object.defineProperty(row,'cells',{get(){return this.childNodes;}});
  for(const val of [date,amount,name]){const td=doc.createElement('td');td.textContent=val;row.append(td);}body.append(row);
 }
 return {table,head,body};
}
test('table date defaults descend; numeric sorting preserves rows and missing values stay last',()=>{
 const f=fixture(),original=[...f.body.rows],sort=module.exports.createTableSort(f.table,{column:'date',direction:'desc'});
 assert.equal(f.body.rows[0],original[1]);assert.equal(f.body.rows[2],original[2]);
 sort.sort('amount','asc');assert.equal(f.body.rows[0],original[1]);assert.equal(f.body.rows[2],original[2]);
 sort.sort('amount','desc');assert.equal(f.body.rows[0],original[2]);
 assert.equal(f.head.cells[1].getAttribute('aria-sort'),'descending');
 assert.equal(f.head.cells[1].querySelector('button').type,'button');
 sort.dispose();assert.equal(f.head.cells[1].textContent,'Amount');assert.equal(f.head.cells[1].getAttribute('aria-sort'),null);
});
test('controlled sorting reports the entire dataset sort without rearranging a visible page',()=>{
 const f=fixture(),original=[...f.body.rows],changes=[],sort=module.exports.createTableSort(f.table,{column:'date',direction:'desc',manual:true,onChange:s=>changes.push(s)});
 f.head.cells[0].querySelector('button').fire('click');assert.equal(sort.state.direction,'asc');assert.deepEqual(f.body.rows,original);assert.equal(changes[0].column,'date');
 const button=f.head.cells[0].querySelector('button');sort.dispose();assert.equal(button.listeners.get('click').size,0);
});

test('default is first column ascending and third click restores it',()=>{
 const f=fixture(),changes=[],sort=module.exports.createTableSort(f.table,{onChange:state=>changes.push(state)});
 assert.equal(sort.state.column,'date');assert.equal(sort.state.direction,'asc');
 const button=f.head.cells[1].querySelector('button');button.fire('click');assert.equal(sort.state.direction,'asc');
 button.fire('click');assert.equal(sort.state.direction,'desc');button.fire('click');
 assert.equal(sort.state.column,'date');assert.equal(sort.state.direction,'asc');assert.equal(changes.length,3);sort.dispose();
});
test('third click restores an app supplied default and reset clears its cycle',()=>{
 const f=fixture(),sort=module.exports.createTableSort(f.table,{column:'date',direction:'desc'}),button=f.head.cells[2].querySelector('button');
 for(let i=0;i<3;i++)button.fire('click');assert.equal(sort.state.column,'date');assert.equal(sort.state.direction,'desc');
 sort.reset();button.fire('click');assert.equal(sort.state.column,'name');assert.equal(sort.state.direction,'asc');sort.dispose();
});

test('manual sorting resumes a cycle across server navigation with a fixed default',()=>{
 const f=fixture(),sort=module.exports.createTableSort(f.table,{column:'amount',direction:'asc',cycle:1,defaultColumn:'date',defaultDirection:'desc',manual:true});
 const button=f.head.cells[1].querySelector('button');button.fire('click');assert.equal(sort.cycle,2);assert.equal(sort.state.direction,'desc');button.fire('click');assert.equal(sort.cycle,0);assert.equal(sort.state.column,'date');assert.equal(sort.state.direction,'desc');sort.dispose();
});
