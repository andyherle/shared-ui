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
function control(){const doc={baseURI:'https://app.example/panel',createElement:n=>new Node(n,doc),createElementNS:(_ns,n)=>new Node(n,doc)};const button=doc.createElement('button'),label=doc.createElement('strong');label.textContent='Save';button.append(label);button.className='primary';button.setAttribute('aria-label','Save the selected project');button.setAttribute('title','Save project');button.onclick=()=>{};return {button,label,doc};}
function zoomControl(options={}){
 const {doc}=control(),group=doc.createElement('div'),out=doc.createElement('button'),into=doc.createElement('button'),output=doc.createElement('output'),changes=[];
 out.setAttribute('data-ui-zoom','out');into.setAttribute('data-ui-zoom','in');output.setAttribute('data-ui-zoom','value');group.append(out,into,output);
 const zoom=module.exports.createZoom(group,{min:72,max:420,step:20,value:220,onChange:value=>changes.push(value),...options});
 return {group,out,into,output,changes,zoom};
}
test('zoom preserves a saved value, steps in both directions and disables native buttons at bounds',()=>{
 const f=zoomControl();assert.equal(f.zoom.value,220);assert.equal(f.output.textContent,'220');
 f.into.fire('click');assert.equal(f.zoom.value,240);f.out.fire('click');assert.equal(f.zoom.value,220);
 f.zoom.setValue(418);assert.equal(f.changes.length,2);f.into.fire('click');assert.equal(f.zoom.value,420);assert.equal(f.into.disabled,true);assert.equal(f.out.disabled,false);
 f.into.fire('click');assert.deepEqual(f.changes,[240,220,420]);f.zoom.setValue(74);f.out.fire('click');assert.equal(f.zoom.value,72);assert.equal(f.out.disabled,true);assert.equal(f.into.disabled,false);
 f.zoom.setValue(999);assert.equal(f.zoom.value,420);f.zoom.setValue(-1);assert.equal(f.zoom.value,72);
});
test('fractional zoom stays precise and disposing releases click handlers',()=>{
 const f=zoomControl({min:.5,max:1.5,step:.1,value:1});for(let i=0;i<5;i++)f.into.fire('click');assert.equal(f.zoom.value,1.5);assert.equal(f.into.disabled,true);
 f.zoom.dispose();f.out.fire('click');assert.equal(f.zoom.value,1.5);assert.equal(f.out.listeners.get('click').size,0);assert.equal(f.into.listeners.get('click').size,0);
 assert.throws(()=>zoomControl({step:0}),/positive step/);assert.throws(()=>zoomControl({min:500}),/finite bounds/);assert.throws(()=>f.zoom.setValue(NaN),/finite value/);
});
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

test('reserved action text keeps variants out of textContent and preserves its slot on state changes',()=>{
 const {button,doc}=control(),handler=button.onclick;
 module.exports.adoptAction(button,{icon:'save',label:'Save',labelStates:['Save','Saving…','Saved'],sprite:'/ui/icons.svg'});
 const label=button.querySelector(':scope > .ui-label'),group=label.querySelector(':scope > .ui-dynamic'),glyph=button.querySelector(':scope > svg'),current=group.querySelector(':scope > [data-ui-current]');
 assert.equal(label.textContent,'Save');assert.equal(group.querySelectorAll(':scope > [data-ui-text]').length,3);
 for(const text of ['Saving…','Saved','Save']){module.exports.setActionLabel(button,text,{ariaLabel:text});assert.equal(label.textContent,text);assert.equal(label.querySelector(':scope > .ui-dynamic'),group);assert.equal(group.querySelector(':scope > [data-ui-current]'),current);assert.equal(button.querySelector(':scope > svg'),glyph);assert.equal(button.getAttribute('aria-label'),text);}
 const writes=doc.writes;module.exports.adoptAction(button,{label:'Save',labelStates:['Save','Saving…','Saved']});assert.equal(doc.writes,writes);assert.equal(button.onclick,handler);
 module.exports.reserveText(label,['Save','Save failed']);assert.equal(label.textContent,'Save');assert.equal(group.querySelectorAll(':scope > [data-ui-text]').length,2);
});

test('reserved standalone text supports empty values and literal strings without injecting markup',()=>{
 const {doc,button}=control(),status=doc.createElement('span');status.textContent='Live';
 module.exports.reserveText(status,['Live','Unsaved changes','<script>']);module.exports.setText(status,'');assert.equal(status.textContent,'');
 module.exports.setText(status,'<script>');assert.equal(status.textContent,'<script>');assert.equal(status.querySelector('script'),undefined);
 assert.throws(()=>module.exports.reserveText(button,['Save']),/label or text container/);assert.throws(()=>module.exports.reserveText(status,[]),/nonempty/);
});


