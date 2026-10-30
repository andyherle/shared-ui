// Optional browser-only dependency stays in tools/browser, never the consumer bundle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildSite} from '../scripts/build.mjs';
import {createAuthoringService, DEMO_VIEWS} from '../src/studio/service.mjs';
import {startStudio} from '../scripts/studio-server.mjs';
const require=createRequire(new URL('../tools/browser/package.json',import.meta.url));
const engines=require('playwright'),engine=process.env.UI_TEST_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'Supported browser engine');
const root=fileURLToPath(new URL('../',import.meta.url));buildSite();
const routes=new Map([
 ['/renderer.mjs','src/studio/renderer.mjs'],['/editor.css','src/studio/editor.css'],
 ...['registry','validation'].map(name=>['/src/studio/'+name+'.mjs','src/studio/'+name+'.mjs']),
 ...['composition-policy-browser','studio-renderer-browser','studio-render-frame'].map(name=>['/test/'+name+'.html','test/'+name+'.html'])
]);
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 const file=routes.has(name)?path.join(root,routes.get(name)):path.resolve(root,'public','.'+name);
 if(!['GET','HEAD'].includes(req.method)||(!routes.has(name)&&!file.startsWith(path.join(root,'public')+path.sep))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('content-type',({'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'text/html');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await engines[engine].launch({headless:true}),results=[],errors=[];
let studio;
const store=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'composition-browser-'));
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  for(const name of ['composition-policy-browser','studio-renderer-browser']){
   await page.goto(origin+'/test/'+name+'.html');
   await page.waitForFunction(()=>document.documentElement.dataset.testResult,null,{timeout:15000});
   const result=await page.locator('#result').textContent();
   assert.equal(await page.locator('html').getAttribute('data-test-result'),'pass',result);
   results.push({engine,width,name,result});
  }
  await page.goto(origin+'/index.html#compositions');
  const demo=page.locator('#composition-policy-demo');await demo.waitFor();
  const field=demo.getByRole('textbox',{name:'First view name',exact:true});await field.evaluate(el=>{el.value='Original input';});await field.focus();
  await page.keyboard.press('End');await page.keyboard.type(' edited');
  // Do not steal focus for the policy edit: mimic an agent update arriving while typing.
  await demo.getByRole('combobox',{name:'Shared control group layout'}).evaluate(select=>{select.value='grid';select.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await field.inputValue(),'Original input edited');assert.equal(await field.evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Control+z');assert.equal(await field.inputValue(),'Original input');
  const summary=demo.locator('summary').first();await summary.focus();await page.keyboard.press('Space');
  assert.equal(await summary.evaluate(el=>el.parentElement.open),false);
  await page.keyboard.press('Enter');assert.equal(await summary.evaluate(el=>el.parentElement.open),true);
  assert.equal(await demo.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'No policy example overflow');
  results.push({engine,width,name:'catalogue-native-interaction',result:'PASS: real keyboard toggle, native Undo and focused edit survives policy change'});
  await context.close();
 }
 const service=createAuthoringService({directory:store,views:DEMO_VIEWS,writable:true});
 const node=(id,componentId,props={},slots={})=>({id,componentId,props,slots,tokens:{},bindings:{}});
 const model={schemaVersion:1,kind:'composition',name:'Layout browser fixture',target:{appId:'studio-demo',viewId:'review'},pack:'personal',mode:'dark',density:'compact',root:'group',tokens:{},nodes:{
  group:node('group','control-group',{}, {header:['heading'],body:['field']}),heading:node('heading','text',{label:'Editable group',role:'heading'}),field:node('field','text-input',{label:'Editable field'})}};
 service.dispatch({method:'document.command',args:{documentId:'layout',expectedRevision:0,operationId:'seed',command:{type:'create',document:model}}});
 studio=await startStudio({service,port:0});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.goto(studio.url+'#'+studio.token);
 const layout=page.locator('#composition-defaults-fields select[data-composition="control-group"]');await layout.waitFor();
 const preview=page.frameLocator('#preview');await preview.getByRole('textbox',{name:'Editable field'}).fill('Keep this Studio input');
 await layout.selectOption('grid');await page.getByRole('button',{name:'Apply shared layouts',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#composition-defaults-fields select[data-composition="control-group"]')?.value==='grid'&&!document.querySelector('#undo').disabled);
 assert.equal(service.dispatch({method:'document.read',args:{documentId:'layout'}}).document.compositionDefaults['control-group'].variant,'grid');
 assert.equal(await preview.getByRole('textbox',{name:'Editable field'}).inputValue(),'Keep this Studio input');
 await page.getByRole('button',{name:'Use source defaults',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#composition-defaults-fields select[data-composition="control-group"]')?.value==='inherit');
 assert.equal(service.dispatch({method:'document.read',args:{documentId:'layout'}}).document.compositionDefaults,undefined);
 await page.getByRole('button',{name:'Undo latest',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#composition-defaults-fields select[data-composition="control-group"]')?.value==='grid');
 assert.equal(service.dispatch({method:'document.read',args:{documentId:'layout'}}).document.compositionDefaults['control-group'].variant,'grid');
 results.push({engine,name:'studio-editor',result:'PASS: actual editor, command service, persistence, reset and undo'});
 assert.deepEqual(errors,[],'No browser page errors');
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
 fs.writeFileSync(path.join(root,'test-results','composition-'+engine+'.json'),JSON.stringify({browser:browser.version(),results},null,2)+'\n');
 console.log(JSON.stringify({browser:browser.version(),results},null,2));
}finally{await browser.close();if(studio)await studio.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(store,{recursive:true,force:true});}
