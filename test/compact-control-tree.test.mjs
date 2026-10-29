import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8');
const extension=source.slice(source.indexOf('/* Compact, application-neutral component hierarchy.'));

function fixture(){
  const doc={activeElement:null};
  class Node{
    constructor(tag){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentElement=null;this.attributes=new Map();this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.classList={add:(...names)=>this.className=((this.className||'')+' '+names.join(' ')).trim()};this.listeners=new Map();this.scrollTop=0;this.tabIndex=-1;this.textContent='';}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name)??null;}
    removeAttribute(name){this.attributes.delete(name);}
    get firstElementChild(){return this.children[0]||null;}
    get firstChild(){return this.firstElementChild;}
    get nextElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1]||null;}
    append(...children){for(const child of children){child.remove();child.parentElement=this;this.children.push(child);}}
    insertBefore(child,cursor){if(child===cursor)return;child.remove();child.parentElement=this;const index=this.children.indexOf(cursor);this.children.splice(index<0?this.children.length:index,0,child);}
    remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}}
    replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
    querySelectorAll(selector){const result=[];const visit=node=>{for(const child of node.children){if(selector==='[role=treeitem]'&&child.getAttribute('role')==='treeitem')result.push(child);visit(child);}};visit(this);return result;}
    closest(selector){for(let node=this;node;node=node.parentElement){if(selector==='[role=treeitem]'&&node.getAttribute('role')==='treeitem')return node;if(selector==='[data-component]'&&node.dataset.component!==undefined)return node;if(selector==='[data-expand]'&&node.dataset.expand!==undefined)return node;if(selector==='[hidden]'&&node.hidden)return node;}return null;}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
    focus(){doc.activeElement=this;}
    scrollIntoView(){}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    removeEventListener(type,callback){if(this.listeners.get(type)===callback)this.listeners.delete(type);}
    fire(type,event){this.listeners.get(type)?.(event);}
  }
  doc.createElement=tag=>new Node(tag);
  doc.createElementNS=(_ns,tag)=>new Node(tag);
  const ui={adoptAction(node,{label}){node.textContent=label;}};vm.runInNewContext(extension,{window:{SharedUI:ui},document:doc,performance:{now:()=>1000}});
  return {ui,doc};
}

test('compact tree exposes semantic folders, variation accents, navigation and selection',()=>{
  const {ui,doc}=fixture();
  let selected='particles',expanded=true,changed=0,picked='',context='';
  const navigation={
    get selected(){return selected;},
    rows(query=''){
      const all=[
        {id:'particles',parent:null,label:'Particles',depth:0,children:true,expanded,selectors:[]},
        {id:'mark',parent:'particles',label:'Mark style',description:'Change artwork',depth:1,children:false,expanded:false,selectors:['particleMarkStyle']},
      ];
      return query?all.filter(row=>row.label.toLowerCase().includes(query.toLowerCase())):expanded?all:all.slice(0,1);
    },
    toggle(){expanded=!expanded;},
    key(_id,key){return key==='ArrowDown'?'mark':'particles';},
    select(id){selected=id;},
  };
  const tree=ui.createCompactControlTree({navigation,onSelect:id=>{picked=id;selected=id;},onChange:()=>changed++,onContextMenu:(row,event)=>{context=row.id;event.preventDefault();}});
  tree.render();
  const rows=()=>tree.element.querySelectorAll('[role=treeitem]').filter(row=>!row.closest('[hidden]'));
  assert.equal(tree.element.getAttribute('role'),'tree');
  assert.equal(rows().length,2);
  assert.equal(rows()[0].getAttribute('aria-expanded'),'true');
  assert.equal(rows()[1].dataset.uiVariation,'true');
  assert.match(rows()[1].getAttribute('aria-description'),/choices button.*Shift\+F10/);
  const choices=rows()[1].children[0].children.at(-1);assert.equal(choices.hidden,false);choices.onclick({preventDefault(){},stopPropagation(){}});assert.equal(context,'mark');
  assert.equal(rows()[1].getAttribute('aria-level'),'2');
  assert.equal(rows()[0].tabIndex,0);
  rows()[1].children[0].onclick({target:{closest:()=>null}});
  assert.equal(picked,'mark');
  assert.equal(rows()[1].getAttribute('aria-selected'),'true');
  assert.equal(doc.activeElement.dataset.component,'mark');
  rows()[1].oncontextmenu({preventDefault(){}});
  assert.equal(context,'mark');
  tree.element.fire('keydown',{target:rows()[1],key:'ArrowUp',preventDefault(){},stopPropagation(){}});
  assert.equal(doc.activeElement.dataset.component,'particles');
  assert.equal(changed,1);
  const expander=rows()[0].children[0].children[0];
  rows()[0].children[0].onclick({target:expander});
  assert.equal(changed,2);assert.equal(rows().length,1);
  tree.setQuery('mark');assert.equal(rows().length,1);
});

