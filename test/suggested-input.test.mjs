import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8');
function fixture(){
 let doc;class Node{constructor(){this.ownerDocument=doc;this.attrs=new Map();this.style={};this.listeners=new Map();this.children=[];this.value='';this.id='sample';}
 setAttribute(k,v){this.attrs.set(k,v);}getAttribute(k){return this.attrs.get(k)??null;}removeAttribute(k){this.attrs.delete(k);}append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}prepend(n){this.children=this.children.filter(c=>c!==n);this.children.unshift(n);n.parentElement=this;}querySelectorAll(){return this.children;}replaceChildren(){this.children=[];}closest(){return null;}contains(n){return n===this||this.children.some(c=>c.contains(n));}remove(){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}focus(){this.fire('focus');}getBoundingClientRect(){return {left:10,top:30,bottom:60,width:170};}addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f);}removeEventListener(t,f){this.listeners.get(t)?.delete(f);}fire(t,e={}){const event={preventDefault(){},stopPropagation(){},...e};for(const f of this.listeners.get(t)||[])f(event);}}
 doc=new Node();doc.createElement=()=>new Node();doc.defaultView=new Node();doc.defaultView.innerWidth=400;doc.defaultView.innerHeight=600;doc.body=new Node();
 const UI={adoptAction(node,{label}){node.textContent=label;}};vm.runInNewContext(source.slice(source.indexOf('  UI.createSuggestedInput='),source.indexOf('  function activate(')),{UI,Set});
 const parent=new Node(),input=new Node();input.setAttribute('role','textbox');parent.append(input);return {doc,UI,parent,input};
}
test('suggestions are outside layout, preserve literal/IME input and restore attributes on disposal',()=>{
 const f=fixture(),commits=[],control=f.UI.createSuggestedInput(f.input,{options:()=>['Motion','Mood'],onCommit:v=>commits.push(v)});f.input.value='Mo';f.input.fire('input');
 assert.equal(f.parent.children.length,1);assert.equal(f.doc.body.children[0].style.position,'fixed');assert.equal(f.input.value,'Mo');assert.equal(f.doc.body.children[0].style.width,'170px');
 control.handleKey({key:'Enter',preventDefault(){},stopPropagation(){}});assert.equal(commits[0],'Mo');
 f.input.value='Mo';f.input.fire('input');control.handleKey({key:'ArrowDown',preventDefault(){}});control.handleKey({key:'Enter',preventDefault(){},stopPropagation(){}});assert.equal(commits[1],'Motion');
 f.input.value='入力';f.input.fire('compositionstart');control.handleKey({key:'Enter',isComposing:true});assert.equal(f.input.value,'入力');f.input.fire('compositionend');
 control.dispose();assert.equal(f.input.getAttribute('role'),'textbox');assert.equal(f.doc.body.children.length,0);for(const target of [f.doc,f.doc.defaultView,f.input])for(const set of target.listeners.values())assert.equal(set.size,0);
});
test('tag choices share the overlay and retain comma commits without an extra flow row',()=>{
 const f=fixture(),commits=[],control=f.UI.createTagInput(f.input,{options:()=>['Mood'],onCommit:v=>commits.push(v)});f.input.value='new, another';f.input.fire('paste',{clipboardData:{getData:()=>f.input.value}});assert.equal(commits[0],'new, another');assert.equal(f.parent.children.length,1);control.dispose();
});

test('inline tag field retains a single entry row and scrolls committed chips',()=>{const f=fixture(),chips=f.doc.createElement('div');f.parent.append(chips);const control=f.UI.createTagInput(f.input,{field:f.parent,chips});assert.equal(f.parent.children[0],f.input);assert.equal(f.parent.style.display,'flex');assert.equal(f.input.style.flex,'1 1 14ch');assert.equal(chips.style.flex,'0 1 auto');assert.equal(chips.style.maxInlineSize,'50%');assert.equal(chips.style.flexWrap,'nowrap');assert.equal(chips.style.overflowX,'auto');control.dispose();});

