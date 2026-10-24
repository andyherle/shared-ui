import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createAuthoringService, DEMO_VIEWS} from '../src/studio/service.mjs';
import {runStudioCLI} from '../scripts/studio.mjs';
const execFileAsync = promisify(execFile);
const fixture = () => JSON.parse(fs.readFileSync(new URL('./fixtures/studio-document.json', import.meta.url), 'utf8'));
const message = (method, args = {}) => ({method, args});
function harness(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'shared-ui-studio-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const open = (overrides = {}) => createAuthoringService({directory, views: DEMO_VIEWS, writable: true, ...options, ...overrides});
  const service = open(); let serial = 0;
  const send = (command, expectedRevision, documentId = 'review', operationId = `op-${++serial}`) => service.dispatch(message('document.command', {documentId, expectedRevision, operationId, command}));
  const read = (versionId, documentId = 'review') => service.dispatch(message('document.read', {documentId, ...(versionId ? {versionId} : {})}));
  const create = document => send({type: 'create', document: document ?? fixture()}, 0);
  return {directory, open, service, send, read, create};
}
const errorCode = code => error => error.code === code;

test('vertical slice: save, duplicate, scoped edit, swap, move, compare, undo and restore', t => {
  const h = harness(t); h.create();
  h.send({type: 'save-version', versionId: 'baseline', name: 'Baseline'}, 1);
  h.send({type: 'duplicate', sourceDocumentId: 'review', sourceRevision: 2, versionId: 'baseline', name: 'Variation'}, 0, 'variation');
  h.send({type: 'set-token', nodeId: 'save', token: '--ui-primary', value: '#123456'}, 1, 'variation');
  h.send({type: 'swap-node', nodeId: 'save', componentId: 'button'}, 2, 'variation');
  const moved = h.send({type: 'move-node', nodeId: 'save', parentId: 'decisions', slot: 'children', index: 1}, 3, 'variation');
  const working = h.read(null, 'variation').document;
  assert.equal(working.nodes.save.id, 'save'); assert.deepEqual(working.nodes.save.bindings, {activate: 'save'});
  assert.deepEqual(working.nodes.decisions.slots.children, ['cancel', 'save']);
  assert.equal(working.nodes.save.tokens['--ui-primary'], '#123456');
  assert.deepEqual(h.read().document.nodes.save.tokens, {}); assert.equal(h.read().revision, 2);
  h.send({type: 'undo', operationId: moved.operationId}, 4, 'variation');
  assert.deepEqual(h.read(null, 'variation').document.nodes.decisions.slots.children, ['save', 'cancel']);
  const edited = h.send({type: 'set-props', nodeId: 'save', props: {label: 'Approve'}}, 2);
  const comparison = h.service.dispatch(message('document.compare', {documentId: 'review', beforeVersionId: 'baseline'}));
  assert.deepEqual(comparison.changes, [{path: '/nodes/save/props/label', kind: 'changed', before: 'Save', after: 'Approve'}]);
  assert.equal(h.read('baseline').document.nodes.save.props.label, 'Save'); assert.equal(h.read().revision, 3);
  h.send({type: 'undo', operationId: edited.operationId}, 3);
  assert.equal(h.read().document.nodes.save.props.label, 'Save');
  h.send({type: 'rename', name: 'Changed'}, 4); h.send({type: 'restore-version', versionId: 'baseline'}, 5);
  assert.equal(h.read().document.name, 'Synthetic review');
});

