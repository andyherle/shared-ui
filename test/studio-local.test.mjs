import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createAuthoringService, DEMO_VIEWS} from '../src/studio/service.mjs';
import {COMPONENTS} from '../src/studio/registry.mjs';
import {RENDERED_COMPONENTS} from '../src/studio/renderer.mjs';
import {startStudio} from '../scripts/studio-server.mjs';
import {localOptions} from '../src/studio/local.mjs';
const fixture = () => JSON.parse(fs.readFileSync(new URL('./fixtures/studio-document.json', import.meta.url)));
function setup(t, writable = true) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'studio-local-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return {directory, service: createAuthoringService({directory, views: DEMO_VIEWS, writable})};
}
test('every authorable descriptor has exactly one native renderer', () => {
  assert.deepEqual([...RENDERED_COMPONENTS].sort(), COMPONENTS.filter(item => item.renderer.status === 'document-only').map(item => item.id).sort());
});
test('editor server rejects unauthenticated, cross-origin and rebound traffic before reading private state', async t => {
  let reads = 0;
  const app = await startStudio({service: {dispatch() {reads++; return {safe: true};}}, port: 0}); t.after(app.close);
  const request = (headers = {}, body = '{"method":"describe"}') => fetch(app.url + 'api', {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body});
  assert.equal((await request()).status, 401);
  assert.equal((await request({Authorization: 'Bearer wrong'})).status, 401);
  assert.equal((await request({Authorization: `Bearer ${app.token}`, Origin: 'https://hostile.example'})).status, 403);
  const rebound = await new Promise(resolve => http.get(app.url, {headers: {Host: 'hostile.example'}}, response => {response.resume(); resolve(response.statusCode);}));
  assert.equal(rebound, 403); assert.equal(reads, 0);
  const response = await request({Authorization: `Bearer ${app.token}`}); assert.equal(response.status, 200); assert.equal(reads, 1);
  assert.equal(response.headers.get('access-control-allow-origin'), null); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await request({Authorization: `Bearer ${app.token}`}, '{broken')).status, 400);
  assert.equal((await request({Authorization: `Bearer ${app.token}`, 'Content-Type': 'text/plain'})).status, 415);
  assert.equal((await request({Authorization: `Bearer ${app.token}`}, ' '.repeat(4 * 1024 * 1024 + 1))).status, 413);
});
test('static allowlist serves editor assets without mounting repository, store, or credentials', async t => {
  const {service} = setup(t), app = await startStudio({service, port: 0}); t.after(app.close);
  for (const route of ['', 'editor.mjs', 'renderer.mjs', 'editor.css', 'preview.html', 'preview.mjs', 'v1/styles.css', 'v1/runtime.js', 'v1/icons.svg']) {
    const response = await fetch(app.url + route); assert.equal(response.status, 200, route);
    const body = await response.text(); assert.ok(body.length > 50); assert.ok(!body.includes(app.token));
  }
  for (const route of ['studio.json', 'src/studio/service.mjs', 'api', '.git/config', '%2e%2e/studio.json', 'editor.mjs?anything']) assert.equal((await fetch(app.url + route)).status, 404, route);
});
test('browser API enforces read-only permissions and returns actionable validation errors', async t => {
  const {directory, service} = setup(t);
  service.dispatch({method: 'document.command', args: {documentId: 'review', expectedRevision: 0, operationId: 'seed', command: {type: 'create', document: fixture()}}});
  const readOnly = createAuthoringService({directory, views: DEMO_VIEWS}), app = await startStudio({service: readOnly, port: 0}); t.after(app.close);
  const response = await fetch(app.url + 'api', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${app.token}`}, body: JSON.stringify({method: 'document.command', args: {documentId: 'review', expectedRevision: 1, operationId: 'forbidden', command: {type: 'rename', name: 'No'}}})});
  assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'FORBIDDEN');
  assert.equal(service.dispatch({method: 'document.read', args: {documentId: 'review'}}).revision, 1);
});
test('context changes and subtree removal are validated, atomic and undoable', t => {
  const {service, directory} = setup(t); let serial = 0;
  const send = (command, revision) => service.dispatch({method: 'document.command', args: {documentId: 'review', expectedRevision: revision, operationId: `op-${++serial}`, command}});
  const read = () => service.dispatch({method: 'document.read', args: {documentId: 'review'}});
  send({type: 'create', document: fixture()}, 0);
  send({type: 'set-context', pack: 'personal', mode: 'light', density: 'comfortable'}, 1);
  assert.equal(read().document.pack, 'personal');
  const before = fs.readFileSync(path.join(directory, 'studio.json'));
  assert.throws(() => send({type: 'set-context', pack: 'third-pack', mode: 'light', density: 'compact'}, 2));
  assert.throws(() => send({type: 'remove-node', nodeId: 'review'}, 2));
  assert.deepEqual(fs.readFileSync(path.join(directory, 'studio.json')), before);
  const removed = send({type: 'remove-node', nodeId: 'decisions'}, 2); assert.deepEqual(Object.keys(read().document.nodes), ['review', 'title']);
  send({type: 'undo', operationId: removed.operationId}, 3); assert.equal(read().document.nodes.save.bindings.activate, 'save');
});
test('stores reject any Git working tree, including a second checkout', t => {
  const {directory} = setup(t); fs.writeFileSync(path.join(directory, '.git'), 'gitdir: /private/example');
  assert.throws(() => createAuthoringService({directory: path.join(directory, 'drafts'), views: DEMO_VIEWS, writable: true}), /outside Git/);
  assert.equal(fs.existsSync(path.join(directory, 'drafts')), false);
});
test('local launch options cannot widen interface binding or infer write permission', () => {
  assert.throws(() => localOptions(['--store', '/private/drafts', '--demo', '--host', '0.0.0.0']), /Unknown/);
  assert.throws(() => localOptions(['--store', '/private/drafts', '--demo', '--port', '65536']), /Invalid port/);
  assert.equal(localOptions(['--store', '/private/drafts', '--demo'])['--write'], undefined);
});
test('binding edits accept only typed registered references and preserve node identity', t => {
  const {service} = setup(t);
  const send = (command, expectedRevision, operationId) => service.dispatch({method: 'document.command', args: {documentId: 'review', expectedRevision, operationId, command}});
  send({type: 'create', document: fixture()}, 0, 'seed');
  assert.throws(() => send({type: 'set-bindings', nodeId: 'save', bindings: {activate: 'title'}}, 1, 'wrong-type'), error => error.code === 'INCOMPATIBLE_BINDING');
  assert.throws(() => send({type: 'set-bindings', nodeId: 'save', bindings: {activate: 'unregistered'}}, 1, 'unknown'), error => error.code === 'INCOMPATIBLE_BINDING');
  send({type: 'set-bindings', nodeId: 'save', bindings: {activate: 'cancel'}}, 1, 'rebind');
  const node = service.dispatch({method: 'document.read', args: {documentId: 'review'}}).document.nodes.save;
  assert.equal(node.id, 'save'); assert.equal(node.bindings.activate, 'cancel'); assert.equal(node.props.label, 'Save');
});
test('comparison snapshots are optional and coherent, and undo direction survives reopening', t => {
  const {service, directory} = setup(t); let serial = 0;
  const send = (command, expectedRevision) => service.dispatch({method: 'document.command', args: {documentId: 'review', expectedRevision, operationId: `op-${++serial}`, command}});
  const read = () => createAuthoringService({directory, views: DEMO_VIEWS}).dispatch({method: 'document.read', args: {documentId: 'review'}});
  send({type: 'create', document: fixture()}, 0);
  send({type: 'save-version', versionId: 'before', name: 'Before'}, 1);
  send({type: 'rename', name: 'After'}, 2);
  const args = {documentId: 'review', beforeVersionId: 'before'};
  assert.equal(service.dispatch({method: 'document.compare', args}).beforeDocument, undefined);
  const comparison = service.dispatch({method: 'document.compare', args: {...args, includeDocuments: true}});
  assert.equal(comparison.beforeDocument.name, 'Synthetic review'); assert.equal(comparison.afterDocument.name, 'After'); assert.equal(comparison.revision, 3);
  assert.deepEqual(comparison.changes, [{path: '/name', kind: 'changed', before: 'Synthetic review', after: 'After'}]);
  assert.equal(read().undo.direction, 'undo'); send({type: 'undo', operationId: read().undo.operationId}, 3);
  assert.equal(read().undo.direction, 'redo'); assert.equal(read().document.name, 'Synthetic review');
  send({type: 'undo', operationId: read().undo.operationId}, 4);
  assert.equal(read().undo.direction, 'undo'); assert.equal(read().document.name, 'After');
});
test('impact traces declared dependencies without claiming live consumers or escaping node scope', t => {
  const {service} = setup(t); const document = fixture();
  document.tokens['--ui-primary'] = {ref: '--ui-accent'};
  document.nodes.cancel.tokens['--ui-primary'] = '#123456';
  service.dispatch({method: 'document.command', args: {documentId: 'review', expectedRevision: 0, operationId: 'impact-seed', command: {type: 'create', document}}});
  const impact = service.dispatch({method: 'document.impact', args: {documentId: 'review', token: '--ui-accent'}});
  assert.ok(impact.tokens.some(item => item.id === '--ui-primary'));
  assert.ok(impact.components.some(item => item.id === 'action'));
  assert.ok(impact.nodes.some(item => item.id === 'save'));
  assert.ok(!impact.nodes.some(item => item.id === 'cancel'));
  assert.equal(impact.coverage.liveConsumers, false); assert.equal(impact.coverage.computedStyles, false);
  const scoped = service.dispatch({method: 'document.impact', args: {documentId: 'review', token: '--ui-primary', nodeId: 'save'}});
  assert.deepEqual(scoped.nodes.map(item => item.id), ['save']);
  assert.throws(() => service.dispatch({method: 'document.impact', args: {documentId: 'review', token: '--missing'}}), /Unknown token/);
  assert.throws(() => service.dispatch({method: 'document.impact', args: {documentId: 'review', token: '__proto__'}}), /Unknown token/);
});
