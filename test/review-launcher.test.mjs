import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {bundleFingerprint,ReviewManager,validateReviewPlan,STATICREF_FIX31} from '../scripts/review-manager.mjs';
import {verifyBundleFiles,verifySandboxAttestation,readReviewPlan,verifyStaticRefSourceReport} from '../scripts/review-host.mjs';
import {dispatchLine} from '../scripts/review-launcher.mjs';

const hex=(c,n)=>c.repeat(n);
const sha256=data=>createHash('sha256').update(data).digest('hex');
function command(binary,script,args=[]){
  return {binary,binarySha256:hex('b',64),args:[script,...args],sourceFiles:[script]};
}
function plan(){
  const bundle=variant=>{
    const digests={'styles.css':hex('1',64),'runtime.js':hex('2',64),
      'icons.svg':hex('3',64),'manifest.json':hex('4',64)};
    if(variant==='candidate')digests['runtime.js']=hex('a',64);
    return {variant,root:'/private/ui-'+variant,sourceRoot:'/private/ui-source-'+variant,
      uiSha:variant==='candidate'?hex('c',40):hex('d',40),pack:'postvisual',
      digests,bundleDigest:bundleFingerprint(digests)};
  };
  return {schemaVersion:1,reviewId:'review-candidate-01',receiptDir:'/private/review-receipts',
    isolation:{binary:'/private/audited-isolator',binarySha256:hex('a',64),
      policy:'/private/policy.json',policySha256:hex('e',64)},
    bundles:[bundle('baseline'),bundle('candidate')],
    apps:[
      {id:'aura',repository:'andyherle/aura',root:'/private/aura',sha:hex('f',40),
        port:41888,manifest:'/private/aura/fixtures/ui-manifest.json',
        healthPath:'/__fixture__/review-lock.json',reviewRoute:'/studio?state=default',
        start:command('/private/node','scripts/ui-fixtures.mjs',['--port=41888']),
        tests:{http:command('/private/node','tests/ui-fixtures.test.mjs',['--test']),
          browser:command('/private/node','tests/ui-fixtures.browser.test.mjs',['--test'])}},
      {id:'staticref',repository:'andyherle/StaticRef',root:'/private/staticref',sha:hex('0',40),
        port:8769,manifest:'/private/staticref/tests/browser/ui-fixture-manifest.json',
        healthPath:'/__fixture__/review-lock.json',reviewRoute:'/reference/c/editorial/?fixture=normal',
        start:command('/private/python','tests/browser/serve_ui_review.py',['--port=8769']),
        tests:{http:command('/private/node','tests/ui-fixture.test.mjs',['--test'])}}
    ]};
}
function fakeHost(planInput=plan()){
  let pid=1000; const calls={preflight:[],spawn:[],stop:[],record:[],cleanup:[],port:[]};
  const host={
    calls,block:false,busy:false,failHealth:false,shutdownUnknown:false,
    async preflight(s){
      calls.preflight.push(s);
      return host.block?{verified:false}:{
        verified:true,profileSha256:planInput.isolation.policySha256,
        executableSha256:planInput.isolation.binarySha256,evidenceDigest:hex('a',64)};
    },
    async portFree(port){calls.port.push(port);return !host.busy;},
    async spawn(s){calls.spawn.push(s);return {pid:++pid,exitCode:null,signalCode:null};},
    async health(s){return host.failHealth?{}:{
      protocol:'shared-ui-review-health-v1',appSha:s.app.sha,
      uiSha:s.bundle.uiSha,bundleDigest:s.bundle.bundleDigest,
      seed:s.seed,variant:s.bundle.variant==='baseline'?'installed':s.bundle.variant,
      pack:s.bundle.pack,files:{...s.bundle.digests},
      fixture_route:s.app.reviewRoute,
      composition:{id:'review-workspace',revision:'1',instances:[s.app.id+'.review-workspace']},
      mockOnly:true,productionWritesDisabled:true,realAppCode:true};},
    async stop(child){calls.stop.push(child);if(host.shutdownUnknown)return false;child.exitCode=0;return true;},
    async waitTest(child){child.exitCode=0;return {code:0};},
    async record(r){calls.record.push(structuredClone(r));return '/private/review-receipts/receipt-'+calls.record.length+'.json';},
    async cleanup(s){calls.cleanup.push(s);}
  };
  return host;
}