test('authored card colors choose readable ink, reject CSS injection and restore the theme',()=>{
 const values=new Map(),card={dataset:{},style:{setProperty:(key,value)=>values.set(key,value),removeProperty:key=>values.delete(key)}};
 module.exports.setCardColor(card,'#ff575c');assert.equal(values.get('--ui-card-fill'),`light-dark(#ff575c,${module.exports.resolveCardColor('#ff575c').dark})`);assert.equal(values.get('--ui-card-ink'),'light-dark(#000000,#000000)');
 module.exports.setCardColor(card,'#27313e');assert.equal(values.get('--ui-card-ink'),'light-dark(#ffffff,#ffffff)');
 assert.throws(()=>module.exports.setCardColor(card,'url(https://example.com)'),/six-digit/);assert.equal(card.dataset.uiColor,'#27313e');
 module.exports.setCardColor(card,'transparent');assert.equal(card.dataset.uiColor,'transparent');assert.equal(values.size,0);
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

test('theme-adaptive authored colours preserve their value with readable light/dark ink and bounded reusable resolutions',()=>{
 const resolve=module.exports.resolveCardColor;
 assert.equal(resolve('#c44c53').lightInk,'#ffffff');assert.equal(resolve('#ff3b30').light,'#c44c53');
 for(const colour of ['#c44c53','#f3d376','#22c55e'])assert.equal(resolve(colour).dark,colour,'Approval colours stay vivid in both themes');
 assert.equal(resolve('#ffffff').dark,'var(--ui-surface)');
 assert.equal(resolve('#f6c7a6'),resolve('#f6c7a6'),'Repeated card colours reuse their resolution');
 const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
 for(let r=0;r<=255;r+=17)for(let g=0;g<=255;g+=17)for(let b=0;b<=255;b+=17){
  const hex='#'+[r,g,b].map(c=>c.toString(16).padStart(2,'0')).join(''),value=resolve(hex);
  if(hex==='#ffffff')continue;
  assert.equal(value.light,hex==='#ffff00'?'#f3d376':hex);
  for(const mode of ['light','dark']){const a=luminance(value[mode]),b=luminance(value[mode+'Ink']);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,hex+' '+mode);}
 }
});


test('output colour resolver caches actual native card paint and refreshes themes without CSS expressions',()=>{
 const {doc}=control(),root=doc.createElement('html');root.dataset={ui:'postvisual',theme:'dark',uiRevision:'one'};
 let reads=0;doc.defaultView={matchMedia:()=>({matches:false}),getComputedStyle:card=>{reads++;return {backgroundColor:card.dataset.uiColor==='#ffb3d2'?'rgb(255, 179, 210)':root.dataset.theme==='dark'?'rgb(20, 22, 26)':'rgb(255, 255, 255)',color:card.dataset.uiColor==='#ffb3d2'?'rgb(0, 0, 0)':root.dataset.theme==='dark'?'rgb(255, 255, 255)':'rgb(0, 0, 0)',borderTopColor:'rgb(80, 80, 80)',fontFamily:'sans-serif'};}};
 const create=doc.createElement;doc.createElement=tag=>{const node=create(tag);node.style={setProperty(){},removeProperty(){}};return node;};
 const resolver=module.exports.createCardColorResolver(root),dark=resolver.resolve();
 assert.equal(dark.fill,'rgb(20, 22, 26)');assert.equal(resolver.resolve(),dark);assert.equal(reads,1);
 const pink=resolver.resolve('#ffb3d2');assert.equal(pink.fill,'rgb(255, 179, 210)');assert.equal(pink.ink,'rgb(0, 0, 0)');
 for(let i=0;i<200;i++)assert.equal(resolver.resolve('#ffb3d2'),pink);assert.equal(reads,2);
 root.dataset.theme='light';assert.equal(resolver.resolve().fill,'rgb(255, 255, 255)');assert.equal(reads,3);
 root.dataset.ui='personal';resolver.resolve();assert.equal(reads,4);
 resolver.invalidate();resolver.resolve();assert.equal(reads,5);resolver.dispose();assert.equal(root.childNodes.length,0);assert.throws(()=>resolver.resolve(),/disposed/);
});

test('button feedback preserves its handler and icon contract through pending, success, error and reset',async()=>{
 const {button}=control(),UI=module.exports;UI.adoptAction(button,{icon:'save',label:'Save'});const handler=button.onclick;
 UI.setActionState(button,{state:'pending',message:'Saving'});assert.equal(button.getAttribute('aria-busy'),'true');assert.ok(button.classList.contains('ui-warning'));assert.equal(button.onclick,handler);
 UI.setActionState(button,{state:'success',message:'Saved'});assert.ok(button.classList.contains('ui-success'));assert.match(button.querySelector('svg').querySelector('use').getAttribute('href'),/#ui-save$/);
 UI.adoptAction(button,{icon:'save',label:'Save'});assert.match(button.querySelector('svg').querySelector('use').getAttribute('href'),/#ui-save$/,'feedback keeps the action purpose through re-adoption');
 UI.setActionState(button,{state:'idle'});assert.match(button.querySelector('svg').querySelector('use').getAttribute('href'),/#ui-save$/);assert.ok(button.classList.contains('primary'));
 await assert.rejects(UI.runAction(button,async()=>{throw new Error('Offline')}),/Offline/);assert.equal(button.dataset.uiActionState,'error');assert.equal(button.onclick,handler);assert.match(button.querySelector('svg').querySelector('use').getAttribute('href'),/#ui-save$/);
});

test('Command arrows change content only, preserve native editors and IME, and dispose',()=>{
 const listeners=new Map(),view={addEventListener(){},removeEventListener(){}},doc={activeElement:null,defaultView:view,addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};
 let value=100,allowed=true;const zoom=module.exports.installZoomShortcuts(doc,{canZoom:()=>allowed,onZoom:direction=>value+=direction*10});
 const key=(name,extra={})=>{let prevented=false;listeners.get('keydown')?.({key:name,metaKey:true,target:{closest:()=>null},preventDefault(){prevented=true;},...extra});return prevented;};
 assert.equal(key('+',{code:'Equal'}),true);assert.equal(value,110);assert.equal(key('-',{code:'Minus'}),true);assert.equal(value,100);assert.equal(key('ArrowUp'),true);assert.equal(value,110);key('ArrowRight');key('ArrowDown');key('ArrowLeft');assert.equal(value,100);
 assert.equal(key('ArrowUp',{metaKey:false}),false);assert.equal(key('ArrowUp',{ctrlKey:true}),false);assert.equal(key('ArrowUp',{target:{closest:()=>({})}}),false);
 listeners.get('compositionstart')();assert.equal(key('ArrowUp'),false);listeners.get('compositionend')();assert.equal(key('ArrowUp',{keyCode:229}),false);
 allowed=false;assert.equal(key('ArrowUp'),false);assert.equal(value,100);zoom.dispose();assert.equal(listeners.has('keydown'),false);
});

test('quick value easing accumulates target steps, completes exactly, and respects reduced motion',()=>{
 let queued,time=0,reduced=false;const changes=[],view={requestAnimationFrame(fn){queued=fn;return 1;},cancelAnimationFrame(){queued=null;},matchMedia(){return {matches:reduced};},addEventListener(){},removeEventListener(){}};
 const motion=module.exports.createValueTransition({value:100,duration:100,view,onChange:(value,options)=>changes.push([value,options.final])});
 const advance=now=>{const fn=queued;queued=null;fn(now);};motion.to(120);advance(0);advance(50);assert.ok(motion.value>100&&motion.value<120);motion.to(motion.target+20);advance(50);advance(150);assert.equal(motion.value,140);assert.equal(motion.active,false);assert.deepEqual(changes.at(-1),[140,true]);
 reduced=true;motion.to(160);assert.equal(motion.value,160);assert.equal(queued,null);motion.dispose();
});


test('content zoom starts gently and accelerates only rapid same-direction presses',()=>{
 let time=0;const steps=module.exports.createZoomSteps({now:()=>time});
 assert.equal(steps.next(1),1.1);time=100;assert.equal(steps.next(1),1.15);time=180;assert.equal(steps.next(1),1.2);time=220;assert.equal(steps.next(1),1.2);
 assert.equal(steps.next(-1),1/1.1);time=600;assert.equal(steps.next(-1),1/1.1);steps.next(0);assert.equal(steps.next(-1),1/1.1);
});


test('numbered document actions retain native links, names and glyph nodes across caption changes',()=>{
 const {doc}=control(),link=doc.createElement('a');link.setAttribute('href','/statement#row-42');link.setAttribute('aria-label','Statement 2: Bank.pdf');link.setAttribute('title','Bank.pdf · row 42');link.textContent='Bank.pdf';const handler=()=>{};link.onclick=handler;
 module.exports.adoptNumberedAction(link,{number:2,sprite:'/ui/icons.svg'});
 const glyph=link.querySelector(':scope > svg'),square=glyph.querySelector('rect'),text=glyph.querySelector('text');
 assert.equal(text.textContent,'2');assert.equal(square.getAttribute('width'),'20');assert.equal(glyph.getAttribute('aria-hidden'),'true');assert.equal(link.getAttribute('href'),'/statement#row-42');assert.equal(link.getAttribute('aria-label'),'Statement 2: Bank.pdf');assert.equal(link.onclick,handler);
 module.exports.adoptNumberedAction(link,{number:2,label:'Renamed bank.pdf',iconOnly:true,sprite:'/ui/icons.svg'});
 assert.equal(link.querySelector(':scope > svg'),glyph);assert.equal(glyph.querySelector('text'),text);assert.equal(link.dataset.uiLabel,'hidden');assert.equal(link.querySelector(':scope > .ui-label').textContent,'Renamed bank.pdf');
 module.exports.adoptNumberedAction(link,{number:12,sprite:'/ui/icons.svg'});assert.equal(link.querySelector(':scope > svg'),glyph);assert.equal(glyph.querySelector('text').textContent,'12');
});
test('document ordinals reject non-integers and unsafe values before changing a control',()=>{
 for(const number of [0,-1,1.5,NaN,Infinity,'2',Number.MAX_SAFE_INTEGER+1]){const {button}=control();assert.throws(()=>module.exports.adoptNumberedAction(button,{number}),/positive document number/);assert.equal(button.querySelector(':scope > svg'),undefined);}
});
