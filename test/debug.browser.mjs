// Optional browser acceptance. Install Playwright in the test environment, not the consumer bundle.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../scripts/build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');buildSite(root);
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'public','.'+name);
 if(!file.startsWith(path.join(root,'public')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('content-type',({'.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/html');res.end(fs.readFileSync(file));
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/debug.html');await page.waitForSelector('.ui-debug-grid dd');
 const first=page.locator('[data-ui-component=debug]').first();assert.equal(await page.locator('[data-ui-component=debug]').count(),2);
 for(const pack of ['postvisual','personal'])for(const theme of ['dark','light']){
  await page.selectOption('#debug-pack',pack);await page.selectOption('#debug-theme',theme);
  for(const width of [1600,1024,390]){
   await page.setViewportSize({width,height:1100});await page.waitForTimeout(80);
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,plots:[...document.querySelectorAll('.ui-debug-plot')].filter(n=>n.getBoundingClientRect().width).map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}))}));
   assert.equal(layout.overflow,false,JSON.stringify({pack,theme,width,layout}));assert(layout.plots.every(p=>p.w>0&&p.h>0));
  }
 }
 await page.setViewportSize({width:1600,height:1100});await page.selectOption('#debug-pack','postvisual');await page.selectOption('#debug-theme','dark');
 const view=first.locator('select[aria-label="Debug view"]');
 for(const mode of ['overview','scope','lanes','metrics','program','raw','overwhelm']){await view.selectOption(mode);await page.waitForTimeout(40);assert.equal(await first.getAttribute('data-debug-view'),mode);}
 const frozen=await first.locator('.ui-debug-sample').textContent();await first.getByRole('button',{name:'Freeze',exact:true}).click();await page.click('#debug-advance');await page.waitForTimeout(80);
 assert.equal((await first.locator('.ui-debug-sample').textContent()).replace('FROZEN · ',''),frozen);
 assert.notEqual(await page.locator('[data-debug-example]').nth(1).locator('.ui-debug-sample').textContent(),frozen);
 await first.getByRole('button',{name:'Resume',exact:true}).click();
 const search=first.locator('input[type=search]');await search.fill('channel_000');await page.click('#debug-advance');await search.focus();await page.waitForTimeout(50);assert.equal(await first.locator('.ui-debug-grid dd').count(),1);
 await search.fill('');await view.selectOption('scope');await first.locator('canvas').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(70);assert.match(await first.locator('.ui-debug-readout').textContent(),/Nearest supplied/);
 const hosted=await page.evaluate(()=>{
  const host=document.createElement('header'),other=document.createElement('input');other.value='Keep this draft';host.append(other);document.body.append(host);
  const panel=SharedUI.createDebugPanel({controlsHost:host});document.body.append(panel.element);
  const search=host.querySelector('input[type=search]');search.value='native draft';panel.setVisible(false);
  if(!host.querySelector('.ui-debug').hidden||other.hidden)throw Error('Hosted control visibility escaped its owner');
  panel.setVisible(true);panel.setView('raw');if(host.querySelector('input[type=search]')!==search||search.value!=='native draft')throw Error('Hosted controls were replaced');
  panel.destroy();const retained=host.children.length===1&&host.firstElementChild===other&&other.value==='Keep this draft';host.remove();return retained;
 });assert.equal(hosted,true);
 const lifecycle=await page.evaluate(async()=>{
  const panel=SharedUI.createDebugPanel();document.body.append(panel.element);
  let receive,resolve,unsub=0,deleted=0,updates=0;
  panel.connect({subscribe:fn=>{receive=fn;return()=>unsub++;},snapshot:()=>new Promise(r=>resolve=r)});
  receive({version:1,epoch:'new',cursor:9});resolve({version:1,epoch:'old',cursor:1});await Promise.resolve();await Promise.resolve();
  if(panel.getState().cursor!==9)throw Error('Stale snapshot replaced subscription');
  const unregister=panel.registerView({id:'custom',mount:root=>{root.textContent='Custom diagnostic view';return {update:()=>updates++,destroy:()=>deleted++};}});
  panel.setView('custom');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));unregister();
  panel.setVisible(false);panel.update({version:1,cursor:50});panel.destroy();receive({version:1,cursor:60});
  return {unsub,deleted,updates,connected:panel.element.isConnected};
 });assert.equal(lifecycle.unsub,1);assert.equal(lifecycle.deleted,1);assert(lifecycle.updates>0);assert.equal(lifecycle.connected,false);
 await view.selectOption('overwhelm');await page.waitForTimeout(100);
 fs.mkdirSync(path.join(root,'docs/images'),{recursive:true});await first.screenshot({path:path.join(root,'docs/images/debug-console.jpg'),type:'jpeg',quality:90});
 assert.deepEqual(errors,[]);console.log('Debug browser: 12 pack/theme/width cases, 7 views, real data filtering, independent freeze, keyboard inspection, async adapter ordering, extension cleanup and two-host isolation passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
