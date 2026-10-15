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


test('authored card colors choose readable ink, reject CSS injection and restore the theme',()=>{
 const values=new Map(),card={dataset:{},style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)}};
 module.exports.setCardColor(card,'#ff575c');assert.equal(values.get('--ui-card-fill'),'#ff575c');assert.equal(values.get('--ui-card-ink'),'#111111');
 module.exports.setCardColor(card,'#27313e');assert.equal(values.get('--ui-card-ink'),'#ffffff');
 assert.throws(()=>module.exports.setCardColor(card,'url(https://example.com)'),/six-digit/);assert.equal(card.dataset.uiColor,'#27313e');
 module.exports.setCardColor(card,null);assert.equal(card.dataset.uiColor,undefined);assert.equal(values.size,0);
});


test('sort direction changes the glyph and name while keeping the native button and handler',()=>{
 const {button}=control(),handler=button.onclick;
 module.exports.setSortDirection(button,'asc',{sprite:'/ui/icons.svg'});
 assert.equal(button.dataset.uiDirection,'asc');
 assert.match(button.querySelector(':scope > svg').querySelector('use').getAttribute('href'),/#ui-arrow-up$/);
 assert.match(button.getAttribute('aria-label'),/^Ascending; reverse/);
 module.exports.setSortDirection(button,'desc',{sprite:'/ui/icons.svg'});
 assert.match(button.querySelector(':scope > svg').querySelector('use').getAttribute('href'),/#ui-arrow-down$/);
 assert.match(button.getAttribute('aria-label'),/^Descending; reverse/);
 assert.equal(button.onclick,handler);
 assert.throws(()=>module.exports.setSortDirection(button,'random'),/asc or desc/);
});

test('selection exposes full, partial and cleared state without changing article semantics',()=>{
 const {doc}=control(),card=doc.createElement('article');
 module.exports.setSelection(card,true);assert.equal(card.dataset.uiSelected,'true');
 module.exports.setSelection(card,'mixed');assert.equal(card.dataset.uiSelected,'mixed');
 module.exports.setSelection(card,false);assert.equal(card.dataset.uiSelected,'false');
 assert.equal(card.getAttribute('role'),null);assert.equal(card.getAttribute('aria-selected'),null);
});

test('launcher colors accept only authored hex values and can return to the theme',()=>{
 const values=new Map(),tile={style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)}};
 module.exports.setAppColor(tile,'#42abef');assert.equal(values.get('--ui-app-color'),'#42abef');
 assert.throws(()=>module.exports.setAppColor(tile,'red;position:fixed'),/six-digit/);
 module.exports.setAppColor(tile,null);assert.equal(values.size,0);
});

test('panel back-to-top returns focus, pauses while hidden and releases its listeners',()=>{
 const events=object=>Object.assign(object,{listeners:new Map(),addEventListener(type,fn){this.listeners.set(type,fn);},removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);},emit(type){this.listeners.get(type)?.();}});
 const {button,doc}=control();events(button);events(doc);doc.visibilityState='visible';
 const view=events({matchMedia:()=>({matches:true})});doc.defaultView=view;
 const panel=events({scrollTop:0,scrollTo(options){this.lastScroll=options;this.scrollTop=options.top;}});
 const focus={matches:()=>true,focus(options){this.lastFocus=options;}};
 const helper=module.exports.createBackToTop(button,{scrollTarget:panel,focusTarget:()=>focus,sprite:'/ui/icons.svg'});
 assert.equal(button.hidden,true);
 panel.scrollTop=500;panel.emit('scroll');assert.equal(button.hidden,false);
 button.emit('click');assert.equal(panel.lastScroll.top,0);assert.equal(panel.lastScroll.behavior,'instant');assert.equal(focus.lastFocus.preventScroll,true);
 doc.visibilityState='hidden';doc.emit('visibilitychange');assert.equal(button.hidden,true);assert.equal(panel.listeners.size,0);
 doc.visibilityState='visible';doc.emit('visibilitychange');assert.equal(panel.listeners.size,1);
 view.emit('pagehide');assert.equal(panel.listeners.size,0);view.emit('pageshow');assert.equal(panel.listeners.size,1);
 helper.dispose();helper.dispose();
 assert.equal(panel.listeners.size,0);assert.equal(button.listeners.size,0);assert.equal(doc.listeners.size,0);assert.equal(view.listeners.size,0);
});
