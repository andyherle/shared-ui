import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectManifests, escapeHTML, renderIndex, validateManifest, writeIndex} from '../scripts/fixture-index.mjs';

const sample=JSON.parse(fs.readFileSync(new URL('../fixtures/manifest.example.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(sample);
const mutate=(fn)=>{const doc=copy();fn(doc.fixtures[0]);return doc;};

test('public fixture example references only launchable local Style Lab sections',()=>{
  const cases=validateManifest(sample);
  assert.equal(cases.length,4);
  assert.ok(cases.every(item=>item.href.startsWith('http://127.0.0.1:41910/#')));
  assert.ok(cases.every(item=>item.sourceKind==='shared-ui-catalogue' && item.status==='prepared' && item.evidence.result==='unrun'));
  const source=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  for(const item of cases)assert.ok(source.includes('id="'+item.route.slice(2)+'"'),item.route);
});

test('the index merges real application manifests and keeps one launch/reset per app',()=>{
  const a=copy(), b=copy();
  for(const f of b.fixtures) {
    f.app='other-app';f.repository='example/other-app';f.baseUrl='http://localhost:43111';
    f.command='node fixtures/serve.mjs';f.reset='node fixtures/reset.mjs';f.sourceKind='real-app';
  }
  const entries=collectManifests([{source:'a',document:a},{source:'b',document:b}]);
  assert.equal(entries.length,8);
  assert.deepEqual([...new Set(entries.map(x=>x.app))],['other-app','shared-ui-catalogue']);
  const differentProfile=copy();
  differentProfile.fixtures[1].command='separate profile launcher';
  differentProfile.fixtures[1].baseUrl='http://localhost:43112';
  assert.equal(collectManifests([{source:'profiles',document:differentProfile}]).length,4);
  const inconsistent=copy();
  inconsistent.fixtures[1].reset='different reset on same launch profile';
  assert.throws(()=>collectManifests([{source:'inconsistent',document:inconsistent}]),/inconsistent launch profile/);
  const reused=copy();reused.fixtures[1].route=reused.fixtures[0].route;
  assert.equal(collectManifests([{source:'reused',document:reused}]).length,4);
  assert.throws(()=>collectManifests([{source:'a',document:a},{source:'a2',document:a}]),/duplicate/);
});

test('reject remote origins, credentials, traversal, ambiguous route and unacknowledged production data',()=>{
  const rejected=[
    f=>{f.baseUrl='https://example.org:43111';},
    f=>{f.baseUrl='http://user:secret@localhost:43111';},
    f=>{f.baseUrl='http://localhost:43111/private';},
    f=>{f.baseUrl='http://localhost';},
    f=>{f.route='//example.org/home';},
    f=>{f.route='/\\example.org/home';},
    f=>{f.route='/private/../foo';},
    f=>{f.route='/private/%2e%2e/foo';},
    f=>{f.route='/%00';},
    f=>{f.route='javascript:alert(1)';},
    f=>{f.mockOnly=false;},
    f=>{f.productionWritesDisabled=false;},
    f=>{f.unredactedCustomerData={customer:'secret'};},
    f=>{delete f.evidence;},
    f=>{f.app='Invalid App';},
    f=>{f.sourceKind='unknown';}
  ];
  for(const fn of rejected) assert.throws(()=>validateManifest(mutate(fn)),Error);
});

test('imports coordinator CONTRACT v1 prepared manifests without inventing verification',()=>{
  const legacy=copy();
  legacy.description='Old private app fixture matrix; stay app-owned';
  for(const item of legacy.fixtures) {
    item.app='Example Home';
    item.status='prepared-unrun';
    item.evidence='Prepared only; runtime and browser checks unrun';
    delete item.sourceKind;delete item.mockOnly;delete item.productionWritesDisabled;
  }
  legacy.fixtures[0].launchUrl='http://127.0.0.1:41910/fixture-login?mode=rich&next=%2F%23buttons';
  const fixtures=collectManifests([{source:'existing-owner',document:legacy}]);
  assert.equal(fixtures.length,4);
  assert.equal(fixtures[0].status,'prepared');
  assert.equal(fixtures[0].evidence.result,'unrun');
  assert.match(fixtures[0].isolation,/not explicitly attested/);
  assert.ok(fixtures[0].href.startsWith('http://127.0.0.1:41910/fixture-login'));
  const unsafe=structuredClone(legacy);
  unsafe.fixtures[0].status='verified';
  assert.throws(()=>validateManifest(unsafe));
  unsafe.fixtures[0].status='prepared-unrun';
  unsafe.fixtures[0].launchUrl='https://example.org/login';
  assert.throws(()=>validateManifest(unsafe),/same-origin/);
});

test('normalizes Home, Ledger, Delivery and Portal v1 wrapper formats',()=>{
  const f=structuredClone(copy().fixtures[0]);
  f.app='Example Home';f.status='prepared-unrun';f.evidence='Source only, runtime unrun';
  delete f.sourceKind;delete f.mockOnly;delete f.productionWritesDisabled;
  const wrappers=[
    {schemaVersion:1,description:'Synthetic Home',fixtures:[f]},
    {schemaVersion:1,app:'Ledger',repository:'example/ledger',ref:'fixture',
      command:f.command,baseUrl:f.baseUrl,reset:f.reset,scope:'synthetic',
      fixtureStates:[{...f,app:'Ledger'}]},
    {schema:'shared-ui-fixture-manifest-v1',fixtureOnly:true,
      sharedBundle:{version:'1.10.2'},ownership:'synthetic only',
      entries:[{...f,app:'Delivery'}]},
    [{...f,app:'portal',launchUrl:f.baseUrl+'/fixture-login?mode=rich&next=%2Ftools'}]
  ];
  for(const [i,document] of wrappers.entries()){
    const entries=validateManifest(document,'legacy-'+i);
    assert.equal(entries.length,1);
    assert.equal(entries[0].status,'prepared');
    assert.equal(entries[0].evidence.result,'unrun');
    assert.match(entries[0].isolation,/not explicitly attested/);
  }
  const combined=collectManifests(wrappers.map((document,i)=>({document,source:'legacy-'+i})));
  assert.equal(combined.length,4);
  assert.ok(renderIndex(combined).includes('Example Home'));
  assert.ok(renderIndex(combined).includes('fixture-login'));
});

test('only real observed execution receipts can label a fixture verified',()=>{
  const doc=mutate(f=>{f.status='verified';});assert.throws(()=>validateManifest(doc),/verified fixtures require|invalid runner/);
  doc.fixtures[0].evidence={
    result:'passed',runner:'local-browser',command:'npm run fixture:check',
    commit:'0123456789abcdef0123456789abcdef01234567',
    observedAt:'2026-10-16T23:15:00Z'
  };
  assert.equal(validateManifest(doc)[0].status,'verified');
  doc.fixtures[0].evidence.observedAt='not a time';
  assert.throws(()=>validateManifest(doc),/verified fixtures require/);
});

test('static HTML index escapes untrusted manifest text and never embeds executable script',()=>{
  const doc=mutate(f=>{
    f.expectedInteraction='<script>alert("x")</script> & data';
    f.state='RTL عربي <img src=x onerror=alert(1)>';
    f.route='/?q=%3Cscript%3E&fixture=stress';
  });
  const html=renderIndex(validateManifest(doc));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&amp;fixture=stress'));
  assert.ok(!html.includes('fetch('));
  assert.equal(escapeHTML(`<&>"'`),'&lt;&amp;&gt;&quot;&#39;');
});

test('writes an offline index outside public shared-ui and refuses output symlinks',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ui-index-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const output=path.join(dir,'index.html');
  assert.equal(writeIndex(output,renderIndex(validateManifest(sample))),output);
  assert.ok(fs.readFileSync(output,'utf8').includes('UI fixture index'));
  assert.equal(fs.statSync(output).mode & 0o077,0);
  const symlink=path.join(dir,'redirect.html');
  fs.symlinkSync(output,symlink);
  assert.throws(()=>writeIndex(symlink,'oops'),/symlink/);
  const repoRoot=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
  assert.throws(()=>writeIndex(path.join(repoRoot,'fixtures','forbidden.html'),'oops'),/outside the public/);
});
