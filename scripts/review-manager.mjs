// Foreground, app-agnostic lifecycle. Execution and OS confinement belong to a
// separately audited Host adapter; source tests inject an inert fake Host.
import {createHash} from 'node:crypto';

const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const SEED=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const VARIANT=/^(candidate|baseline|saved:[a-z0-9][a-z0-9-]{1,63})$/;
const FILES=['styles.css','runtime.js','icons.svg','manifest.json'];
const APPS=Object.freeze({aura:'andyherle/aura',staticref:'andyherle/StaticRef'});
function check(condition, message){if(!condition)throw new Error(message);}
function object(value, keys, label){
  check(value && typeof value==='object' && !Array.isArray(value),label+' must be an object');
  check(Object.keys(value).every(key=>keys.includes(key)),label+' has unsupported keys');
  return value;
}
function nonempty(value, label, max=4096){
  check(typeof value==='string' && !!value.trim() && value.length<=max && !/[\u0000-\u001f\u007f]/.test(value),label+' is invalid');
  return value;
}
function absolute(value,label){
  nonempty(value,label);check(value.startsWith('/')&&!value.split('/').includes('..')&&!value.includes('\\'),label+' must be an absolute canonical path');
  return value;
}
function argv(value,label){
  check(Array.isArray(value)&&value.length<=24,label+' needs a bounded argv');
  for(const arg of value) nonempty(arg,label+' argument',1024);
  return value;
}
function executable(cmd,label){
  object(cmd,['binary','binarySha256','args','sourceFiles'],label);
  absolute(cmd.binary,label+'.binary');
  check(HEX64.test(cmd.binarySha256),label+' needs its pinned executable digest');
  argv(cmd.args,label+'.args');
  check(cmd.args.length>0,'An owned fixture command needs explicit arguments');
  check(!cmd.args.some(arg=>['-e','--eval','-c','--import','--require'].includes(arg)),
    'Inline/early executable hooks are forbidden in review commands');
  check(Array.isArray(cmd.sourceFiles)&&cmd.sourceFiles.length>0&&cmd.sourceFiles.length<=12,
    'Review commands must pin their app-owned source files');
  for(const file of cmd.sourceFiles){
    check(typeof file==='string'&&/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]{0,180}$/.test(file)&&
      !file.split('/').includes('..')&&!file.startsWith('/'),label+' sourceFiles must remain inside checkout');
  }
  return cmd;
}
export function bundleFingerprint(digests){
  object(digests,FILES,'UI file digests');
  for(const file of FILES)check(HEX64.test(digests[file]),'Missing pinned digest '+file);
  return createHash('sha256').update(FILES.map(name=>name+':'+digests[name]).join('\n')).digest('hex');
}
export function validateReviewPlan(input){
  const plan=object(input,['schemaVersion','reviewId','receiptDir','isolation','bundles','apps'],'review plan');
  check(plan.schemaVersion===1,'Unsupported review plan schema');
  nonempty(plan.reviewId,'reviewId',80);
  check(/^[a-z][a-z0-9-]{2,79}$/.test(plan.reviewId),'Invalid reviewId');
  absolute(plan.receiptDir,'receiptDir');
  const iso=object(plan.isolation,['binary','binarySha256','policy','policySha256'],'isolation');
  absolute(iso.binary,'isolation.binary');absolute(iso.policy,'isolation.policy');
  check(HEX64.test(iso.binarySha256)&&HEX64.test(iso.policySha256),'Isolation executable/policy must be pinned by digest');
  check(Array.isArray(plan.bundles)&&plan.bundles.length>=2&&plan.bundles.length<=8,'Need bounded baseline and candidate bundles');
  const bundles=new Set();
  for(const bundle of plan.bundles){
    object(bundle,['variant','root','sourceRoot','uiSha','pack','digests','bundleDigest','savedVersion'],'bundle');
    check(VARIANT.test(bundle.variant)&&!bundles.has(bundle.variant),'Unknown or repeated bundle variant');
    bundles.add(bundle.variant);
    absolute(bundle.root,'bundle.root');absolute(bundle.sourceRoot,'bundle.sourceRoot');
    check(HEX40.test(bundle.uiSha),'Bundle needs exact shared-ui source SHA');
    check(['postvisual','personal'].includes(bundle.pack),'Bundle pack invalid');
    check(bundle.bundleDigest===bundleFingerprint(bundle.digests),'Composite bundle digest mismatch');
    if(bundle.variant.startsWith('saved:')) nonempty(bundle.savedVersion,'savedVersion',128);
    else check(bundle.savedVersion===undefined,'Only a saved variant can carry a savedVersion');
  }
  check(bundles.has('candidate')&&bundles.has('baseline'),'Both candidate and baseline must be pinned');
  check(Array.isArray(plan.apps)&&plan.apps.length===2,'Initial review accepts precisely two application profiles');
  const ids=new Set(),ports=new Set();
  for(const app of plan.apps){
    object(app,['id','repository','root','sha','port','manifest','start','tests','healthPath'],'application');
    check(APPS[app.id]===app.repository&&!ids.has(app.id),'Initial app must be uniquely owned Aura or StaticRef');
    ids.add(app.id);
    absolute(app.root,'app.root');absolute(app.manifest,'app.manifest');
    check(HEX40.test(app.sha),'Application requires exact clean commit SHA');
    check(Number.isInteger(app.port)&&app.port>=1024&&app.port<=65535&&!ports.has(app.port),'Distinct reserved high-numbered ports required');
    ports.add(app.port);
    check(app.port===(app.id==='aura'?41888:8769),'Fixture ports must match existing owner manifests');
    executable(app.start,'app.start');
    check(app.healthPath==='/__fixture__/health','App must implement the dedicated review health endpoint');
    check(app.tests&&typeof app.tests==='object'&&!Array.isArray(app.tests)&&
      Object.keys(app.tests).length<=6,'Tests must be a bounded named command map');
    for(const [name,cmd]of Object.entries(app.tests)){
      check(/^[a-z][a-z0-9-]{1,32}$/.test(name),'Invalid test name');
      executable(cmd,'test '+name);
    }
  }
  return structuredClone(plan);
}
function selection(plan, appId, variant, seed){
  check(SEED.test(seed),'Invalid deterministic seed');
  const app=plan.apps.find(item=>item.id===appId);
  const bundle=plan.bundles.find(item=>item.variant===variant);
  check(app&&bundle,'Unknown app or UI variant');
  return {app,bundle,seed};
}
function identity({app,bundle,seed}){
  return [app.repository,app.sha,bundle.uiSha,bundle.bundleDigest,bundle.variant,bundle.pack,seed].join('|');
}
function receipt(kind, session, extra={}){
  const {app,bundle,seed,attestation}=session;
  return {
    schemaVersion:1,kind,reviewId:session.reviewId,app:app.id,repository:app.repository,
    appSha:app.sha,uiSha:bundle.uiSha,bundleDigest:bundle.bundleDigest,
    files:{...bundle.digests},variant:bundle.variant,pack:bundle.pack,seed,
    port:app.port,ownedPid:session.child?.pid??null,fixtureSource:'real-app',
    isolationProfile:attestation.profileSha256,isolatorDigest:attestation.executableSha256,
    result:'source-prepared/runtime-unverified',...extra
  };
}
export class ReviewManager {
  constructor(input,host){
    this.plan=validateReviewPlan(input);this.host=host;this.owned=new Map();this.testActive=false;
  }
  status(){
    return Object.freeze(this.plan.apps.map(app=>{
      const s=this.owned.get(app.id);
      return {app:app.id,port:app.port,state:s?.state||'stopped',pid:s?.child?.pid||null,
        variant:s?.bundle.variant||null,uiSha:s?.bundle.uiSha||null,seed:s?.seed||null,
        owned:!!s,reviewId:this.plan.reviewId};
    }));
  }
  async start(appId,variant='candidate',seed='seed-1'){
    const selected=selection(this.plan,appId,variant,seed),key=identity(selected);
    const previous=this.owned.get(appId);
    if(previous){
      if(previous.state==='ready'&&previous.key===key)return {reused:true,pid:previous.child.pid,app:appId,variant,seed};
      throw new Error('An owned session already exists; stop it explicitly before changing revision or seed');
    }
    check(this.owned.size<2,'At most two owned fixture children');
    // Preflight must hash exact source, app, bundle and isolation policy and
    // execute bounded OS confinement probes. No default or mock-only fallback.
    const attestation=await this.host.preflight({...selected,plan:this.plan,mode:'fixture'});
    check(attestation?.verified===true&&attestation?.profileSha256===this.plan.isolation.policySha256&&
      attestation.executableSha256===this.plan.isolation.binarySha256,
      'OS isolation has not been independently verified; refusing fixture start');
    check(await this.host.portFree(selected.app.port),'Fixture port is occupied or cannot be checked; refusing foreign process reuse');
    let child;
    const session={...selected,reviewId:this.plan.reviewId,attestation,key,state:'starting'};
    this.owned.set(appId,session);
    try{
      child=await this.host.spawn({...session,mode:'fixture',plan:this.plan});
      check(Number.isSafeInteger(child?.pid)&&child.pid>0,'Isolator did not return an owned child handle');
      session.child=child;
      const health=await this.host.health(session);
      check(health?.protocol==='shared-ui-review-health-v1'&&
        health.appSha===selected.app.sha&&health.uiSha===selected.bundle.uiSha&&
        health.bundleDigest===selected.bundle.bundleDigest&&health.seed===seed&&
        health.mockOnly===true&&health.productionWritesDisabled===true&&health.realAppCode===true,
        'Fixture did not confirm the exact real-code app, bundle and mock boundary');
      session.state='ready';
      const saved=await this.host.record(receipt('start',session,{result:'health-verified/browser-unrun',healthPath:selected.app.healthPath}));
      return {app:appId,pid:child.pid,port:selected.app.port,variant,seed,reused:false,receipt:saved,
        href:'http://127.0.0.1:'+selected.app.port+'/__fixture__/'};
    }catch(error){
      // The manager knows only this child; never attempt to kill a PID recovered
      // from a port probe, saved receipt or an external running application.
      if(child){
        session.state='stopping';
        const closed=await this.host.stop(child).catch(()=>false);
        if(!closed)throw new Error('Isolated child shutdown unconfirmed; retained owned handle for explicit stop: '+error.message);
      }
      this.owned.delete(appId);
      throw error;
    }
  }
  async stop(appId){
    const session=this.owned.get(appId);
    if(!session)return {app:appId,stopped:true,alreadyStopped:true};
    session.state='stopping';
    const closed=await this.host.stop(session.child); // SIGTERM, bounded wait; NEVER force kill.
    if(!closed)throw new Error('Graceful stop is pending; do not force kill or infer shutdown');
    this.owned.delete(appId);
    const saved=await this.host.record(receipt('stop',session,{result:'owned-child-exited'}));
    return {app:appId,stopped:true,pid:session.child.pid,receipt:saved};
  }
  async test(appId,name){
    check(!this.testActive,'Only one isolated test child at a time');
    const session=this.owned.get(appId);
    check(session?.state==='ready','Start the exact app and UI bundle before testing');
    const test=session.app.tests[name];
    check(test,'Unknown app-owned test command');
    this.testActive=true;
    try{
      // The test uses the SAME verified isolation profile, immutable source,
      // candidate bundle and seed. It may not run with host shell access.
      const att=await this.host.preflight({...session,plan:this.plan,mode:'test'});
      check(att?.verified===true&&att.profileSha256===session.attestation.profileSha256&&
        att.executableSha256===session.attestation.executableSha256,
        'Test sandbox isolation could not be reverified');
      const child=await this.host.spawn({...session,mode:'test',test,plan:this.plan});
      check(Number.isSafeInteger(child?.pid)&&child.pid>0,'Test needs its own owned child handle');
      const outcome=await this.host.waitTest(child);
      const result=outcome?.code===0?'source-test-executed/browser-evidence-separate':'test-failed';
      const saved=await this.host.record(receipt('test',session,{test:name,testPid:child.pid,
        testArgv:[...test.args],exitCode:outcome?.code??null,result}));
      return {app:appId,test:name,result,exitCode:outcome?.code??null,receipt:saved};
    }finally{this.testActive=false;}
  }
  async exit(){
    check(this.owned.size===0&&!this.testActive,'Stop all owned fixture children explicitly before exiting; no idle auto-shutdown');
    return {closed:true};
  }
}