test('suggestions align to the outer native field rather than its text inset',()=>{const f=fixture();f.input.closest=selector=>selector==='.ui-field'?{getBoundingClientRect:()=>({left:10,top:30,bottom:62,width:200})}:null;const control=f.UI.createSuggestedInput(f.input,{options:()=>['Motion']});f.input.fire('focus');assert.equal(f.doc.body.children[0].style.width,'200px');assert.equal(f.doc.body.children[0].style.left,'10px');control.dispose();});

test('stacked tag entry reserves a separate chip row and never allocates suggestion flow',()=>{
 const f=fixture(),chips=f.doc.createElement('div');f.parent.append(chips);
 const control=f.UI.createTagInput(f.input,{field:f.parent,chips,layout:'stacked',options:()=>['Motion']});
 assert.equal(f.parent.style.display,'grid');assert.equal(f.input.style.inlineSize,'100%');assert.equal(chips.style.gridRow,'2');assert.equal(chips.style.display,'flex');
 const rows=f.parent.style.gridTemplateRows;f.input.value='Mo';f.input.fire('input');chips.append(f.doc.createElement('button'));
 assert.equal(f.parent.style.gridTemplateRows,rows);assert.equal(f.doc.body.children[0].style.position,'fixed');assert.equal(chips.style.flexWrap,'nowrap');control.dispose();
});

test('wrapped tag entry stays above a bounded wrapping list and releases dynamic layout ownership',()=>{
 const f=fixture(),chips=f.doc.createElement('div'),chip=f.doc.createElement('button');let observer,disconnected=false;
 f.doc.defaultView.MutationObserver=class{constructor(fn){observer=fn;}observe(node,options){assert.equal(node,chips);assert.equal(options.childList,true);}disconnect(){disconnected=true;}};
 f.parent.append(chips);chips.append(chip);const control=f.UI.createTagInput(f.input,{field:f.parent,chips,layout:'wrap'});
 assert.equal(f.parent.style.gridTemplateRows,'auto auto');assert.equal(f.input.style.inlineSize,'100%');assert.equal(chips.style.flexWrap,'wrap');assert.equal(chips.style.overflowX,'hidden');assert.equal(chips.style.overflowY,'auto');assert.match(chips.style.maxBlockSize,/--ui-tag-list-height/);assert.equal(chip.style.whiteSpace,'normal');
 const later=f.doc.createElement('button');chips.append(later);observer();assert.equal(later.style.overflowWrap,'anywhere');
 f.input.value='Draft stays';observer();assert.equal(f.input.value,'Draft stays');control.dispose();assert(disconnected);assert.equal(later.getAttribute('style'),null);
});

test('an existing ui-field shell is never inserted into itself when composing native tags',()=>{const f=fixture(),chips=f.doc.createElement('div'),outer=f.doc.createElement('div'),commits=[];outer.append(f.parent,chips);chips.parentNode=outer;outer.insertBefore=(node)=>{node.parentElement=outer;};f.input.closest=selector=>selector==='.ui-field'?f.parent:null;const prepend=f.parent.prepend;f.parent.prepend=function(node){assert.notEqual(node,this,'Native DOM rejects inserting a field into itself');prepend.call(this,node);};const control=f.UI.createTagInput(f.input,{field:f.parent,chips,layout:'field',options:()=>['Motion'],onCommit:v=>commits.push(v)});assert.equal(f.parent.style.display,'flex');assert.equal(f.parent.getAttribute('data-ui-tag-field'),'');assert(f.parent.children.includes(f.input));assert(f.parent.children.includes(chips));assert.equal(f.parent.children[0],chips);assert.equal(chips.style.display,'contents');assert.equal(f.input.style.flex,'1 1 12ch');assert.equal(f.parent.style.overflowY,'auto');f.input.value='入力 draft';f.input.fire('compositionstart');control.handleKey({key:'Enter',isComposing:true});assert.equal(commits.length,0);assert.equal(f.input.value,'入力 draft');f.input.fire('compositionend');control.dispose();assert.equal(f.parent.getAttribute('data-ui-tag-field'),null);assert.equal(chips.parentElement,outer);});
