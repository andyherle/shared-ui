import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildCSS,manifest,compactCSS} from '../scripts/build.mjs';
const module={exports:{}};vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module,URL});
const {release}=module.exports;
const css=buildCSS(JSON.parse(fs.readFileSync(new URL('../src/tokens.json',import.meta.url))),fs.readFileSync(new URL('../src/controls.css',import.meta.url),'utf8'));
test('release points to one immutable stylesheet with a SHA-384 integrity value',()=>{
 const value=manifest(css),parsed=release(value);assert.equal(parsed.url,`https://andyherle.github.io/shared-ui/v1/styles.${value.revision}.css`);assert.equal(parsed.integrity,value.integrity);
});
test('update contract rejects incompatible and external stylesheet releases',()=>{
 const value=manifest(css);
 for(const patch of [{protocol:2},{version:'2.0.0'},{revision:'x'},{stylesheet:'https://elsewhere.test/style.css'},{stylesheet:'../style.css'},{integrity:'sha384-invalid'}])assert.throws(()=>release({...value,...patch}));
});
test('both packs use the same controls and distinct light/dark palettes',()=>{
 for(const pack of ['postvisual','personal'])assert.ok(css.includes(`[data-ui="${pack}"]`));
 for(let level=1;level<=6;level++)assert.ok(css.includes(`--ui-h${level}:`));
 assert.ok(css.includes('@layer app,ui.tokens,ui.controls,ui.prose;'));
 assert.doesNotMatch(css,/@import|url\s*\(/i);
 assert.ok(Buffer.byteLength(css)<=32768);
});

test('compact CSS preserves strings, descendant selectors and calc arithmetic',()=>{
 const input=`.parent :where(button) { width: calc(100% - 2px); content: "a : , > b"; }`;
 const compact=compactCSS(input);
 assert.equal(compact,'.parent :where(button){width:calc(100% - 2px);content:"a : , > b"}');
});
test('workspace scale has shared chrome, metadata, rhythm, and native tabs',()=>{
 for(const role of ['.ui-check','.ui-chrome','.ui-section-title','.ui-meta','.ui-value','.ui-stack','.ui-pad','.ui-tabs'])assert.ok(css.includes(role));
 assert.match(css,/\.ui-chrome\{font-size:var\(--ui-control-size\);line-height:1\.45/);
 assert.ok(css.includes('justify-content:flex-start'));
 assert.ok(css.includes('[data-ui-align=center]'));
 assert.ok(css.includes(':where([data-ui-variant=quiet]:is(.ui-field,:not(:hover)))')); // Selected native states must outrank quiet resting paint.
 const catalogue=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
 assert.ok(catalogue.includes('id="workspace-density"'));
 assert.ok(catalogue.includes('class="ui-card ui-pad ui-stack"'));
});

test('shared CSS preserves native label row placement',()=>{assert.doesNotMatch(css, /\) label(?:\{| >)/);});
