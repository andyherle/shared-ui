// Local source previews. Separate from immutable, brokered review acceptance.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';

export const APPS=[
 {id:'portal',name:'Portal',repo:'portal',route:'/fixture-login?mode=rich&next=%2F'},
 {id:'aura',name:'Aura',repo:'aura',route:'/studio'},
 {id:'staticref',name:'StaticRef',repo:'staticref',route:'/'},
 {id:'ledger',name:'Ledger · PV',repo:'pv-ledger',route:'/'},
 {id:'ledger-personal',name:'Ledger · Personal',repo:'pv-ledger',route:'/'},
 {id:'home',name:'Postvisual Home',repo:'postvisual-home',route:'/'},
 {id:'delivery',name:'Documents · PV',repo:'vault-store',route:'/#Documents'},
 {id:'delivery-personal',name:'Documents · Personal',repo:'vault-store',route:'/#Documents'}
];
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function requestPath(req){
 if(!req.url?.startsWith('/')||req.url.startsWith('//'))throw Error('Use an origin-relative request path');
 return decodeURIComponent(new URL(req.url,'http://local').pathname);
}
function localOrigin(value){
 const url=new URL(value);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password||url.href!==url.origin+'/')throw Error('Fixture must use an exact loopback HTTP origin');
 return url.origin;
}
const running=child=>child&&child.exitCode===null&&!child.signalCode&&!child.launchError;
export function injectSource(html,manifest){
 return html.replace(/<html\b([^>]*)>/i,(_,attrs)=>'<html'+attrs.replace(/\sdata-ui-(?:source|version|revision)=(?:"[^"]*"|'[^']*')/gi,'')+` data-ui-source="/__shared_ui_dev/assets/manifest.json" data-ui-version="${manifest.version}" data-ui-revision="${manifest.revision}">`)
 .replace(/(<link\b[^>]*\bdata-ui-baseline[^>]*)(>)/gi,(_,attrs,end)=>attrs.replace(/\s(?:integrity|crossorigin)=(?:"[^"]*"|'[^']*')/gi,'')+end)
 .replace(/<\/head>/i,'<script src="/__shared_ui_dev/live.js" defer></script></head>');
}
export async function freePort(){const server=http.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
export function createDevPreviews({root,startFixture}={}){
 const sessions=new Map(),pending=new Map(),clients=new Set(),children=new Set(),stopping=new Map();let directory,closed=false;
 const scratch=()=>directory??=fs.mkdtempSync(path.join(os.tmpdir(),'shared-ui-source-previews-'));
 const assets=path.join(root,'public/v1');
 function release(){const manifest=JSON.parse(fs.readFileSync(path.join(assets,'manifest.json')));return {...manifest,code:createHash('sha256').update(fs.readFileSync(path.join(assets,'runtime.js'))).update(fs.readFileSync(path.join(assets,'icons.svg'))).digest('hex')};}
 function send(res,value,status=200,type='application/json'){if(res.destroyed)return;if(res.headersSent){res.destroy();return;}res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(type==='application/json'&&!Buffer.isBuffer(value)?JSON.stringify(value):value);}
 function stopChild(processChild){
  if(!children.has(processChild)||!Number.isSafeInteger(processChild.pid))return Promise.resolve();
  if(stopping.has(processChild))return stopping.get(processChild);
  const stopped=new Promise(resolve=>{
   try{process.kill(-processChild.pid,'SIGTERM');}catch{resolve();return;}
   // Keep the deadline alive until owned descendants have been terminated.
   setTimeout(()=>{try{process.kill(-processChild.pid,'SIGKILL');}catch{}resolve();},2000);
  });stopping.set(processChild,stopped);return stopped;
 }
 function child(command,args,cwd,extra={}){
  if(closed)throw Error('Preview launcher closed');
  const log=fs.openSync(path.join(scratch(),`child-${children.size}.log`),'a');
  // Do not inherit application credentials or real backend configuration.
  const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','GOPATH','GOCACHE'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
  const processChild=spawn(command,args,{cwd,env:{...env,...extra,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore',log,log],detached:true});fs.closeSync(log);children.add(processChild);
  processChild.on('error',error=>{processChild.launchError=error.message;});return processChild;
 }
 async function fixture(app){
  const owned=new Set();
  const start=(...args)=>{const processChild=child(...args);owned.add(processChild);return processChild;};
  try{
  if(closed)throw Error('Preview launcher closed');
  const cwd=path.resolve(root,'..',app.repo);if(!fs.existsSync(cwd))throw Error(`Checkout missing: ${app.repo}`);
  const fixtureRoot=fs.mkdtempSync(path.join(scratch(),app.id+'-'));
  const port=await freePort();let processChild,origin=`http://127.0.0.1:${port}`;
  const python=fs.existsSync(path.join(cwd,'.venv/bin/python'))?path.join(cwd,'.venv/bin/python'):fs.existsSync('/opt/homebrew/bin/python3')?'/opt/homebrew/bin/python3':'python3';
  if(app.id==='portal'){
   const receipt=path.join(fixtureRoot,'portal.json');processChild=start('go',['test','./internal/web','-run','^TestPortalUIFixtureGallery$','-count=1','-timeout','0','-v'],cwd,{PORTAL_UI_FIXTURE:receipt,PORTAL_UI_FIXTURE_DEV:'1'});
   const deadline=Date.now()+120000;
   while(Date.now()<deadline){if(closed)throw Error('Preview launcher closed');if(!running(processChild))throw Error('Portal fixture failed to start; see local preview logs');if(fs.existsSync(receipt)){origin=localOrigin(JSON.parse(fs.readFileSync(receipt)).origin);break;}await new Promise(r=>setTimeout(r,100));}
   if(!fs.existsSync(receipt))throw Error('Portal fixture startup timed out');
  }else if(app.id==='aura'){
   // The actual Core host uses ROOT/.aura; isolate it from the user's Working state.
   const core=path.join(fixtureRoot,'aura');fs.mkdirSync(core,{recursive:true});
   for(const entry of ['control','mcp','runtime','shared','packages'])fs.cpSync(path.join(cwd,entry),path.join(core,entry),{recursive:true,filter:file=>!['node_modules','.aura','.aurafx'].includes(path.basename(file))});
   for(const entry of ['node_modules','mcp/node_modules'])if(fs.existsSync(path.join(cwd,entry)))fs.symlinkSync(path.join(cwd,entry),path.join(core,entry),'dir');
   processChild=start(process.execPath,['control/host.mjs'],core,{AURA_CONTROL_PORT:String(port),AURA_VIEWER_PORT:String(await freePort()),AURA_FX_HOME:path.join(fixtureRoot,'effects'),AURA_FX_PATHS:'',AURA_FX_MANAGED_BUILTINS:'0',AURA_LAUNCHER_PID:String(process.pid)});
  }else if(app.id==='staticref')processChild=start(python,['tests/browser/serve_canvas.py','--port',String(port)],cwd);
  else if(app.id.startsWith('ledger'))processChild=start(python,['-m','pvledger.server','--config',`config/${app.id==='ledger'?'pv':'personal'}.demo.json`,'--port',String(port)],cwd);
  else if(app.id==='home'){
   const inventory={schema:1,hostname:'Synthetic host',observed_at:new Date().toISOString(),warnings:[],routes:[],processes:[],services:[{id:'docker:staticref-staticref-1',name:'StaticRef',kind:'Container',description:'Synthetic reference library',pids:[100],ports:[{port:8081,protocol:'tcp',address:'127.0.0.1',kind:'published'}],urls:['http://example.invalid/'],state:'running'}]};
   fs.writeFileSync(path.join(fixtureRoot,'home-inventory.json'),JSON.stringify(inventory));
   processChild=start(python,['server.py','--port',String(port),'--state',path.join(fixtureRoot,'home-state'),'--inventory',path.join(fixtureRoot,'home-inventory.json')],cwd);
  }else {
   // Build only synthetic browser output; never generate/install NAS configuration.
   await new Promise((resolve,reject)=>{const build=start(python,['-c',"from deploy.make_config import build, ROOT; [build(s,ROOT/'build/browser'/s) for s in ('pv','personal')]"],cwd);const timer=setTimeout(()=>{stopChild(build);reject(Error('Documents browser build timed out'));},120000);build.once('error',error=>{clearTimeout(timer);reject(error);});build.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Documents browser build failed'));});});
   processChild=start(python,['tests/test_browser_fixture.py','--scope',app.id==='delivery'?'pv':'personal','--port',String(port)],cwd);
  }
  const deadline=Date.now()+120000;
  while(Date.now()<deadline){
   if(closed)throw Error('Preview launcher closed');
   if(!running(processChild))throw Error(`${app.name} fixture failed to start; see local preview logs`);
   try{const response=await fetch(origin+app.route.split('#')[0],{signal:AbortSignal.timeout(1000),redirect:'manual'});await response.body?.cancel();if(response.status>=200&&response.status<400)return {origin,processChild};}catch{}
   await new Promise(r=>setTimeout(r,100));
  }
  throw Error(`${app.name} fixture startup timed out`);
  }catch(error){for(const processChild of owned)stopChild(processChild);throw error;}
 }
 function local(req){const host=`127.0.0.1:${req.socket.localPort}`;return req.headers.host===host&&(!req.headers.origin||req.headers.origin===`http://${host}`)&&req.headers['sec-fetch-site']!=='cross-site'&&(!['POST','PUT','PATCH','DELETE'].includes(req.method)||req.headers['sec-fetch-site']!=='same-site'||req.headers.origin===`http://${host}`);}
 function serveSource(req,res,pathname){
  if(pathname==='/__shared_ui_dev/live.js'){send(res,liveScript,200,'text/javascript');return true;}
  if(pathname==='/__shared_ui_dev/events'){
   if(req.method==='HEAD'){send(res,'Use GET for events',405,'text/plain');return true;}
   if(clients.size>=64){send(res,'Too many preview streams',503,'text/plain');return true;}
   const data=JSON.stringify(release());res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.write('data: '+data+'\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return true;
  }
  const match=/^\/(?:__shared_ui_dev\/assets|assets\/shared-ui|gui\/shared-ui|static\/shared-ui|shared-ui|ui\/shared-ui)\/(styles(?:\.[a-f0-9]{64})?\.css|runtime\.js|icons\.svg|manifest\.json)$/.exec(pathname);
  if(!match)return false;
  const name=match[1],file=path.join(assets,name);let bytes;
  try{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||!fs.realpathSync(file).startsWith(fs.realpathSync(assets)+path.sep))throw Error('Unsafe asset');bytes=fs.readFileSync(file);}catch{send(res,'Missing asset',404,'text/plain');return true;}
  send(res,bytes,200,name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':name.endsWith('.svg')?'image/svg+xml':'application/json');return true;
 }
 async function launch(app){
  if(closed)throw Error('Preview launcher closed');
  app=APPS.find(item=>item.id===app?.id);if(!app)throw Error('Unknown preview app');
  const existing=sessions.get(app.id);if(existing&&running(existing.processChild))return existing;if(existing){existing.proxy.closeAllConnections();existing.proxy.close();stopChild(existing.processChild);sessions.delete(app.id);}
  if(pending.has(app.id))return pending.get(app.id);
  const promise=(async()=>{
   const target=await (startFixture||fixture)(app);if(closed){stopChild(target.processChild);throw Error('Preview launcher closed');}target.origin=localOrigin(target.origin);const proxy=http.createServer((req,res)=>{
    if(!local(req)){send(res,'Local preview only',403,'text/plain');return;}
    let pathname;try{pathname=requestPath(req);}catch{send(res,'Invalid request path',400,'text/plain');return;}
    if(pathname==='/sw.js'){send(res,'Service workers disabled in source previews',404,'text/plain');return;}
    if(['GET','HEAD'].includes(req.method)){try{if(serveSource(req,res,pathname))return;}catch{send(res,'Source assets unavailable; retry after a successful build',503,'text/plain');return;}}
    const headers={...req.headers,host:new URL(target.origin).host,'accept-encoding':'identity','sec-fetch-site':'same-origin'};delete headers.connection;
    if(headers.origin)headers.origin=target.origin;
    if(headers.referer)headers.referer=target.origin+'/';
    const upstream=http.request(target.origin+req.url,{method:req.method,headers},incoming=>{
     incoming.on('error',()=>res.destroy());
     const output={...incoming.headers,'cache-control':'no-store'};delete output.etag;
     if(output.location===target.origin||output.location?.startsWith(target.origin+'/'))output.location=output.location.slice(target.origin.length)||'/';
     if(/text\/html/.test(output['content-type']||'')&&req.method!=='HEAD'){
      if(output['content-encoding']&&output['content-encoding']!=='identity'){incoming.resume();send(res,'Fixture must serve uncompressed HTML for source previews',502,'text/plain');return;}
      delete output['content-length'];
      const chunks=[];let size=0;incoming.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){incoming.destroy();res.destroy();}else chunks.push(chunk);});
      incoming.on('end',()=>{try{const html=injectSource(Buffer.concat(chunks).toString(),release());res.writeHead(incoming.statusCode,output);res.end(html);}catch{send(res,'Source assets unavailable; retry after a successful build',503,'text/plain');}});
     }else{res.writeHead(incoming.statusCode,output);incoming.pipe(res);}
    });upstream.on('error',()=>{if(!res.headersSent)send(res,'Preview stopped. Open it again from App previews.',502,'text/plain');else res.destroy();});
    upstream.setTimeout(30000,()=>upstream.destroy(Error('Preview upstream timed out')));
    req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
   });proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
   if(closed){proxy.closeAllConnections();proxy.close();stopChild(target.processChild);throw Error('Preview launcher closed');}
   const session={...target,proxy,url:`http://127.0.0.1:${proxy.address().port}${app.route}`};sessions.set(app.id,session);return session;
  })();pending.set(app.id,promise);try{return await promise;}finally{pending.delete(app.id);}
 }
 function handle(req,res){
  let pathname;try{pathname=requestPath(req);}catch{send(res,'Invalid request path',400,'text/plain');return true;}if(!pathname.startsWith('/previews'))return false;
  if(!local(req)){send(res,'Local preview only',403,'text/plain');return true;}
  if(pathname==='/previews'&&req.method==='GET'){
   const icons={portal:'inbox',aura:'layers',staticref:'image',ledger:'chart','ledger-personal':'chart',home:'home',delivery:'file','delivery-personal':'file'};
   const rows=APPS.map(app=>`<form method="post" action="/previews/${app.id}/open" target="_blank"><button class="ui-action ui-app-tile" data-ui-variant="quiet" aria-label="Open ${app.name}"><span class="ui-card ui-app-symbol"><svg class="ui-icon" aria-hidden="true"><use href="/v1/icons.svg#ui-${icons[app.id]}"/></svg></span><span class="ui-label">${app.name}</span></button></form>`).join('');
   send(res,`<!doctype html><html lang="en" data-ui="personal"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>App previews · Shared UI</title><link rel="stylesheet" href="/v1/styles.css" data-ui-baseline><script src="/v1/runtime.js" defer></script><style>@layer app {.preview-page{max-inline-size:52rem;margin-inline:auto}.preview-apps{--ui-grid-min:9rem;gap:calc(2*var(--ui-gap))}}</style><main class="preview-page ui-stack ui-pad"><header><h1>App previews</h1><p>Latest shared-ui source · synthetic app data</p><a href="/" class="ui-action" data-ui-icon="arrow-left"><span class="ui-label">Style Lab</span></a></header><p>Open an app once. Shared CSS refreshes as you edit; runtime changes offer Reload shared UI. Your app’s installed bundle stays unchanged.</p><nav class="preview-apps ui-grid" aria-label="App previews">${rows}</nav></main></html>`,200,'text/html');return true;
  }
  const app=APPS.find(app=>pathname===`/previews/${app.id}/open`);
  if(!app||req.method!=='POST'){send(res,'Not found',404,'text/plain');return true;}
  launch(app).then(session=>{if(!res.destroyed){res.writeHead(303,{Location:session.url,'Cache-Control':'no-store'});res.end();}}).catch(error=>send(res,escape(error.message)+(directory?'\nLocal logs: '+directory:''),503,'text/plain'));return true;
 }
 const heartbeat=setInterval(()=>{for(const client of clients)client.write(': alive\n\n');},25000);heartbeat.unref();
 return {handle,launch,changed(){if(!closed)for(const client of clients)client.write('data: '+JSON.stringify(release())+'\n\n');},close(){closed=true;clearInterval(heartbeat);for(const client of clients)client.end();clients.clear();for(const session of sessions.values()){session.proxy.closeAllConnections();session.proxy.close();}sessions.clear();return Promise.all([...children].map(stopChild));},get logDirectory(){return directory;}};
}
const liveScript=String.raw`(()=>{
 let stream,code,revision;const ui=window.SharedUI;
 const note=document.createElement('aside');note.className='ui-notice ui-pad ui-actions';note.setAttribute('aria-label','Shared UI source preview');
 const label=document.createElement('span');label.textContent='Shared UI · live source';note.append(label);
 const reload=document.createElement('button');reload.hidden=true;reload.textContent='Reload shared UI';reload.addEventListener('click',()=>location.reload());note.append(reload);
 document.body.prepend(note);ui?.adoptAction(reload,{icon:'refresh',label:'Reload shared UI',sprite:'/__shared_ui_dev/assets/icons.svg'});
 async function update(event){const next=JSON.parse(event.data);if(code&&code!==next.code){reload.hidden=false;label.textContent='Shared UI changed · reload when ready';}code??=next.code;if(revision!==next.revision){await ui?.instance?.refresh();revision=next.revision;}}
 function connect(){if(document.hidden||stream)return;stream=new EventSource('/__shared_ui_dev/events');stream.onmessage=update;}
 function disconnect(){stream?.close();stream=null;}
 document.addEventListener('visibilitychange',()=>document.hidden?disconnect():connect());window.addEventListener('pagehide',disconnect);window.addEventListener('pageshow',connect);connect();
})();`;