test('review config requires two pinned clean-commit owners and separate baseline/candidate digests',()=>{
  const config=plan();
  assert.equal(validateReviewPlan(config).apps.length,2);
  assert.notEqual(config.bundles[0].bundleDigest,config.bundles[1].bundleDigest);
  const ordered=Object.fromEntries(Object.entries(config.bundles[0].digests).sort(([a],[b])=>a.localeCompare(b)));
  assert.equal(config.bundles[0].bundleDigest,sha256(JSON.stringify({files:ordered})));
  for(const mutation of [
    c=>{c.isolation={};},c=>{delete c.bundles[1];},
    c=>{c.apps[0].sha='main';},c=>{c.apps[0].root='/private/../live';},
    c=>{c.apps[0].port=80;},c=>{c.apps[1].port=41888;},
    c=>{c.apps[0].tests.http.args=['-e','require("fs").readFileSync("/secrets")'];},
    c=>{c.apps[0].start.sourceFiles=['../private'];},
    c=>{c.bundles[1].digests['runtime.js']=hex('0',64);},
    c=>{c.bundles[1].root='/private/shared-ui-sandbox';c.bundles[1].extra='unreviewed';},
    c=>{c.apps[1].repository='other/StaticRef';},
    c=>{c.apps[1].start.binarySha256='unverified';}
  ]){
    const broken=structuredClone(config);mutation(broken);
    assert.throws(()=>validateReviewPlan(broken),Error);
  }
  assert.throws(()=>bundleFingerprint({'styles.css':hex('0',64)}),/pinned digest/);
});

test('StaticRef-FIRST accepts one owner without requiring Aura; routes are exact and bounded',async()=>{
  const base=plan(),single={...base,apps:[structuredClone(base.apps[1])]};
  assert.equal(validateReviewPlan(single).apps.length,1);
  const m=new ReviewManager(single,fakeHost(single));
  assert.equal(m.status().length,1);
  const started=await m.start('staticref','baseline','seed-1');
  assert.equal(started.href,'http://127.0.0.1:8769/reference/c/editorial/?fixture=normal');
  await m.stop('staticref');
  for(const mutation of [
    c=>{c.apps=[];},
    c=>{c.apps.push({...structuredClone(base.apps[0]),id:'staticref'});},
    c=>{c.apps[0].reviewRoute='//foreign.example/';},
    c=>{c.apps[0].reviewRoute='/%2e%2e/secret';},
    c=>{c.apps[0].reviewRoute='/reference/#unbounded';},
    c=>{delete c.apps[0].reviewRoute;}
  ]){
    const invalid=structuredClone(single);mutation(invalid);
    assert.throws(()=>validateReviewPlan(invalid),Error);
  }
  const tooMany=structuredClone(base);
  tooMany.apps.push({...structuredClone(base.apps[1]),id:'another'});
  assert.throws(()=>validateReviewPlan(tooMany),/one or two/);
});

