import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function kit(){
 class Node{dataset={};style={};attrs=new Map();listeners=new Map();textContent='Rotation';isConnected=true;setAttribute(k,v){this.attrs.set(k,String(v));}addEventListener(k,f){this.listeners.set(k,f);}replaceWith(node){this.replacement=node;}}
 const doc={addEventListener(){},createElement(){return new Node();}},UI={adoptAction(node,{label}){node.textContent=label;}};
 vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:doc,WeakMap,Map,Set,setTimeout,clearTimeout});
 const label=new Node(),row={ownerDocument:doc,querySelector:()=>label.replacement||label};return {UI,row,label};
}
test('property names reset only on double-click or keyboard activation, coalescing pending resets',async()=>{
 const {UI,row,label}=kit();let calls=0,release;
 const reset=()=>{calls++;return new Promise(resolve=>release=resolve);};
 UI.setPropertyAction(row,{onReset:reset});const name=label.replacement;
 assert.equal(name.className,'ui-graphic-action');assert.equal(name.dataset.uiLabel,'always','property identity is not an optional toolbar caption');
 name.listeners.get('click')({detail:1});assert.equal(calls,0,'single pointer click does nothing');
 name.listeners.get('dblclick')();name.listeners.get('dblclick')();assert.equal(calls,1,'pending reset is not duplicated');assert.equal(name.disabled,true);
 release();await new Promise(setImmediate);assert.equal(name.disabled,false);
 let keyboardCalls=0;UI.setPropertyAction(row,{onReset:()=>keyboardCalls++});assert.equal(label.replacement,name,'same node and focus retained');
 name.listeners.get('click')({detail:0});await new Promise(setImmediate);assert.equal(keyboardCalls,1,'native keyboard activation resets');
 UI.setPropertyAction(row,{onReset:undefined});assert.equal(name.disabled,true);name.listeners.get('dblclick')();assert.equal(keyboardCalls,1,'capability removal gates handler');
});
test('canonical action order preserves nodes and avoids repeated moves',()=>{
 const {UI}=kit(),make=role=>({dataset:{uiPropertyAction:role}}),key=make('keyframe'),fx=make('fx'),event=make('event');let moves=0;
 const group={children:[fx,key],append(...nodes){moves++;this.children=nodes;}};
 UI.orderPropertyActions(group);assert.deepEqual(group.children,[key,fx]);UI.orderPropertyActions(group);assert.equal(moves,1);
});

test('event names reveal their event by pointer or keyboard and double-click resets',async()=>{
 const {UI,row,label}=kit();let visits=0,resets=0;
 UI.setPropertyAction(row,{onActivate:()=>visits++});UI.setPropertyAction(row,{onReset:()=>resets++});const name=label.replacement;
 name.listeners.get('click')({detail:1});assert.equal(visits,1);
 name.listeners.get('dblclick')();await new Promise(setImmediate);assert.equal(resets,1);
 name.listeners.get('click')({detail:0});assert.equal(visits,2,'keyboard reveals events');
 UI.setPropertyAction(row,{onActivate:undefined});name.listeners.get('click')({detail:1});assert.equal(visits,2);
});
