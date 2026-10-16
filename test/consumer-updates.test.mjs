import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {updateConsumers} from '../scripts/update-consumers.mjs';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'shared-ui-consumers-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  for (const app of ['one', 'two']) {fs.mkdirSync(path.join(root, app)); fs.writeFileSync(path.join(root, app, 'app.js'), 'private source stays here');}
  return {root, config: {schemaVersion: 1, consumers: ['one', 'two'].map(id => ({id, root: path.join(root, id), assets: 'static/shared-ui'}))}};
}
test('consumer plan is read-only, apply requires a pinned release, and check verifies only generated assets', t => {
  const {root, config} = fixture(t), plan = updateConsumers(config);
  assert.ok(plan.consumers.every(item => !item.current)); assert.equal(fs.existsSync(path.join(root, 'one/static')), false);
  assert.throws(() => updateConsumers(config, {apply: true}), /exact/);
  updateConsumers(config, {apply: true, expectedVersion: plan.version, expectedRevision: plan.revision});
  assert.ok(updateConsumers(config).consumers.every(item => item.current));
  assert.equal(fs.readFileSync(path.join(root, 'one/app.js'), 'utf8'), 'private source stays here');
  assert.deepEqual(fs.readdirSync(path.join(root, 'one/static/shared-ui')).sort(), ['bundle.json', 'icons.svg', 'manifest.json', 'runtime.js', 'styles.css']);
});
test('unsafe second destination prevents changes to the first consumer', t => {
  const {root, config} = fixture(t); config.consumers[1].assets = '../escape';
  assert.throws(() => updateConsumers(config), /escape/); assert.equal(fs.existsSync(path.join(root, 'one/static')), false);
  config.consumers[1].assets = 'linked'; fs.symlinkSync(path.join(root, 'one'), path.join(root, 'two/linked'));
  assert.throws(() => updateConsumers(config), /symlink/);
});
test('consumer updates reject duplicate destinations and symlinked bundle files', t => {
  const {root, config} = fixture(t); config.consumers[1].root = config.consumers[0].root;
  assert.throws(() => updateConsumers(config), /Duplicate generated/);
  config.consumers.pop(); fs.mkdirSync(path.join(root, 'one/static/shared-ui'), {recursive: true}); fs.symlinkSync(path.join(root, 'one/app.js'), path.join(root, 'one/static/shared-ui/styles.css'));
  assert.throws(() => updateConsumers(config), /ordinary files/);
});
