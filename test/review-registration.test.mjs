import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {REVIEW_REGISTRY,REVIEW_IDS,registrationFor,profileFor,readinessFor,
  checkMountCompatibility,reviewOriginRoute} from '../scripts/review-registration.mjs';
import {ReviewManager,bundleFingerprint,validateReviewPlan} from '../scripts/review-manager.mjs';
import {dispatchLine} from '../scripts/review-launcher.mjs';

const sha=c=>c.repeat(40);
const hash=c=>c.repeat(64);
const files=(id,variant)=>{
  const num=(id.charCodeAt(0)%9)+1;
  return {'styles.css':hash(String(num)),'runtime.js':hash(variant==='candidate'?'a':'b'),
    'icons.svg':hash('c'),'manifest.json':hash('d')};
};
function plan(){
  const bundles=[];
  for(const pack of ['postvisual','personal'])for(const variant of ['baseline','candidate']){
    const digests=files(pack,variant);
    bundles.push({id:pack+'-'+variant,pack,variant,root:'/private/bundles/'+pack+'-'+variant,
      sourceRoot:'/private/ui-'+variant,uiSha:sha(variant==='candidate'?'a':'b'),
      digests,bundleDigest:bundleFingerprint(digests)});
  }
  const apps=REVIEW_REGISTRY.owners.map((reg,index)=>{
    const p=reg.profiles[0],root='/private/'+reg.id;
    return {id:reg.id,repository:reg.repository,root,sha:sha(String(index+1)),
      profile:p.name,port:p.port,pack:p.pack,reviewRoute:p.reviewRoute,
      ...(p.manifestMode==='checkout'?{manifest:root+'/'+p.manifestPath}:{}),
      bundleRefs:{baseline:p.pack+'-baseline',candidate:p.pack+'-candidate'},
      healthPath:'/__fixture__/review-lock.json',
      start:{binary:'/private/node',binarySha256:hash('f'),
        args:['scripts/review.mjs'],sourceFiles:['scripts/review.mjs']},
      tests:{}};
  });
  return {schemaVersion:1,reviewId:'fleet-six-consumers',receiptDir:'/private/review-receipts',
    isolation:{binary:'/private/trusted-sandbox',binarySha256:hash('e'),
      policy:'/private/private-policy',policySha256:hash('d')},bundles,apps};
}
function fakeHost(plan){
  const calls={preflight:[],spawn:[],stop:[],record:[],manifest:[]};let pid=1190;
  return {calls,
    async preflight(selected){calls.preflight.push(selected);
      return {verified:true,profileSha256:plan.isolation.policySha256,
        executableSha256:plan.isolation.binarySha256,evidenceDigest:hash('1')};},
    async portFree(){return true;},
    async spawn(s){calls.spawn.push(s);return {pid:++pid,exitCode:null,signalCode:null};},
    async health(s){
      const selected=s.bundle;
      return {protocol:'shared-ui-review-health-v1',
        appSha:s.app.sha,uiSha:selected.uiSha,bundleDigest:selected.bundleDigest,
        files:{...selected.digests},seed:s.seed,pack:selected.pack,
        variant:selected.variant==='baseline'?'installed':selected.variant,
        mockOnly:true,productionWritesDisabled:true,realAppCode:true,
        ...(selected.variant==='candidate'?{
          composition:{id:'review-workspace',revision:'1',instances:[s.app.id+'.review']}
        }:{})};
    },
    async validateRuntimeManifest(s){calls.manifest.push(s);return {verified:true};},
    async record(receipt){calls.record.push(receipt);return '/private/receipt'+calls.record.length+'.json';},
    async stop(child){calls.stop.push(child);child.exitCode=0;return true;},
    async cleanup(){}
  };
}
test('one canonical versioned registry includes every required consumer and original app profile',()=>{
  assert.deepEqual(REVIEW_IDS,['staticref','aura','home','ledger','delivery','portal']);
  assert.deepEqual(REVIEW_REGISTRY.owners.map(o=>o.id),REVIEW_IDS);
  assert.equal(REVIEW_REGISTRY.maxOwnedFixtureChildren,2);
  const allProfiles=REVIEW_REGISTRY.owners.flatMap(o=>o.profiles.map(p=>[o.id,p.name,p.pack,p.port]));
  assert.equal(allProfiles.length,8);
  assert.deepEqual(registrationFor('ledger').profiles.map(p=>p.port),[41924,41925]);
  assert.deepEqual(registrationFor('delivery').profiles.map(p=>p.port),[41927,41928]);
  assert.equal(profileFor(registrationFor('portal')).manifestMode,'runtime-loopback');
  assert.equal(profileFor(registrationFor('portal')).port,41915);
  assert.equal(profileFor(registrationFor('ledger')).seed,'7');
  assert.equal(profileFor(registrationFor('aura')).seed,'seed-1');
  assert.deepEqual([...new Set(allProfiles.map(row=>row[3]))].length,allProfiles.length);
  assert.equal(registrationFor('unknown'),null);
  assert.equal(readinessFor({},registrationFor('portal'),'candidate').state,'blocked');
  assert.equal(readinessFor({},registrationFor('home'),'candidate').state,'blocked');
  assert.throws(()=>{REVIEW_REGISTRY.owners[0].id='not-staticref';},TypeError);
});

