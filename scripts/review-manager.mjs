// Foreground, app-agnostic lifecycle. Execution and OS confinement belong to a
// separately audited Host adapter; source tests inject an inert fake Host.
import {createHash} from 'node:crypto';
import {REVIEW_IDS,REVIEW_REGISTRY,registrationFor,profileFor,readinessFor,checkMountCompatibility,reviewOriginRoute} from './review-registration.mjs';

const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const SEED=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const VARIANT=/^(candidate|baseline|saved:[a-z0-9][a-z0-9-]{1,63})$/;
const FILES=['styles.css','runtime.js','icons.svg','manifest.json'];
// A registration is not an app runner. Each of the six apps is source-known
// even when its fixture or candidate mode is explicitly BLOCKED.
// Exact app-owned PR31 source blobs; Git SHA-1, NOT UI bundle SHA256.
export const STATICREF_FIX31=Object.freeze({
  sha:'d0139bd231b3cb5b1bf02df6b7380d975d992f5e',
  blobs:Object.freeze({
    'staticref/web/canvas.js':'dda63a89ef5a36573bfc9caa2de2ea2b9ff20b6e',
    'staticref/web/canvas.css':'8c3736db9476f74d718ebf46a97a14e26d573673',
    'tests/canvas-client.test.mjs':'83337e0d10233b9d786a0592aa5a37915e3a417f',
    'docs/CANVAS.md':'d99842c18066fb3f27ab94fb52391b0ff0ccd33d'
  })
});
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
  // Canonical cross-language digest: ASCII UTF-8 JSON, sorted file keys,
  // no spaces. Python: json.dumps({"files": sorted_map},separators=(",",":"),sort_keys=True).
  const files=Object.fromEntries([...FILES].sort().map(name=>[name,digests[name]]));
  return createHash('sha256').update(JSON.stringify({files})).digest('hex');
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
  check(Array.isArray(plan.bundles)&&plan.bundles.length>=2&&plan.bundles.length<=24,'Need bounded pinned baseline and candidate bundles');
  const bundles=new Set();
  for(const bundle of plan.bundles){
    object(bundle,['id','variant','root','sourceRoot','uiSha','pack','digests','bundleDigest','savedVersion'],'bundle');
    check(VARIANT.test(bundle.variant),'Unknown bundle variant');
    if(bundle.id!==undefined)check(/^[a-z][a-z0-9-]{2,63}$/.test(bundle.id),'Invalid immutable bundle selection id');
    const identity=bundle.id??bundle.pack+'-'+bundle.variant;
    check(!bundles.has(identity),'Repeated bundle id; assign distinct names for app-specific baseline');
    bundles.add(identity);
    absolute(bundle.root,'bundle.root');absolute(bundle.sourceRoot,'bundle.sourceRoot');
    check(HEX40.test(bundle.uiSha),'Bundle needs exact shared-ui source SHA');
    check(['postvisual','personal'].includes(bundle.pack),'Bundle pack invalid');
    check(bundle.bundleDigest===bundleFingerprint(bundle.digests),'Composite bundle digest mismatch');
    if(bundle.variant.startsWith('saved:')) nonempty(bundle.savedVersion,'savedVersion',128);
    else check(bundle.savedVersion===undefined,'Only a saved variant can carry a savedVersion');
  }
  check(plan.bundles.some(b=>b.variant==='baseline')&&plan.bundles.some(b=>b.variant==='candidate'),
    'Both candidate and baseline must be represented in the immutable bundle catalogue');
  // Six registered consumers is not the same as two simultaneously running
  // child processes. Registration and source readiness are independent of RAM.
  check(Array.isArray(plan.apps)&&plan.apps.length>=1&&plan.apps.length<=REVIEW_IDS.length,
    'One to six registered application profiles may be configured');
  const ids=new Set(),ports=new Set();
  for(const app of plan.apps){
    object(app,['id','repository','root','sha','port','profile','pack','manifest','bundleRefs','readiness','mountEvidence',
      'start','tests','healthPath','reviewRoute','sourceProof'],'application');
    const registration=registrationFor(app.id);
    check(registration&&registration.repository===app.repository&&!ids.has(app.id),
      'Unknown app ID, repository mismatch or duplicate registered consumer');
    ids.add(app.id);
    const profile=profileFor(registration,app.profile);
    check(profile&&app.port===profile.port,'App must select one exact registered fixture profile and reserved port');
    if(app.pack!==undefined)check(app.pack===profile.pack,'App pack disagrees with its registered profile');
    if(profile.manifestMode==='checkout')check(typeof app.manifest==='string',
      'Checked-in app fixture manifest required for this profile');
    else if(app.manifest!==undefined)absolute(app.manifest,'app.manifest');
    absolute(app.root,'app.root');
    if(profile.manifestMode==='checkout')absolute(app.manifest,'app.manifest');
    check(HEX40.test(app.sha),'Application requires exact clean commit SHA');
    check(Number.isInteger(app.port)&&app.port>=1024&&app.port<=65535&&!ports.has(app.port),'Distinct reserved high-numbered ports required');
    ports.add(app.port);
    reviewOriginRoute(nonempty(app.reviewRoute,'app.reviewRoute',512));
    if(app.readiness!==undefined)object(app.readiness,['baseline','candidate'],'app readiness');
    for(const variant of ['baseline','candidate'])readinessFor(app,registration,variant);
    if(app.mountEvidence!==undefined){
      // App adapters must prove original native ownership before changing
      // server-rendered/hydrated forms; this only validates source claims.
      checkMountCompatibility(app,registration,{state:'prepared',reason:'Source integration declared'});
    }
    if(app.bundleRefs!==undefined){
      object(app.bundleRefs,['baseline','candidate'],'app bundle references');
      for(const variant of ['baseline','candidate']){
        const ref=nonempty(app.bundleRefs[variant],'bundleRefs.'+variant,64);
        check(plan.bundles.some(b=>(b.id??b.pack+'-'+b.variant)===ref&&
          b.variant===variant&&b.pack===profile.pack),
          'App bundle reference does not pin its correct pack and variant');
      }
    }
    if(app.sourceProof!==undefined){
      check(app.id==='staticref','Only StaticRef owns the first combined Canvas source proof');
      object(app.sourceProof,['fixtureSha','fixSha'],'StaticRef sourceProof');
      check(HEX40.test(app.sourceProof.fixtureSha)&&app.sourceProof.fixSha===STATICREF_FIX31.sha,
        'Source proof must identify the exact StaticRef fixture and PR31 fix commits');
    }
    executable(app.start,'app.start');
    check(app.healthPath==='/__fixture__/review-lock.json','App must implement the dedicated exact review-lock endpoint');
    check(app.tests&&typeof app.tests==='object'&&!Array.isArray(app.tests)&&
      Object.keys(app.tests).length<=6,'Tests must be a bounded named command map');
    for(const [name,cmd]of Object.entries(app.tests)){
      check(/^[a-z][a-z0-9-]{1,32}$/.test(name),'Invalid test name');
      executable(cmd,'test '+name);
    }
  }
  return structuredClone(plan);
}
function selection(plan,appId,variant,seed){
  const registration=registrationFor(appId);
  check(registration,'Unknown consumer: not in six-app registry');
  const app=plan.apps.find(item=>item.id===appId);
  check(app,'Consumer '+appId+' is registered but BLOCKED: no pinned application source profile in this review plan');
  const profile=profileFor(registration,app.profile);
  const actualSeed=seed??profile.seed;
  check(SEED.test(actualSeed),'Invalid deterministic seed');
  const requested=app.bundleRefs?.[variant];
  const candidates=plan.bundles.filter(item=>item.variant===variant&&item.pack===profile.pack&&
    (!requested||(item.id??item.pack+'-'+item.variant)===requested));
  check(candidates.length===1,'Consumer '+appId+' is registered but BLOCKED: no unique pinned '+variant+'/'+profile.pack+' complete bundle');
  return {app,bundle:candidates[0],seed:actualSeed,registration,profile};
}
const appRoute=app=>app.reviewRoute;
function identity({app,bundle,seed}){
  return [app.repository,app.sha,bundle.uiSha,bundle.bundleDigest,bundle.variant,bundle.pack,seed].join('|');
}
function receipt(kind, session, extra={}){
  const {app,bundle,seed,attestation}=session;
  return {
    schemaVersion:1,kind,reviewId:session.reviewId,app:app.id,repository:app.repository,
    appSha:app.sha,uiSha:bundle.uiSha,bundleDigest:bundle.bundleDigest,
    files:{...bundle.digests},variant:bundle.variant,pack:bundle.pack,seed,
    port:app.port,appProfile:session.profile.name,ownedPid:session.child?.pid??null,fixtureSource:'real-app',
    fixtureRoute:app.reviewRoute,sourceProof:attestation.sourceProof??null,
    isolationProfile:attestation.profileSha256,isolatorDigest:attestation.executableSha256,
    result:'source-prepared/runtime-unverified',...extra
  };
}
export class ReviewManager {
  constructor(input,host){
    this.plan=validateReviewPlan(input);this.host=host;this.owned=new Map();this.testActive=false;this.testChild=null;
  }
  status(){
    return Object.freeze(this.plan.apps.map(app=>{
      const s=this.owned.get(app.id);
      const exited=!!s?.child&&(Number.isInteger(s.child.exitCode)||!!s.child.signalCode);
      return {app:app.id,port:app.port,state:exited&&s.state==='ready'?'exited-unexpected':s?.state||'stopped',pid:s?.child?.pid||null,
        variant:s?.bundle.variant||null,uiSha:s?.bundle.uiSha||null,seed:s?.seed||null,
        owned:!!s,reviewId:this.plan.reviewId,
        testPid:this.testChild?.appId===app.id?this.testChild.child.pid:null,
        testState:this.testChild?.appId===app.id?'owned-running-or-unconfirmed':'idle'};
    }));
  }
  async start(appId,variant='candidate',seed='seed-1'){
    const selected=selection(this.plan,appId,variant,seed),key=identity(selected);
    const previous=this.owned.get(appId);
    if(previous){
      const exited=Number.isInteger(previous.child?.exitCode)||!!previous.child?.signalCode;
      if(previous.state==='ready'&&!exited&&previous.key===key)
        return {reused:true,pid:previous.child.pid,app:appId,variant,seed};
      throw new Error('An owned session already exists; stop it explicitly before changing revision or seed');
    }
    check(this.owned.size<2,'At most two owned fixture children');
    const requiresFix=selected.app.id==='staticref'&&
      (selected.bundle.variant!=='baseline'||!!selected.app.sourceProof);
    if(requiresFix)check(!!selected.app.sourceProof,
      'StaticRef candidate requires a clean combined PR32+PR31 sourceProof');
    // Preflight must hash exact source, app, bundle and isolation policy and
    // execute bounded OS confinement probes. No default or mock-only fallback.
    const attestation=await this.host.preflight({...selected,plan:this.plan,mode:'fixture'});
    check(attestation?.verified===true&&attestation?.profileSha256===this.plan.isolation.policySha256&&
      attestation.executableSha256===this.plan.isolation.binarySha256&&/^[0-9a-f]{64}$/.test(attestation.evidenceDigest),
      'OS isolation has not been independently verified; refusing fixture start');
    if(requiresFix)check(
      attestation.sourceProof?.fixturePr32Sha===selected.app.sourceProof.fixtureSha&&
      attestation.sourceProof?.headingFixPr31Sha===STATICREF_FIX31.sha&&
      attestation.sourceProof?.combinedAppSha===selected.app.sha&&
      Object.entries(STATICREF_FIX31.blobs).every(([file,sha])=>
        attestation.sourceProof?.gitBlobs?.[file]===sha),
      'StaticRef OS host did not return exact committed PR31 source proof');
    if(!await this.host.portFree(selected.app.port)){
      await this.host.cleanup?.({...selected,mode:'fixture'});
      throw new Error('Fixture port occupied or cannot be checked; foreign process reuse refused');
    }
    let child;
    const session={...selected,reviewId:this.plan.reviewId,attestation,key,mode:'fixture',state:'starting'};
    this.owned.set(appId,session);
    try{
      child=await this.host.spawn({...session,mode:'fixture',plan:this.plan});
      check(Number.isSafeInteger(child?.pid)&&child.pid>0,'Isolator did not return an owned child handle');
      session.child=child;
      const health=await this.host.health(session);
      const expectedVariant=selected.bundle.variant==='baseline'?'installed':selected.bundle.variant;
      const candidateComposition=selected.bundle.variant!=='baseline';
      const comp=health?.composition;
      const validComposition=!candidateComposition||(
        comp?.id==='review-workspace'&&String(comp.revision)==='1'&&
        Array.isArray(comp.instances)&&comp.instances.length>=1&&comp.instances.length<=20&&
        comp.instances.every(id=>typeof id==='string'&&/^[a-z][a-z0-9.-]{1,79}$/.test(id))
      );
      check(validComposition,'Candidate fixture did not prove a declared review-workspace@1 instance');
      check(health?.protocol==='shared-ui-review-health-v1'&&
        health.appSha===selected.app.sha&&health.uiSha===selected.bundle.uiSha&&
        health.bundleDigest===selected.bundle.bundleDigest&&health.seed===seed&&
        health.variant===expectedVariant&&health.pack===selected.bundle.pack&&
        health.files&&typeof health.files==='object'&&!Array.isArray(health.files)&&
        Object.keys(health.files).length===FILES.length&&
        FILES.every(name=>health.files[name]===selected.bundle.digests[name])&&
        health.mockOnly===true&&health.productionWritesDisabled===true&&health.realAppCode===true,
        'Fixture did not confirm the exact real-code app, bundle and mock boundary');
      session.state='ready';
      check(health.fixture_route===undefined||health.fixture_route===appRoute(selected.app),
        'Fixture served a different synthetic review route');
      const saved=await this.host.record(receipt('start',session,{
        result:'health-verified/browser-unrun',healthPath:selected.app.healthPath,
        composition:comp?{id:comp.id,revision:String(comp.revision),instances:[...comp.instances]}:null
      }));
      return {app:appId,pid:child.pid,port:selected.app.port,variant,seed,reused:false,receipt:saved,
        href:'http://127.0.0.1:'+selected.app.port+selected.app.reviewRoute};
    }catch(error){
      // The manager knows only this child; never attempt to kill a PID recovered
      // from a port probe, saved receipt or an external running application.
      if(child){
        session.state='stopping';
        const closed=await this.host.stop(child).catch(()=>false);
        if(!closed)throw new Error('Isolated child shutdown unconfirmed; retained owned handle for explicit stop: '+error.message);
      }
      this.owned.delete(appId);
      await this.host.cleanup?.(session);
      throw error;
    }
  }
  async stop(appId){
    const session=this.owned.get(appId);
    if(!session)return {app:appId,stopped:true,alreadyStopped:true};
    session.state='stopping';
    if(this.testChild?.appId===appId){
      if(!await this.host.stop(this.testChild.child))throw new Error('Owned test child remains active; stop remains pending');
      await this.host.cleanup?.({...session,mode:'test'});
      this.testChild=null;this.testActive=false;
    }
    const closed=await this.host.stop(session.child); // SIGTERM, bounded wait; NEVER force kill.
    if(!closed)throw new Error('Graceful stop is pending; do not force kill or infer shutdown');
    this.owned.delete(appId);
    await this.host.cleanup?.(session);
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
    let completed=false;
    try{
      // The test uses the SAME verified isolation profile, immutable source,
      // candidate bundle and seed. It may not run with host shell access.
      const att=await this.host.preflight({...session,plan:this.plan,mode:'test'});
      check(att?.verified===true&&att.profileSha256===session.attestation.profileSha256&&
        att.executableSha256===session.attestation.executableSha256,
        'Test sandbox isolation could not be reverified');
      const child=await this.host.spawn({...session,mode:'test',test,plan:this.plan});
      check(Number.isSafeInteger(child?.pid)&&child.pid>0,'Test needs its own owned child handle');
      this.testChild={appId,child};
      const outcome=await this.host.waitTest(child);
      completed=true;
      const result=outcome?.code===0?'source-test-executed/browser-evidence-separate':'test-failed';
      const saved=await this.host.record(receipt('test',session,{test:name,testPid:child.pid,
        testArgv:[...test.args],exitCode:outcome?.code??null,result}));
      return {app:appId,test:name,result,exitCode:outcome?.code??null,receipt:saved};
    }finally{
      if(completed||!this.testChild){
        this.testActive=false;this.testChild=null;
        await this.host.cleanup?.({...session,mode:'test'});
      }
      // An indeterminate timed-out child remains explicitly owned and must be
      // stopped by the human before starting another test or exiting.
    }
  }
  async exit(){
    check(this.owned.size===0&&!this.testActive,'Stop all owned fixture children explicitly before exiting; no idle auto-shutdown');
    return {closed:true};
  }
}
