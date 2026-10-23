#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {createStyleLabServer} from './serve.mjs';
import {buildSite} from './build.mjs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const port=Number(process.env.SHARED_UI_PORT||41911),url=`http://127.0.0.1:${port}`;
const open=()=>{if(process.argv.includes('--no-open'))return;const command=process.platform==='darwin'?'open':process.platform==='win32'?'explorer':'xdg-open';const child=spawn(command,[url+'/previews'],{stdio:'ignore'});child.on('error',()=>console.log('Open '+url+'/previews'));};
let health;try{health=await fetch(url+'/health',{signal:AbortSignal.timeout(1000)}).then(r=>r.json());}catch{}
if(health){if(!health.sourcePreviews||health.sourceRoot!==root)throw Error(`Port ${port} belongs to another preview. Stop it or choose SHARED_UI_PORT.`);open();console.log('App previews: '+url+'/previews');}
else {buildSite(root);const server=createStyleLabServer({previews:true});server.listen(port,'127.0.0.1',()=>{console.log('Style Lab: '+url+'\nApp previews: '+url+'/previews');open();});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.closeAllConnections();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();});}
