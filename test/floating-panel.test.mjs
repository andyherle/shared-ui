import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/floating-panel.js',import.meta.url),'utf8');
const module={exports:{}};
vm.runInNewContext(source,{module});
const {createFloatingPanel,formatReviewProvenance,viewportBox,fitPosition}=module.exports;

class Events {
  listeners=new Map();
  addEventListener(type,fn){let set=this.listeners.get(type);if(!set){set=new Set();this.listeners.set(type,set);}set.add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,extras={}){
    const event={type,target:this,button:0,pointerId:1,isPrimary:true,clientX:0,clientY:0,
      preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...extras};
    for(const fn of this.listeners.get(type)||[])fn(event);
    return event;
  }
}
class Element extends Events {
  constructor(tag,doc){
    super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.attrs=new Map();
    this.dataset={};this.style={};this.children=[];this.parent=null;this.className='';
    this.textContent='';this.isConnected=false;this.hidden=false;this.capture=null;
    this.width=340;this.height=130;
    this.classList={
      add:name=>{const s=new Set(this.className.split(/\s+/).filter(Boolean));s.add(name);this.className=[...s].join(' ');},
      remove:name=>{this.className=this.className.split(/\s+/).filter(x=>x&&x!==name).join(' ');},
      contains:name=>this.className.split(/\s+/).includes(name)
    };
  }
  setAttribute(name,value){this.attrs.set(name,String(value));if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  getAttribute(name){return this.attrs.get(name)??null;}
  removeAttribute(name){this.attrs.delete(name);if(name.startsWith('data-'))delete this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];}
  connect(value){this.isConnected=value;for(const child of this.children)child.connect(value);}
  append(...items){for(const item of items){item.parent=this;this.children.push(item);item.connect(this.isConnected);}}
  prepend(...items){for(const item of items.reverse()){item.parent=this;this.children.unshift(item);item.connect(this.isConnected);}}
  replaceChildren(...items){for(const old of this.children){old.parent=null;old.connect(false);}this.children=[];this.append(...items);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;this.connect(false);}}
  getBoundingClientRect(){
    const limit=(v,n)=>Number.isFinite(parseFloat(v))?Math.min(n,parseFloat(v)):n;
    return {left:parseFloat(this.style.left)||0,top:parseFloat(this.style.top)||0,
      width:limit(this.style.maxWidth,this.width),height:limit(this.style.maxHeight,this.height)};
  }
  setPointerCapture(id){this.capture=id;this.captureCalls=(this.captureCalls||0)+1;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(id){if(this.capture===id)this.capture=null;}
  closest(){return null;}
}
function environment(width=600,height=400){
  const doc=new Events(),view=new Events(),vv=new Events(),observers=[];
  Object.assign(vv,{offsetLeft:0,offsetTop:0,width,height,scale:1});
  Object.assign(view,{visualViewport:vv,innerWidth:width,innerHeight:height,
    ResizeObserver:class{
      constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}
      observe(root){this.root=root;}
      disconnect(){this.disconnected=true;}
      trigger(){this.callback();}
    }});
  doc.defaultView=view;doc.visibilityState='visible';doc.createElement=tag=>new Element(tag,doc);
  const panel=doc.createElement('aside');panel.connect(true);
  panel.setAttribute('aria-label','Original fixture panel');
  const details=doc.createElement('details'),summary=doc.createElement('summary'),input=doc.createElement('input'),action=doc.createElement('button');
  input.value='Preserve native input';let clicks=0;
  action.addEventListener('click',()=>clicks++);
  details.append(summary,input,action);panel.append(details);
  return {doc,view,vv,panel,details,input,action,observers,clicks:()=>clicks};
}
const sha='a'.repeat(40),css='c'.repeat(64);
test('installed local baseline is explicitly NOT live production and candidate remains not deployed',()=>{
  const baseline=formatReviewProvenance({variant:'installed',appName:'StaticRef',
    appSha:sha,uiSha:'b'.repeat(40),appVersion:'fixture',uiVersion:'1.10.2',
    cssRevision:css,deploymentState:'not-deployed'});
  assert.match(baseline.variantLabel,/Installed baseline/);
  assert.match(baseline.variantLabel,/code-equivalent only/);
  assert.match(baseline.deploymentLabel,/NOT live production/);
  assert.match(baseline.identityLabel,/App fixture/);
  assert.match(baseline.identityLabel,/UI 1.10.2/);
  assert.match(baseline.identityLabel,/aaaaaaaa/);
  const candidate=formatReviewProvenance({variant:'candidate',appName:'StaticRef',
    uiVersion:'1.11.0',deploymentState:'not-deployed'});
  assert.equal(candidate.variantLabel,'Local candidate shared-ui');
  assert.match(candidate.deploymentLabel,/NOT deployed/);
  assert.doesNotMatch(candidate.deploymentLabel,/live production/i);
  assert.equal(formatReviewProvenance().deploymentLabel,'Deployment status unverified');
  assert.throws(()=>formatReviewProvenance({variant:'candidate',deploymentState:'deployed'}),/invalid/);
  assert.throws(()=>formatReviewProvenance({appSha:'a'.repeat(8)}),/validated SHA/);
  assert.throws(()=>formatReviewProvenance({uiSha:'a'.repeat(39)}),/validated SHA/);
  assert.throws(()=>formatReviewProvenance({cssRevision:'bad'}),/validated SHA/);
  assert.throws(()=>formatReviewProvenance({unknown:'live'}),/typed fields/);
});
test('panel starts at lower visible corner, never moves the original native controls and may attach idempotently',()=>{
  const e=environment(),panel=e.panel,original=[...e.details.children],rootIndex=e.panel.children.indexOf(e.details);
  const f=createFloatingPanel(panel,{label:'Fixture review',provenance:{
    variant:'installed',appName:'StaticRef',uiVersion:'1.10.2',appSha:sha,deploymentState:'not-deployed'}});
  assert.equal(f.position.x,252);
  assert.equal(f.position.y,262);
  assert.equal(panel.children.indexOf(e.details),rootIndex+1);
  assert.equal(e.details.children[1],e.input);
  assert.equal(e.details.children[2],e.action);
  assert.equal(e.input.value,'Preserve native input');
  assert.equal(f.handle.getAttribute('aria-keyshortcuts').includes('ArrowUp'),true);
  assert.match(f.handle.getAttribute('aria-label'),/Move Fixture review/);
  assert.equal(createFloatingPanel(panel,{label:'Again'}),f);
  assert.equal(panel.classList.contains('ui-floating-panel'),true);
  assert.match(f.provenance.variantLabel,/Installed baseline/);
  assert.equal(f.provenanceDetails.children.length,2);
  assert.equal(f.provenanceDetails.children[1].children.length,16);
  e.action.emit('click');assert.equal(e.clicks(),1);
  assert.equal(f.position.moved,false);
  assert.equal(original[1],e.input);
  f.dispose();assert.equal(panel.children.length,1);
  assert.equal(panel.children[0],e.details);
  assert.equal(panel.getAttribute('aria-label'),'Original fixture panel');
  assert.equal(panel.getAttribute('data-ui-floating-panel'),null);
  assert.equal(panel.getAttribute('style'),null);
  assert.equal(panel.classList.contains('ui-floating-panel'),false);
  assert.ok([...f.handle.listeners.values()].every(set=>set.size===0));
  assert.equal(e.observers[0].disconnected,true);
});
test('mouse and touch pointer capture drag only on handle with visible-space edge clamping',()=>{
  const e=environment(),f=createFloatingPanel(e.panel);
  const handle=f.handle;
  const beginning=f.position;
  let event=handle.emit('pointerdown',{target:handle,pointerId:7,clientX:300,clientY:300,pointerType:'touch'});
  assert.equal(event.defaultPrevented,true);
  assert.equal(handle.capture,7);
  assert.equal(handle.captureCalls,1);
  event=handle.emit('pointermove',{target:handle,pointerId:7,clientX:-1500,clientY:-1600,pointerType:'touch'});
  assert.equal(event.defaultPrevented,true);
  assert.equal(f.position.x,8);assert.equal(f.position.y,8);
  handle.emit('pointermove',{target:handle,pointerId:7,clientX:4500,clientY:3000});
  assert.equal(f.position.x,252);assert.equal(f.position.y,262);
  handle.emit('pointerup',{target:handle,pointerId:7});
  assert.equal(handle.capture,null);
  assert.equal(f.position.moved,true);
  const at=f.position;
  handle.emit('pointerdown',{target:handle,pointerId:11,clientX:100,clientY:100});
  handle.emit('pointermove',{target:handle,pointerId:11,clientX:85,clientY:70});
  handle.emit('pointercancel',{target:handle,pointerId:11});
  assert.equal(f.position.x,at.x);assert.equal(f.position.y,at.y);
  assert.equal(handle.capture,null);
  const interactive={closest:()=>({tagName:'INPUT'})};
  handle.emit('pointerdown',{target:interactive,pointerId:12});
  assert.equal(handle.capture,null);
  assert.equal(handle.captureCalls,2);
  e.input.emit('pointerdown');
  e.action.emit('click');
  assert.equal(e.clicks(),1);
  assert.equal(f.position.x,beginning.x);
  f.dispose();
});
test('keyboard arrows including shift, Home and reset button are accessible and bounded',()=>{
  const e=environment(),f=createFloatingPanel(e.panel,{placement:'bottom-right'});
  let k=f.handle.emit('keydown',{target:f.handle,key:'ArrowLeft'});
  assert.equal(k.defaultPrevented,true);
  assert.equal(f.position.x,236);
  f.handle.emit('keydown',{target:f.handle,key:'ArrowUp',shiftKey:true});
  assert.equal(f.position.y,214);
  for(let i=0;i<50;i++)f.handle.emit('keydown',{target:f.handle,key:'ArrowLeft',shiftKey:true});
  assert.equal(f.position.x,8);
  k=f.handle.emit('keydown',{target:f.handle,key:'Home'});
  assert.equal(k.defaultPrevented,true);assert.equal(f.position.x,252);assert.equal(f.position.y,262);
  f.handle.emit('keydown',{target:f.handle,key:'ArrowUp'});
  f.resetButton.emit('click');
  assert.equal(f.position.moved,false);assert.equal(f.position.y,262);
  const before={...f.position};
  f.handle.emit('keydown',{target:e.input,key:'ArrowLeft'});
  assert.equal(f.position.x,before.x);
  f.handle.emit('keydown',{target:f.handle,key:'ArrowDown',metaKey:true});
  assert.equal(f.position.y,before.y);
  f.dispose();
});
test('visualViewport pinch/scroll and ResizeObserver dynamically clamp expanded content to visible viewport',()=>{
  const e=environment(),f=createFloatingPanel(e.panel);
  e.vv.width=240;e.vv.height=200;e.vv.offsetLeft=40;e.vv.offsetTop=75;e.vv.scale=2;
  e.vv.emit('resize');
  assert.equal(e.panel.style.maxWidth,'224px');
  assert.equal(e.panel.style.maxHeight,'184px');
  assert.equal(f.position.x,48);
  assert.equal(f.position.y,137);
  e.vv.offsetLeft=90;e.vv.offsetTop=130;
  e.vv.emit('scroll');
  assert.equal(f.position.x,98);assert.equal(f.position.y,192);
  e.panel.height=600;e.observers[0].trigger();
  assert.equal(f.position.y,138);
  e.vv.width=180;e.vv.height=100;e.vv.emit('resize');
  const box=e.panel.getBoundingClientRect();
  assert.ok(box.width<=e.vv.width);assert.ok(box.height<=e.vv.height);
  assert.ok(f.position.x>=e.vv.offsetLeft);
  assert.ok(f.position.y>=e.vv.offsetTop);
  e.view.emit('resize');
  assert.ok(f.position.x+box.width<=e.vv.offsetLeft+e.vv.width+0.1);
  assert.ok(f.position.y+box.height<=e.vv.offsetTop+e.vv.height+0.1);
  f.dispose();
});
test('human-provenance updates never inject HTML or replace a focused app control',()=>{
  const e=environment(),f=createFloatingPanel(e.panel);
  const oldInput=e.input;
  const p=f.setProvenance({variant:'candidate',appName:'<script>not an element</script>',
    appSha:sha,uiSha:'b'.repeat(40),uiVersion:'1.11.0',deploymentState:'not-deployed'});
  assert.equal(f.provenance.appName,'<script>not an element</script>');
  assert.equal(p.uiVersion,'1.11.0');
  assert.equal(e.details.children[1],oldInput);
  const texts=f.provenanceDetails.children[1].children.map(x=>x.textContent);
  assert.ok(texts.includes('<script>not an element</script>'));
  assert.equal(e.panel.dataset.uiFloatingVariant,'candidate');
  assert.match(f.provenanceDetails.children[1].textContent||'',/^$/);
  f.dispose();
  assert.equal(e.panel.dataset.uiFloatingVariant,undefined);
  assert.throws(()=>createFloatingPanel(new Element('aside',e.doc)),/already mounted/);
});
test('pure geometry helpers clamp zero/oversized visual viewports without negative widths',()=>{
  const e=environment(280,100);
  assert.equal(viewportBox(e.view).width,280);
  e.vv.width=70;e.vv.height=40;e.vv.offsetLeft=10;e.vv.offsetTop=20;
  const v=viewportBox(e.view);
  assert.equal(v.x,10);assert.equal(v.width,70);
  const p=fitPosition({x:-1e5,y:1e5},{width:200,height:100},v,8);
  assert.equal(p.x,p.minX);assert.equal(p.y,p.maxY);
  assert.ok(p.maxX>=p.minX);
  assert.ok(p.maxY>=p.minY);
});
