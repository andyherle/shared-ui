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
  const inconsistent=copy();
  inconsistent.fixtures[1].command='different launcher';
  assert.throws(()=>collectManifests([{source:'inconsistent',document:inconsistent}]),/one launch\/reset\/adapter/);
  const duplicate=copy();duplicate.fixtures[1].route=duplicate.fixtures[0].route;
  assert.throws(()=>collectManifests([{source:'duplicate',document:duplicate}]),/same direct route/);
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
