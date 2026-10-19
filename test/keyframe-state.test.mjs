import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('key presence changes the shared icon independently of selected button paint',()=>{
 const icons=[],attrs=new Map(),graphic={style:{}},action={dataset:{},querySelector:()=>graphic,getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v)};
 const UI={adoptAction(node,{icon}){icons.push(icon);}};
 vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:{addEventListener(){}},WeakMap,Map,Set});
 UI.setKeyframeState(action,{present:false,selected:false});assert.equal(icons.at(-1),'keyframe');assert.equal(attrs.get('aria-pressed'),'false');
 UI.setKeyframeState(action,{present:true,selected:false});assert.equal(icons.at(-1),'keyframe-filled');assert.equal(graphic.style.color,'var(--ui-text)');assert.equal(attrs.get('aria-pressed'),'false');
 UI.setKeyframeState(action,{present:true,selected:true});assert.equal(attrs.get('aria-pressed'),'true');assert.equal(icons.length,2,'selection preserves the existing SVG');
 UI.setKeyframeState(action,{present:false,selected:false});assert.equal(icons.at(-1),'keyframe');assert.equal(attrs.get('aria-pressed'),'false');
});
