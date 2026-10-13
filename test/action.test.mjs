import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const module={exports:{}};vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module,URL});
class Node {
 constructor(name,doc){this.name=name;this.ownerDocument=doc;this.childNodes=[];this.attrs=new Map();this.dataset={};}
 classList={contains:(name)=>(this.className||'').split(/\s+/).includes(name),add:(name)=>{this.className=[...new Set((this.className||'').split(/\s+/).filter(Boolean).concat(name))].join(' ');}};
 matches(selector){return selector.split(',').includes(this.name);}
 append(...nodes){for(const node of nodes){if(node.parent)node.parent.childNodes=node.parent.childNodes.filter(n=>n!==node);node.parent=this;this.childNodes.push(node);}}
 prepend(node){this.append(node);this.childNodes=[node,...this.childNodes.filter(n=>n!==node)];}
 replaceChildren(...nodes){for(const n of this.childNodes)n.parent=null;this.childNodes=[];this.append(...nodes);}
 querySelector(selector){if(selector===':scope > .ui-label')return this.childNodes.find(n=>(n.className||'').split(' ').includes('ui-label'));if(selector===':scope > svg')return this.childNodes.find(n=>n.name==='svg');return this.childNodes.find(n=>n.name===selector);}
 setAttribute(k,v){this.ownerDocument.writes=(this.ownerDocument.writes||0)+1;this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)??null;}hasAttribute(k){return this.attrs.has(k);}
 get textContent(){return this.name==='#text'?this.value||'':this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v){if(this.name==='#text')this.value=String(v);else{const t=new Node('#text',this.ownerDocument);t.value=String(v);this.replaceChildren(t);}}
}
function control(){const doc={baseURI:'https://app.example/panel',createElement:n=>new Node(n,doc),createElementNS:(_ns,n)=>new Node(n,doc)};const button=doc.createElement('button'),label=doc.createElement('strong');label.textContent='Save';button.append(label);button.className='primary';button.setAttribute('aria-label','Save the selected project');button.setAttribute('title','Save project');button.onclick=()=>{};return {button,label,doc};}
test('adoption preserves the native action, nested label, handler and complete accessible name',()=>{
 const {button,label}=control(),handler=button.onclick;assert.equal(module.exports.adoptAction(button,{icon:'save',sprite:'/ui/icons.svg'}),button);assert.equal(button.onclick,handler);assert.equal(button.getAttribute('aria-label'),'Save the selected project');assert.equal(button.getAttribute('title'),'Save project');assert.equal(button.querySelector(':scope > .ui-label').childNodes[0],label);assert.match(button.className,/primary/);
 module.exports.adoptAction(button,{icon:'save',sprite:'/ui/icons.svg',iconOnly:true});assert.equal(button.childNodes.length,2);assert.equal(button.dataset.uiLabel,'hidden');module.exports.setActionLabel(button,'Saved',{ariaLabel:'Selected project saved'});assert.equal(button.querySelector(':scope > .ui-label').textContent,'Saved');assert.equal(button.getAttribute('aria-label'),'Selected project saved');
});
test('invalid or cross-origin glyphs are rejected before mutating a native control',()=>{
 const {button}=control();assert.throws(()=>module.exports.adoptAction(button,{icon:'save',sprite:'https://foreign.example/icons.svg'}),/served by the app/);assert.throws(()=>module.exports.adoptAction(button,{icon:'javascript:bad'}),/Invalid icon/);assert.equal(button.childNodes.length,1);assert.equal(button.className,'primary');
});

test('stable timeline captions reuse their existing text and glyph without attribute churn',()=>{
 const {button,doc}=control();module.exports.adoptAction(button,{icon:'save',label:'Save',sprite:'/ui/icons.svg'});
 const label=button.querySelector(':scope > .ui-label'),text=label.childNodes[0],glyph=button.querySelector(':scope > svg'),use=glyph.querySelector('use'),writes=doc.writes;
 for(let i=0;i<10;i++)module.exports.adoptAction(button,{icon:'save',label:'Save',sprite:'/ui/icons.svg'});
 assert.equal(label.childNodes[0],text);assert.equal(button.querySelector(':scope > svg'),glyph);assert.equal(glyph.querySelector('use'),use);assert.equal(doc.writes,writes);
});
