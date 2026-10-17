// Host adapter for the deliberately foreground-only review manager.
// It refuses to run without a pinned, separately audited OS sandbox binary.
// No sandbox, fallback shell or on-demand executor is provided by shared-ui.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {execFileSync,spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {validateManifest} from './fixture-index.mjs';
import {bundleFingerprint,validateReviewPlan,STATICREF_FIX31} from './review-manager.mjs';
import {registrationFor,profileFor} from './review-registration.mjs';

const HEX64=/^[0-9a-f]{64}$/;
const within=(child,parent)=>child===parent||!path.relative(parent,child).startsWith('..'+path.sep)&&
  path.relative(parent,child)!=='..'&&!path.isAbsolute(path.relative(parent,child));
const digest=data=>createHash('sha256').update(data).digest('hex');
const readDigest=file=>digest(fs.readFileSync(file));
// Future user-started tests must be observable in their Mac terminal.
// Keep the long-lived fixture supervisor quiet; a test child alone inherits
// stdout/stderr so its progress and assertion failures can be watched live.
// Never inherit stdin or forward arbitrary host environment/credentials.
export function reviewChildStdio(mode){
  if(mode==='test')return ['ignore','inherit','inherit'];
  if(mode==='fixture')return 'ignore';
  throw new Error('Unknown review child mode');
}
function requireThat(ok,message){if(!ok)throw new Error(message);}
function exactFile(file,{readonly=false,privateFile=false,max=2<<20}={}){
  const absolute=path.resolve(file),real=fs.realpathSync(absolute);
  requireThat(absolute===real,'Symlink/path alias refused for '+path.basename(file));
  const info=fs.lstatSync(real);
  requireThat(info.isFile()&&info.nlink===1&&info.size<=max,'Unsafe or oversized file '+path.basename(file));
  if(readonly)requireThat((info.mode & 0o222)===0,'Review bundle files must be read-only');
  if(privateFile)requireThat((info.mode & 0o077)===0,'Private file permissions required');
  return real;
}
function exactDir(dir,{privateDir=false,readonly=false}={}){
  const absolute=path.resolve(dir),real=fs.realpathSync(absolute);
  requireThat(absolute===real&&fs.lstatSync(real).isDirectory(),'Directory or symlink is unsafe');
  const mode=fs.statSync(real).mode;
  if(privateDir)requireThat((mode & 0o077)===0,'Private 0700 review directory required');
  if(readonly)requireThat((mode & 0o222)===0,'Bundle directory must be immutable');
  return real;
}
function gitRead(root,args){
  return execFileSync('/usr/bin/git',['-C',root,...args],
    {encoding:'utf8',timeout:5000,maxBuffer:32768,
      env:{PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',LC_ALL:'C'}}).trim();
}
function gitAt(root){
  return {sha:gitRead(root,['rev-parse','HEAD']),
    dirty:gitRead(root,['status','--porcelain','--untracked-files=all'])};
}
// Source provenance is an independent admission gate, not a flag echoed by
// StaticRef's in-memory fixture lock or a claim of native browser acceptance.
export function verifyStaticRefSourceReport(app,report){
  const proof=app.sourceProof;
  requireThat(!!proof&&app.id==='staticref'&&proof.fixSha===STATICREF_FIX31.sha,
    'StaticRef candidate needs the exact combined PR32+PR31 source provenance');
  const expected=STATICREF_FIX31.blobs,paths=Object.keys(expected).sort();
  requireThat(report?.fixtureAncestor===true&&
    report.combinedSha===app.sha&&
    Array.isArray(report.changedFiles)&&
    JSON.stringify([...report.changedFiles].sort())===JSON.stringify(paths),
    'Combined StaticRef review commit contains missing or extra changes');
  for(const [file,sha]of Object.entries(expected)){
    requireThat(report.headBlobs?.[file]===sha&&report.fixBlobs?.[file]===sha,
      'Combined StaticRef Canvas must match the exact PR31 blob: '+file);
  }
  return Object.freeze({
    fixturePr32Sha:proof.fixtureSha,headingFixPr31Sha:proof.fixSha,
    combinedAppSha:app.sha,gitBlobs:{...expected}
  });
}
function sourceWithin(root,relative){
  const resolved=path.resolve(root,relative);
  requireThat(within(resolved,root),'App command source escaped checkout');
  const real=exactFile(resolved);
  requireThat(within(real,root),'App command source is outside checkout');
  return real;
}
export function verifyBundleFiles(bundle){
  const root=exactDir(bundle.root,{readonly:true});
  for(const source of ['sourceRoot']){
    const sourceRoot=exactDir(bundle[source]);
    requireThat(!within(root,sourceRoot)&&!within(sourceRoot,root),
      'Candidate/baseline assets must be staged outside source checkouts');
  }
  const files={};
  for(const name of ['styles.css','runtime.js','icons.svg','manifest.json']){
    const file=exactFile(path.join(root,name),{readonly:true,
      max:name==='styles.css'?64*1024:name==='runtime.js'?1<<20:256*1024});
    requireThat(within(file,root),'Bundle file escaped its immutable root');
    files[name]=readDigest(file);
    requireThat(files[name]===bundle.digests[name],'Bundled file digest mismatch: '+name);
  }
  requireThat(bundleFingerprint(files)===bundle.bundleDigest,'UI aggregate digest mismatch');
  const meta=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  const styles=fs.readFileSync(path.join(root,'styles.css'));
  const sha384=createHash('sha384').update(styles).digest('base64');
  requireThat(meta.protocol===1&&meta.revision===files['styles.css']&&
    meta.stylesheet==='styles.'+meta.revision+'.css'&&meta.integrity==='sha384-'+sha384,
    'CSS integrity manifest does not match staged immutable stylesheet');
  requireThat(/^1\.\d+\.\d+$/.test(meta.version),'Invalid bundle version');
  return {root,files,version:meta.version};
}
export function verifySandboxAttestation(payload,challenge,isolation){
  const p=payload;
  requireThat(p&&p.protocol==='shared-ui-review-os-isolation-v1'&&p.challenge===challenge&&
    p.profileSha256===isolation.policySha256&&p.executableSha256===isolation.binarySha256,
    'Sandbox attestation is missing or does not match the pinned program, policy and challenge');
  requireThat(p.verification==='os-probes-passed'&&p.enforcement?.network==='kernel-egress-deny-except-fixture'&&
    p.enforcement?.filesystem==='readonly-allowlist-plus-scratch'&&
    p.enforcement?.process==='supervised-owned-foreground'&&
    p.enforcement?.productionMounts==='absent'&&p.enforcement?.environment==='scrubbed',
    'Sandbox OS enforcement capabilities are not established');
  const probes=p.probes||{};
  for(const key of ['externalNetwork','otherLoopback','productionFilesystem','sourceWrite','serviceWorkerNetwork']){
    requireThat(probes[key]?.result==='denied-by-os'&&
      ['EPERM','EACCES','ENETUNREACH','EHOSTUNREACH'].includes(probes[key]?.error),
      'Required isolation denial probe missing: '+key);
  }
  return {verified:true,profileSha256:p.profileSha256,executableSha256:p.executableSha256,
    evidenceDigest:digest(Buffer.from(JSON.stringify(p)))};
}
export class LocalReviewHost {
  constructor(input){
    this.plan=validateReviewPlan(input);
    this.scratch=new Map();
    this.children=new Set();
  }
  prepareRoot(){
    const dir=exactDir(this.plan.receiptDir,{privateDir:true});
    for(const app of this.plan.apps) requireThat(!within(dir,app.root)&&!within(app.root,dir),
      'Private receipts must not be inside an application checkout');
    for(const bundle of this.plan.bundles)requireThat(!within(dir,bundle.root)&&!within(bundle.root,dir),
      'Private receipts must not be inside an immutable UI bundle');
    return dir;
  }
  verifyRepo(root,sha){
    const dir=exactDir(root),state=gitAt(dir);
    requireThat(state.sha===sha&&state.dirty==='',
      'Clean source commit mismatch; an app or shared-ui checkout must not be changed for review');
    return dir;
  }
  verifyAppSourceProof(app,bundle){
    if(app.id!=='staticref')return null;
    if(!app.sourceProof){
      requireThat(bundle.variant==='baseline',
        'StaticRef candidate requires the separately committed PR32+PR31 source proof');
      return null; // Intentional old-production Canvas baseline.
    }
    const proof=app.sourceProof,root=app.root,expected=STATICREF_FIX31.blobs;
    const paths=Object.keys(expected);
    let report;
    try{
      gitRead(root,['merge-base','--is-ancestor',proof.fixtureSha,'HEAD']);
      const changed=gitRead(root,['diff','--name-only',proof.fixtureSha,'HEAD'])
        .split('\n').filter(Boolean);
      const headBlobs={},fixBlobs={};
      for(const file of paths){
        headBlobs[file]=gitRead(root,['rev-parse','HEAD:'+file]);
        fixBlobs[file]=gitRead(root,['rev-parse',proof.fixSha+':'+file]);
      }
      report={fixtureAncestor:true,combinedSha:app.sha,changedFiles:changed,headBlobs,fixBlobs};
    }catch{
      throw new Error('Combined StaticRef commit or PR31 source objects unavailable in clean checkout');
    }
    return verifyStaticRefSourceReport(app,report);
  }
  verifyCommand(cmd,appRoot){
    const binary=exactFile(cmd.binary,{max:256<<20});
    requireThat(readDigest(binary)===cmd.binarySha256,'Interpreter/executable digest changed');
    for(const name of cmd.sourceFiles)sourceWithin(appRoot,name);
    return binary;
  }
  verifyPrivatePlan(){
    const isolator=exactFile(this.plan.isolation.binary,{max:256<<20});
    const policy=exactFile(this.plan.isolation.policy,{privateFile:true,max:64*1024});
    requireThat(readDigest(isolator)===this.plan.isolation.binarySha256&&
      readDigest(policy)===this.plan.isolation.policySha256,
      'Trusted OS sandbox binary or private policy is not available at pinned digest');
    return {isolator,policy};
  }
  readOwnerManifest(app){
    const registration=registrationFor(app.id),profile=profileFor(registration,app.profile);
    if(profile.manifestMode==='runtime-loopback'){
      // Portal's actual Go templates/manifest are generated by its opt-in
      // synthetic test process AFTER server start; never invent a static JSON.
      sourceWithin(app.root,'internal/web/ui_fixture_manifest_test.go');
      return {deferred:true,source:'runtime-loopback',route:profile.manifestPath};
    }
    const file=exactFile(app.manifest,{max:1<<20});
    requireThat(within(file,app.root)&&
      file===path.join(app.root,profile.manifestPath),
      'Fixture manifest must be the registered original app-owned source file');
    const cases=validateManifest(JSON.parse(fs.readFileSync(file,'utf8')),app.id);
    const approvedPorts=new Set(registration.profiles.map(p=>p.port));
    requireThat(cases.every(item=>item.repository===app.repository&&
      item.sourceKind==='real-app'&&item.isolation==='declared mock-only'&&
      new URL(item.baseUrl).hostname==='127.0.0.1'&&
      approvedPorts.has(+new URL(item.baseUrl).port)),
      'Manifest must contain only real app-owned mock-only routes on registered local ports');
    const chosen=cases.filter(item=>+new URL(item.baseUrl).port===app.port);
    const exactRoute='http://127.0.0.1:'+app.port+app.reviewRoute;
    requireThat(chosen.length>0&&chosen.some(item=>item.href===exactRoute),
      'This supported profile is BLOCKED: manifest lacks its exact launch route and port');
    return chosen;
  }
  async validateRuntimeManifest(session){
    const {app,profile}=session;
    if(profile.manifestMode!=='runtime-loopback')return {verified:true,source:'checked-in'};
    const origin='http://127.0.0.1:'+app.port;
    const target=origin+profile.manifestPath;
    const body=await new Promise((resolve,reject)=>{
      const req=http.get(target,{headers:{Host:'127.0.0.1:'+app.port,
        Origin:origin,Accept:'application/json'},timeout:1200},res=>{
        if(res.statusCode!==200||
          !String(res.headers['content-type']||'').startsWith('application/json')){
          res.resume();reject(new Error('App-owned runtime manifest response was not verified'));return;
        }
        let bytes=0,data='';
        res.on('data',part=>{
          bytes+=part.length;
          if(bytes>1<<20){req.destroy(new Error('Runtime manifest exceeds 1MiB'));return;}
          data+=part;
        });
        res.once('end',()=>resolve(data));
      });
      req.once('error',reject);
      req.once('timeout',()=>req.destroy(new Error('Runtime manifest request timed out')));
    });
    const cases=validateManifest(JSON.parse(body),'runtime '+app.id);
    requireThat(cases.length>0&&cases.every(item=>
      item.repository===app.repository&&item.sourceKind==='real-app'&&
      item.isolation==='declared mock-only'&&
      new URL(item.baseUrl).origin===origin),
      'Runtime-generated app manifest differs from pinned origin or mock-only contract');
    requireThat(profile.reviewRoute==='/fixture'&&app.reviewRoute==='/fixture',
      'Portal must retain its real synthetic index; no copied demo route');
    return {verified:true,source:'runtime-loopback',rows:cases.length};
  }
  key(session){return [session.app.id,session.bundle.bundleDigest,session.seed,session.mode].join('|');}
  async preflight(session){
    const {app,bundle,seed,mode}=session;
    const receipts=this.prepareRoot();
    const appRoot=this.verifyRepo(app.root,app.sha);
    const sourceProof=this.verifyAppSourceProof(app,bundle);
    const uiRoot=this.verifyRepo(bundle.sourceRoot,bundle.uiSha);
    const checked=verifyBundleFiles(bundle);
    requireThat(!within(checked.root,appRoot)&&!within(checked.root,uiRoot),
      'Review bundle must be outside all app and shared-ui checkouts');
    this.verifyCommand(app.start,appRoot);
    for(const cmd of Object.values(app.tests))this.verifyCommand(cmd,appRoot);
    this.readOwnerManifest(app);
    const iso=this.verifyPrivatePlan();
    // No process is started until the owner explicitly issues "start" or "test".
    // The external pinned sandbox must run *real OS probes* in the same policy
    // used by "run". This source does not ship a pretend no-egress isolation mode.
    const key=this.key(session);
    let scratch=this.scratch.get(key);
    if(!scratch){
      scratch=fs.mkdtempSync(path.join(receipts,'.review-owned-'+app.id+'-'));
      fs.chmodSync(scratch,0o700);this.scratch.set(key,scratch);
    }
    const challenge=randomUUID();
    let output;
    try{
      output=execFileSync(iso.isolator,[
        'verify','--protocol','shared-ui-review-os-isolation-v1',
        '--policy',iso.policy,'--challenge',challenge,
        '--app-root',appRoot,'--bundle-root',checked.root,
        '--scratch',scratch,'--port',String(app.port)
      ],{encoding:'utf8',timeout:6000,maxBuffer:8192,
        env:{PATH:'/usr/bin:/bin',HOME:scratch,TMPDIR:scratch,LANG:'C'}});
    }catch{
      this.releaseScratch(key);
      throw new Error('Pinned OS sandbox verifier unavailable or refused its bounded security probes; fixture stays stopped');
    }
    let value;
    try{value=JSON.parse(output);}catch{
      this.releaseScratch(key);throw new Error('Invalid OS sandbox attestation');
    }
    try{return {...verifySandboxAttestation(value,challenge,this.plan.isolation),sourceProof};}
    catch(error){this.releaseScratch(key);throw error;}
  }
  async portFree(port){
    return new Promise(resolve=>{
      const listener=net.createServer();
      listener.once('error',()=>resolve(false));
      listener.listen({host:'127.0.0.1',port,exclusive:true},()=>listener.close(()=>resolve(true)));
    });
  }
  async spawn(session){
    const {app,bundle,seed,mode}=session,cmd=mode==='test'?session.test:app.start;
    const key=this.key(session);
    const scratch=this.scratch.get(key);
    requireThat(scratch&&fs.existsSync(scratch),'Verified review scratch missing');
    // Only the pinned OS sandbox program executes. It supervises the actual
    // fixture process and must forward graceful shutdown; no shell or fallback.
    const iso=this.plan.isolation;
    // The two app owners agreed on a startup-only candidate selector.
    // URL/query parameters cannot change the bundle after this process starts.
    const appVariant=bundle.variant==='baseline'?'installed':bundle.variant;
    const ownerArgs=mode==='fixture'?[
      '--ui-variant='+appVariant,'--ui-source-sha='+bundle.uiSha,
      '--ui-bundle-dir='+bundle.root,'--ui-bundle-sha256='+bundle.bundleDigest,
      '--app-sha='+app.sha,'--seed='+seed,'--review-root='+scratch,
      ...(app.id==='staticref'?['--fixture-route='+app.reviewRoute,
        ...(app.sourceProof?[
          '--fixture-source-sha='+app.sourceProof.fixtureSha,
          '--require-heading-fix-sha='+app.sourceProof.fixSha]:[])]:[])
    ]:[];
    const args=['run','--protocol','shared-ui-review-os-isolation-v1','--policy',iso.policy,
      '--app-root',app.root,'--bundle-root',bundle.root,'--scratch',scratch,'--port',String(app.port),
      '--',cmd.binary,...cmd.args,...ownerArgs];
    const env={
      PATH:'/usr/bin:/bin',HOME:scratch,TMPDIR:scratch,LANG:'C',
      UI_REVIEW_FIXTURE:'1',UI_REVIEW_ASSET_ROOT:bundle.root,
      UI_REVIEW_BUNDLE_DIGEST:bundle.bundleDigest,UI_REVIEW_SOURCE_SHA:bundle.uiSha,
      UI_REVIEW_APP_SHA:app.sha,UI_REVIEW_SEED:seed,
      UI_REVIEW_VARIANT:bundle.variant,UI_REVIEW_PORT:String(app.port)
    };
    return await new Promise((resolve,reject)=>{
      let settled=false;
      const child=spawn(iso.binary,args,{cwd:app.root,env,detached:false,stdio:reviewChildStdio(mode)});
      child.once('error',error=>{
        if(!settled){settled=true;reject(new Error('Reviewed sandbox process did not launch: '+error.code));}
      });
      // spawn event confirms an owned process handle, never its app readiness.
      child.once('spawn',()=>{if(!settled){settled=true;this.children.add(child);
        // Retain the owned handle even after an unexpected exit. Only an
        // explicit stop or completed test releases ownership and scratch.
        resolve(child);}});
    });
  }
  async health(session){
    const expectedPort=session.app.port;
    const address='http://127.0.0.1:'+expectedPort+session.app.healthPath;
    let last;
    for(let attempt=0;attempt<10;attempt++){
      try{
        return await new Promise((resolve,reject)=>{
          const req=http.get(address,{headers:{Host:'127.0.0.1:'+expectedPort,
            Origin:'http://127.0.0.1:'+expectedPort,Accept:'application/json'},
            timeout:750},res=>{
            if(res.statusCode!==200||!String(res.headers['content-type']||'').startsWith('application/json')){
              res.resume();reject(new Error('Synthetic health endpoint refused request'));return;
            }
            let size=0,body='';
            res.on('data',chunk=>{size+=chunk.length;if(size>4096){req.destroy(new Error('Health response too large'));return;}body+=chunk;});
            res.once('end',()=>{try{resolve(JSON.parse(body));}catch{reject(new Error('Invalid health JSON'));}});
          });
          req.once('error',reject);req.once('timeout',()=>req.destroy(new Error('Health timeout')));
        });
      }catch(error){last=error;}
      if(attempt<9)await new Promise(resolve=>setTimeout(resolve,150));
    }
    throw new Error('Fixture exact-bundle health proof unavailable after bounded loopback attempts: '+last.message);
  }
  async stop(child){
    requireThat(this.children.has(child),'Stop refused: process was not created by this review manager');
    if(child.exitCode!==null||child.signalCode!==null){
      this.children.delete(child);return true;
    }
    child.kill('SIGTERM'); // No PID lookup, broad signal, process-group or force kill.
    const closed=await new Promise(resolve=>{
      let done=false;
      const timeout=setTimeout(()=>finish(false),5000);
      function finish(ok){if(done)return;done=true;clearTimeout(timeout);resolve(ok);}
      child.once('exit',()=>finish(true));
    });
    if(closed)this.children.delete(child);
    return closed;
  }
  async waitTest(child){
    requireThat(this.children.has(child),'Test is not an owned sandbox child');
    return new Promise((resolve,reject)=>{
      let done=false;
      const timeout=setTimeout(()=>{
        if(done)return;done=true;
        // Explicitly requested bounded test may time out; graceful, child-only
        // SIGTERM is attempted. No force kill, no inference of process exit.
        child.kill('SIGTERM');
        reject(new Error('Test timed out; owned child termination requires verification'));
      },180000);
      child.once('exit',(code,signal)=>{if(done)return;done=true;clearTimeout(timeout);
        this.children.delete(child);resolve({code,signal});});
      child.once('error',error=>{if(done)return;done=true;clearTimeout(timeout);reject(error);});
    });
  }
  async record(payload){
    const dir=this.prepareRoot(),target=path.join(dir,this.plan.reviewId+'-'+payload.kind+'-'+randomUUID()+'.json');
    const body=JSON.stringify({...payload,observedAt:new Date().toISOString()},null,2)+'\n';
    const fd=fs.openSync(target,'wx',0o600);
    try{fs.writeSync(fd,body);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    return target;
  }
  releaseScratch(key){
    const scratch=this.scratch.get(key);
    if(!scratch)return;
    // Scratch was created exclusively under this manager's private root.
    const root=exactDir(this.plan.receiptDir,{privateDir:true});
    requireThat(within(scratch,root)&&path.basename(scratch).startsWith('.review-owned-'),'Unowned scratch cleanup refused');
    fs.rmSync(scratch,{recursive:true,force:true});this.scratch.delete(key);
  }
  async cleanup(session){this.releaseScratch(this.key(session));}
}
export function readReviewPlan(file){
  const name=exactFile(file,{privateFile:true,max:64*1024});
  return validateReviewPlan(JSON.parse(fs.readFileSync(name,'utf8')));
}
