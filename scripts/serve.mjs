import http from 'node:http';
import {createDevPreviews} from './dev-previews.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {buildSite} from './build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=path.join(root,'public');
export function createStyleLabServer({watch=true,previews=false}={}){
 const dev=previews?createDevPreviews({root}):null;
 const clients=new Set(),cache=new Map();let debounce=null,building=false;const changes=new Set();
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 function build(kind='styles'){
  if(building)return;building=true;
  try{buildSite(root);cache.clear();const manifest=JSON.parse(fs.readFileSync(path.join(publicRoot,'v1/manifest.json'),'utf8'));const data={...manifest,kind,labRevision:hash(fs.readFileSync(path.join(publicRoot,'lab.css')))};for(const response of clients)response.write('data: '+JSON.stringify(data)+'\n\n');dev?.changed();return data;
  }finally{building=false;}
 }
 const server=http.createServer((request,response)=>{
  if(dev?.handle(request,response))return;
  response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Access-Control-Allow-Origin','*');
  response.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' https://andyherle.github.io; script-src 'self'; connect-src 'self' https://andyherle.github.io; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'");
  let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://style-lab.local').pathname);}catch{response.writeHead(400);return response.end();}
  if(pathname==='/refresh'&&request.method==='POST'){
   if(request.headers['x-ui-lab']!=='refresh'){response.writeHead(403);return response.end();}
   if(request.headers.origin){try{if(new URL(request.headers.origin).host!==request.headers.host){response.writeHead(403);return response.end();}}catch{response.writeHead(403);return response.end();}}
   try{response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');return response.end(JSON.stringify(build()));}catch{response.writeHead(500);return response.end(JSON.stringify({error:'Build failed; last working styles retained'}));}
  }
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);return response.end();}
  if(pathname==='/health'){response.setHeader('Content-Type','application/json');return response.end(JSON.stringify({ok:true,service:'shared-ui',sourcePreviews:previews,sourceRoot:previews?root:undefined,revision:JSON.parse(fs.readFileSync(path.join(publicRoot,'v1/manifest.json'),'utf8')).revision,viewers:clients.size}));}
  if(pathname==='/events'){
   if(request.method==='HEAD'){response.writeHead(405);return response.end();}
   if(clients.size>=64){response.writeHead(503);return response.end();}
   response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});response.write('retry: 1500\n: connected\n\n');clients.add(response);request.on('close',()=>clients.delete(response));return;
  }
  const relative=pathname==='/'?'index.html':pathname.slice(1);
  if(!/^(?:index\.html|lab\.(?:css|js)|v1\/(?:manifest\.json|runtime\.js|icons\.svg|floating-panel\.fixture\.css|styles(?:\.[a-f0-9]{64})?\.css)|assets\/[a-z0-9-]+\.(?:svg|wav|mp4))$/.test(relative)){response.writeHead(404);return response.end();}
  const file=path.join(publicRoot,relative);let stat;try{stat=fs.statSync(file);if(!stat.isFile()||!fs.realpathSync(file).startsWith(fs.realpathSync(publicRoot)+path.sep))throw new Error();}catch{response.writeHead(404);return response.end();}
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wav':'audio/wav','.mp4':'video/mp4'}[path.extname(file)];response.setHeader('Content-Type',mime);
  response.setHeader('Cache-Control',/styles\.[a-f0-9]{64}\.css$/.test(file)?'public, max-age=31536000, immutable':'no-cache');
  if(request.headers.range&&['.mp4','.wav'].includes(path.extname(file))){
   const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);let start=0,end=stat.size-1;
   if(match){if(!match[1])start=Math.max(0,stat.size-Number(match[2]));else start=Number(match[1]);if(match[1]&&match[2])end=Math.min(end,Number(match[2]));}
   if(!match||start<0||end<start||start>=stat.size){response.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return response.end();}
   response.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});if(request.method==='HEAD')return response.end();return fs.createReadStream(file,{start,end}).pipe(response);
  }
  if(['.mp4','.wav'].includes(path.extname(file))){response.setHeader('Content-Length',stat.size);response.setHeader('Accept-Ranges','bytes');if(request.method==='HEAD')return response.end();return fs.createReadStream(file).pipe(response);}
  let asset=cache.get(file);if(!asset||asset.mtime!==stat.mtimeMs){let bytes=fs.readFileSync(file);if(dev&&relative==='index.html')bytes=Buffer.from(bytes.toString().replace('<span id="live-status"', '<a class="ui-action" href="/previews" data-ui-icon="play"><span class="ui-label">App previews</span></a><span id="live-status"'));asset={mtime:stat.mtimeMs,bytes,gzip:gzipSync(bytes),etag:'"'+hash(bytes)+'"'};cache.set(file,asset);}
  response.setHeader('ETag',asset.etag);response.setHeader('Vary','Accept-Encoding');if(request.headers['if-none-match']===asset.etag){response.writeHead(304);return response.end();}
  const compressed=/\bgzip\b/.test(request.headers['accept-encoding']||'');const bytes=compressed?asset.gzip:asset.bytes;if(compressed)response.setHeader('Content-Encoding','gzip');response.setHeader('Content-Length',bytes.length);
  if(request.method==='HEAD')return response.end();response.end(bytes);
 });
 const heartbeat=setInterval(()=>{for(const response of clients)response.write(': alive\n\n');},25000);heartbeat.unref();
 let watcher=null;if(watch)watcher=fs.watch(path.join(root,'src'),{recursive:true},(_,file)=>{clearTimeout(debounce);changes.add(String(file));debounce=setTimeout(()=>{const kind=[...changes].some(name=>/\.js$|\.html$/.test(name))?'code':changes.has('lab.css')?'layout':'styles';changes.clear();try{build(kind);}catch(error){process.stderr.write('Style build failed: '+error.message+'\n');}},100);});
 let shutdown;
 const cleanup=()=>shutdown??=(()=>{clearInterval(heartbeat);clearTimeout(debounce);watcher?.close();for(const response of clients)response.end();clients.clear();return dev?.close()||Promise.resolve();})();
 // End long-lived streams and stop children before waiting for HTTP close.
 const close=server.close;
 server.close=function(callback){const stopped=cleanup();return close.call(this,error=>{stopped.then(()=>callback?.(error));});};
 server.on('close',cleanup);
 server.requestTimeout=15000;server.headersTimeout=10000;
 return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.SHARED_UI_PORT||41910),host='127.0.0.1';
 buildSite(root);
 const server=createStyleLabServer();server.listen(port,host,()=>console.log(`Style Lab: http://${host}:${port}/`));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1000).unref();});
}
