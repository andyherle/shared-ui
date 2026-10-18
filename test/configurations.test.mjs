import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createAuthoringService, DEMO_VIEWS} from '../src/studio/service.mjs';
import {createReleaseManager} from '../src/studio/releases.mjs';
import {resolvePacks} from '../src/packs.mjs';
import {buildSite} from '../scripts/build.mjs';

const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
function setup(t, options = {}) {
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'configuration-test-'));
  t.after(() => fs.rmSync(temporary, {recursive: true, force: true}));
  const directory = path.join(temporary, 'drafts');
  if (!options.releases) options.releases = fixtureManager(path.join(temporary, 'source'));
  const service = createAuthoringService({directory, views: DEMO_VIEWS, writable: true, ...options});
  let serial = 0;
  const read = (id = 'postvisual') => service.dispatch({method: 'configuration.read', args: {configurationId: id}});
  const command = (operation, id = 'postvisual', revision = read(id).revision, operationId = `edit-${++serial}`) => service.dispatch({method: 'configuration.command', args: {configurationId: id, expectedRevision: revision, operationId, command: operation}});
  return {temporary, directory, service, read, command};
}
function fixtureManager(root, options = {}) {
  fs.mkdirSync(root);
  for (const name of ['src', 'scripts', 'package.json']) fs.cpSync(new URL('../' + name, import.meta.url), path.join(root, name), {recursive: true});
  const tokens = JSON.parse(fs.readFileSync(path.join(root, 'src/tokens.json')));
  tokens.personal = {mirror: 'postvisual', overrides: {defaults: {}, light: {}, dark: {}}};
  fs.writeFileSync(path.join(root, 'src/tokens.json'), JSON.stringify(tokens));
  return createReleaseManager({root, ...options});
}
test('Personal inherits Postvisual live; overrides reset and duplicates remain independent', t => {
  const h = setup(t);
  assert.equal(h.read('personal').definition.mirror, 'postvisual'); assert.deepEqual(h.read('personal').values, h.read().values);
  h.command({type: 'set-value', scope: 'dark', token: 'accent', value: '#123456'});
  assert.equal(h.read('personal').values.dark.accent, '#123456');
  h.command({type: 'set-value', scope: 'dark', token: 'accent', value: '#abcdef'}, 'personal');
  h.command({type: 'set-value', scope: 'dark', token: 'accent', value: '#654321'});
  assert.equal(h.read('personal').values.dark.accent, '#abcdef');
  h.command({type: 'reset-value', scope: 'dark', token: 'accent'}, 'personal'); assert.equal(h.read('personal').values.dark.accent, '#654321');
  h.command({type: 'duplicate', sourceId: 'personal', sourceRevision: h.read('personal').revision, name: 'Independent', pack: 'personal'}, 'copy', 0);
  h.command({type: 'set-value', scope: 'dark', token: 'accent', value: '#112233'});
  assert.equal(h.read('copy').values.dark.accent, '#654321'); assert.equal(h.read('copy').definition.mirror, undefined);
  const preview = h.service.dispatch({method: 'configuration.preview', args: {configurationId: 'postvisual'}});
  assert.deepEqual(preview.affectedPacks, ['postvisual', 'personal']); assert.match(preview.css, /#123/);
});
test('snapshots compare exact resolved values and restore without following later parent edits', t => {
  const h = setup(t);
  h.command({type: 'snapshot', snapshotId: 'before', name: 'Before'}, 'personal');
  const before = h.read('personal').values.dark.accent;
  h.command({type: 'set-value', scope: 'dark', token: 'accent', value: '#112233'});
  const comparison = h.service.dispatch({method: 'configuration.compare', args: {configurationId: 'personal', snapshotId: 'before'}});
  assert.equal(comparison.before.dark.accent, before); assert.equal(comparison.after.dark.accent, '#112233');
  h.command({type: 'restore', snapshotId: 'before'}, 'personal');
  assert.equal(h.read('personal').values.dark.accent, before); assert.equal(h.read('personal').definition.mirror, undefined);
});
test('stale writes, duplicate source races, invalid tokens and mirror cycles preserve store bytes', t => {
  const h = setup(t); h.command({type: 'rename', name: 'Postvisual draft'});
  const before = fs.readFileSync(path.join(h.directory, 'studio.json'));
  for (const work of [
    () => h.command({type: 'rename', name: 'Stale'}, 'postvisual', 0),
    () => h.command({type: 'set-value', scope: 'dark', token: 'accent', value: 'red; background:url(secret)'}),
    () => h.command({type: 'set-value', scope: 'defaults', token: 'font', value: 'x'}),
    () => h.command({type: 'mirror', sourceId: 'personal'}),
    () => h.command({type: 'duplicate', sourceId: 'postvisual', sourceRevision: 0, pack: 'personal', name: 'Stale'}, 'copy', 0)
  ]) assert.throws(work);
  assert.deepEqual(fs.readFileSync(path.join(h.directory, 'studio.json')), before);
});
test('configuration operations replay after restart and cannot widen read-only or publish permissions', t => {
  const h = setup(t), command = {type: 'set-value', scope: 'light', token: 'primary', value: '#123456'};
  h.command(command, 'postvisual', 0, 'same');
  const releases = fixtureManager(path.join(h.temporary, 'reopened-source'));
  const restarted = createAuthoringService({directory: h.directory, views: DEMO_VIEWS, writable: true, releases});
  const request = {method: 'configuration.command', args: {configurationId: 'postvisual', expectedRevision: 0, operationId: 'same', command}};
  assert.equal(restarted.dispatch(request).replayed, true);
  assert.throws(() => restarted.dispatch({...request, args: {...request.args, command: {type: 'rename', name: 'Different'}}}), {code: 'OPERATION_REUSED'});
  const readonly = createAuthoringService({directory: h.directory, views: DEMO_VIEWS, releases});
  assert.throws(() => readonly.dispatch(request), {code: 'FORBIDDEN'});
  assert.equal(readonly.dispatch({method: 'configuration.read', args: {configurationId: 'personal'}}).values.light.primary, '#123456');
  assert.equal(restarted.dispatch({method: 'describe'}).permissions.publish, false);
});
test('validation is bound to mirror values and source; stale inherited values cannot publish', async t => {
  let count = 0;
  const h = setup(t), manager = fixtureManager(path.join(h.temporary, 'validation-source'), {check: async root => {count++; buildSite(root);}});
  h.service = createAuthoringService({directory: h.directory, views: DEMO_VIEWS, writable: true, releases: manager});
  h.command({type: 'set-value', scope: 'dark', token: 'primary', value: '#112233'});
  const request = {method: 'configuration.validate', args: {configurationId: 'personal', expectedRevision: 0, operationId: 'check'}};
  const checked = await h.service.dispatch(request); assert.equal(count, 1); assert.deepEqual(checked.affectedPacks, ['postvisual', 'personal']);
  assert.equal((await h.service.dispatch(request)).replayed, true); assert.equal(count, 1);
  assert.ok(checked.cssBytes <= 36864); assert.ok(checked.gzipBytes < checked.cssBytes);
  h.command({type: 'set-value', scope: 'dark', token: 'primary', value: '#445566'});
  const enabled = createAuthoringService({directory: h.directory, views: DEMO_VIEWS, writable: true, releases: {...manager, canPublish: true, push: async () => {throw new Error('Must not push');}}});
  await assert.rejects(enabled.dispatch({method: 'configuration.publish', args: {configurationId: 'personal', expectedRevision: 0, operationId: 'push', validationId: 'check'}}), {code: 'REVISION_CONFLICT'});
});
test('validation failures never edit shared source or save a successful receipt', async t => {
  const h = setup(t, {releases: createReleaseManager({check: async () => {throw Object.assign(new Error('Broken fixture'), {code: 'VALIDATION_ERROR'});}})});
  const before = fs.readFileSync(new URL('../src/tokens.json', import.meta.url));
  await assert.rejects(h.service.dispatch({method: 'configuration.validate', args: {configurationId: 'postvisual', expectedRevision: 0, operationId: 'broken'}}), {code: 'VALIDATION_ERROR'});
  assert.deepEqual(h.read().validations, {}); assert.deepEqual(fs.readFileSync(new URL('../src/tokens.json', import.meta.url)), before);
});
function releaseRepo(t) {
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'configuration-git-'));
  t.after(() => fs.rmSync(temporary, {recursive: true, force: true}));
  const root = path.join(temporary, 'source'), remote = path.join(temporary, 'remote.git'); fixtureManager(root);
  buildSite(root); git(root, 'init', '-b', 'main'); git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.test');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'Initial'); git(temporary, 'init', '--bare', remote); git(root, 'remote', 'add', 'origin', remote); git(root, 'push', 'origin', 'main');
  return {root, remote};
}
test('publication builds an isolated commit, pushes both linked packs and replays after restart', async t => {
  const {root, remote} = releaseRepo(t), manager = createReleaseManager({root, publish: true, check: async root => buildSite(root)});
  const h = setup(t, {releases: manager});
  h.command({type: 'set-value', scope: 'light', token: 'primary', value: '#112233'});
  const validation = await h.service.dispatch({method: 'configuration.validate', args: {configurationId: 'postvisual', expectedRevision: 1, operationId: 'check'}});
  const request = {method: 'configuration.publish', args: {configurationId: 'postvisual', expectedRevision: 1, validationId: validation.validationId, operationId: 'push'}};
  const result = await h.service.dispatch(request);
  assert.equal(result.status, 'pushed'); assert.equal(git(remote, 'rev-parse', 'main'), result.commit); assert.equal(result.checkoutUpdated, true);
  const tokens = JSON.parse(git(remote, 'show', 'main:src/tokens.json')); assert.equal(resolvePacks(tokens).personal.light.primary, '#112233'); assert.equal(tokens.personal.mirror, 'postvisual');
  const restarted = createAuthoringService({directory: h.directory, views: DEMO_VIEWS, writable: true, releases: manager});
  assert.equal((await restarted.dispatch(request)).replayed, true); assert.equal(git(remote, 'rev-list', '--count', 'main'), '2');
  // The adapter also recovers the crash gap after local fast-forward, before a receipt is saved.
  const recovered = await manager.push({pack: 'postvisual', values: tokens.postvisual, related: {}, validation, operationId: 'push'});
  assert.equal(recovered.commit, result.commit);
});
test('dirty source and a changed origin reject publication without pushing', async t => {
  const {root, remote} = releaseRepo(t), manager = createReleaseManager({root, publish: true, check: async root => buildSite(root)});
  const values = manager.source().tokens.postvisual; values.light.primary = '#123456'; const validation = await manager.validate('postvisual', values);
  const before = git(remote, 'rev-parse', 'main');
  fs.appendFileSync(path.join(root, 'src/controls.css'), '\n/* concurrent edit */\n');
  await assert.rejects(manager.push({pack: 'postvisual', values, validation, operationId: 'dirty'}), {code: 'SOURCE_CONFLICT'});
  assert.equal(git(remote, 'rev-parse', 'main'), before);
  git(root, 'checkout', '--', 'src/controls.css');
  const advanced = git(remote, '-c', 'user.name=Remote test', '-c', 'user.email=remote@example.test', 'commit-tree', git(remote, 'rev-parse', 'main^{tree}'), '-p', before, '-m', 'Concurrent release');
  git(remote, 'update-ref', 'refs/heads/main', advanced);
  await assert.rejects(manager.push({pack: 'postvisual', values, validation, operationId: 'stale-origin'}), {code: 'RELEASE_CONFLICT'});
  assert.equal(git(remote, 'rev-parse', 'main'), advanced);
});
test('uncertain pushes retain one recoverable request and block a different publication', async t => {
  const {root, remote} = releaseRepo(t), manager = createReleaseManager({root, publish: true, check: async root => buildSite(root)});
  const h = setup(t, {releases: manager});
  h.command({type: 'set-value', scope: 'dark', token: 'accent', value: '#112233'});
  await h.service.dispatch({method: 'configuration.validate', args: {configurationId: 'postvisual', expectedRevision: 1, operationId: 'check'}});
  const hook = path.join(remote, 'hooks/pre-receive'); fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', {mode: 0o700});
  const request = {method: 'configuration.publish', args: {configurationId: 'postvisual', expectedRevision: 1, operationId: 'push', validationId: 'check'}};
  await assert.rejects(h.service.dispatch(request), {code: 'PUBLICATION_UNCERTAIN'});
  assert.equal(h.read().receipts.push.result.status, 'retry-required'); assert.deepEqual(h.read().receipts.push.request, request.args);
  await assert.rejects(h.service.dispatch({...request, args: {...request.args, operationId: 'different'}}), {code: 'STORE_BUSY'});
  fs.unlinkSync(hook);
  assert.equal((await h.service.dispatch(request)).status, 'pushed'); assert.equal(git(remote, 'rev-list', '--count', 'main'), '2');
});
test('pack mirrors reject cycles and retain matching component geometry', () => {
  assert.throws(() => resolvePacks({postvisual: {mirror: 'personal'}, personal: {mirror: 'postvisual'}}), /cycle/);
  const source = JSON.parse(fs.readFileSync(new URL('../src/tokens.json', import.meta.url)));
  const packs = resolvePacks({postvisual: source.postvisual, personal: {mirror: 'postvisual'}});
  assert.deepEqual(packs.personal, packs.postvisual); assert.equal(packs.personal.defaults.radius, packs.postvisual.defaults.radius);
});
