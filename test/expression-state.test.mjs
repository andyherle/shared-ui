import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('the inline fx marker toggles the shared editor through one native action and follows updated callbacks',()=>{
 class Node{tagName='SPAN';style={};attrs=new Map();listeners=new Map();setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k);}removeAttribute(k){this.attrs.delete(k);}addEventListener(k,f){this.listeners.set(k,f);}remove(){this.removed=true;}}
 const doc={addEventListener(){},createElement(tag){const node=new Node();node.tagName=tag.toUpperCase();return node;}},UI={adoptAction(node,{label}){node.textContent=label;}};
 vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
 const input=Object.assign(new Node(),{ownerDocument:doc,after(node){this.marker=node;}});let opened=0;
 const state={expression:'base * 2',base:3,result:6,label:'Rotation',controls:'rotation-expression',onActivate:()=>{opened++;return true;}};
 UI.setExpressionState(input,state);const marker=input.marker;assert.equal(marker.tagName,'BUTTON');assert.equal(marker.type,'button');assert.equal(marker.getAttribute('aria-controls'),'rotation-expression');marker.listeners.get('click')();assert.equal(opened,1);
 UI.setExpressionState(input,{...state,onActivate:()=>{opened+=10;return false;},expanded:true});assert.equal(input.marker,marker);marker.listeners.get('click')();assert.equal(opened,11);assert.equal(marker.getAttribute('aria-expanded'),'false');
 UI.setExpressionState(input,{expression:null});assert.equal(marker.removed,true);assert.equal(input.getAttribute('aria-description'),undefined);
});
