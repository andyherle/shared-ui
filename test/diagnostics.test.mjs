import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(){
 const UI={version:'test'},doc={defaultView:{getComputedStyle:node=>node.css||({getPropertyValue:()=>30})}},items=[];
 function action(name,x){
  const node={tagName:'BUTTON',id:'',textContent:name,isConnected:true,ownerDocument:doc,parentElement:null,rect:{x,y:0,width:70,height:30},attrs:new Map([['aria-label',name]]),getAttribute(key){return this.attrs.get(key)||null;},hasAttribute(key){return this.attrs.has(key);},getBoundingClientRect(){return {...this.rect,left:this.rect.x,right:this.rect.x+this.rect.width};},getClientRects(){return [this.rect];},closest:()=>null,contains:()=>false,matches:selector=>selector==='.ui-action'||selector==='button,a,summary,label',querySelector:selector=>selector===':scope > .ui-label'?{textContent:name}:null};
  items.push(node);return node;
 }
 const scope={ownerDocument:doc,querySelectorAll:()=>items};vm.runInNewContext(fs.readFileSync(new URL('../src/diagnostics.js',import.meta.url),'utf8'),{window:{SharedUI:UI}});
 return {UI,scope,action,doc};
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

test('consumer audit catches unregistered native icon commands even when they look like shared controls',()=>{
 const f=fixture(),button=f.action('Text',0),matches=button.matches,query=button.querySelector;
 button.matches=selector=>selector==='.ui-action'?false:selector==='button,a,summary'?true:matches(selector);
 button.closest=selector=>selector==='.ui-actions,.ui-toolbar'?{}:null;button.querySelector=selector=>selector===':scope > svg'?{matches:()=>true}:query(selector);
 assert.ok(f.UI.auditControls(f.scope).issues.some(issue=>issue.code==='unadopted-action'));
 button.matches=matches;assert.equal(f.UI.auditControls(f.scope).issues.length,0);
});

test('tags and multiline native fields use minimum heights while ordinary controls keep exact drift checks',()=>{
 const f=fixture(),tag=f.action('Wrapped tag',0),field=f.action('Notes',80),button=f.action('Ordinary',160);
 const tagMatches=tag.matches;tag.matches=selector=>selector==='.ui-tag'||tagMatches(selector);tag.css={getPropertyValue:property=>property==='--ui-tag-height'?'26':'24'};tag.rect.height=54;
 const fieldMatches=field.matches,fieldQuery=field.querySelector;field.matches=selector=>selector==='.ui-field'||fieldMatches(selector);field.querySelector=selector=>selector==='textarea,.ui-color-palette'?{rows:2}:fieldQuery(selector);field.css={getPropertyValue:()=>26};field.rect.height=62;
 assert.equal(f.UI.auditControls(f.scope).issues.length,0);button.rect.height=54;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-height-drift').length,1);
 button.rect.height=30;tag.rect.height=20;field.rect.height=20;const drift=f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-height-drift');assert.equal(drift.length,2);assert(drift.every(issue=>issue.detail.includes('at least 26px')));
});
test('overlap uses ancestor scroll clipping but retains real partially visible overlaps',()=>{
 const f=fixture(),tag=f.action('Scrolled tag',0),nearby=f.action('Footer',0);
 const scrollport={parentElement:null,closest:()=>null,css:{overflowX:'hidden',overflowY:'auto'},getBoundingClientRect:()=>({x:0,y:0,width:80,height:30}),clientLeft:0,clientTop:0,clientWidth:80,clientHeight:30};
 tag.parentElement=scrollport;tag.rect.y=40;nearby.rect.y=45;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-overlap').length,0);
 tag.rect.y=20;nearby.rect.y=25;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-overlap').length,1);
 nearby.rect.y=31;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-overlap').length,0);
});
test('nested clipping honors each axis, client borders, scrollbar space and transformed scrollports',()=>{
 const f=fixture(),first=f.action('First',60),second=f.action('Second',70);
 const outer={parentElement:null,closest:()=>null,css:{overflowX:'hidden',overflowY:'visible'},getBoundingClientRect:()=>({x:0,y:0,width:100,height:100}),offsetWidth:50,offsetHeight:50,clientLeft:2,clientTop:2,clientWidth:30,clientHeight:46};
 const inner={parentElement:outer,closest:()=>null,css:{overflowX:'visible',overflowY:'clip'},getBoundingClientRect:()=>({x:0,y:0,width:200,height:20}),clientWidth:200,clientHeight:20};first.parentElement=inner;second.rect.y=25;first.rect.y=25;
 assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-overlap').length,0);
 first.rect.y=10;second.rect.y=10;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-overlap').length,0);
 second.rect.x=62;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-overlap').length,1);
});

test('a native textarea carrying ui-field itself uses the field minimum height',()=>{
 const f=fixture(),textarea=f.action('Native notes',0);textarea.tagName='TEXTAREA';textarea.matches=selector=>selector==='textarea'||selector==='.ui-field';textarea.querySelector=()=>null;textarea.css={getPropertyValue:property=>property==='--ui-field-height'?'26':'24'};textarea.rect.height=62;
 assert.equal(f.UI.auditControls(f.scope).issues.length,0);textarea.rect.height=20;const issues=f.UI.auditControls(f.scope).issues;assert.equal(issues.length,1);assert.equal(issues[0].code,'control-height-drift');assert.match(issues[0].detail,/at least 26px/);
});

test('declared, hidden and empty SVG icons are diagnosed without fetching resources',()=>{const f=fixture(),action=f.action('Open',0),query=action.querySelector;action.dataset={uiIcon:'grid'};assert(f.UI.auditControls(f.scope).issues.some(issue=>issue.code==='missing-icon'));const use={getAttribute:()=>'/v1/icons.svg#ui-grid',getBBox:()=>({width:0,height:0})},icon={matches:()=>true,querySelector:()=>use,getBoundingClientRect:()=>({width:18,height:18})};action.querySelector=selector=>selector===':scope > svg'?icon:query(selector);assert(f.UI.auditControls(f.scope).issues.some(issue=>issue.code==='empty-icon'));use.getBBox=()=>({width:16,height:16});icon.css={display:'none',getPropertyValue:()=>30};assert(f.UI.auditControls(f.scope).issues.some(issue=>issue.code==='hidden-icon'));action.attrs.set('aria-busy','true');assert(!f.UI.auditControls(f.scope).issues.some(issue=>['empty-icon','hidden-icon'].includes(issue.code)));});

test('composed native tag shells use a minimum height without exempting ordinary fields or buttons',()=>{const f=fixture(),shell=f.action('Tags',0),ordinary=f.action('Search',80),button=f.action('Save',160);for(const node of [shell,ordinary]){const matches=node.matches;node.matches=selector=>selector==='.ui-field'||matches(selector);}shell.attrs.set('data-ui-tag-field','');shell.rect.height=68;assert.equal(f.UI.auditControls(f.scope).issues.length,0);ordinary.rect.height=54;button.rect.height=54;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-height-drift').length,2);shell.rect.height=20;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-height-drift').length,3);});

test('shared swatch field panels retain their multiline minimum while other fields remain exact',()=>{const f=fixture(),panel=f.action('Filter colours',0),other=f.action('Search',80);for(const node of [panel,other]){const match=node.matches;node.matches=selector=>selector==='.ui-field'||match(selector);}const query=panel.querySelector;panel.querySelector=selector=>selector==='textarea,.ui-color-palette'?{}:query(selector);panel.rect.height=120;assert.equal(f.UI.auditControls(f.scope).issues.length,0);other.rect.height=54;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-height-drift').length,1);});

test('documented media openers keep domain preview geometry outside control height checks',()=>{const f=fixture(),media=f.action('Open reference',0),ordinary=f.action('Open settings',90);media.rect.height=160;const match=media.matches;media.matches=selector=>selector==='.ui-item,.ui-media-button,[data-ui-surface],.ui-graphic-action,.ui-resize-handle'||match(selector);assert.equal(f.UI.auditControls(f.scope).issues.length,0);ordinary.rect.height=50;assert.equal(f.UI.auditControls(f.scope).issues.filter(issue=>issue.code==='control-height-drift').length,1);});