test('source-ready native and blocked SSR pre-mount modes remain separate, not unsupported',()=>{
  assert.equal(checkMountCompatibility({},registrationFor('aura'),{state:'prepared'}).state,'prepared');
  const blocked=checkMountCompatibility({},registrationFor('portal'),{state:'prepared'});
  assert.equal(blocked.state,'blocked');
  assert.match(blocked.reason,/SSR\/pre-mount/);
  const app={sha:sha('6'),mountEvidence:{
    strategy:'ssr-pre-hydration-tested',sourceSha:sha('6'),
    testFile:'internal/web/ui_fixture_review_contract_test.go',
    instanceIds:['portal.document.review'],nativeFormOwner:true,outerDialogHost:true,
    connectedNodesMoved:false}};
  assert.equal(checkMountCompatibility(app,registrationFor('portal'),{state:'prepared'}).state,'prepared');
  app.mountEvidence.connectedNodesMoved=true;
  assert.throws(()=>checkMountCompatibility(app,registrationFor('portal'),{state:'prepared'}),/connected forms/);
  app.mountEvidence.connectedNodesMoved=false;
  app.mountEvidence.testFile='../../unsafe/executable';
  assert.throws(()=>checkMountCompatibility(app,registrationFor('portal'),{state:'prepared'}),/connected forms/);
});

test('all six app source profiles validate and expose independent selected pack bundles',()=>{
  const p=plan(),checked=validateReviewPlan(p);
  assert.equal(checked.apps.length,6);
  const h=fakeHost(p),m=new ReviewManager(p,h),states=m.status();
  assert.equal(states.length,6);
  assert.equal(states.filter(s=>s.supported&&s.configured).length,6);
  assert.equal(states.find(s=>s.app==='portal').pack,'personal');
  assert.equal(states.find(s=>s.app==='ledger').pack,'postvisual');
  assert.equal(states.find(s=>s.app==='home').candidate.state,'blocked');
  assert.equal(states.find(s=>s.app==='delivery').candidate.state,'blocked');
  assert.equal(states.find(s=>s.app==='ledger').candidate.state,'blocked');
  assert.equal(states.find(s=>s.app==='portal').candidate.state,'blocked');
  assert.equal(states.find(s=>s.app==='aura').candidate.state,'prepared');
  assert.equal(states.find(s=>s.app==='staticref').candidate.state,'prepared');
});

test('registered but not in private plan is BLOCKED and remains visible in six-owner status',async()=>{
  const p=plan();p.apps=[p.apps.find(a=>a.id==='staticref')];
  const h=fakeHost(p),m=new ReviewManager(p,h);
  assert.equal(m.status().length,6);
  assert.equal(m.status().filter(s=>s.configured).length,1);
  const home=m.status().find(s=>s.app==='home');
  assert.equal(home.supported,true);
  assert.equal(home.configured,false);
  assert.equal(home.state,'blocked');
  await assert.rejects(m.start('home','baseline'),/registered but BLOCKED/);
  await assert.rejects(m.start('something-else','baseline'),/Unknown consumer/);
  assert.equal(h.calls.spawn.length,0);
});

