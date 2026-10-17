#!/usr/bin/env node
// One visible foreground human-driven manager, never a background daemon.
// No source-check invocation starts a fixture or an isolation subprocess.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {ReviewManager} from './review-manager.mjs';
import {LocalReviewHost,readReviewPlan} from './review-host.mjs';
import {collectManifests,renderIndex,writeIndex} from './fixture-index.mjs';

const own=fileURLToPath(import.meta.url);
function commandWords(value){
  const words=value.trim().split(/\s+/).filter(Boolean);
  if(words.length>5)throw new Error('Use one bounded review command at a time');
  return words;
}
export async function dispatchLine(manager,host,line,{output=()=>{}}={}){
  const [cmd,a,b,c]=commandWords(line);
  if(!cmd)return {continue:true};
  if(cmd==='help'){
    output('status | start aura|staticref candidate|baseline|saved:<id> [seed] | test <app> <named-test> | stop <app> | index | exit');
    output('No idle timeout, background launch, foreign port reuse, auto-stop, auto-install or auto-promotion.');
    return {continue:true};
  }
  if(cmd==='status'){for(const item of manager.status())output(JSON.stringify(item));return {continue:true};}
  if(cmd==='start'){
    if(!a||![undefined,'candidate','baseline'].includes(b)&&!b?.startsWith('saved:'))
      throw new Error('start <aura|staticref> <candidate|baseline|saved:id> [seed]');
    const result=await manager.start(a,b||'candidate',c||'seed-1');
    output(JSON.stringify(result));return {continue:true};
  }
  if(cmd==='stop'){
    if(!a||b)throw new Error('stop <aura|staticref>');
    output(JSON.stringify(await manager.stop(a)));return {continue:true};
  }
  if(cmd==='test'){
    if(!a||!b||c)throw new Error('test <aura|staticref> <named-test>');
    output(JSON.stringify(await manager.test(a,b)));return {continue:true};
  }
  if(cmd==='index'){
    if(a)throw new Error('index takes no arguments');
    const documents=manager.plan.apps.map(app=>({source:app.id,document:JSON.parse(fs.readFileSync(app.manifest,'utf8'))}));
    const entries=collectManifests(documents);
    const outputPath=path.join(host.prepareRoot(),manager.plan.reviewId+'-index.html');
    const generated=writeIndex(outputPath,renderIndex(entries));
    output('Offline links (not runtime acceptance): '+generated);return {continue:true};
  }
  if(cmd==='exit'||cmd==='quit'){
    if(a)throw new Error('exit takes no arguments');
    await manager.exit();return {continue:false};
  }
  throw new Error('Unknown review action. Enter help for explicit commands.');
}
export async function foreground(args=process.argv.slice(2)){
  if(args.length!==2||args[0]!=='--config'||!path.isAbsolute(args[1]))
    throw new Error('Usage: node scripts/review-launcher.mjs --config /absolute/private/review-plan.json');
  if(!process.stdin.isTTY||!process.stdout.isTTY)
    throw new Error('Foreground manual review requires a terminal; unattended or piped startup is forbidden');
  const plan=readReviewPlan(args[1]),host=new LocalReviewHost(plan),manager=new ReviewManager(plan,host);
  const rl=createInterface({input:process.stdin,output:process.stdout,terminal:true});
  console.log('Shared UI candidate review · '+plan.reviewId+' · manually owned; source/fixture safety unverified until preflight');
  console.log('Enter help, status, start, test, stop, index or exit. No idle shutdown.');
  const write=value=>console.log(value);
  let pending=Promise.resolve(),closing=false;
  function queue(line){
    pending=pending.then(async()=>{
      if(closing)return;
      try{
        const result=await dispatchLine(manager,host,line,{output:write});
        if(!result.continue){closing=true;rl.close();}
      }catch(error){console.error('Review denied: '+error.message);}
      if(!closing)rl.prompt();
    });
  }
  rl.setPrompt('review> ');rl.on('line',queue);
  rl.on('SIGINT',()=>{
    console.error('Review owns child processes only while explicitly supervised. Use status and stop <app>; Ctrl-C is not an authorized child shutdown.');
    rl.prompt();
  });
  rl.on('close',()=>{
    if(!closing&&manager.status().some(item=>item.owned))
      console.error('Terminal closed unexpectedly with owned children: process survival unknown; do not kill by PID or port. Reconcile with owning session.');
  });
  rl.prompt();
}
if(process.argv[1]&&path.resolve(process.argv[1])===own){
  foreground().catch(error=>{console.error('Review launcher refused: '+error.message);process.exitCode=2;});
}
