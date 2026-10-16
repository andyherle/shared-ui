import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCSS} from '../scripts/build.mjs';
import {loadTokenCatalogue} from '../src/studio/tokens.mjs';

const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const tokens=JSON.parse(source('src/tokens.json'));
const controls=source('src/controls.css');

test('the desktop page width is one typed, inherited semantic setting in both packs',()=>{
  for(const pack of ['postvisual','personal']){
    assert.equal(tokens[pack].defaults['page-width'],'70%');
    const catalogue=loadTokenCatalogue({pack});
    assert.equal(catalogue.definitions['--ui-page-width'].type,'length');
    assert.equal(catalogue.definitions['--ui-page-width'].editable,true);
    assert.equal(catalogue.resolved['--ui-page-width'].value,'70%');
  }
});

test('only direct outer page roots receive the width, with container and mobile fallback',()=>{
  assert.match(controls,/\[data-ui-page-host\] \{ container-type:inline-size; inline-size:100%; min-inline-size:0;/);
  assert.match(controls,/\[data-ui-page-host\] > \[data-ui-page-root\] \{ inline-size:min\(var\(--ui-page-width\),calc\(100% - 32px\),96rem\)/);
  assert.match(controls,/@container \(max-width:48rem\)/);
  assert.match(controls,/@media \(max-width:48rem\)/);
  assert.match(controls,/\[data-ui-page-root\]\[data-ui-page-mode=full\]/);
  assert.doesNotMatch(controls,/\[data-ui-page-root\] \[data-ui-page-root\]/);
  const html=source('src/index.html');
  assert.match(html,/id="page-width"/);
  assert.match(html,/data-ui-page-mode="full"/);
  assert.match(html,/class="lab-page-narrow"/);
  assert.match(html,/data-ui-page-root class="ui-card ui-pad ui-stack"/);
});

test('the new page role stays CSS-only and within the shared stylesheet budget',()=>{
  const css=buildCSS(tokens,controls);
  assert.ok(Buffer.byteLength(css)<32768,'shared stylesheet must stay under 32KiB');
  assert.match(css,/--ui-page-width:70%/);
  assert.match(css,/\[data-ui-page-host\]>\[data-ui-page-root\]/);
  assert.doesNotMatch(css,/@import|url\s*\(/i);
});