test('StaticRef source admission rejects old Canvas blobs and unreviewed extra changes',()=>{
  const c=structuredClone(plan().apps[1]);
  c.sha='e'.repeat(40);
  c.sourceProof={fixtureSha:'8c00b29781340327174a6d3f08768b318c9079b9',
    fixSha:STATICREF_FIX31.sha};
  const paths=Object.keys(STATICREF_FIX31.blobs);
  const report={fixtureAncestor:true,combinedSha:c.sha,
    changedFiles:[...paths],headBlobs:{...STATICREF_FIX31.blobs},fixBlobs:{...STATICREF_FIX31.blobs}};
  assert.equal(validateReviewPlan({...plan(),apps:[c]}).apps.length,1);
  const proven=verifyStaticRefSourceReport(c,report);
  assert.equal(proven.combinedAppSha,c.sha);
  assert.equal(proven.headingFixPr31Sha,STATICREF_FIX31.sha);
  assert.deepEqual(proven.gitBlobs,STATICREF_FIX31.blobs);
  for(const mutate of [
    r=>{r.changedFiles.push('staticref/web/gallery-aspect.js');},
    r=>{r.changedFiles.pop();},
    r=>{r.headBlobs['staticref/web/canvas.js']='06445a987cf2e21f1bfdea3a72c62b33b416ffc4';},
    r=>{r.fixBlobs['staticref/web/canvas.css']='39a0c6429d3729d472afeb864495999dbbc976aa';},
    r=>{r.fixtureAncestor=false;},
    r=>{r.combinedSha='0'.repeat(40);}
  ]){
    const invalid=structuredClone(report);mutate(invalid);
    assert.throws(()=>verifyStaticRefSourceReport(c,invalid),Error);
  }
  const invalid=structuredClone(c);invalid.sourceProof.fixSha='0'.repeat(40);
  assert.throws(()=>validateReviewPlan({...plan(),apps:[invalid]}),/PR31|exact/);
  assert.throws(()=>verifyStaticRefSourceReport({...c,sourceProof:null},report),Error);
});

test('StaticRef candidate is never admitted without independently returned PR31 blob provenance',async()=>{
  const p=plan();p.apps=[p.apps[1]];
  const host=fakeHost(p),manager=new ReviewManager(p,host);
  await assert.rejects(manager.start('staticref','candidate','seed-1'),/sourceProof/);
  assert.equal(host.calls.spawn.length,0);
  const proof={fixtureSha:'2e6d2bbb31fb5e2010c87cce79b4065dc5ed1a3d',
    fixSha:STATICREF_FIX31.sha};
  p.apps[0].sourceProof=proof;
  const host2=fakeHost(p);
  const manager2=new ReviewManager(p,host2);
  await assert.rejects(manager2.start('staticref','candidate','seed-1'),/committed PR31 source proof/);
  assert.equal(host2.calls.spawn.length,0);
  host2.preflight=async selected=>({
    verified:true,profileSha256:p.isolation.policySha256,
    executableSha256:p.isolation.binarySha256,evidenceDigest:hex('a',64),
    sourceProof:{
      fixturePr32Sha:proof.fixtureSha,headingFixPr31Sha:STATICREF_FIX31.sha,
      combinedAppSha:p.apps[0].sha,gitBlobs:{...STATICREF_FIX31.blobs}
    }
  });
  const result=await manager2.start('staticref','candidate','seed-1');
  assert.equal(result.port,8769);
  assert.equal(host2.calls.record[0].fixtureRoute,'/reference/c/editorial/?fixture=normal');
  await manager2.stop('staticref');
});

test('OS sandbox attestation is a pinned challenge/probe result, never a mockOnly flag',()=>{
  const config=plan(),challenge='nonce-0123';
  const valid={
    protocol:'shared-ui-review-os-isolation-v1',challenge,
    profileSha256:config.isolation.policySha256,executableSha256:config.isolation.binarySha256,
    verification:'os-probes-passed',
    enforcement:{network:'kernel-egress-deny-except-fixture',filesystem:'readonly-allowlist-plus-scratch',
      process:'supervised-owned-foreground',productionMounts:'absent',environment:'scrubbed'},
    probes:Object.fromEntries(['externalNetwork','otherLoopback','productionFilesystem','sourceWrite','serviceWorkerNetwork']
      .map(name=>[name,{result:'denied-by-os',error:'EPERM'}]))
  };
  const output=verifySandboxAttestation(valid,challenge,config.isolation);
  assert.equal(output.verified,true);assert.match(output.evidenceDigest,/^[0-9a-f]{64}$/);
  for(const change of [
    a=>{a.challenge='reused';},a=>{a.verification='mock-only';},
    a=>{a.probes.otherLoopback.result='declared';},
    a=>{delete a.probes.serviceWorkerNetwork;},
    a=>{a.enforcement.productionMounts='host-mounts';},
    a=>{a.profileSha256=hex('f',64);}
  ]){
    const result=structuredClone(valid);change(result);
    assert.throws(()=>verifySandboxAttestation(result,challenge,config.isolation),Error);
  }
  assert.throws(()=>verifySandboxAttestation({mockOnly:true},challenge,config.isolation),Error);
});

