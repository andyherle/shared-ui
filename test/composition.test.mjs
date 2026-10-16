import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {COMPONENTS, getComponent, ROLE_OWNERS} from '../src/studio/registry.mjs';
import {loadTokenCatalogue} from '../src/studio/tokens.mjs';
import {validateDocument} from '../src/studio/document.mjs';
import {auditSchemaSnapshot} from '../src/schema-audit.mjs';
import {RENDERED_COMPONENTS} from '../src/studio/renderer.mjs';
import {buildCSS} from '../scripts/build.mjs';
import {gzipSync} from 'node:zlib';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
class Element {
  constructor(doc,tag){
    this.nodeType=1;this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.children=[];
    this.className='';this.dataset={};this.parentNode=null;this.isConnected=false;this.properties=new Map();
    this.style={setProperty:(key,value)=>this.properties.set(key,value),removeProperty:key=>this.properties.delete(key)};
    this.value='';
  }
  append(...children){
    for(const child of children){
      if(child.parentNode)child.remove();
      this.children.push(child);child.parentNode=this;
    }
  }
  contains(target){return this===target||this.children.some(child=>child.contains(target));}
  remove(){
    if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);
    this.parentNode=null;
  }
}
class Document {
  createElement(tag){return new Element(this,tag);}
}
function mountFactory(){
  const doc=new Document(), SharedUI={}, win={SharedUI,document:doc};
  vm.runInNewContext(read('src/compositions.js'),{window:win});
  return {doc,UI:SharedUI};
}
function fixture(){
  const {doc,UI}=mountFactory();
  const heading=doc.createElement('h2'),body=doc.createElement('form'),toolbar=doc.createElement('div'),
    inspector=doc.createElement('aside'),footer=doc.createElement('div');
  const field=doc.createElement('input');field.value='Unsaved — 東京 / مرحبا';
  body.append(field);
  const innerHeading=doc.createElement('h3'),innerBody=doc.createElement('textarea');
  const inner=UI.createComposition('review-workspace',{header:innerHeading,body:innerBody},{variant:'stack',instanceId:'nested-record'});
  inspector.append(inner.element);
  const panel=UI.createComposition('review-workspace',
    {header:heading,toolbar,body,aside:inspector,footer},
    {variant:'standard',crowding:'wrap',instanceId:'review-record'});
  return {doc,UI,panel,heading,body,toolbar,field,inspector,footer,inner};
}

test('composition contract is a stable authorable Studio component in both packs',()=>{
  const item=getComponent('review-workspace');
  assert.ok(item);assert.deepEqual(item.packs,['postvisual','personal']);
  assert.equal(item.renderer.status,'document-only');
  assert.ok(RENDERED_COMPONENTS.includes(item.id));
  assert.deepEqual(item.variants,['standard','split','stack']);
  assert.ok(item.slots.header.min===1 && item.slots.body.min===1);
  assert.ok(item.slots.aside.max>0);
  assert.ok(item.tokens.includes('--ui-composition-gap')&&item.tokens.includes('--ui-composition-aside'));
  assert.equal(ROLE_OWNERS['composition-layout'],item.id);
  assert.ok(COMPONENTS.some(x=>x.id===item.id));
  for(const pack of ['personal','postvisual']){
    const c=loadTokenCatalogue({pack});
    assert.equal(c.definitions['--ui-composition-aside'].type,'length');
    assert.equal(c.resolved['--ui-composition-aside'].value,'18rem');
    assert.equal(c.resolved['--ui-composition-gap'].value,'12px');
  }
});

test('factory composes original native nodes once and preserves values through live layout changes',()=>{
  const {UI,panel,heading,body,field,inspector,inner}=fixture();
  const originalSlots=panel.slots;
  assert.equal(panel.element.dataset.uiComposition,'review-workspace');
  assert.equal(panel.element.dataset.uiCompositionRevision,'1');
  assert.equal(panel.element.dataset.uiCompositionInstance,'review-record');
  assert.equal(panel.slots.header.children[0],heading);
  assert.equal(panel.slots.body.children[0],body);
  assert.equal(panel.slots.aside.children[0],inspector);
  assert.equal(inner.element.dataset.uiComposition,'review-workspace');
  let conf=panel.setLayout({variant:'split',crowding:'scroll',overrides:{aside:'22rem',gap:'8px',reason:'Wider synthetic inspector'}});
  assert.equal(conf.variant,'split');assert.equal(conf.crowding,'scroll');
  assert.equal(panel.element.dataset.uiCompositionOverrides,'gap,aside');
  assert.equal(panel.element.properties.get('--ui-composition-aside'),'22rem');
  assert.equal(panel.element.properties.get('--ui-composition-gap'),'8px');
  assert.equal(field.value,'Unsaved — 東京 / مرحبا');
  assert.equal(panel.slots.header,originalSlots.header);
  assert.equal(panel.slots.body.children[0],body);
  assert.equal(panel.slots.aside.children[0],inspector);
  conf=panel.setLayout({variant:'stack',crowding:'wrap',overrides:{}});
  assert.equal(conf.variant,'stack');
  assert.equal(panel.element.dataset.uiCompositionOverrides,undefined);
  assert.equal(panel.element.properties.has('--ui-composition-aside'),false);
  assert.equal(field.value,'Unsaved — 東京 / مرحبا');
  panel.dispose();panel.dispose();
  assert.throws(()=>panel.setLayout({variant:'split'}),/disposed/);
  assert.equal(typeof UI.createComposition,'function');
});

