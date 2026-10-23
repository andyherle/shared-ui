import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const module={exports:{}};
vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module,URL});
class Events{
  listeners=new Map();
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  fire(type,event={}){for(const fn of this.listeners.get(type)||[])fn(event);}
  count(){return [...this.listeners.values()].reduce((n,v)=>n+v.size,0);}
}
function fixture(){
  const doc=new Events(),view=new Events(),media=new Events(),tokens=new Map();
  const baseline={'--ui-control-size':'12px','--ui-control-height':'30px','--ui-field-height':'30px','--ui-control-padding':'4px 8px','--ui-field-padding':'4px 8px'};
  const style={getPropertyValue:key=>tokens.get(key)?.[0]||'',getPropertyPriority:key=>tokens.get(key)?.[1]||'',setProperty:(key,value,priority='')=>tokens.set(key,[value,priority]),removeProperty:key=>tokens.delete(key)};
  doc.defaultView=view;doc.hidden=false;media.matches=false;
  view.matchMedia=()=>media;view.getComputedStyle=()=>({getPropertyValue:key=>style.getPropertyValue(key)||baseline[key]||''});
  return {doc,view,media,style,baseline,root:{ownerDocument:doc,style},tokens};
}
test('fractional sizes scale from the original density and preserve unrelated inline values',()=>{
 const f=fixture();f.style.setProperty('--ui-gap','7px','important');f.style.setProperty('color','purple');
 const control=module.exports.createControlScale(f.root,{fontSize:14.5});
 assert.equal(f.style.getPropertyValue('--ui-control-size'),'14.5px');assert.equal(f.style.getPropertyValue('--ui-field-height'),'36.25px');
 control.setFontSize(6);assert.equal(f.style.getPropertyValue('--ui-field-height'),'15px');assert.equal(f.style.getPropertyValue('--ui-field-padding'),'2px 4px');
 control.setFontSize(14.5);control.refresh();assert.equal(f.style.getPropertyValue('--ui-field-height'),'36.25px');
 for(const invalid of [0,-2,NaN,Infinity,'12'])assert.throws(()=>control.setFontSize(invalid),/positive finite/);
 control.dispose();assert.deepEqual(f.tokens,new Map([['--ui-gap',['7px','important']],['color',['purple','']]]));
 assert.equal(f.doc.count()+f.view.count()+f.media.count(),0);
});
test('touch fallback and refreshed styles use a fresh baseline; hidden views defer work',()=>{
 const f=fixture(),control=module.exports.createControlScale(f.root,{fontSize:9});
 f.doc.hidden=true;control.setFontSize(14.5);assert.equal(f.style.getPropertyValue('--ui-control-size'),'9px');
 f.doc.hidden=false;f.doc.fire('visibilitychange');assert.equal(f.style.getPropertyValue('--ui-control-size'),'14.5px');
 f.media.matches=true;Object.assign(f.baseline,{'--ui-control-size':'16px','--ui-control-height':'44px','--ui-field-height':'44px'});f.media.fire('change');
 assert.equal(f.style.getPropertyValue('--ui-control-size'),'16px');assert.equal(f.style.getPropertyValue('--ui-field-height'),'max(44px, 44px)');
 control.setFontSize(20);assert.equal(f.style.getPropertyValue('--ui-field-height'),'max(44px, 55px)');
 f.media.matches=false;Object.assign(f.baseline,{'--ui-control-size':'12px','--ui-field-height':'36px'});f.doc.fire('ui:styles');assert.equal(f.style.getPropertyValue('--ui-field-height'),'60px');
 f.view.fire('pagehide',{persisted:true});assert.ok(f.tokens.size);f.view.fire('pagehide',{persisted:false});assert.equal(f.tokens.size,0);
});

test('a precision density scales its existing icon baseline',()=>{
 const f=fixture();Object.assign(f.baseline,{'--ui-control-size':'10px','--ui-action-icon':'10px'});
 const control=module.exports.createControlScale(f.root,{fontSize:12});assert.equal(f.style.getPropertyValue('--ui-control-icon'),'12px');control.dispose();
});