test('manual start, deduplication and exact immutable source/UI/seed receipt',async()=>{
  const p=plan(),host=fakeHost(p),manager=new ReviewManager(p,host);
  assert.equal(manager.status()[0].state,'stopped');
  const first=await manager.start('aura','candidate','seed-42');
  assert.equal(first.port,41888);assert.equal(first.reused,false);
  assert.equal(host.calls.spawn.length,1);
  const second=await manager.start('aura','candidate','seed-42');
  assert.equal(second.reused,true);assert.equal(host.calls.spawn.length,1);
  assert.equal(host.calls.record[0].appSha,p.apps[0].sha);
  assert.equal(host.calls.record[0].uiSha,p.bundles[1].uiSha);
  assert.equal(host.calls.record[0].bundleDigest,p.bundles[1].bundleDigest);
  assert.equal(host.calls.record[0].seed,'seed-42');
  assert.equal(host.calls.record[0].kind,'start');
  assert.equal(host.calls.record[0].result,'health-verified/browser-unrun');
  assert.equal(host.calls.record[0].fixtureRoute,'/studio?state=default');
  assert.equal(first.href,'http://127.0.0.1:41888/studio?state=default');
  assert.equal(host.calls.record[0].composition.id,'review-workspace');
  assert.equal(host.calls.record[0].composition.instances[0],'aura.review-workspace');
  await assert.rejects(manager.start('aura','baseline','seed-42'),/stop it explicitly/);
  await assert.rejects(manager.start('aura','candidate','different-seed'),/stop it explicitly/);
  await manager.start('staticref','baseline','seed-42');
  assert.equal(manager.status().filter(s=>s.owned).length,2);
  await assert.rejects(manager.exit(),/Stop all owned/);
  const stopA=await manager.stop('aura');assert.equal(stopA.stopped,true);
  const stopB=await manager.stop('staticref');assert.equal(stopB.stopped,true);
  assert.equal(host.calls.stop.length,2);
  assert.equal(host.calls.cleanup.length,2);
  assert.deepEqual(await manager.exit(),{closed:true});
  assert.equal((await manager.stop('aura')).alreadyStopped,true);
});

test('absence of external isolation proof, blocked port and wrong app/UI health all fail closed',async()=>{
  for(const [key,message] of [
    ['block',/OS isolation/],['busy',/occupied/],['failHealth',/Candidate fixture/]
  ]){
    const p=plan(),host=fakeHost(p),manager=new ReviewManager(p,host);
    host[key]=true;
    await assert.rejects(manager.start('aura','candidate','stable-seed'),message);
    assert.equal(manager.status()[0].state,'stopped');
    assert.equal(host.calls.spawn.length,key==='failHealth'?1:0);
    assert.equal(host.calls.stop.length,key==='failHealth'?1:0);
    assert.equal(host.calls.record.length,0);
  }
  const p=plan(),host=fakeHost(p);host.shutdownUnknown=true;
  const m=new ReviewManager(p,host);
  await m.start('aura');
  await assert.rejects(m.stop('aura'),/pending/);
  assert.equal(m.status()[0].state,'stopping');
  assert.equal(m.status()[0].owned,true);
  await assert.rejects(m.exit(),/Stop all owned/);
});

test('unexpected owned app exit remains visible, cannot be deduplicated, and is cleaned only by explicit stop',async()=>{
  const p=plan(),host=fakeHost(p),m=new ReviewManager(p,host);
  await m.start('aura','candidate','seed-12');
  const child=m.owned.get('aura').child;
  child.exitCode=1;
  assert.equal(m.status()[0].state,'exited-unexpected');
  assert.equal(m.status()[0].owned,true);
  await assert.rejects(m.start('aura','candidate','seed-12'),/stop it explicitly/);
  assert.equal(host.calls.spawn.length,1);
  await m.stop('aura');
  assert.equal(host.calls.stop[0],child);
  assert.equal(m.status()[0].state,'stopped');
});

