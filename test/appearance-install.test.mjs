import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {installAppearance, APPEARANCE_FILES} from '../scripts/install-appearance.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRevision = () => execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();

test('optional appearance install is exact, repeatable and does not touch the release quartet', () => {
  const scratch = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'appearance-install-'));
  try {
    const baseline = path.join(scratch, 'runtime.js'); fs.writeFileSync(baseline, 'original runtime');
    const target = path.join(scratch, 'appearance');
    const installed = installAppearance(target, {sourceRevision: sourceRevision()});
    assert.deepEqual(installed.changed, [...APPEARANCE_FILES, 'appearance-bundle.json']);
    assert.equal(fs.readFileSync(baseline, 'utf8'), 'original runtime');
    assert.deepEqual(installAppearance(target, {check: true, sourceRevision: sourceRevision()}).changed, []);
    fs.appendFileSync(path.join(target, 'schema.mjs'), '\nchanged');
    assert.throws(() => installAppearance(target, {check: true, sourceRevision: sourceRevision()}), /assets differ/);
    assert.throws(() => installAppearance(target, {sourceRevision: 'a'.repeat(40)}), /does not match/);
  } finally {fs.rmSync(scratch, {recursive: true, force: true});}
});

test('optional installer rejects symbolic asset destinations and symbolic parent directories', () => {
  const scratch = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'appearance-dest-'));
  try {
    const outside = path.join(scratch, 'outside'); fs.mkdirSync(outside);
    const target = path.join(scratch, 'appearance'); fs.symlinkSync(outside, target, 'dir');
    assert.throws(() => installAppearance(target, {sourceRevision: sourceRevision()}), /real directories/);
    fs.unlinkSync(target); fs.mkdirSync(target);
    fs.writeFileSync(path.join(outside, 'file'), 'untouched');
    fs.symlinkSync(path.join(outside, 'file'), path.join(target, 'schema.mjs'));
    assert.throws(() => installAppearance(target, {sourceRevision: sourceRevision()}));
    assert.equal(fs.readFileSync(path.join(outside, 'file'), 'utf8'), 'untouched');
  } finally {fs.rmSync(scratch, {recursive: true, force: true});}
});
