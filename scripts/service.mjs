/* Local macOS host. Owns only this labelled LaunchAgent. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawnSync} from 'node:child_process';
import {buildSite} from './build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const label='com.andyherle.shared-ui-style-lab',domain=`gui/${process.getuid()}`,job=`${domain}/${label}`;
const plist=path.join(os.homedir(),'Library/LaunchAgents',label+'.plist'),state=path.join(os.homedir(),'Library/Application Support/Background Services/Shared UI Style Lab');
const hosted=path.join(state,'site');
function copyChanged(source,target){
 const info=fs.statSync(source);
 if(info.isDirectory()){fs.mkdirSync(target,{recursive:true});for(const name of fs.readdirSync(source))copyChanged(path.join(source,name),path.join(target,name));return;}
 const bytes=fs.readFileSync(source);if(fs.existsSync(target)&&bytes.equals(fs.readFileSync(target)))return;
 const temporary=target+'.'+process.pid+'.tmp';fs.writeFileSync(temporary,bytes);fs.renameSync(temporary,target);
}
function sync(){
 buildSite(root);
 fs.mkdirSync(hosted,{recursive:true});
 for(const name of ['package.json','src','public','scripts'])copyChanged(path.join(root,name),path.join(hosted,name));
}
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const run=(args,allowed=false)=>{const result=spawnSync('/bin/launchctl',args,{encoding:'utf8'});if(result.status!==0&&!allowed)throw new Error((result.stderr||result.stdout).trim());return result;};
const loaded=()=>run(['print',job],true).status===0;
const port=Number(process.env.SHARED_UI_PORT||41910);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose an unprivileged port between 1024 and 65535');
const stableNode=['/opt/homebrew/bin/node','/usr/local/bin/node'].find(file=>fs.existsSync(file)&&fs.realpathSync(file)===fs.realpathSync(process.execPath))||process.execPath;
const content=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${escape(stableNode)}</string><string>${escape(path.join(hosted,'scripts/serve.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${escape(state)}</string>
<key>EnvironmentVariables</key><dict><key>SHARED_UI_PORT</key><string>${port}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
<key>ProcessType</key><string>Background</string>
<key>StandardOutPath</key><string>${escape(path.join(state,'server.log'))}</string>
<key>StandardErrorPath</key><string>${escape(path.join(state,'error.log'))}</string>
</dict></plist>\n`;
if(process.platform!=='darwin')throw new Error('The managed host requires macOS. Use npm start on other systems.');
const action=process.argv[2]||'status';
if(action==='start'||action==='restart'){
 sync();
 fs.mkdirSync(path.dirname(plist),{recursive:true});fs.mkdirSync(state,{recursive:true});
 const changed=!fs.existsSync(plist)||fs.readFileSync(plist,'utf8')!==content;
 if(loaded()&&changed){
  run(['bootout',job]);
  for(let attempt=0;attempt<50&&loaded();attempt++)await delay(100);
  if(loaded())throw new Error('Previous lab service is still stopping. Retry start shortly.');
 }
 if(changed)fs.writeFileSync(plist,content);
 if(!loaded())run(['bootstrap',domain,plist]);
 else run(action==='restart'?['kickstart','-k',job]:['kickstart',job]);
 let ready=false;
 for(let attempt=0;attempt<50&&!ready;attempt++){
  try{const response=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(500)});ready=response.ok&&(await response.json()).service==='shared-ui';}catch{}
  if(!ready)await delay(100);
 }
 if(!ready)throw new Error('Lab service started but is not serving yet. Check '+path.join(state,'error.log'));
 console.log(`Style Lab managed at http://127.0.0.1:${port}/`);
}else if(action==='sync'){
 sync();console.log('Dev source built and refreshed in the managed host.');
}else if(action==='stop'){
 if(loaded())run(['bootout',job]);console.log('Style Lab stopped. Its Tailscale route is retained.');
}else if(action==='status'){
 const result=run(['print',job],true);
 if(result.status!==0){console.log('Style Lab is stopped');process.exitCode=1;}
 else{const stateLine=result.stdout.match(/\bstate = ([^\n]+)/)?.[1]||'loaded';const pid=result.stdout.match(/\bpid = (\d+)/)?.[1];console.log(`Style Lab: ${stateLine}${pid?' · PID '+pid:''} · http://127.0.0.1:${port}/`);}
}else if(action==='uninstall'){
 if(loaded())run(['bootout',job]);if(fs.existsSync(plist))fs.unlinkSync(plist);console.log('Style Lab background service removed. Source and logs retained.');
}else throw new Error('Usage: service.mjs start|restart|stop|status|sync|uninstall');
