import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function kit(){
 class Node{dataset={};style={};attrs=new Map();listeners=new Map();textContent='Rotation';setAttribute(k,v){this.attrs.set(k,String(v));}addEventListener(k,f){this.listeners.set(k,f);}replaceWith(node){this.replacement=node;}}
 const doc={addEventListener(){},createElement(){return new Node();}},UI={adoptAction(node,{label}){node.textContent=label;}};
 vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set});
 const label=new Node(),row={ownerDocument:doc,querySelector:()=>label.replacement||label};return {UI,row,label};
}
test('property names reset only on double-click or keyboard activation, coalescing pending resets',async()=>{
 const {UI,row,label}=kit();let calls=0,release;
 const reset=()=>{calls++;return new Promise(resolve=>release=resolve);};
 UI.setPropertyReset(row,{onReset:reset});const name=label.replacement;
 name.listeners.get('click')({detail:1});assert.equal(calls,0,'single pointer click does nothing');
 name.listeners.get('dblclick')();name.listeners.get('dblclick')();assert.equal(calls,1,'pending reset is not duplicated');assert.equal(name.disabled,true);
 release();await new Promise(setImmediate);assert.equal(name.disabled,false);
 let keyboardCalls=0;UI.setPropertyReset(row,{onReset:()=>keyboardCalls++});assert.equal(label.replacement,name,'same node and focus retained');
 name.listeners.get('click')({detail:0});await new Promise(setImmediate);assert.equal(keyboardCalls,1,'native keyboard activation resets');
 UI.setPropertyReset(row,{onReset:undefined});assert.equal(name.disabled,true);name.listeners.get('dblclick')();assert.equal(keyboardCalls,1,'capability removal gates handler');
});
test('canonical action order preserves nodes and avoids repeated moves',()=>{
 const {UI}=kit(),make=role=>({dataset:{uiPropertyAction:role}}),key=make('keyframe'),fx=make('fx'),event=make('event');let moves=0;
 const group={children:[event,key,fx],append(...nodes){moves++;this.children=nodes;}};
 UI.orderPropertyActions(group);assert.deepEqual(group.children,[key,fx,event]);UI.orderPropertyActions(group);assert.equal(moves,1);
});
