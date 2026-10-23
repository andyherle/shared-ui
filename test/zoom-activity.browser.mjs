import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
const {chromium}=await import(process.env.STATICREF_PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../public/v1/',import.meta.url),assets=new Set(['runtime.js','styles.css','icons.svg']);
const server=createServer(async(req,res)=>{try{
 if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html data-ui="postvisual" data-theme="dark"><link rel="stylesheet" href="/styles.css"><script src="/runtime.js"></script><body><button id="focusStart">Start</button><nav id="commands"><button>Text</button><button>Media</button></nav><script>let percent=100;window.zoomControl=SharedUI.createZoomFeedback(document,{sprite:'/icons.svg'});zoomControl.show(percent);const apply=direction=>{percent=direction?percent+direction*10:100;zoomControl.show(percent);};document.addEventListener('ui:zoom',e=>apply(e.detail.direction));SharedUI.installZoomShortcuts(document,{canZoom:()=>true,onZoom:apply});for(const b of document.querySelectorAll('#commands button'))SharedUI.adoptAction(b,{label:b.textContent,icon:b.textContent==='Text'?'edit':'image',sprite:'/icons.svg'});window.dock=SharedUI.createContextToolbar(document.querySelector('#commands'),{zoom:zoomControl.element});</script></body></html>`);return;}
 const name=req.url.slice(1);if(!assets.has(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'image/svg+xml');res.end(await readFile(new URL(name,root)));
 }catch(e){res.writeHead(500);res.end(e.message);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.STATICREF_CHROMIUM?{executablePath:process.env.STATICREF_CHROMIUM}:{})});
try{
 for(const pack of ['postvisual','personal'])for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.evaluate(pack=>document.documentElement.dataset.ui=pack,pack);await page.mouse.move(0,0);
  const zoom=page.locator('.ui-zoom-feedback'),opacity=()=>zoom.evaluate(el=>getComputedStyle(el).opacity),geometry=()=>page.locator('#commands').boundingBox();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ui-zoom-feedback')).opacity==='0');const before=await geometry();
  await zoom.hover();assert.equal(await opacity(),'1');await page.mouse.move(0,0);assert.equal(await opacity(),'0');
  await page.locator('[data-ui-zoom=in]').focus();assert.equal(await opacity(),'1');await page.keyboard.press('Enter');
  await page.locator('#focusStart').focus();assert.equal(await opacity(),'1');assert.equal(await page.locator('[data-ui-zoom=value]').innerText(),'110%');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ui-zoom-feedback')).opacity==='0');assert.deepEqual(await geometry(),before,'Activity must not move other controls');
  await page.keyboard.press('Meta+ArrowUp');assert.equal(await opacity(),'1');assert.equal(await page.locator('[data-ui-zoom=value]').innerText(),'120%');
  await page.evaluate(()=>zoomControl.setVisible(false));assert.equal(await zoom.isVisible(),false);await page.evaluate(()=>zoomControl.setVisible(true));assert.equal(await opacity(),'0');
  const other=await context.newPage();await other.goto(origin);await other.mouse.move(0,0);assert.equal(await other.locator('.ui-zoom-feedback').evaluate(el=>getComputedStyle(el).opacity),'0');
  await page.evaluate(()=>zoomControl.show(130));assert.equal(await opacity(),'1');assert.equal(await other.locator('.ui-zoom-feedback').evaluate(el=>getComputedStyle(el).opacity),'0');
  assert.deepEqual(errors,[]);await context.close();console.log(pack+'/'+width+': idle/hover/focus/shortcut/activity/layout/two-view passed');
 }
 const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await touch.newPage();await page.goto(origin);assert.equal(await page.locator('.ui-zoom-feedback').evaluate(el=>getComputedStyle(el).opacity),'1','Touch retains discoverable controls');await touch.close();
 console.log('PASS shared transient zoom; touch remains visible');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
