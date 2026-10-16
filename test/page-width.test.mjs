import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCSS} from '../scripts/build.mjs';
import {loadTokenCatalogue} from '../src/studio/tokens.mjs';

const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const tokens=JSON.parse(source('src/tokens.json'));
const controls=source('src/controls.css');

test('one typed semantic page-width setting is defined in both packs',()=>{
  for(const pack of ['postvisual','personal']){
    assert.equal(tokens[pack].defaults['page-width'],'70%');
    const catalogue=loadTokenCatalogue({pack});
    assert.equal(catalogue.definitions['--ui-page-width'].type,'length');
    assert.equal(catalogue.definitions['--ui-page-width'].editable,true);
    assert.equal(catalogue.resolved['--ui-page-width'].value,'70%');
  }
});

test('app-layer fixture applies width once, with narrow and full-workspace exceptions',()=>{
  const layout=source('src/lab.css');
  assert.ok(layout.includes('[data-ui-page-host] { container-type:inline-size; inline-size:100%; min-inline-size:0; }'));
  assert.ok(layout.includes('[data-ui-page-host] > [data-ui-page-root] { inline-size:min(var(--ui-page-width),calc(100% - 32px),96rem)'));
  assert.ok(layout.includes('@container (max-width:48rem)'));
  assert.ok(layout.includes('@media (max-width:48rem)'));
  assert.ok(layout.includes('[data-ui-page-root][data-ui-page-mode=full]'));
  const html=source('src/index.html');
  assert.ok(html.includes('id="page-width"'));
  assert.ok(html.includes('data-ui-page-mode="full"'));
  assert.ok(html.includes('class="lab-page-narrow"'));
  assert.ok(html.includes('data-ui-page-root class="ui-card ui-pad ui-stack"'));
});

test('shared control stylesheet retains its hard 32KiB budget and no app layout selectors',()=>{
  const css=buildCSS(tokens,controls);
  assert.ok(Buffer.byteLength(css)<=32768,'shared stylesheet must stay within 32KiB');
  assert.ok(css.includes('--ui-page-width:70%'));
  assert.ok(!css.includes('[data-ui-page-host]'));
  assert.ok(!css.includes('@import'));
});
