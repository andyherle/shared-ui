// Synthetic controls only. Semantic identities must not disappear in icon-only toolbars.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createServer} from 'node:http';
const {chromium}=await import(process.env.SHARED_UI_PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../public/v1/',import.meta.url);
const server=createServer(async(req,res)=>{try{const file=new URL(req.url.slice(1),root);if(!file.pathname.startsWith(root.pathname))throw Error('Invalid path');res.setHeader('Content-Type',file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/javascript');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 for(const pack of ['postvisual','personal'])for(const touch of [false,true]){
  const context=await browser.newContext({viewport:{width:900,height:800},hasTouch:touch,isMobile:touch});const page=await context.newPage();
  await page.setContent(`<html data-ui="${pack}"><head><base href="${origin}/"><link rel="stylesheet" href="${origin}/styles.css"></head><body><main style="width:300px;padding:12px"><div id="bar" class="ui-actions ui-fill"><button id="primary" data-ui-label="always">Components</button><button id="output">Output</button></div><button id="item" class="ui-item">Particle appearance</button><details class="ui-menu" open><summary>Options</summary><div class="ui-menu-panel"><button id="rename">Rename</button></div></details><input id="draft" value="Keep my draft"></main><script src="${origin}/runtime.js"></script></body></html>`);
  await page.waitForFunction(()=>Boolean(window.SharedUI?.observeActions));
  const result=await page.evaluate(async()=>{
   const UI=window.SharedUI,main=document.querySelector('main');for(const [id,icon] of [['primary','layers'],['output','output'],['item','folder'],['rename','notes']])UI.adoptAction(document.getElementById(id),{icon,label:document.getElementById(id).textContent,sprite:'/icons.svg'});
   const input=document.getElementById('draft');input.focus();input.setSelectionRange(2,5);
   const out=[];for(const mode of ['icons','above','beside'])for(const width of [180,300,500]){
    main.style.width=width+'px';UI.setActionLayout(main,mode);document.getElementById('primary').setAttribute('data-ui-compact','');UI.observeActions(document.getElementById('bar'));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const rows=['primary','item','rename'].map(id=>{const n=document.getElementById(id),label=n.querySelector('.ui-label');return {id,caption:getComputedStyle(label).display,label:label.textContent,compact:n.hasAttribute('data-ui-compact')};});out.push({mode,width,rows});
    if(document.activeElement!==input||input.value!=='Keep my draft'||input.selectionStart!==2)throw Error('Native draft/focus lost');
   }return out;
  });
  for(const sample of result)for(const row of sample.rows){assert.notEqual(row.caption,'none',JSON.stringify({pack,touch,...sample,row}));if(row.id==='primary')assert.equal(row.compact,false,'explicit label releases old compact mode');}
  await context.close();
 }
 console.log('Semantic captions: explicit labels, record identities and menu choices survive all action layouts, widths, both packs and touch without disturbing native drafts.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
