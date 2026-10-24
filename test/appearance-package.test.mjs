import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source = file => new URL('../' + file, import.meta.url);
const read = file => fs.readFileSync(source(file), 'utf8');

test('all optional appearance browser entrypoints parse without a bundler', () => {
  for (const file of ['schema.mjs', 'controller.mjs', 'editor.mjs', 'persistence.mjs', 'studio-persistence.mjs', 'studio-page.mjs', 'demo.mjs', 'demo-registry.mjs']) {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', fileURLToPath(source('src/appearance/' + file))], {stdio: 'pipe'}), file);
  }
});

test('the application editor dependency closure is same-origin, optional and free of Node-only service code', () => {
  const allowed = new Set(['schema.mjs', 'controller.mjs', 'persistence.mjs', 'editor.mjs']);
  for (const file of allowed) {
    const text = read('src/appearance/' + file);
    for (const match of text.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('./') && allowed.has(match[1].slice(2)), file + ': unregistered dependency ' + match[1]);
    }
    assert.doesNotMatch(text, /node:|https?:\/\/|eval\s*\(|new Function\s*\(/, file);
  }
  assert.doesNotMatch(read('src/runtime.js') + read('src/components.js') + read('src/diagnostics.js'), /appearance\/|createAppearanceController|mountAppearanceEditor/);
  assert.doesNotMatch(read('scripts/build.mjs'), /src\/appearance|appearance\/editor/);
});

test('Studio serves exact optional routes and preserves the existing POST permission boundary', () => {
  const server = read('scripts/studio-server.mjs');
  assert.match(server, /'\/appearance\.html'/);
  assert.match(server, /'\/appearance-demo\.html'/);
  assert.match(server, /if \(!authorized\(request, token\)\)/);
  assert.match(read('src/studio/editor.html'), /href="\/appearance\.html"/);
  assert.match(read('src/studio/editor.mjs'), /scope\.kind !== 'appearance'/);
});