test('inline leaf settings retain their native fields, drafts and focus across updates and collapse',()=>{
  const {ui,doc}=fixture(),content=doc.createElement('div'),input=doc.createElement('input');input.value='1.2';content.append(input);
  let expanded=true,label='Signal',changes=[];
  const navigation={selected:'signal',rows:()=>[{id:'signal',parent:null,label,depth:0,children:false,expandable:true,expanded}],toggle(){expanded=!expanded;},key(id,key){if(key==='ArrowRight')expanded=true;if(key==='ArrowLeft')expanded=false;return id;}};
  const tree=ui.createCompactControlTree({navigation,onSelect(){},onChange(){changes.push(content.hidden);}});
  tree.setInlineContent(()=>content);
  const item=tree.element.querySelectorAll('[role=treeitem]')[0],line=item.children[0],expander=line.children[0];
  assert.equal(item.getAttribute('aria-expanded'),'true');assert.equal(item.children[1],content);
  assert.equal(content.style['--control-tree-depth'],'1','inline settings inherit the depth below their owning component');
  assert.match(line.children[1].children[0].getAttribute('href'),/ui-sliders$/,'a leaf with settings keeps its settings icon');
  input.value='unfinished draft';input.focus();label='Updated signal';tree.render();
  assert.equal(tree.element.querySelectorAll('[role=treeitem]')[0],item,'polls reuse the tree item');assert.equal(item.children[1],content);assert.equal(doc.activeElement,input,'polls do not steal input focus');
  line.onclick({target:expander});assert.equal(content.hidden,true);assert.equal(item.children[1],content,'collapse hides the host in place');assert.equal(input.value,'unfinished draft');assert.deepEqual(changes,[true],'change callback sees the new visibility');
  tree.element.fire('keydown',{target:item,key:'ArrowRight',preventDefault(){},stopPropagation(){}});
  assert.equal(content.hidden,false);assert.equal(item.children[1].children[0],input);assert.deepEqual(changes,[true,false]);
  content.remove();tree.setInlineContent(null);assert.equal(input.value,'unfinished draft','the host can reclaim live controls before mode change');
  tree.dispose();assert.equal(tree.element.listeners.size,0);assert.equal(line.onclick,null);
});

test('settings keep native keyboard and context actions while tree rows support keyboard menus',()=>{
  const {ui,doc}=fixture(),content=doc.createElement('div'),input=doc.createElement('input');content.append(input);
  let menus=0,prevented=0,stopped=0,moves=0;
  const navigation={selected:'signal',rows:()=>[{id:'signal',parent:null,label:'Signal',depth:0,children:false,expandable:true,expanded:true}],key(id){moves++;return id;}};
  const tree=ui.createCompactControlTree({navigation,onSelect(){},onContextMenu(){menus++;}});tree.setInlineContent(()=>content);
  const item=tree.element.querySelectorAll('[role=treeitem]')[0],event=(target,key,more={})=>({target,key,preventDefault(){prevented++;},stopPropagation(){stopped++;},...more});
  for(const key of ['ArrowLeft','ArrowRight','Home','End','Enter',' ','ContextMenu']){tree.element.fire('keydown',event(input,key));tree.element.fire('keyup',event(input,key));}
  item.oncontextmenu(event(input,''));assert.equal(menus,0);assert.equal(prevented,0);assert.equal(stopped,0);assert.equal(moves,0);
  tree.element.fire('keydown',event(item,'ContextMenu'));tree.element.fire('keydown',event(item,'F10',{shiftKey:true}));
  assert.equal(menus,2);assert.equal(prevented,2);assert.equal(stopped,2);
  item.oncontextmenu(event(item.children[0],''));assert.equal(menus,3);
});

