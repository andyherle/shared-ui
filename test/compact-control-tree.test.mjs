import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8');
const extension=source.slice(source.indexOf('/* Compact, application-neutral component hierarchy.'));

function fixture(){
  const doc={activeElement:null};
  class Node{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attributes=new Map();this.dataset={};this.style={setProperty(){}};this.classList={add:(...names)=>this.className=((this.className||'')+' '+names.join(' ')).trim()};this.listeners=new Map();this.scrollTop=0;this.tabIndex=-1;this.textContent='';}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name)??null;}
    append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
    replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
    querySelectorAll(selector){const result=[];const visit=node=>{for(const child of node.children){if(selector==='[role=treeitem]'&&child.getAttribute('role')==='treeitem')result.push(child);visit(child);}};visit(this);return result;}
    closest(selector){for(let node=this;node;node=node.parentElement){if(selector==='[role=treeitem]'&&node.getAttribute('role')==='treeitem')return node;if(selector==='[data-component]'&&node.dataset.component!==undefined)return node;if(selector==='[data-expand]'&&node.dataset.expand!==undefined)return node;}return null;}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
    focus(){doc.activeElement=this;}
    scrollIntoView(){}
    addEventListener(type,callback){this.listeners.set(type,callback);}
    fire(type,event){this.listeners.get(type)?.(event);}
  }
  doc.createElement=tag=>new Node(tag);
  doc.createElementNS=(_ns,tag)=>new Node(tag);
  const ui={};vm.runInNewContext(extension,{window:{SharedUI:ui},document:doc,performance:{now:()=>1000}});
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
  const rows=()=>tree.element.querySelectorAll('[role=treeitem]');
  assert.equal(tree.element.getAttribute('role'),'tree');
  assert.equal(rows().length,2);
  assert.equal(rows()[0].getAttribute('aria-expanded'),'true');
  assert.equal(rows()[1].dataset.uiVariation,'true');
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
