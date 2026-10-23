import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function fixture(){
 class Node {style={};listeners=new Map();attrs=new Map();children=[];hidden=false;open=false;ownerDocument=null;id='';setAttribute(k,v){this.attrs.set(k,v);}getAttribute(k){return this.attrs.get(k)??null;}removeAttribute(k){this.attrs.delete(k);}addEventListener(k,f){const a=this.listeners.get(k)||[];a.push(f);this.listeners.set(k,a);}removeEventListener(k,f){this.listeners.set(k,(this.listeners.get(k)||[]).filter(x=>x!==f));}emit(k,e={}){for(const f of this.listeners.get(k)||[])f({target:this,preventDefault(){},stopImmediatePropagation(){},...e});}append(...nodes){this.children.push(...nodes);}remove(){this.removed=true;}querySelectorAll(){return this.sections||[];}closest(){return this.hidden?this:null;}contains(node){return node===this;}getBoundingClientRect(){return {left:10,top:20,width:200,height:100};}focus(){this.ownerDocument.activeElement=this;}setPointerCapture(id){this.capture=id;}hasPointerCapture(id){return this.capture===id;}releasePointerCapture(){this.capture=null;}}
 const doc=new Node(),view=new Node();doc.defaultView=view;doc.createElement=()=>Object.assign(new Node(),{ownerDocument:doc});doc.hidden=false;
 const UI={adoptAction(node,options){node.textContent=options.label;node.adopted=options;}};vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
 return {UI,doc,view,node:()=>doc.createElement('div')};
}
test('bulk disclosure actions only affect visible sections and retain their nodes',()=>{
 const {UI,node}=fixture(),root=node(),actions=node(),a=node(),b=node(),hidden=node();hidden.hidden=true;a.open=true;root.sections=[a,b,hidden];const notices=[];
 const bulk=UI.createSectionActions({root,actions,onChange:x=>notices.push(x)});bulk.expand();assert(a.open&&b.open);assert.equal(hidden.open,false);assert.equal(actions.children[0].disabled,true);bulk.collapse();assert(!a.open&&!b.open);assert.equal(notices[1].sections[0],a);assert.equal(actions.children[1].disabled,true);bulk.dispose();assert(actions.children.every(x=>x.removed));assert.equal(root.listeners.get('toggle').length,0);
});
test('preview zoom anchors the pixel under the pointer, supports fit and never resizes the media',()=>{
 const {UI,node}=fixture(),surface=node(),content=node();content.style.width='600px';let changes=0;
 const view=UI.createMediaViewport({surface,content,onChange(){changes++;}});view.zoom(2,{x:160,y:70});assert.equal(view.state.scale,2);assert.equal(view.state.x,-50);assert.equal(view.state.y,0);assert.equal(content.style.width,'600px');
 surface.emit('pointerdown',{button:1,pointerId:1,clientX:10,clientY:10});surface.emit('pointermove',{pointerId:1,clientX:35,clientY:30});assert.equal(view.state.x,-25);surface.emit('pointercancel');assert.equal(view.state.x,-50);
 view.fit();assert.equal(view.state.scale,1);assert.equal(view.state.x,0);assert(changes>=4);view.dispose();assert.equal(content.style.transform,undefined);assert.equal(surface.listeners.get('wheel').length,0);
});
test('Space reserves panning only over the preview and fields retain keyboard input',()=>{
 const {UI,node,doc}=fixture(),surface=node(),content=node(),field=node();field.closest=()=>field;let prevented=0;
 const view=UI.createMediaViewport({surface,content});doc.emit('keydown',{key:' ',code:'Space',target:node(),preventDefault(){prevented++;}});assert.equal(prevented,0);
 surface.emit('pointerenter');doc.emit('keydown',{key:' ',code:'Space',target:field,preventDefault(){prevented++;}});assert.equal(prevented,0);
 doc.emit('keydown',{key:' ',code:'Space',preventDefault(){prevented++;}});assert.equal(prevented,1);surface.emit('pointerdown',{button:0,pointerId:2,clientX:0,clientY:0});surface.emit('pointermove',{pointerId:2,clientX:20,clientY:10});surface.emit('pointerup',{pointerId:2});assert.equal(view.state.x,20);view.dispose();
});

test('two-finger wheel deltas pan in both axes while pinch and modified wheel zoom',()=>{
 const {UI,node}=fixture(),surface=node(),content=node(),view=UI.createMediaViewport({surface,content});
 surface.emit('wheel',{deltaMode:0,deltaX:24,deltaY:36,clientX:110,clientY:70});assert.equal(view.state.x,-24);assert.equal(view.state.y,-36);assert.equal(view.state.scale,1);
 surface.emit('wheel',{deltaMode:0,deltaX:0,deltaY:20,shiftKey:true});assert.equal(view.state.x,-44);assert.equal(view.state.y,-36);
 surface.emit('wheel',{deltaMode:0,deltaX:0,deltaY:-100,ctrlKey:true,clientX:110,clientY:70});assert(view.state.scale>1);
 view.fit();surface.emit('gesturestart',{});surface.emit('gesturechange',{scale:2,clientX:110,clientY:70});assert.equal(view.state.scale,2);surface.emit('gestureend',{});view.dispose();
});

test('hosts can reserve transport keys and hand wheel input to scene tools',()=>{
 const {UI,node,doc}=fixture(),surface=node(),content=node();let prevented=0;
 const view=UI.createMediaViewport({surface,content,keyboard:false});surface.emit('pointerenter');surface.focus();
 for(const key of [' ','ArrowRight','i','o'])doc.emit('keydown',{key,code:key===' '?'Space':key,target:surface,preventDefault(){prevented++;}});
 assert.equal(prevented,0);assert.equal(view.state.x,0);
 view.setEnabled(false);surface.emit('wheel',{deltaX:10,deltaY:20,preventDefault(){prevented++;}});assert.equal(prevented,0);assert.equal(view.state.y,0);
 view.setEnabled(true);surface.emit('wheel',{deltaX:10,deltaY:20});assert.equal(view.state.y,-20);view.dispose();
});

test('bulk section controls offer intrinsic icon commands without changing authored classes',()=>{
 const {UI,node}=fixture(),root=node(),actions=node();actions.className='ui-actions ui-inline';const classes=new Set(actions.className.split(' '));actions.classList={add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name))};root.sections=[node()];
 const control=UI.createSectionActions({root,actions,fill:false,iconOnly:true});assert(classes.has('ui-inline'));assert(!classes.has('ui-fill'));assert(actions.children.every(button=>button.adopted.iconOnly===true));assert.equal(actions.children[0].adopted.label,'Expand all');control.dispose();assert.equal(actions.className,'ui-actions ui-inline');
});