test('closing or filtering a branch keeps its live child controls inside the tree',()=>{
  const {ui,doc}=fixture(),content=doc.createElement('div');let expanded=true;
  const parent={id:'parent',parent:null,label:'Parent',depth:0,children:true,expanded:true},child={id:'child',parent:'parent',label:'Child',depth:1,children:false,expandable:true,expanded:true};
  const navigation={selected:'parent',rows(query){return query==='none'?[]:expanded?[{...parent,expanded},child]:[{...parent,expanded}];},toggle(){expanded=!expanded;},key:id=>id};
  const tree=ui.createCompactControlTree({navigation,onSelect(){}});tree.setInlineContent(row=>row.id==='child'?content:null);
  const first=tree.element.querySelectorAll('[role=treeitem]'),line=first[0].children[0],expander=line.children[0];
  line.onclick({target:expander});assert.equal(tree.element.querySelectorAll('[role=treeitem]').filter(row=>!row.closest('[hidden]')).length,1);
  assert.equal(tree.element.contains(content),true,'host queries can still reach hidden controls');assert.ok(content.closest('[hidden]'));
  line.onclick({target:expander});const reopened=tree.element.querySelectorAll('[role=treeitem]');assert.equal(reopened[1],first[1]);assert.equal(reopened[1].children[1],content);
  tree.setQuery('none');assert.equal(tree.element.contains(content),true);assert.ok(content.closest('[hidden]'));
  tree.setQuery('');assert.equal(tree.element.querySelectorAll('[role=treeitem]')[1],first[1]);assert.equal(content.closest('[hidden]'),null);
});

test('navigation controls expansion while a search is active',()=>{
  const {ui,doc}=fixture(),content=doc.createElement('div');let expanded=true;
  const navigation={selected:'signal',rows:()=>[{id:'signal',parent:null,label:'Signal',depth:0,children:false,expandable:true,expanded}],toggle(){expanded=!expanded;},key:id=>id};
  const tree=ui.createCompactControlTree({navigation,onSelect(){}});tree.setInlineContent(()=>content);tree.setQuery('signal');
  const item=tree.element.querySelectorAll('[role=treeitem]')[0],line=item.children[0];
  line.onclick({target:line.children[0]});assert.equal(content.hidden,true);assert.equal(item.getAttribute('aria-expanded'),'false');
  line.onclick({target:line.children[0]});assert.equal(content.hidden,false);assert.equal(item.getAttribute('aria-expanded'),'true');
});

test('a tree without a context handler keeps the native keyboard menu',()=>{
  const {ui}=fixture();let prevented=0;
  const navigation={selected:'signal',rows:()=>[{id:'signal',parent:null,label:'Signal',depth:0,children:false,selectors:['style']}],key:id=>id};
  const tree=ui.createCompactControlTree({navigation,onSelect(){}});tree.render();const item=tree.element.querySelectorAll('[role=treeitem]')[0];
  tree.element.fire('keydown',{target:item,key:'ContextMenu',preventDefault(){prevented++;},stopPropagation(){}});
  assert.equal(prevented,0);assert.doesNotMatch(item.getAttribute('aria-description'),/Right-click/);
});

test('tree hierarchy decoration preserves native labels and can be removed without rebuilding them',()=>{
  const {ui,doc}=fixture(),details=doc.createElement('details'),summary=doc.createElement('summary'),heading=doc.createElement('h5'),field=doc.createElement('input');
  heading.textContent='Appearance';summary.append(heading);details.append(summary,field);details.open=true;field.value='unfinished draft';field.focus();
  ui.adoptControlTreeRow(summary,{kind:'group',sprite:'/v1/icons.svg'});const icon=summary.firstElementChild;
  assert.equal(summary.dataset.uiTreeRow,'group');assert.equal(icon.dataset.uiTreeIcon,'group');assert.equal(icon.getAttribute('aria-hidden'),'true');assert.equal(icon.firstElementChild.getAttribute('href'),'/v1/icons.svg#ui-layers');
  ui.adoptControlTreeRow(summary,{kind:'group',sprite:'/v1/icons.svg'});assert.equal(summary.children.length,2);assert.equal(summary.firstElementChild,icon);assert.equal(summary.children[1],heading);assert.equal(doc.activeElement,field);
  ui.adoptControlTreeRow(summary,{kind:'group',enabled:false});assert.equal(summary.dataset.uiTreeRow,undefined);assert.equal(summary.firstElementChild,heading);assert.equal(details.open,true);assert.equal(field.value,'unfinished draft');
  const label=doc.createElement('button'),name=doc.createElement('span');name.textContent='Speed';label.append(name);
  ui.adoptControlTreeRow(label,{kind:'control'});assert.equal(label.firstElementChild.dataset.uiTreeIcon,'control');assert.match(label.firstElementChild.firstElementChild.getAttribute('href'),/#ui-sliders$/);assert.equal(label.children[1],name);
  ui.adoptControlTreeRow(label,{kind:'control',enabled:false});assert.equal(label.firstElementChild,name);
});