test('native composer rejects unknown slots, connected nodes, duplicate descendants and unapproved overrides',()=>{
  const {doc,UI}=mountFactory();
  const make=()=>({header:doc.createElement('h3'),body:doc.createElement('form')});
  for(const options of [
    {variant:'absolute'}, {crowding:'hide'}, {overrides:{aside:'url(javascript:1)',reason:'bad'}},
    {overrides:{aside:'-1rem',reason:'bad'}}, {overrides:{aside:'120rem',reason:'too large'}},
    {overrides:{gap:'calc(1px + 2px)',reason:'not typed'}},
    {overrides:{aside:'22rem'}}, {overrides:{aside:'22rem',reason:'x'}},
    {overrides:{aside:'22rem',reason:'okay',unknown:'value'}}
  ])assert.throws(()=>UI.createComposition('review-workspace',make(),options));
  assert.throws(()=>UI.createComposition('unknown',make()),/Unknown canonical/);
  assert.throws(()=>UI.createComposition('review-workspace',{...make(),extra:doc.createElement('p')}),/Unknown composition slot/);
  const one=doc.createElement('button');
  assert.throws(()=>UI.createComposition('review-workspace',{header:one,body:one}),/unique/);
  const connected=doc.createElement('p');connected.isConnected=true;
  assert.throws(()=>UI.createComposition('review-workspace',{header:connected,body:doc.createElement('div')}),/detached/);
  const missing=make();delete missing.body;
  assert.throws(()=>UI.createComposition('review-workspace',missing),/Missing required/);
  assert.throws(()=>UI.createComposition('review-workspace',make(),{instanceId:'bad id'}),/instance/);
});

function docModel(){
  const node=(id,componentId,props={},slots={})=>({id,componentId,props,slots,tokens:{},bindings:{}});
  return {schemaVersion:1,kind:'composition',name:'Demo review',target:{appId:'demo',viewId:'review'},
    pack:'postvisual',mode:'dark',density:'default',root:'workspace',tokens:{},nodes:{
      workspace:node('workspace','review-workspace',{variant:'split',crowding:'wrap'},{header:['heading'],body:['content']}),
      heading:node('heading','text',{label:'Review record',role:'heading'}),
      content:node('content','text',{label:'Synthetic sample',role:'body'})
    }};
}
const validate=model=>validateDocument(model,{
  views:[{appId:'demo',viewId:'review',adapter:'document',bindings:{}}],
  catalogue:loadTokenCatalogue({pack:'postvisual',mode:'dark',density:'default'}),
  icons:Object.keys(JSON.parse(read('src/icons.json')))
});
test('Studio source authoring enforces typed editable overrides with explicit notes',()=>{
  const model=docModel();assert.equal(validate(model).root,'workspace');
  model.nodes.workspace.tokens['--ui-composition-aside']='22rem';
  assert.throws(()=>validate(model),/overrideReason/);
  model.nodes.workspace.props.overrideReason='Wider inspector for long synthetic labels';
  assert.equal(validate(model).root,'workspace');
  model.nodes.workspace.tokens['--ui-composition-aside']='url(javascript:alert(1))';
  assert.throws(()=>validate(model));
  model.nodes.workspace.tokens={'--ui-composition-aside':'22rem'};
  delete model.nodes.workspace.slots.body;
  assert.throws(()=>validate(model),/Missing required/);
});

test('development audit detects wrong/missing composition slots and variants without app data',()=>{
  const expected={ 'composition-frame':1,'composition-header':1,'composition-body':1,
    'composition-toolbar':1,'composition-filters':0,'composition-footer':1,'composition-aside':1};
  const data={schemaVersion:1,appId:'synthetic',viewId:'review',elements:[{
    id:'article:1',tag:'article',roles:['review-workspace'],
    attributes:{'data-ui-composition-revision':'1','data-ui-variant':'split','data-ui-crowding':'wrap'},
    counts:{...expected}
  }],coverage:{matched:1,captured:1,truncated:false}};
  assert.deepEqual(auditSchemaSnapshot(data).findings,[]);
  data.elements[0].attributes['data-ui-composition-revision']='0';
  data.elements[0].attributes['data-ui-variant']='absolute';
  data.elements[0].counts['composition-body']=0;
  const report=auditSchemaSnapshot(data);
  assert.ok(report.findings.some(f=>f.rule==='review-workspace-variant'));
  assert.ok(report.findings.some(f=>f.rule==='composition-body'));
  assert.ok(report.findings.length>=3);
  assert.ok(report.findings.every(f=>f.severity==='warning'));
});

test('composition remains a bounded shared CSS and JS addition with local clickable fixture',()=>{
  const controls=read('src/controls.css');
  const css=buildCSS(JSON.parse(read('src/tokens.json')),controls);
  const raw=Buffer.byteLength(css),gz=gzipSync(css).length;
  assert.ok(raw<=36864,'raw composition CSS must remain within 36KiB');
  assert.ok(gz<=8192,'transfer CSS must remain within 8KiB gzip');
  assert.ok(css.includes('.ui-composition-main'));
  assert.ok(css.includes('@container (min-width:48rem)'));
  const lab=read('src/index.html'),code=read('src/composition-lab.js');
  assert.ok(lab.includes('id="compositions"'));
  assert.ok(lab.includes('compositionWidth=390'));
  assert.ok(code.includes("UI.createComposition('review-workspace'"));
  assert.ok(code.includes('form.addEventListener(\'submit\''));
  assert.ok(read('scripts/build.mjs').includes("read('compositions.js')"));
  assert.ok(!read('scripts/build.mjs').includes("read('schema-audit.mjs')"));
  assert.ok(raw>0 && gz>0);
});
