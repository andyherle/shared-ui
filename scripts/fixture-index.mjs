#!/usr/bin/env node
// Offline index for app-owned, mock-only UI fixtures. This process never starts apps.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const allowed = new Set(['id','app','repository','ref','command','baseUrl','route','state','expectedInteraction','backendAdapter','reset','sourceKind','mockOnly','productionWritesDisabled','status','evidence','launchUrl']);
const statuses = new Set(['prepared','verified','blocked']);

function fail(where, message) { throw new Error(where + ': ' + message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function string(obj, key, where, max = 2048) {
  const value = obj[key];
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(where, 'invalid ' + key);
  return value;
}
function loopback(base, route, where) {
  let origin, target;
  try { origin = new URL(base); } catch { fail(where, 'invalid baseUrl'); }
  if (!['http:','https:'].includes(origin.protocol) ||
      !['127.0.0.1','localhost','[::1]'].includes(origin.hostname) ||
      origin.username || origin.password || origin.search || origin.hash ||
      origin.pathname !== '/' || !origin.port) fail(where, 'baseUrl must be a loopback origin with explicit port');
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('\\')) fail(where, 'route must be a same-origin absolute path');
  let pathname;
  try { pathname = decodeURIComponent(route.split(/[?#]/,1)[0]); target = new URL(route,origin); }
  catch { fail(where, 'invalid encoded route'); }
  if (/[\u0000-\u001f\u007f]/.test(pathname) || pathname.split('/').includes('..') ||
      target.origin !== origin.origin || target.username || target.password) fail(where, 'unsafe route');
  return target.href;
}
export function validateManifest(document, source = 'manifest') {
  if (!isObject(document) || document.schemaVersion !== 1 || !Array.isArray(document.fixtures) ||
      !document.fixtures.length || document.fixtures.length > 400) fail(source, 'expected schemaVersion 1 with 1–400 fixtures');
  if (Object.keys(document).some(key => !['schemaVersion','fixtures','description'].includes(key))) fail(source, 'unknown top-level key');
  const result = [], seen = new Set();
  for (const [index, record] of document.fixtures.entries()) {
    const where = source + ' fixture ' + (index + 1);
    if (!isObject(record) || Object.keys(record).some(key => !allowed.has(key))) fail(where, 'unexpected fixture key (do not include private data)');
    const item = {};
    for (const key of ['id','app','repository','ref','command','baseUrl','route','state','expectedInteraction','backendAdapter','reset']) item[key] = string(record,key,where);
    if (!/^[a-z][a-z0-9-]{1,79}$/.test(item.id) || !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$/.test(item.app)) fail(where, 'invalid app label or stable fixture id');
    if (!/^[\w.-]+\/[\w.-]+$/.test(item.repository)) fail(where, 'repository must be owner/repo');
    if (record.sourceKind !== undefined && !['real-app','shared-ui-catalogue'].includes(record.sourceKind)) fail(where, 'invalid sourceKind');
    if (record.mockOnly === false || record.productionWritesDisabled === false) fail(where, 'production writes or live adapters must be prohibited');
    const legacy = record.status === 'prepared-unrun';
    item.status = legacy ? 'prepared' : record.status;
    if (!statuses.has(item.status)) fail(where, 'invalid status');
    const declaredIsolation = record.mockOnly === true && record.productionWritesDisabled === true;
    if (!declaredIsolation && item.status !== 'prepared') fail(where, 'unattested isolation cannot be called verified or blocked');
    item.isolation = declaredIsolation ? 'declared mock-only' : 'legacy: isolation not explicitly attested in manifest';
    item.href = loopback(item.baseUrl,item.route,where);
    if (record.launchUrl !== undefined) {
      const launch=string(record,'launchUrl',where), base=new URL(item.baseUrl), target=new URL(launch,base);
      if (launch.includes('\\') || target.origin!==base.origin || target.username || target.password) fail(where,'launchUrl must remain same-origin loopback');
      item.href=loopback(item.baseUrl,target.pathname+target.search+target.hash,where);
    }
    item.sourceKind = record.sourceKind ?? 'real-app';
    item.evidence = typeof record.evidence === 'string' && item.status==='prepared'
      ? {result:'unrun',detail:string(record,'evidence',where)} : record.evidence;
    if (!isObject(item.evidence) ||
        Object.keys(item.evidence).some(key => !['result','runner','command','commit','observedAt','detail'].includes(key))) fail(where, 'invalid evidence');
    if (item.status === 'verified') {
      for (const key of ['runner','command','commit','observedAt']) string(item.evidence,key,where,500);
      if (item.evidence.result !== 'passed' || !Number.isFinite(Date.parse(item.evidence.observedAt))) fail(where, 'verified fixtures require actual passed execution evidence and timestamp');
    } else if (!['unrun','blocked','failed','passed'].includes(item.evidence.result)) fail(where, 'invalid evidence result');
    const identity = item.app + '/' + item.id;
    if (seen.has(identity)) fail(where, 'duplicate app/id ' + identity);
    seen.add(identity);
    result.push(item);
  }
  return result;
}
export function collectManifests(manifests) {
  if (!Array.isArray(manifests) || !manifests.length) throw new Error('At least one fixture manifest is required');
  const fixtures = manifests.flatMap(({document,source}) => validateManifest(document,source));
  const ids = new Set(), routes = new Set(), launchers = new Map();
  for (const item of fixtures) {
    const identity = item.app + '/' + item.id, routeKey=item.app + '/' + item.href;
    if (ids.has(identity)) fail('combined manifest','duplicate ' + identity);
    if (routes.has(routeKey)) fail('combined manifest','two fixture states share the same direct route ' + routeKey);
    ids.add(identity); routes.add(routeKey);
    const fingerprint=JSON.stringify([item.repository,item.ref,item.command,item.baseUrl,item.backendAdapter,item.reset,item.sourceKind]);
    if(launchers.has(item.app) && launchers.get(item.app)!==fingerprint) fail('combined manifest','app ' + item.app + ' must advertise one launch/reset/adapter contract');
    launchers.set(item.app,fingerprint);
  }
  return fixtures.sort((a,b) => a.app.localeCompare(b.app) || a.id.localeCompare(b.id));
}
export function escapeHTML(value) {
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
export function renderIndex(fixtures) {
  const e=escapeHTML, groups=new Map();
  for(const item of fixtures) {
    if(!groups.has(item.app))groups.set(item.app,[]);
    groups.get(item.app).push(item);
  }
  const counts={prepared:0,verified:0,blocked:0};
  for(const item of fixtures)counts[item.status]++;
  const sections=[...groups].map(([app,items])=>{
    const head=items[0], rows=items.map(item=>{
      const ev=item.evidence;
      const receipt=ev.result==='unrun'?'No fixture execution recorded.':
        ev.result==='passed'?'Execution passed (see evidence).':'Execution '+ev.result+'.';
      const details=['Result: '+ev.result,ev.runner&&'Runner: '+ev.runner,
        ev.command&&'Command: '+ev.command,ev.commit&&'Commit: '+ev.commit,
        ev.observedAt&&'Observed: '+ev.observedAt,ev.detail&&'Detail: '+ev.detail].filter(Boolean);
      return '<tr><th scope="row">'+e(item.id)+'<small>'+e(item.state)+'</small></th>'+
        '<td><a href="'+e(item.href)+'">'+e(item.route)+'</a></td>'+
        '<td>'+e(item.expectedInteraction)+'</td>'+
        '<td><strong>'+e(item.status)+'</strong><small>'+e(receipt)+'</small><details><summary>Evidence</summary><pre>'+e(details.join('\n'))+'</pre></details></td></tr>';
    }).join('');
    return '<section><h2>'+e(app)+'</h2><p>Source: '+e(head.repository)+' @ '+e(head.ref)+
      ' · '+e(head.sourceKind)+'</p><dl><dt>Start locally</dt><dd><code>'+e(head.command)+
      '</code></dd><dt>Reset synthetic state</dt><dd><code>'+e(head.reset)+'</code></dd>'+
      '<dt>Backend boundary</dt><dd>'+e(head.backendAdapter)+'</dd><dt>Isolation</dt><dd>'+e(head.isolation)+'</dd></dl>'+
      '<div class="scroller"><table><thead><tr><th>Fixture / state</th><th>Direct route</th><th>Expected interaction</th><th>Status</th></tr></thead><tbody>'+
      rows+'</tbody></table></div></section>';
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="referrer" content="no-referrer"><title>Shared UI fixture index</title>'+
    '<style>body{font:15px/1.5 system-ui,sans-serif;max-width:1160px;margin:2rem auto;padding:0 1rem;color:#202020;background:#fff}h1,h2{line-height:1.3}section{border-top:1px solid #ccc;padding-block:1rem 2rem}dl{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:.25rem 1rem}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}.scroller{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{padding:.6rem;text-align:left;vertical-align:top;border-bottom:1px solid #ccc;min-width:120px}th[scope=row]{font-weight:600}a{color:#124a96}small{display:block;color:#555;margin-top:.3rem}code,pre{font:12px/1.5 ui-monospace,monospace;overflow-wrap:anywhere;white-space:pre-wrap}details{margin-top:.5rem}summary{cursor:pointer}footer{border-top:1px solid #ccc;padding:1rem 0;color:#444}@media(max-width:640px){dl{grid-template-columns:1fr}body{margin:1rem auto}}</style></head>'+
    '<body><header><h1>UI fixture index</h1><p>'+e(String(fixtures.length))+' direct local fixtures; '+
    counts.prepared+' prepared, '+counts.verified+' verified, '+counts.blocked+' blocked.</p>'+
    '<p>Links require the owning fixture app to be running locally. These are synthetic, mock-only UI modes; this index does not execute or validate app handlers.</p></header>'+
    '<main>'+sections+'</main><footer>Prepared is not browser-verified. Exact execution evidence is required for verified status. No production writes or remote connections.</footer></body></html>\n';
}
export function writeIndex(output, html) {
  const absolute=path.resolve(output), dir=fs.realpathSync(path.dirname(absolute));
  if(dir===repoRoot || dir.startsWith(repoRoot+path.sep)) throw new Error('Output must be outside the public shared-ui checkout');
  try { if(fs.lstatSync(absolute).isSymbolicLink()) throw new Error('Output symlinks are refused'); } catch(error) { if(error.code!=='ENOENT') throw error; }
  const temp=path.join(dir,'.ui-fixture-index-'+randomUUID()+'.tmp');
  try { fs.writeFileSync(temp,html,{mode:0o600,flag:'wx'}); fs.renameSync(temp,absolute); }
  finally { try { fs.unlinkSync(temp); } catch(error) { if(error.code!=='ENOENT') throw error; } }
  return absolute;
}
function cli(args) {
  const input=[], output=[];
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--input' && args[i+1]) input.push(args[++i]);
    else if(args[i]==='--output' && args[i+1]) output.push(args[++i]);
    else throw new Error('Usage: node scripts/fixture-index.mjs --input app-manifest.json [--input other.json] --output /tmp/ui-fixtures.html');
  }
  if(!input.length || output.length!==1)throw new Error('At least one --input and exactly one --output required');
  const docs=input.map(file=>({source:path.basename(file),document:JSON.parse(fs.readFileSync(file,'utf8'))}));
  const index=collectManifests(docs),written=writeIndex(output[0],renderIndex(index));
  process.stdout.write('Wrote '+index.length+' synthetic fixture routes to '+written+'\n');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { cli(process.argv.slice(2)); } catch(error) { process.stderr.write(error.message+'\n'); process.exitCode=2; }
}
