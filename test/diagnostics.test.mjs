import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(){
 const UI={version:'test'},doc={defaultView:{getComputedStyle:()=>({getPropertyValue:()=>30})}},items=[];
 function action(name,x){
  const node={tagName:'BUTTON',id:'',textContent:name,isConnected:true,ownerDocument:doc,parentElement:null,rect:{x,y:0,width:70,height:30},attrs:new Map([['aria-label',name]]),getAttribute(key){return this.attrs.get(key)||null;},hasAttribute(key){return this.attrs.has(key);},getBoundingClientRect(){return {...this.rect,left:this.rect.x,right:this.rect.x+this.rect.width};},getClientRects(){return [this.rect];},closest:()=>null,contains:()=>false,matches:selector=>selector==='.ui-action'||selector==='button,a,summary,label',querySelector:selector=>selector===':scope > .ui-label'?{textContent:name}:null};
  items.push(node);return node;
 }
 const scope={ownerDocument:doc,querySelectorAll:()=>items};vm.runInNewContext(fs.readFileSync(new URL('../src/diagnostics.js',import.meta.url),'utf8'),{window:{SharedUI:UI}});
 return {UI,scope,action};
}
test('rendered consumer audit catches overlap, height drift and missing names without mutating controls',()=>{
 const f=fixture(),first=f.action('Save',0),second=f.action('Present',76);assert.equal(f.UI.auditControls(f.scope).issues.length,0);
 second.rect.x=60;second.rect.height=52;second.attrs.delete('aria-label');second.textContent='';
 const codes=f.UI.auditControls(f.scope).issues.map(issue=>issue.code);assert.ok(codes.includes('control-overlap'));assert.ok(codes.includes('control-height-drift'));assert.ok(codes.includes('missing-name'));assert.equal(first.rect.x,0);assert.equal(second.rect.height,52);
});
test('state comparison detects neighbor movement, resizing, caption changes and disappearing controls',()=>{
 const f=fixture(),save=f.action('Save',0),neighbor=f.action('Present',76),before=f.UI.captureLayout(f.scope);assert.equal(f.UI.compareLayout(before).length,0);
 save.rect.width=90;neighbor.rect.x=96;assert.equal(f.UI.compareLayout(before).length,2);
 save.rect.width=70;neighbor.rect.x=76;neighbor.attrs.set('data-ui-compact','');assert.equal(f.UI.compareLayout(before).length,1);
 neighbor.isConnected=false;assert.equal(f.UI.compareLayout(before)[0].code,'control-disappeared');
});
