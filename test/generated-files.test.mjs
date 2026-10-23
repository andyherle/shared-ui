import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {publishGeneratedFiles} from '../scripts/generated-files.mjs';
import {installBundle} from '../scripts/install.mjs';
import {installDebugBundle} from '../scripts/debug-bundle.mjs';
import {installTimeline} from '../scripts/timeline-bundle.mjs';
import {installPDFPreview} from '../scripts/install-pdf-preview.mjs';

const source = new URL('../public/v1/', import.meta.url).pathname;
function scratch(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-ui-write-test-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true})); return root;
}
for (const [component, install, first, last] of [
  ['baseline', installBundle, 'styles.css', 'bundle.json'],
  ['debug', installDebugBundle, 'debug.js', 'debug.manifest.json'],
  ['timeline', installTimeline, 'timeline.css', 'timeline.manifest.json'],
  ['PDF', installPDFPreview, 'pdf-preview.mjs', 'pdf-preview.bundle.json']
]) {
  test(`${component} installer checks without creating directories and safely creates a fresh bundle`, t => {
    const root = scratch(t), target = path.join(root, 'new/assets');
    assert.throws(() => install(target, {source, check: true}));
    assert.equal(fs.existsSync(path.join(root, 'new')), false);
    install(target, {source});
    const before = fs.statSync(path.join(target, first)).mtimeMs;
    assert.deepEqual(install(target, {source}).changed, []);
    assert.deepEqual(install(target, {source, check: true}).changed, []);
    assert.equal(fs.statSync(path.join(target, first)).mtimeMs, before);
    assert.equal(fs.readdirSync(target).some(name => name.startsWith('.shared-ui-')), false);
  });
  test(`${component} installer rejects unsafe final entries before replacing any working asset`, t => {
    const root = scratch(t), target = path.join(root, 'assets'), victim = path.join(root, 'private.txt');
    install(target, {source});
    fs.writeFileSync(path.join(target, first), 'keep working bytes');
    fs.writeFileSync(victim, 'private bytes');
    fs.unlinkSync(path.join(target, last));
    for (const type of ['symlink', 'broken symlink', 'hardlink', 'directory']) {
      const file = path.join(target, last);
      if (type === 'hardlink') fs.linkSync(victim, file);
      else if (type === 'directory') fs.mkdirSync(file);
      else fs.symlinkSync(type === 'symlink' ? victim : path.join(root, 'missing'), file);
      for (const check of [true, false]) assert.throws(() => install(target, {source, check}), /ordinary files/);
      assert.equal(fs.readFileSync(path.join(target, first), 'utf8'), 'keep working bytes');
      assert.equal(fs.readFileSync(victim, 'utf8'), 'private bytes');
      fs.rmSync(file, {recursive: true});
    }
    fs.symlinkSync(target, path.join(root, 'linked'));
    assert.throws(() => install(path.join(root, 'linked'), {source}), /real directory/);
  });
  test(`${component} installer never writes through legacy predictable temporary symlinks`, t => {
    const root = scratch(t), victim = path.join(root, 'private.txt'), target = path.join(root, 'assets');
    fs.mkdirSync(target); fs.writeFileSync(victim, 'private bytes');
    for (const suffix of ['.tmp', `.${process.pid}.tmp`]) fs.symlinkSync(victim, path.join(target, first + suffix));
    install(target, {source});
    assert.equal(fs.readFileSync(victim, 'utf8'), 'private bytes');
    for (const suffix of ['.tmp', `.${process.pid}.tmp`]) assert.equal(fs.lstatSync(path.join(target, first + suffix)).isSymbolicLink(), true);
  });
}

test('failed staging leaves all working bytes intact and removes owned staging files', t => {
  const root = scratch(t), files = new Map([['one.js', 'old one'], ['manifest.json', 'old manifest']]);
  publishGeneratedFiles(root, files);
  const write = fs.writeFileSync; let writes = 0;
  t.mock.method(fs, 'writeFileSync', (...args) => {
    if (++writes === 2) throw new Error('simulated full disk');
    return write(...args);
  });
  assert.throws(() => publishGeneratedFiles(root, new Map([['one.js', 'new one'], ['manifest.json', 'new manifest']])), /full disk/);
  for (const [name, content] of files) assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), content);
  assert.deepEqual(fs.readdirSync(root).sort(), ['manifest.json', 'one.js']);
});

test('generated paths cannot escape the output root or traverse an internal symlink', t => {
  const root = scratch(t), target = path.join(root, 'public'), outside = path.join(root, 'outside');
  fs.mkdirSync(target); fs.mkdirSync(outside); fs.symlinkSync(outside, path.join(target, 'v1'));
  for (const name of ['../private', '/private', 'v1/../../private', 'v1\\private', 'v1/styles.css'])
    assert.throws(() => publishGeneratedFiles(target, new Map([[name, 'bad']])));
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('all installer CLIs reject missing, option-shaped and repeated targets without writing', t => {
  const root = scratch(t);
  for (const script of ['install.mjs', 'install-debug.mjs', 'install-timeline.mjs', 'install-pdf-preview.mjs']) {
    for (const args of [['--target'], ['--target', '--check'], ['--target', 'one', '--target', 'two']]) {
      const result = spawnSync(process.execPath, [new URL('../scripts/' + script, import.meta.url).pathname, ...args], {cwd: root, encoding: 'utf8'});
      assert.notEqual(result.status, 0, script + ' ' + args.join(' '));
      assert.match(result.stderr, /Missing --target|repeated argument/);
    }
  }
  assert.deepEqual(fs.readdirSync(root), []);
});
