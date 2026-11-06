import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Node {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.listeners=new Map();this.dataset={};this.attrs={};this.name='';this.value='';this.disabled=false;}
 addEventListener(t,fn){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(fn);}
 removeEventListener(t,fn){this.listeners.get(t)?.delete(fn);}
 fire(t,extra={}){let e={type:t,target:this,preventDefault(){this.defaultPrevented=true;},...extra};for(const fn of this.listeners.get(t)||[])fn(e);return e;}
 setAttribute(k,v){this.attrs[k]=v;}
 matches(){return this.marked;}
 closest(s){return s==='form'?this.form:this.clear?this:null;}
 focus(){this.focused=true;}
}
function fixture(){const form=new Node('form'),details=new Node('details'),summary=new Node('summary'),clear=new Node('button'),view=new Node(),fields=[];clear.clear=true;clear.form=form;details.open=true;details.querySelector=()=>summary;Object.assign(view,{setTimeout,clearTimeout});const doc=new Node();doc.defaultView=view;form.ownerDocument=doc;form.querySelector=()=>details;form.querySelectorAll=s=>s==='[data-ui-filter-field]'?fields:[clear];const UI={adoptAction(n,opts){n.label=opts.label;}};
 vm.runInNewContext(fs.readFileSync(new URL('../src/filters.js',import.meta.url),'utf8'),{window:{SharedUI:UI},console,queueMicrotask});
 const field=(name,value='',type='text')=>{const f=new Node(type==='select'?'select':'input');Object.assign(f,{name,value,type,marked:true,form});fields.push(f);return f;};return {form,details,summary,clear,view,fields,field,UI};}
test('counts defaults and dynamic fields without replacing native nodes or routing values',()=>{const f=fixture(),category=f.field('category','action','select'),query=f.field('query');category.dataset.uiFilterDefault='action';let calls=[];const menu=f.UI.createFilterMenu(f.form,{onChange:(v,m)=>calls.push([v,m])});assert.equal(menu.active,0);query.value='Camera';f.form.fire('input',{target:query});assert.equal(menu.active,1);assert.equal(f.summary.label,'Filters · 1');assert.equal(calls.length,1);f.field('from','2026-10-01');menu.refresh();assert.equal(menu.active,2);assert.equal(menu.values.query,'Camera');menu.clear();assert.equal(category.value,'action');assert.equal(query.value,'');assert.equal(menu.active,0);assert.equal(calls.at(-1)[1].reason,'clear');assert.equal(f.details.open,true);});
test('groups native choices by criterion, supports multiselects and ignores disabled fields',()=>{const f=fixture(),a=f.field('tag','a','checkbox'),b=f.field('tag','b','checkbox'),multi=f.field('kind','','select');a.checked=b.checked=true;multi.multiple=true;multi.options=[{value:'image',selected:true},{value:'video',selected:true}];Object.defineProperty(multi,'selectedOptions',{get(){return this.options.filter(o=>o.selected);}});const ignored=f.field('disabled','x');ignored.disabled=true;const menu=f.UI.createFilterMenu(f.form,{defaults:{tag:['a']}});assert.equal(menu.active,2);assert.deepEqual([...menu.values.tag],['a','b']);menu.clear();assert.equal(a.checked,true);assert.equal(b.checked,false);assert.equal(multi.selectedOptions.length,0);assert.equal(menu.active,0);});
test('native reset action and Escape retain focus; dispose releases every listener',()=>{const f=fixture(),q=f.field('query','x');const menu=f.UI.createFilterMenu(f.form);assert.equal(f.form.fire('click',{target:f.clear}).defaultPrevented,true);assert.equal(q.value,'');f.details.fire('keydown',{key:'Escape'});assert.equal(f.details.open,false);assert.equal(f.summary.focused,true);menu.dispose();assert.equal([...f.form.listeners.values()].reduce((n,s)=>n+s.size,0),0);assert.equal([...f.view.listeners.values()].reduce((n,s)=>n+s.size,0),0);});

test('externally associated native search participates in read, count, clear and document input events',()=>{const f=fixture(),query=f.field('q','Visible draft'),external=f.fields.pop();f.form.elements=[external];external.closest=()=>null;const calls=[],menu=f.UI.createFilterMenu(f.form,{onChange:(values,detail)=>calls.push({values,detail})});assert.equal(menu.values.q,'Visible draft');assert.equal(menu.active,1);external.value='New live value';f.form.ownerDocument.fire('input',{target:external});assert.equal(calls.length,1);assert.equal(calls[0].values.q,'New live value');menu.clear();assert.equal(external.value,'');assert.equal(menu.active,0);menu.dispose();assert([...f.form.ownerDocument.listeners.values()].every(set=>set.size===0));});


test('clearing one criterion retains other drafts and all disabled values',()=>{
 const f=fixture(),query=f.field('q','camera'),type=f.field('type','video','select'),locked=f.field('locked','keep');locked.disabled=true;
 const menu=f.UI.createFilterMenu(f.form,{defaults:{type:'image'}});menu.clear('type');assert.equal(type.value,'image');assert.equal(query.value,'camera');assert.equal(locked.value,'keep');assert.equal(menu.active,1);menu.clear();assert.equal(query.value,'');assert.equal(locked.value,'keep');
});
test('native reset refreshes after restoration and respects cancellation and disposal',async()=>{
 const f=fixture(),q=f.field('q','changed'),calls=[];const menu=f.UI.createFilterMenu(f.form,{onChange:(v,m)=>calls.push([v.q,m.reason])});
 f.form.fire('reset');q.value='';await new Promise(resolve=>setTimeout(resolve,5));assert.deepEqual(calls,[['','reset']]);assert.equal(menu.active,0);
 f.form.fire('reset',{defaultPrevented:true});await new Promise(resolve=>setTimeout(resolve,5));assert.equal(calls.length,1);
 f.form.fire('reset');menu.dispose();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(calls.length,1);
});
