#!/usr/bin/env node
/* OPT-IN genuine Chromium review of the shared Style Lab fixture. This file
 * NEVER starts the app server, alters a consumer or touches a production URL.
 * Browser is headless by default; --headed is optional for local observation.
 * Source CI does not install Playwright or execute this browser test. */
import assert from 'node:assert/strict';

const url=process.env.SHARED_UI_FLOATING_ORIGIN;
if(!url||!/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/.test(url)||
  process.argv.slice(2).some(arg=>arg!=='--headed'))
  throw new Error('Use the separately authorized 127.0.0.1 Style Lab origin and optional --headed; do not start a server here');
const headed=process.argv.includes('--headed');
let chromium;
try{({chromium}=await import('playwright'));}
catch{throw new Error('Vetted offline Playwright/Chromium missing; browser assertions were NOT run');}
const browser=await chromium.launch({headless:!headed,slowMo:headed?85:0});
const pass=name=>process.stdout.write('PASS '+name+'\n');
const panelBounds=async panel=>{
  const p=await panel.boundingBox();assert.ok(p,'Panel did not render');
  return p;
};
const bounded=(rect,width,height)=>{
  assert.ok(rect.x>=-1&&rect.y>=-1,'Floating panel is above/off left visible screen');
  assert.ok(rect.x+rect.width<=width+1,'Floating panel escaped screen horizontally');
  assert.ok(rect.y+rect.height<=height+1,'Floating panel escaped screen vertically');
};
try{
  for(const [width,height] of [[1440,900],[768,1024],[390,844],[280,650]]){
    const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',
      permissions:[],acceptDownloads:false});
    await context.route('**/*',route=>{
      if(new URL(route.request().url()).origin!==url)return route.abort('blockedbyclient');
      return route.continue();
    });
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url+'/#floating-review',{waitUntil:'domcontentloaded'});
    const panel=page.locator('#floating-review-panel');
    const handle=panel.locator('.ui-floating-handle');
    await handle.waitFor();
    let rect=await panelBounds(panel);bounded(rect,width,height);
    assert.equal(await panel.locator('.ui-floating-name').textContent(),'Fixture review');
    assert.match(await panel.locator('.ui-floating-variant').textContent(),/Local candidate shared-ui/);
    assert.match(await panel.locator('.ui-floating-deployment').textContent(),/NOT deployed/);
    pass('actual local candidate and not-deployed human labels '+width+'x'+height);
    // Existing nested native input/button must keep working without drag.
    await panel.locator('details#floating-demo-tools > summary').click();
    await panel.locator('#floating-demo-input').fill('Retain native selection / 東京');
    await panel.locator('#floating-demo-action').click();
    assert.match(await panel.locator('#floating-demo-result').textContent(),/Retain native selection/);
    await panel.locator('#floating-demo-input').focus();
    await page.keyboard.press('ControlOrMeta+A');
    const focused=await page.evaluate(()=>document.activeElement?.id);
    assert.equal(focused,'floating-demo-input');
    pass('original native input and button focus/caret unaffected '+width+'x'+height);
    rect=await panelBounds(panel);bounded(rect,width,height);
    // Dedicated move handle uses actual Chromium mouse capture.
    let position=rect;
    const grip=await handle.boundingBox();assert.ok(grip);
    await page.mouse.move(grip.x+Math.min(25,grip.width/2),grip.y+grip.height/2);
    await page.mouse.down();
    await page.mouse.move(2,4,{steps:8});
    await page.mouse.up();
    rect=await panelBounds(panel);bounded(rect,width,height);
    assert.ok(rect.x<position.x||rect.y<position.y||width<=280);
    assert.equal(await handle.getAttribute('data-ui-dragging'),null);
    pass('mouse pointer capture and viewport clamping '+width+'x'+height);
    await handle.focus();await page.keyboard.press('ArrowRight');
    let next=await panelBounds(panel);bounded(next,width,height);
    assert.ok(next.x>=rect.x);
    await page.keyboard.press('Home');
    rect=await panelBounds(panel);bounded(rect,width,height);
    await handle.focus();await page.keyboard.press('ArrowLeft');
    await panel.locator('.ui-floating-reset').click();
    next=await panelBounds(panel);bounded(next,width,height);
    assert.ok(Math.abs(rect.x-next.x)<=1);
    pass('arrow/Home/Reset accessible repositioning '+width+'x'+height);
    // Explicit health provenance is distinct from a claim of live production.
    const values=await panel.evaluate(element=>{
      const ui=window.SharedUI;
      const controller=ui.createFloatingPanel(element);
      controller.setProvenance({
        variant:'installed',appName:'StaticRef',appVersion:'fixture',
        uiVersion:'1.10.2',appSha:'a'.repeat(40),
        uiSha:'b'.repeat(40),deploymentState:'not-deployed'
      });
      return {variant:element.querySelector('.ui-floating-variant').textContent,
        deployment:element.querySelector('.ui-floating-deployment').textContent,
        details:element.querySelector('.ui-floating-provenance').textContent};
    });
    assert.match(values.variant,/Installed baseline/);
    assert.match(values.deployment,/NOT live production/);
    assert.match(values.details,/aaaaaaaa/);
    pass('explicit installed CODE baseline never mislabeled as live '+width+'x'+height);
    assert.deepEqual(errors,[],'Browser generated console page errors');
    await context.close();
  }
  // Chromium CDP touch pointer path: touch-action:none belongs ONLY to handle.
  const context=await browser.newContext({viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,serviceWorkers:'block',permissions:[]});
  await context.route('**/*',route=>new URL(route.request().url()).origin===url?
    route.continue():route.abort('blockedbyclient'));
  const page=await context.newPage();
  await page.goto(url+'/#floating-review',{waitUntil:'domcontentloaded'});
  const panel=page.locator('#floating-review-panel'),handle=panel.locator('.ui-floating-handle');
  await handle.waitFor();
  const old=await panelBounds(panel),grip=await handle.boundingBox();assert.ok(grip);
  const x=grip.x+Math.min(20,grip.width/2),y=grip.y+grip.height/2;
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-55,y:y-70}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const now=await panelBounds(panel);bounded(now,390,844);
  assert.ok(now.x<old.x||now.y<old.y,'Real touch drag did not move floating panel');
  pass('real Chromium touch capture and bounds');
  await context.close();
  process.stdout.write('FINISHED · headless='+String(!headed)+' · native macOS Safari/IME user verification is SEPARATE\n');
}finally{await browser.close();}
