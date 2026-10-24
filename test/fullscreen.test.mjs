import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture({supported=true,native=false}={}){
 class Events{listeners=new Map();addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f);}removeEventListener(t,f){this.listeners.get(t)?.delete(f);}fire(t){for(const f of this.listeners.get(t)||[])f({type:t});}}
 const doc=new Events(),view=new Events(),scope=new Events(),button=new Events(),root={},video=new Events(),attrs=new Map(),states=[];
 Object.assign(doc,{defaultView:view,documentElement:root,fullscreenEnabled:supported,fullscreenElement:null});
 Object.assign(root,{ownerDocument:doc,tagName:'HTML',dataset:{}});Object.assign(scope,{ownerDocument:doc,querySelector:selector=>selector==='video'&&native?video:null});
 Object.assign(button,{ownerDocument:doc,hidden:false,disabled:false,closest:()=>scope,getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)});
 let exits=0,requests=0;
 if(supported)root.requestFullscreen=async()=>{requests++;doc.fullscreenElement=root;doc.fire('fullscreenchange');};
 doc.exitFullscreen=async()=>{exits++;doc.fullscreenElement=null;doc.fire('fullscreenchange');};
 Object.assign(video,{currentTime:7,paused:false,webkitDisplayingFullscreen:false});
 if(native){video.webkitEnterFullscreen=()=>{requests++;video.webkitDisplayingFullscreen=true;video.fire('webkitbeginfullscreen');};video.webkitExitFullscreen=()=>{exits++;video.webkitDisplayingFullscreen=false;video.fire('webkitendfullscreen');};}
 const UI={adoptAction:(_button,options)=>{Object.assign(button,{label:options.label,icon:options.icon});if(options.ariaLabel!==undefined||button.getAttribute('aria-label')===null)button.setAttribute('aria-label',options.ariaLabel??options.label);},setActionState:(_button,state)=>states.push(state)};
 vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
 const baseline=[...doc.listeners.values()].reduce((n,s)=>n+s.size,0);const control=UI.createFullscreen(button,{scope});return{baseline,control,button,doc,view,scope,root,video,states,get requests(){return requests;},get exits(){return exits;}};
}

test('fullscreen preserves media and follows native entry, Escape and action exit',async()=>{
 const f=fixture();assert.equal(f.button.label,'Fullscreen');assert.equal(await f.control.toggle(),true);assert.equal(f.doc.fullscreenElement,f.root);assert.equal(f.button.label,'Exit fullscreen');assert.equal(f.button.getAttribute('aria-label'),'Exit fullscreen');assert.equal(f.button.getAttribute('aria-pressed'),'true');
 f.doc.fullscreenElement=null;f.doc.fire('fullscreenchange');assert.equal(f.button.label,'Fullscreen');assert.equal(f.control.active,false);
 await f.control.toggle();await f.control.toggle();assert.equal(f.exits,1);assert.equal(f.video.currentTime,7);assert.equal(f.video.paused,false);f.control.dispose();
});
test('closing a viewer exits its fullscreen and leaves preexisting fullscreen alone',async()=>{
 const f=fixture();await f.control.toggle();f.scope.fire('close');await Promise.resolve();assert.equal(f.exits,1);f.control.dispose();
 const g=fixture();g.doc.fullscreenElement=g.root;g.doc.fire('fullscreenchange');g.scope.fire('close');assert.equal(g.exits,0);g.control.dispose();
});
for(const reason of ['close','dispose'])test(`${reason} during a pending request exits once fullscreen arrives`,async()=>{
 const f=fixture();let complete;f.root.requestFullscreen=()=>new Promise(resolve=>{complete=()=>{f.doc.fullscreenElement=f.root;f.doc.fire('fullscreenchange');resolve();};});
 const entering=f.control.toggle();assert.equal(f.button.disabled,false);if(reason==='close')f.scope.fire('close');else f.control.dispose();complete();await entering;assert.equal(f.doc.fullscreenElement,null);assert.equal(f.exits,1);f.control.dispose();
});
test('unsupported photo actions hide, native video fallback tracks entry and exit',async()=>{
 const f=fixture({supported:false});assert.equal(f.button.hidden,true);assert.equal(await f.control.toggle(),false);f.control.dispose();
 const g=fixture({supported:false,native:true});assert.equal(g.button.hidden,false);await g.control.toggle();assert.equal(g.control.active,true);g.scope.fire('close');assert.equal(g.video.webkitDisplayingFullscreen,false);assert.equal(g.exits,1);g.control.dispose();
});
test('request rejection restores the action and reports shared feedback',async()=>{
 const f=fixture();f.root.requestFullscreen=()=>Promise.reject(Error('Denied'));assert.equal(await f.control.toggle(),false);assert.equal(f.button.disabled,false);assert.equal(f.button.getAttribute('aria-pressed'),'false');assert.equal(f.states.at(-1).state,'error');f.control.dispose();
});
test('dispose releases listeners in independent viewers and restores native button state',()=>{
 const a=fixture({native:true}),b=fixture();a.control.dispose();assert.equal(a.button.getAttribute('aria-pressed'),null);assert.equal([...a.doc.listeners.values()].reduce((n,s)=>n+s.size,0),a.baseline);assert.ok([...a.view.listeners.values(),...a.scope.listeners.values(),...a.button.listeners.values(),...a.video.listeners.values()].every(list=>list.size===0));assert.equal(b.button.label,'Fullscreen');b.control.dispose();
});