test('two owned app children maximum despite six registered, with a separate Personal pack and ledger seed',async()=>{
  const p=plan(),h=fakeHost(p),m=new ReviewManager(p,h);
  const home=await m.start('home','baseline');
  assert.equal(home.pack,'postvisual');
  assert.equal(home.port,18795);
  const portal=await m.start('portal','baseline');
  assert.equal(portal.pack,'personal');
  assert.equal(portal.port,41915);
  assert.equal(h.calls.manifest.length,1);
  await assert.rejects(m.start('delivery','baseline'),/At most two/);
  assert.equal(h.calls.spawn.length,2);
  await m.stop('home');
  const ledger=await m.start('ledger','baseline');
  assert.equal(ledger.seed,'7');
  assert.equal(ledger.pack,'postvisual');
  assert.equal(ledger.port,41924);
  assert.equal(h.calls.record.find(r=>r.app==='ledger'&&r.kind==='start')?.seed,'7');
  await assert.rejects(m.start('ledger','candidate'),/BLOCKED|stop it explicitly/);
  await m.stop('portal');await m.stop('ledger');
  assert.deepEqual(await m.exit(),{closed:true});
});

test('per-app pack/profiles cannot silently run a wrong candidate or swap ports',()=>{
  const p=plan();
  const changed=structuredClone(p);
  changed.apps.find(a=>a.id==='portal').bundleRefs.candidate='postvisual-candidate';
  assert.throws(()=>validateReviewPlan(changed),/bundle reference/);
  const mismatch=structuredClone(p);
  mismatch.apps.find(a=>a.id==='home').port=41927;
  assert.throws(()=>validateReviewPlan(mismatch),/registered fixture profile/);
  const broken=structuredClone(p);
  broken.apps.find(a=>a.id==='ledger').profile='personal';
  assert.throws(()=>validateReviewPlan(broken),/registered fixture profile/);
  const personal=structuredClone(p);
  const ledger=personal.apps.find(a=>a.id==='ledger');
  ledger.profile='personal';ledger.port=41925;ledger.pack='personal';
  ledger.reviewRoute='/?fixture=many&seed=7&view=reconcile&layout=phone';
  ledger.bundleRefs={baseline:'personal-baseline',candidate:'personal-candidate'};
  assert.equal(validateReviewPlan(personal).apps.find(a=>a.id==='ledger').pack,'personal');
  const ambiguous=structuredClone(p);
  const extra=structuredClone(ambiguous.bundles[0]);extra.id='home-custom-baseline';
  ambiguous.bundles.push(extra);delete ambiguous.apps.find(a=>a.id==='home').bundleRefs;
  // Source admission still validates; exact selection must block ambiguous bundles.
  assert.equal(validateReviewPlan(ambiguous).apps.length,6);
  const m=new ReviewManager(ambiguous,fakeHost(ambiguous));
  assert.rejects(m.start('home','baseline'),/no unique pinned/);
});

test('blocked candidate startup refuses before any OS preflight; future SSR readiness requires declared native ownership',async()=>{
  const p=plan(),h=fakeHost(p),m=new ReviewManager(p,h);
  for(const id of ['home','ledger','delivery','portal'])
    await assert.rejects(m.start(id,'candidate'),/BLOCKED/);
  assert.equal(h.calls.preflight.length,0);
  assert.equal(h.calls.spawn.length,0);
  const upgraded=plan(),app=upgraded.apps.find(a=>a.id==='portal');
  app.readiness={candidate:{state:'prepared',reason:'Native SSR prehydration reviewed in exact app source',
    sourceSha:app.sha}};
  const m2=new ReviewManager(upgraded,fakeHost(upgraded));
  await assert.rejects(m2.start('portal','candidate'),/SSR\/pre-mount/);
  app.mountEvidence={strategy:'ssr-pre-hydration-tested',sourceSha:app.sha,
    testFile:'internal/web/ui_fixture_review_contract_test.go',
    instanceIds:['portal.document.review'],nativeFormOwner:true,outerDialogHost:true,
    connectedNodesMoved:false};
  assert.equal(validateReviewPlan(upgraded).apps.length,6);
  // Source readiness now PREPARED, but actual runtime/browser proof still unrun.
  assert.equal(new ReviewManager(upgraded,fakeHost(upgraded)).status()
    .find(s=>s.app==='portal').candidate.state,'prepared');
});

test('shared registry route parser preserves exact real-app fragments but refuses escapes',()=>{
  assert.equal(reviewOriginRoute('/?fixture=default&frame=desktop#Documents'),
    '/?fixture=default&frame=desktop#Documents');
  for(const route of ['//external/', '/%2e%2e/secrets','/\\bad','/%00bad','javascript:alert(1)'])
    assert.throws(()=>reviewOriginRoute(route),/Unsafe|Malformed|escape/);
});
