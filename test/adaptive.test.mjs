import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8');
function fixture(){
  class Target{listeners=new Map();addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}fire(type,event={}){for(const fn of this.listeners.get(type)||[])fn(event);}}
  const frames=new Map();let next=0,observer;
  const defaults={display:'flex',flexDirection:'row',font:'12px sans-serif',letterSpacing:'normal',columnGap:'6px',paddingLeft:'5px',paddingRight:'5px',borderLeftWidth:'1px',borderRightWidth:'1px',marginLeft:'0px',marginRight:'0px',minWidth:'30px',width:'30px',position:'static'};
  const view=new Target();Object.assign(view,{getComputedStyle:node=>({...defaults,...node.css}),requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{targets=new Set();constructor(fn){this.callback=fn;observer=this;}observe(node){this.targets.add(node);}unobserve(node){this.targets.delete(node);}disconnect(){this.targets.clear();}notify(node){this.callback([{target:node}]);}}});
  const doc=new Target();Object.assign(doc,{defaultView:view,visibilityState:'visible',readyState:'complete',documentElement:{dataset:{ui:'postvisual'}},activeElement:null,querySelectorAll:()=>[],createElement:()=>({getContext:()=>({measureText:text=>({width:text.length*6})})})});
  class Node{constructor(tag,className='',width=30){this.tagName=tag.toUpperCase();this.className=className;this.children=[];this.dataset={};this.attrs=new Map();this.ownerDocument=doc;this.isConnected=true;this.clientWidth=width;this.css={};this.textContent='';this.open=false;}
    append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
    getBoundingClientRect(){return {width:this.clientWidth,height:30};}
    matches(selector){return selector.split(',').some(part=>{const tag=part.match(/^[a-z]+/)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;const classes=[...part.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);if(classes.some(name=>!this.className.split(' ').includes(name)))return false;const attrs=[...part.matchAll(/\[([\w-]+)(?:=([^\]]+))?\]/g)];return attrs.every(([,key,value])=>key==='open'?this.open:this.getAttribute(key)!==null&&(value===undefined||this.getAttribute(key)===value));});}
    querySelector(selector){const part=selector.replace(':scope > ','');return this.children.find(node=>node.matches(part))||null;}
    querySelectorAll(selector){const part=selector.replace(':scope > ','');return this.children.filter(node=>node.matches(part));}
    closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
    hasAttribute(name){return this.attrs.has(name);}getAttribute(name){return this.attrs.get(name)??null;}setAttribute(name,value){this.attrs.set(name,String(value));}removeAttribute(name){this.attrs.delete(name);}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
  }
  const row=new Node('div','ui-actions',400);row.css={paddingLeft:'0px',paddingRight:'0px',borderLeftWidth:'0px',borderRightWidth:'0px'};
  function action(text,{primary=false,always=false}={}){const node=new Node('button','ui-action'+(primary?' primary':''));node.textContent=text;if(always)node.setAttribute('data-ui-label','always');const icon=new Node('svg','ui-icon',18);icon.css.width='18px';const label=new Node('span','ui-label');label.textContent=text;node.append(icon,label);node.onclick=()=>text;return node;}
  function overflow(actions,priority=0){const node=new Node('details','ui-disclosure ui-overflow');node.dataset.uiPriority=String(priority);const summary=action('More');summary.tagName='SUMMARY';summary.dataset.uiLabel='hidden';summary.setAttribute('data-ui-label','hidden');const body=new Node('div','ui-actions ui-disclosure-body');body.append(...actions);node.append(summary,body);return node;}
  const UI={};vm.runInNewContext(source,{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
  const flush=()=>{for(let count=0;frames.size&&count<10;count++){const work=[...frames.values()];frames.clear();for(const fn of work)fn();}assert.equal(frames.size,0);};
  const resize=width=>{row.clientWidth=width;observer.notify(row);flush();};
  return {UI,doc,view,row,action,overflow,flush,resize,get observer(){return observer;},frames,Node};
}
test('a horizontal group compacts primary and secondary captions together',()=>{
 const f=fixture(),save=f.action('Save',{primary:true}),other=f.action('Long secondary caption');f.row.append(save,other);f.UI.observeActions(f.row);f.flush();assert.equal(other.hasAttribute('data-ui-compact'),false);f.resize(180);assert.equal(other.hasAttribute('data-ui-compact'),true);assert.equal(save.hasAttribute('data-ui-compact'),true);assert.equal(other.getAttribute('aria-label'),null);f.resize(500);assert.equal(other.hasAttribute('data-ui-compact'),false);assert.equal(save.hasAttribute('data-ui-compact'),false);
});
test('an explicit caption stays readable while neighboring actions compact',()=>{
 const f=fixture(),fixed=f.action('Keep',{always:true}),other=f.action('Secondary');f.row.append(fixed,other);f.UI.observeActions(f.row);f.flush();f.resize(100);assert.equal(other.hasAttribute('data-ui-compact'),true);assert.equal(fixed.hasAttribute('data-ui-compact'),false);
});
test('narrow pure action rows share space only when every control fits its slot',()=>{
 const f=fixture(),first=f.action('Open'),second=f.action('Save');f.row.append(first,second);f.UI.observeActions(f.row);f.flush();assert.equal(f.row.hasAttribute('data-ui-equal'),true);f.resize(90);assert.equal(f.row.hasAttribute('data-ui-equal'),true);f.resize(500);assert.equal(f.row.hasAttribute('data-ui-equal'),false);
});
test('intrinsic action groups keep natural widths instead of becoming equal tiles',()=>{
 const f=fixture(),host=new f.Node('div','',400);f.row.className='ui-actions ui-inline';f.row.append(f.action('Blue'),f.action('Red'),f.action('Gold'));host.append(f.row);f.UI.observeActions(f.row);f.flush();assert.equal(f.row.hasAttribute('data-ui-equal'),false);host.clientWidth=180;f.observer.notify(host);f.flush();assert.equal(f.row.hasAttribute('data-ui-equal'),false);
});
test('compact tab navigation shares one row without losing accessible names',()=>{
 const f=fixture();f.row.className='ui-actions ui-tabs';f.row.setAttribute('data-ui-layout','bar');const tabs=['Activity','Ledger','Invoices','Balances','Position','Review','Records','Reconcile'].map(name=>f.action(name));f.row.append(...tabs);f.UI.observeActions(f.row);f.flush();f.resize(300);assert.equal(f.row.hasAttribute('data-ui-equal'),true);for(const tab of tabs){assert.equal(tab.hasAttribute('data-ui-compact'),true);assert.ok(tab.textContent);}f.resize(800);assert.equal(f.row.hasAttribute('data-ui-equal'),false);for(const tab of tabs)assert.equal(tab.hasAttribute('data-ui-compact'),false);
});
test('priority tiles collapse as whole native groups without changing controls or handlers',()=>{
 const f=fixture(),save=f.action('Save',{primary:true}),a=f.action('A'),b=f.action('B'),c=f.action('C'),d=f.action('D'),low=f.overflow([a,b],0),high=f.overflow([c,d],1),handler=a.onclick;f.row.append(save,low,high);f.UI.observeActions(f.row);f.flush();assert.equal(low.dataset.uiOverflow,'expanded');f.resize(150);assert.equal(low.dataset.uiOverflow,'collapsed');assert.equal(high.dataset.uiOverflow,'expanded');assert.equal(low.open,false);assert.equal(a.hasAttribute('data-ui-compact'),false);assert.equal(a.onclick,handler);assert.equal(low.children[1].children[0],a);f.resize(500);assert.equal(low.dataset.uiOverflow,'expanded');assert.equal(low.open,true);
});
test('an open tile and a focused control stay reachable during fitting',()=>{
 const f=fixture(),save=f.action('Save',{primary:true}),draft=f.action('Draft'),low=f.overflow([draft,f.action('Extra')]);f.row.append(save,low);f.UI.observeActions(f.row);f.flush();f.doc.activeElement=draft;f.resize(100);assert.equal(low.dataset.uiOverflow,'collapsed');assert.equal(low.open,true);f.doc.activeElement=null;f.resize(110);assert.equal(low.open,true);
});
test('hidden views suspend fitting and disposal releases observers and queued work',()=>{
 const f=fixture();f.row.append(f.action('Search'));f.UI.observeActions(f.row);assert.equal(f.observer.targets.size,1);f.doc.visibilityState='hidden';f.doc.fire('visibilitychange');assert.equal(f.observer.targets.size,0);assert.equal(f.frames.size,0);f.UI.refreshActions(f.doc);assert.equal(f.frames.size,0);f.doc.visibilityState='visible';f.doc.fire('visibilitychange');f.flush();assert.equal(f.observer.targets.size,1);f.UI.disposeActions(f.doc);assert.equal(f.observer.targets.size,0);assert.equal(f.doc.listeners.get('visibilitychange').size,0);assert.equal(f.frames.size,0);
});
test('removed groups are unobserved and separate documents keep independent lifecycles',()=>{
 const a=fixture(),b=fixture();a.row.append(a.action('A'));b.row.append(b.action('B'));a.UI.observeActions(a.row);b.UI.observeActions(b.row);a.flush();b.flush();a.row.isConnected=false;a.UI.refreshActions(a.doc);a.flush();assert.equal(a.observer.targets.size,0);assert.equal(b.observer.targets.size,1);a.UI.disposeActions(a.doc);assert.equal(b.observer.targets.size,1);
});

test('intrinsic groups reserve flexible sibling identity space before fitting captions',()=>{
 const f=fixture(),identity=new f.Node('strong','',230),group=new f.Node('div','ui-actions ui-inline',70),action=f.action('Search projects');identity.css={flexGrow:'1',flexBasis:'80px'};f.row.clientWidth=300;group.css={paddingLeft:'0px',paddingRight:'0px',borderLeftWidth:'0px',borderRightWidth:'0px'};group.append(action);f.row.append(identity,group);f.UI.observeActions(group);f.flush();assert.equal(action.hasAttribute('data-ui-compact'),false);f.resize(180);assert.equal(action.hasAttribute('data-ui-compact'),true);
});
test('intrinsic subgroups share one caption decision and one observer',()=>{
 const f=fixture(),form=new f.Node('form','ui-actions ui-inline',200),save=f.action('Open task',{primary:true}),other=f.action('Try another'),reply=f.action('Reply');form.css={paddingLeft:'0px',paddingRight:'0px',borderLeftWidth:'0px',borderRightWidth:'0px'};form.append(save,other);f.row.append(form,reply);f.UI.observeActions(f.row);f.UI.observeActions(form);f.flush();f.resize(140);for(const action of [save,other,reply])assert.equal(action.hasAttribute('data-ui-compact'),true);assert.equal(f.observer.targets.size,1);f.resize(500);for(const action of [save,other,reply])assert.equal(action.hasAttribute('data-ui-compact'),false);
});
test('repeated fitting stays stable when compact padding differs from expanded padding',()=>{
 const f=fixture(),base=f.view.getComputedStyle;f.view.getComputedStyle=node=>({...base(node),...(node.hasAttribute('data-ui-compact')?{paddingLeft:'1px',paddingRight:'1px'}:{}),getPropertyValue:name=>name==='--ui-control-inset'?'5px':''});
 const a=f.action('First item'),b=f.action('Next thing');f.row.append(a,b);f.UI.observeActions(f.row);f.flush();f.resize(190);for(let i=0;i<20;i++){f.UI.refreshActions(f.doc);f.flush();assert.equal(a.hasAttribute('data-ui-compact'),true);assert.equal(b.hasAttribute('data-ui-compact'),true);}
});
test('selector captions follow the row and remain measurable while hidden',()=>{
 const f=fixture(),field=new f.Node('label','ui-field'),label=new f.Node('span','ui-label'),select=new f.Node('select'),copy=f.action('Copy image');label.textContent='Zoom';select.value='100%';select.selectedOptions=[{label:'100%'}];field.append(label,select);f.row.append(copy,field);const base=f.view.getComputedStyle;f.view.getComputedStyle=node=>({...base(node),...(node===label&&field.hasAttribute('data-ui-compact')?{display:'none'}:{})});f.UI.observeActions(f.row);f.flush();f.resize(160);for(let i=0;i<10;i++){f.UI.refreshActions(f.doc);f.flush();assert.equal(copy.hasAttribute('data-ui-compact'),true);assert.equal(field.hasAttribute('data-ui-compact'),true);}assert.equal(select.value,'100%');f.resize(400);assert.equal(field.hasAttribute('data-ui-compact'),false);
});
test('priority tiles inside an intrinsic subgroup collapse under the owning row',()=>{
 const f=fixture(),group=new f.Node('div','ui-actions ui-inline'),tile=f.overflow([f.action('Import'),f.action('Export')]),save=f.action('Save');group.css={paddingLeft:'0px',paddingRight:'0px',borderLeftWidth:'0px',borderRightWidth:'0px'};group.append(save,tile);f.row.append(group);f.UI.observeActions(group);f.flush();f.resize(85);assert.equal(tile.dataset.uiOverflow,'collapsed');f.resize(400);assert.equal(tile.dataset.uiOverflow,'expanded');
});
test('equal-width actions compact together before a longer caption outgrows its slot',()=>{
 const f=fixture();f.row.className='ui-actions ui-fill';const long=f.action('Export selection'),short=f.action('Integration');f.row.append(long,short);f.UI.observeActions(f.row);f.flush();f.resize(260);assert.equal(long.hasAttribute('data-ui-compact'),true);assert.equal(short.hasAttribute('data-ui-compact'),true);f.resize(400);assert.equal(long.hasAttribute('data-ui-compact'),false);
});
test('opening a normal disclosure does not make its body width compact the command row',()=>{
 const f=fixture(),details=new f.Node('details','ui-disclosure',300),summary=f.action('Reply');summary.tagName='SUMMARY';details.append(summary);f.row.append(f.action('Open task'),details);f.UI.observeActions(f.row);f.flush();details.open=true;f.UI.refreshActions(f.doc);f.flush();assert.equal(summary.hasAttribute('data-ui-compact'),false);
});

test('an inline toggle reserves its trailing native switch before the group fits',()=>{
 const f=fixture(),file=f.action('File'),toggle=f.action('Journal'),send=f.action('Send',{primary:true});toggle.tagName='LABEL';toggle.className='ui-action ui-toggle';const input=new f.Node('input','',22);input.type='checkbox';input.css={marginLeft:'0px',marginRight:'0px'};toggle.append(input);f.row.append(file,toggle,send);f.UI.observeActions(f.row);f.flush();f.resize(220);for(const action of [file,toggle,send])assert.equal(action.hasAttribute('data-ui-compact'),true);f.resize(400);for(const action of [file,toggle,send])assert.equal(action.hasAttribute('data-ui-compact'),false);assert.equal(toggle.children.at(-1),input);
});

test('closing one embedded view releases its observers without stopping another view',()=>{
 const f=fixture(),view=new f.Node('section'),other=new f.Node('div','ui-actions',100);
 view.append(f.row);f.row.append(f.action('First'));other.append(f.action('Second'));
 f.UI.observeActions(f.row);f.UI.observeActions(other);f.flush();
 assert.equal(f.observer.targets.size,2);f.UI.releaseActions(view);
 assert.equal(f.observer.targets.has(f.row),false);assert.equal(f.observer.targets.has(other),true);
 other.clientWidth=40;f.observer.notify(other);f.flush();
 assert.equal(other.children[0].hasAttribute('data-ui-compact'),true);
});

test('caption fitting reserves the widest state before Save changes, including while compact',()=>{
 const f=fixture(),save=f.action('Save'),other=f.action('Present'),label=save.querySelector(':scope > .ui-label'),group=new f.Node('span','ui-dynamic'),reserve=new f.Node('span');
 reserve.setAttribute('data-ui-text','Saving…');group.append(reserve);label.append(group);f.row.append(save,other);f.UI.observeActions(f.row);f.flush();
 f.resize(160);assert.equal(save.hasAttribute('data-ui-compact'),true);
 for(const value of ['Saving…','Saved','Save']){label.textContent=value;f.UI.refreshActions(f.doc);f.flush();assert.equal(save.hasAttribute('data-ui-compact'),true);assert.equal(other.hasAttribute('data-ui-compact'),true);}
 f.resize(220);assert.equal(save.hasAttribute('data-ui-compact'),false);assert.equal(other.hasAttribute('data-ui-compact'),false);
});

test('flexible header metadata reserves its text rather than the allocated empty space',()=>{
 const f=fixture(),count=new f.Node('span','ui-meta ui-truncate',420),a=f.action('Filters'),b=f.action('Ingest');
 count.css={flexGrow:'1',flexBasis:'0px',minWidth:'0px',paddingLeft:'0px',paddingRight:'0px',borderLeftWidth:'0px',borderRightWidth:'0px'};count.textContent='29 media';
 f.row.append(count,a,b);f.UI.observeActions(f.row);f.flush();
 assert.equal(a.hasAttribute('data-ui-compact'),false);assert.equal(b.hasAttribute('data-ui-compact'),false);
 f.resize(160);assert.equal(a.hasAttribute('data-ui-compact'),true);
});

test('open menu geometry is refreshed after captions change the toolbar layout',()=>{
 const f=fixture(),a=f.action('Save project'),b=f.action('Import media'),menu={};let fitted=[];
 f.doc.querySelectorAll=selector=>selector==='details.ui-menu[open]'?[menu]:[];
 f.UI.positionMenu=value=>{assert.equal(value,menu);fitted.push(a.hasAttribute('data-ui-compact'));};
 f.row.append(a,b);f.UI.observeActions(f.row);f.flush();f.resize(100);assert.equal(fitted.at(-1),true);f.resize(500);assert.equal(fitted.at(-1),false);
});