test('test execution is a separate explicitly requested sandbox process and receipt',async()=>{
  const p=plan(),host=fakeHost(p),m=new ReviewManager(p,host);
  await assert.rejects(m.test('aura','http'),/Start the exact app/);
  await m.start('aura','candidate','ui-seed');
  const result=await m.test('aura','browser');
  assert.equal(result.exitCode,0);
  assert.equal(host.calls.spawn[1].mode,'test');
  assert.equal(host.calls.preflight[1].mode,'test');
  assert.equal(host.calls.record[1].kind,'test');
  assert.equal(host.calls.record[1].test,'browser');
  assert.equal(host.calls.record[1].bundleDigest,p.bundles[1].bundleDigest);
  assert.equal(host.calls.cleanup[0].mode,'test');
  await assert.rejects(m.test('aura','unknown'),/Unknown app-owned test/);
  await m.stop('aura');
});

test('uncertain timed-out owned test is never orphaned by manager and requires manual stop',async()=>{
  const p=plan(),host=fakeHost(p),m=new ReviewManager(p,host);
  await m.start('aura');
  host.waitTest=async()=>{throw new Error('test timeout');};
  await assert.rejects(m.test('aura','http'),/test timeout/);
  await assert.rejects(m.test('aura','http'),/Only one isolated test/);
  await assert.rejects(m.exit(),/Stop all owned/);
  await m.stop('aura');
  assert.equal(host.calls.stop.length,2);
  assert.equal(host.calls.cleanup.filter(s=>s.mode==='test').length,1);
  assert.deepEqual(await m.exit(),{closed:true});
});

test('immutable candidate file checks compare SHA256, stylesheet SRI and disallow symlink/writable assets',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ui-review-bundle-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const sourceRoot=path.join(dir,'source'),bundleRoot=path.join(dir,'bundle');
  fs.mkdirSync(sourceRoot);fs.mkdirSync(bundleRoot);
  const css=Buffer.from('body{color:#fff}'),revision=sha256(css),integrity='sha384-'+createHash('sha384').update(css).digest('base64');
  const assets={'styles.css':css,'runtime.js':'console.log("fixture")',
    'icons.svg':'<svg/>','manifest.json':JSON.stringify({protocol:1,version:'1.11.0',
      revision,stylesheet:'styles.'+revision+'.css',integrity})};
  const hashes={};
  for(const [name,bytes]of Object.entries(assets)){
    fs.writeFileSync(path.join(bundleRoot,name),bytes);fs.chmodSync(path.join(bundleRoot,name),0o444);
    hashes[name]=sha256(bytes);
  }
  fs.chmodSync(bundleRoot,0o555);
  const bundle={root:bundleRoot,sourceRoot,digests:hashes,bundleDigest:bundleFingerprint(hashes)};
  assert.equal(verifyBundleFiles(bundle).files['styles.css'],revision);
  const changed={...bundle,digests:{...hashes,'runtime.js':hex('0',64)}};
  assert.throws(()=>verifyBundleFiles(changed),/digest mismatch/);
  fs.chmodSync(bundleRoot,0o755);fs.chmodSync(path.join(bundleRoot,'runtime.js'),0o644);
  assert.throws(()=>verifyBundleFiles(bundle),/immutable|read-only/);
});

test('private plan reading and foreground command parser do not start any child on import',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ui-review-config-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const config=path.join(dir,'review.json');
  fs.writeFileSync(config,JSON.stringify(plan()));fs.chmodSync(config,0o600);
  assert.equal(readReviewPlan(config).reviewId,'review-candidate-01');
  fs.chmodSync(config,0o644);assert.throws(()=>readReviewPlan(config),/Private file permissions/);
  const p=plan(),host=fakeHost(p),m=new ReviewManager(p,host),output=[];
  await dispatchLine(m,host,'help',{output:value=>output.push(value)});
  assert.ok(output.join(' ').toLowerCase().includes('manual'));
  await dispatchLine(m,host,'status',{output:value=>output.push(value)});
  assert.equal(host.calls.spawn.length,0);
  await assert.rejects(dispatchLine(m,host,'start aura candidate bad seed'),/bounded|Unknown|seed|Invalid/);
  assert.deepEqual(await dispatchLine(m,host,'exit'),{continue:false});
});