test('same operation is idempotent across restarts and later revisions', t => {
  const h = harness(t); h.create();
  const request = message('document.command', {documentId: 'review', expectedRevision: 1, operationId: 'save-once', command: {type: 'save-version', versionId: 'baseline', name: 'Baseline'}});
  const first = h.service.dispatch(request); h.send({type: 'rename', name: 'Later'}, 2);
  const replay = h.open().dispatch(request);
  assert.equal(replay.replayed, true); assert.equal(replay.revision, first.revision); assert.equal(h.read().revision, 3);
  assert.equal(h.read().versions.length, 1);
  request.args.command.name = 'Different'; assert.throws(() => h.open().dispatch(request), errorCode('OPERATION_REUSED'));
});
test('stale writes return the actual revision and preserve bytes', t => {
  const h = harness(t); h.create(); h.send({type: 'rename', name: 'New name'}, 1);
  const before = fs.readFileSync(path.join(h.directory, 'studio.json'));
  assert.throws(() => h.send({type: 'rename', name: 'Stale'}, 1), error => error.code === 'REVISION_CONFLICT' && error.details.actualRevision === 2);
  assert.deepEqual(fs.readFileSync(path.join(h.directory, 'studio.json')), before);
});
test('duplicate rejects a stale source revision', t => {
  const h = harness(t); h.create(); h.send({type: 'save-version', versionId: 'base', name: 'Base'}, 1); h.send({type: 'rename', name: 'New'}, 2);
  assert.throws(() => h.send({type: 'duplicate', sourceDocumentId: 'review', sourceRevision: 2, versionId: 'base', name: 'Copy'}, 0, 'copy'), errorCode('REVISION_CONFLICT'));
});
test('undo is revision-checked and undoing undo provides redo', t => {
  const h = harness(t); h.create();
  const renamed = h.send({type: 'rename', name: 'Renamed'}, 1);
  assert.throws(() => h.send({type: 'undo', operationId: renamed.operationId}, 1), errorCode('REVISION_CONFLICT'));
  assert.throws(() => h.send({type: 'undo', operationId: 'other-operation'}, 2), errorCode('UNDO_CONFLICT'));
  const undone = h.send({type: 'undo', operationId: renamed.operationId}, 2);
  assert.equal(h.read().document.name, 'Synthetic review');
  h.send({type: 'undo', operationId: undone.operationId}, 3); assert.equal(h.read().document.name, 'Renamed');
});
test('version metadata, archive/unarchive, and immutable snapshot reads', t => {
  const h = harness(t); h.create(); h.send({type: 'save-version', versionId: 'base', name: 'Before'}, 1);
  h.send({type: 'rename-version', versionId: 'base', name: 'Baseline'}, 2); h.send({type: 'archive-version', versionId: 'base'}, 3);
  assert.equal(h.read('base').version.archived, true); assert.equal(h.read('base').version.name, 'Baseline');
  assert.throws(() => h.send({type: 'restore-version', versionId: 'base'}, 4));
  assert.throws(() => h.send({type: 'save-version', versionId: 'base', name: 'Overwrite'}, 4));
  h.send({type: 'unarchive-version', versionId: 'base'}, 4); h.send({type: 'restore-version', versionId: 'base'}, 5);
  assert.equal(h.read().revision, 6); assert.equal(h.read('base').version.sourceRevision, 1);
});
test('incompatible swaps retain the original bindings and revision', t => {
  const h = harness(t); h.create();
  assert.throws(() => h.send({type: 'swap-node', nodeId: 'save', componentId: 'checkbox', props: {label: 'Save'}}, 1), errorCode('INCOMPATIBLE_BINDING'));
  assert.deepEqual(h.read().document.nodes.save.bindings, {activate: 'save'}); assert.equal(h.read().revision, 1);
});
test('moves reject cycles, incompatible slots, root moves and invalid indexes atomically', t => {
  const h = harness(t); h.create();
  for (const command of [
    {type: 'move-node', nodeId: 'decisions', parentId: 'decisions', slot: 'children', index: 0},
    {type: 'move-node', nodeId: 'title', parentId: 'decisions', slot: 'children', index: 0},
    {type: 'move-node', nodeId: 'review', parentId: 'decisions', slot: 'children', index: 0},
    {type: 'move-node', nodeId: 'save', parentId: 'decisions', slot: 'unknown', index: 0},
    {type: 'move-node', nodeId: 'save', parentId: 'decisions', slot: 'children', index: 20}
  ]) assert.throws(() => h.send(command, 1));
  assert.equal(h.read().revision, 1); assert.deepEqual(h.read().document, fixture());
});
test('insert preserves stable IDs, rejects duplicates and validates declared layouts', t => {
  const h = harness(t); h.create();
  const node = {id: 'more', componentId: 'button', props: {label: 'More'}, tokens: {}, bindings: {}, slots: {}};
  h.send({type: 'insert-node', node, parentId: 'decisions', slot: 'children', index: 1}, 1);
  assert.throws(() => h.send({type: 'insert-node', node, parentId: 'decisions', slot: 'children', index: 1}, 2));
  h.send({type: 'set-layout', nodeId: 'decisions', layout: {kind: 'column'}}, 2);
  assert.throws(() => h.send({type: 'set-layout', nodeId: 'decisions', layout: {kind: 'absolute', x: 20}}, 3));
  assert.deepEqual(h.read().document.nodes.decisions.slots.children, ['save', 'more', 'cancel']);
});
test('unregistered views, audit-only views and unavailable component adapters cannot be edited', t => {
  for (const edit of [
    doc => { doc.target.viewId = 'unknown'; },
    doc => { doc.nodes.save.componentId = 'dialog'; },
    doc => { doc.nodes.save.bindings.activate = 'missing'; }
  ]) { const h = harness(t); const doc = fixture(); edit(doc); assert.throws(() => h.create(doc)); }
  const h = harness(t, {views: [{...DEMO_VIEWS[0], adapter: 'audit-only'}]});
  assert.throws(() => h.create(), errorCode('READ_ONLY_VIEW'));
});
test('full document validation rejects arbitrary code fields, unknown props, orphans and missing labels', t => {
  for (const edit of [
    doc => { doc.script = 'run()'; }, doc => { doc.nodes.save.props.onclick = 'run()'; },
    doc => { doc.nodes.save.props.style = 'color:red'; }, doc => { doc.nodes.save.props.icon = 'unknown-icon'; },
    doc => { delete doc.nodes.save.props.label; }, doc => { doc.nodes.decisions.slots.children.push('save'); },
    doc => { doc.nodes.review.slots.children = ['decisions']; }, doc => { doc.nodes.save.id = 'replacement'; },
    doc => { doc.nodes.save.bindings.activate = 'source'; }
  ]) { const h = harness(t); const doc = fixture(); edit(doc); assert.throws(() => h.create(doc)); assert.equal(fs.existsSync(path.join(h.directory, 'studio.json')), false); }
});
test('token edits are typed, scoped, resettable and reject injection, cycles and unknown references', t => {
  const h = harness(t); h.create();
  for (const [token, value] of [
    ['--ui-primary', 'url(https://example.test)'], ['--ui-control-height', '-2px'], ['--ui-control-height', '30'],
    ['--ui-control-height', {ref: '--ui-primary'}], ['--ui-primary', {ref: '--ui-primary'}],
    ['--ui-primary', {ref: '--missing'}], ['--missing', '#123456'], ['--ui-font', 'Other font']
  ]) assert.throws(() => h.send({type: 'set-token', token, value}, 1));
  assert.throws(() => h.send({type: 'set-token', nodeId: 'save', token: '--ui-popout-width', value: '500px'}, 1));
  h.send({type: 'set-token', token: '--ui-primary', value: '#123456'}, 1);
  h.send({type: 'set-token', nodeId: 'save', token: '--ui-primary', value: '#abcdef'}, 2);
  h.send({type: 'reset-token', nodeId: 'save', token: '--ui-primary'}, 3);
  assert.deepEqual(h.read().document.nodes.save.tokens, {}); assert.equal(h.read().document.tokens['--ui-primary'], '#123456');
});
test('token documents have no layout nodes and both packs/modes are valid', t => {
  for (const pack of ['postvisual', 'personal']) for (const mode of ['light', 'dark']) {
    const h = harness(t), document = {...fixture(), kind: 'tokens', pack, mode, root: null, nodes: {}};
    h.create(document); assert.deepEqual(h.read().document, document);
  }
  const h = harness(t), invalid = fixture(); invalid.kind = 'tokens'; assert.throws(() => h.create(invalid));
});
test('read-only adapters can inspect, compare and prepare but cannot mutate', t => {
  const h = harness(t); h.create(); h.send({type: 'save-version', versionId: 'base', name: 'Base'}, 1);
  h.send({type: 'set-props', nodeId: 'save', props: {label: 'Approve'}}, 2);
  const reader = h.open({writable: false});
  const result = reader.dispatch(message('document.prepare', {documentId: 'review', beforeVersionId: 'base'}));
  assert.deepEqual(result.affectedNodes, ['save']); assert.equal(result.publishes, false); assert.deepEqual(result.repositories, []);
  assert.equal(reader.dispatch(message('describe')).permissions.write, false);
  assert.throws(() => reader.dispatch(message('document.command', {documentId: 'review', expectedRevision: 3, operationId: 'forbidden', command: {type: 'rename', name: 'No'}})), errorCode('FORBIDDEN'));
});
test('caller mutations never change stored content, fixtures or frozen registry descriptors', t => {
  const h = harness(t); const original = fixture(); h.create(original); original.name = 'Changed outside';
  const read = h.read(); read.document.name = 'Changed result'; assert.equal(h.read().document.name, 'Synthetic review');
  const listed = h.service.dispatch(message('components.list')); listed.components[0].props.label.max = 1;
  assert.equal(h.service.dispatch(message('components.list')).components[0].props.label.max, 500);
});
test('prototype keys, path traversal and unknown commands are rejected', t => {
  const h = harness(t); h.create();
  assert.throws(() => h.send({type: 'rename', name: 'No'}, 1, '../outside'));
  assert.throws(() => h.send({type: 'constructor'}, 1));
  assert.throws(() => h.service.dispatch(JSON.parse('{"method":"describe","args":{"__proto__":{"admin":true}}}')));
  assert.throws(() => h.service.dispatch(message('publish')));
  assert.throws(() => h.service.dispatch(message('document.read', {documentId: 'review', path: '/etc/passwd'})));
});
test('atomic write failure retains the last working file and releases temp files/lock', t => {
  const h = harness(t); h.create(); const before = fs.readFileSync(path.join(h.directory, 'studio.json'));
  const rename = fs.renameSync;
  try { fs.renameSync = () => { throw new Error('Simulated rename failure'); }; assert.throws(() => h.send({type: 'rename', name: 'Failed'}, 1), /Simulated/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual(fs.readFileSync(path.join(h.directory, 'studio.json')), before); assert.deepEqual(fs.readdirSync(h.directory), ['studio.json']);
  h.send({type: 'rename', name: 'Recovered'}, 1); assert.equal(h.read().revision, 2);
});
test('crashed lock is explicit and never automatically stolen', t => {
  const h = harness(t); h.create(); fs.mkdirSync(path.join(h.directory, '.studio-lock'));
  assert.throws(() => h.send({type: 'rename', name: 'No'}, 1), errorCode('STORE_BUSY'));
  assert.equal(h.read().revision, 1);
});
test('symlink and hardlink state files never escape the registered store', t => {
  for (const kind of ['symlink', 'hardlink']) {
    const h = harness(t), outside = path.join(h.directory, 'outside.json'); fs.writeFileSync(outside, 'Do not replace');
    if (kind === 'symlink') fs.symlinkSync(outside, path.join(h.directory, 'studio.json'));
    else fs.linkSync(outside, path.join(h.directory, 'studio.json'));
    assert.throws(() => h.create()); assert.equal(fs.readFileSync(outside, 'utf8'), 'Do not replace');
  }
});
test('replacing the registered root with a symlink fails closed', t => {
  const h = harness(t); h.create(); const moved = h.directory + '-moved'; fs.renameSync(h.directory, moved);
  t.after(() => fs.rmSync(moved, {recursive: true, force: true})); fs.symlinkSync(moved, h.directory);
  assert.throws(() => h.read(), errorCode('UNSAFE_STORE'));
});
test('private state cannot be placed inside the public source repository', () => {
  assert.throws(() => createAuthoringService({directory: path.resolve('test/unsafe-store'), views: DEMO_VIEWS, writable: true}), /outside the public repository|outside Git working trees/);
});
test('malformed store data fails as an operation error without a replacement write', t => {
  const h = harness(t); h.create(); const file = path.join(h.directory, 'studio.json'); fs.writeFileSync(file, '{broken');
  assert.throws(() => h.read()); assert.throws(() => h.send({type: 'rename', name: 'No'}, 1)); assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
test('two processes cannot commit competing writes against the same revision', async t => {
  const h = harness(t); h.create();
  const moduleURL = new URL('../src/studio/service.mjs', import.meta.url).href;
  const script = `import {createAuthoringService,DEMO_VIEWS} from ${JSON.stringify(moduleURL)};
    const service=createAuthoringService({directory:process.env.STUDIO_TEST_STORE,views:DEMO_VIEWS,writable:true});
    try { console.log(JSON.stringify(service.dispatch({method:'document.command',args:{documentId:'review',expectedRevision:1,operationId:process.env.STUDIO_TEST_OPERATION,command:{type:'rename',name:process.env.STUDIO_TEST_OPERATION}}}))); }
    catch(error){ console.log(JSON.stringify({error:error.code})); }`;
  const outcomes = await Promise.all(['writer-one', 'writer-two', 'writer-three'].map(async operation => {
    const {stdout} = await execFileAsync(process.execPath, ['--input-type=module', '-e', script], {env: {...process.env, STUDIO_TEST_STORE: h.directory, STUDIO_TEST_OPERATION: operation}});
    return JSON.parse(stdout);
  }));
  assert.equal(outcomes.filter(result => result.revision === 2).length, 1);
  for (const result of outcomes.filter(result => result.error)) assert.ok(['STORE_BUSY', 'REVISION_CONFLICT'].includes(result.error));
  assert.equal(h.read().revision, 2);
});
test('CLI has explicit write permission, structured errors and a standalone description', t => {
  const h = harness(t); h.create(); const output = [], errors = [];
  const io = {read: () => JSON.stringify(message('document.read', {documentId: 'review'})), write: value => output.push(JSON.parse(value)), error: value => errors.push(JSON.parse(value))};
  assert.equal(runStudioCLI(['--store', h.directory, '--demo'], io), 0); assert.equal(output[0].revision, 1);
  assert.equal(runStudioCLI(['--describe'], io), 0); assert.ok(output[1].commands['move-node']);
  for (const args of [[], ['--store'], ['--unknown'], ['--describe', '--write'], ['--store', h.directory, '--demo', '--views', 'file']]) assert.equal(runStudioCLI(args, io), 2);
  assert.equal(errors.length, 5);
});

test('scoped token reads expose document/node origins without redirecting either editor', t => {
  const h = harness(t); h.create(); h.send({type: 'save-version', versionId: 'base', name: 'Base'}, 1);
  h.send({type: 'set-token', token: '--ui-primary', value: '#123456'}, 2);
  const edited = h.send({type: 'set-token', nodeId: 'save', token: '--ui-primary', value: '#abcdef'}, 3);
  assert.equal(edited.affectedScope.nodeId, 'save');
  const working = h.service.dispatch(message('document.tokens', {documentId: 'review', nodeId: 'save'}));
  assert.equal(working.resolved['--ui-primary'].origin.scope, 'node:save');
  assert.equal(working.resolved['--ui-playhead-color'].value, '#abcdef');
  const saved = h.service.dispatch(message('document.tokens', {documentId: 'review', versionId: 'base'}));
  assert.equal(saved.resolved['--ui-primary'].origin.scope, 'source');
  assert.equal(h.read().revision, 4);
  assert.throws(() => h.service.dispatch(message('components.list', {authorable: 'false'})));
  assert.throws(() => h.service.dispatch(message('document.read')));
});

test('compositions with required slots insert atomically and nodes move between compatible parents', t => {
  const h = harness(t); h.create();
  const node = {id: 'split', componentId: 'split', props: {}, tokens: {}, bindings: {}, slots: {main: ['main-stack'], aside: ['aside-stack']}, layout: {kind: 'split'}};
  const stack = id => ({id, componentId: 'stack', props: {}, tokens: {}, bindings: {}, slots: {children: []}, layout: {kind: 'stack'}});
  assert.throws(() => h.send({type: 'insert-node', node, parentId: 'review', slot: 'children', index: 2}, 1));
  h.send({type: 'insert-node', node, descendants: {'main-stack': stack('main-stack'), 'aside-stack': stack('aside-stack')}, parentId: 'review', slot: 'children', index: 2}, 1);
  h.send({type: 'move-node', nodeId: 'save', parentId: 'main-stack', slot: 'children', index: 0}, 2);
  h.send({type: 'move-node', nodeId: 'save', parentId: 'aside-stack', slot: 'children', index: 0}, 3);
  assert.deepEqual(h.read().document.nodes['aside-stack'].slots.children, ['save']);
  assert.deepEqual(h.read().document.nodes.save.bindings, {activate: 'save'});
  assert.deepEqual(h.read().document.nodes.decisions.slots.children, ['cancel']);
});
