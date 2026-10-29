import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
const {chromium,webkit}=await import(process.env.SHARED_UI_PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../public/v1/',import.meta.url);
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html>');}const file=new URL(req.url.slice(1),root);if(!file.pathname.startsWith(root.pathname))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/javascript; charset=utf-8');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const html=pack=>`<!doctype html><html data-ui="${pack}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${origin}/"><link rel="stylesheet" href="styles.css"></head><body><main class="ui-stack ui-pad">
<h2>Native decisions and filters</h2><div class="ui-actions ui-fill" id="actions"><button id="save" data-ui-variant="primary">Save changes</button><button id="preview">Preview</button><button id="more">More options</button></div>
<div id="action-row"></div>
<form id="filters" class="ui-stack"><label class="ui-field"><span class="ui-label">Search</span><input aria-label="Search" name="q" data-ui-filter-field value="camera"></label><details data-ui-filter class="ui-disclosure" open><summary>Filters</summary><div class="ui-stack ui-pad"><label class="ui-field"><span class="ui-label">Media type</span><select name="kind" aria-label="Media type" data-ui-filter-field><option value="">All media</option><option value="image">Images</option><option value="video">Video</option></select></label><input name="locked" data-ui-filter-field value="keep" disabled><button type="button" data-ui-filter-clear>Clear filters</button></div></details><div id="chips" class="ui-actions ui-tags" data-ui-filter-summary aria-label="Active filters"></div><button type="reset">Reset form</button></form>
<label id="invalid-field" class="ui-field"><span class="ui-label">Required name</span><input aria-label="Required name" aria-invalid="true" value="Draft stays here"></label><output class="ui-status ui-error">Could not save. Your draft is retained.</output>
<div class="ui-tags"><span class="ui-tag ui-info">Linked to source</span><span class="ui-tag ui-warning">Local changes</span><span class="ui-tag ui-success">Saved</span></div>
<div id="row-actions"></div><div id="row"><div id="value" class="ui-field"><input aria-label="Property value" value="42"></div></div>
<script src="runtime.js"></script></main></body></html>`;
const browser=await (process.env.SHARED_UI_BROWSER==='webkit'?webkit:chromium).launch({headless:true});
try{
 for(const pack of ['postvisual','personal'])for(const theme of ['light','dark'])for(const width of [280,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<400,reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/');await page.setContent(html(pack));await page.waitForFunction(()=>Boolean(window.SharedUI?.createFilterMenu));
  await page.evaluate(theme=>{
   document.documentElement.dataset.theme=theme;const UI=window.SharedUI;for(const [id,icon]of [['save','save'],['preview','play'],['more','more']])UI.adoptAction(document.getElementById(id),{icon,sprite:'/icons.svg'});
   window.filter=UI.createFilterMenu(document.getElementById('filters'),{summary:document.getElementById('chips'),sprite:'/icons.svg',onChange:()=>{window.changes=(window.changes||0)+1;}});
   const button=document.createElement('button');button.type='button';UI.adoptPropertyAction(document.getElementById('action-row'),{name:'Trigger',label:'Burst now',icon:'add',action:button,sprite:'/icons.svg'});
   UI.adoptPropertyRow(document.getElementById('row'),{name:'Exposure',control:document.getElementById('value')});
   const field=document.createElement('input'),actions=document.createElement('div');field.value='45';actions.className='ui-actions ui-inline';for(const icon of ['keyframe','formula']){const action=document.createElement('button');UI.adoptAction(action,{label:icon,icon,iconOnly:true,sprite:'/icons.svg'});actions.append(action);}UI.adoptPropertyRow(document.getElementById('row-actions'),{name:'Rotation',control:field,actions});
  },theme);
  for(const mode of ['icons','above','beside']){
   await page.evaluate(mode=>window.SharedUI.setActionLayout(document.body,mode),mode);await page.waitForTimeout(30);
   assert.notEqual(await page.locator('#save .ui-label').evaluate(n=>getComputedStyle(n).display),'none','primary caption '+mode);
   assert.notEqual(await page.getByRole('button',{name:'Burst now',exact:true}).locator('.ui-label').evaluate(n=>getComputedStyle(n).display),'none','verb survives appearance');
  }
  await page.getByLabel('Media type',{exact:true}).selectOption('video');
  await page.locator('#filters summary').click();
  assert.equal(await page.locator('#chips button').count(),2);
  await page.getByRole('button',{name:'Clear Media type filter: Video',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.getByLabel('Media type',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Search',{exact:true}).inputValue(),'camera');
  assert.equal(await page.locator('#chips button').evaluate(n=>document.activeElement===n),true,'focus returns to remaining chip');
  const before=await page.evaluate(()=>{window.inputRef=document.querySelector('[name=q]');window.chipRef=document.querySelector('#chips button');window.inputRef.focus();window.inputRef.setSelectionRange(1,3);window.filter.refresh();return document.activeElement===window.inputRef&&window.chipRef===document.querySelector('#chips button')&&window.inputRef.selectionStart===1;});assert.equal(before,true,'refresh retains chip, input and caret');
  await page.getByRole('button',{name:'Clear Search filter: camera',exact:true}).focus();await page.keyboard.press('Space');assert.equal(await page.locator('#chips').isVisible(),false);assert.equal(await page.locator('#filters summary').evaluate(n=>document.activeElement===n),true);
  await page.getByRole('button',{name:'Reset form',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#chips button'));
  assert.equal(await page.getByLabel('Search',{exact:true}).inputValue(),'camera');assert.equal(await page.locator('[name=locked]').inputValue(),'keep');
  const consistency=await page.evaluate(()=>{const label=getComputedStyle(document.querySelector('#row [data-ui-property-label]')),input=getComputedStyle(document.querySelector('#row input')),a=getComputedStyle(document.querySelector('#invalid-field')),b=getComputedStyle(document.querySelector('#value'));return {labelFont:label.fontSize,valueFont:input.fontSize,padding:['paddingTop','paddingRight','paddingBottom','paddingLeft'].every(k=>a[k]===b[k])};});assert.equal(consistency.labelFont,consistency.valueFont,'property labels and values share control typography');assert(consistency.padding,'composed fields share padding even in an error state');
  const alignment=await page.evaluate(()=>Math.abs(document.querySelector('#row-actions [data-ui-property-value]').getBoundingClientRect().left-document.querySelector('#row [data-ui-property-value]').getBoundingClientRect().left));assert(alignment<1,'property values align with and without actions');
  const paint=await page.evaluate(()=>({border:getComputedStyle(document.getElementById('invalid-field')).borderTopColor,error:getComputedStyle(document.querySelector('.ui-error')).color,overflow:document.documentElement.scrollWidth-innerWidth,spill:[...document.querySelectorAll("main *")].filter(n=>n.getBoundingClientRect().right>innerWidth+1||n.scrollWidth>n.clientWidth+1).map(n=>({tag:n.tagName,id:n.id,cls:n.className,w:n.getBoundingClientRect().width,scroll:n.scrollWidth,client:n.clientWidth,right:n.getBoundingClientRect().right})),value:document.getElementById('value').getBoundingClientRect().width,row:document.getElementById('row').getBoundingClientRect().width}));assert.equal(paint.border,paint.error,'invalid shell uses semantic error');assert(paint.overflow<=1,'no page overflow '+JSON.stringify({pack,theme,width,paint}));if(width===1440)assert(paint.value>paint.row*.7,'wide property values reclaim label gutter');
  if(process.env.SHARED_UI_SCREENSHOT_DIR&&theme==='dark'&&pack==='postvisual'&&[390,1440].includes(width)){await mkdir(process.env.SHARED_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.SHARED_UI_SCREENSHOT_DIR+'/shared-native-'+width+'.png',fullPage:true});}
  await page.evaluate(()=>window.filter.dispose());assert.equal(await page.locator('#chips button').count(),0);assert.equal(errors.length,0,errors.join('\n'));await context.close();
 }
 // Independent documents use their own native state and listeners.
 const context=await browser.newContext();const pages=await Promise.all([context.newPage(),context.newPage()]);for(const p of pages){await p.goto(origin+'/');await p.setContent(html('personal'));await p.waitForFunction(()=>Boolean(window.SharedUI?.createFilterMenu));await p.evaluate(()=>window.filter=SharedUI.createFilterMenu(document.querySelector('form'),{summary:document.querySelector('#chips'),sprite:'/icons.svg'}));}
 await pages[0].evaluate(()=>window.filter.clear());assert.equal(await pages[1].getByLabel('Search',{exact:true}).inputValue(),'camera');await context.close();
 console.log('Native flow passed: both packs/themes; 280, 390, 1440px; touch targets; action appearance; filter removal/reset/focus/identity/disposal; validation; two independent views.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
