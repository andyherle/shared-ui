import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COMPONENTS, REGISTRY, ROLE_OWNERS, AUDIT_CONTRACTS, listComponents} from '../src/studio/registry.mjs';
import {AUDIT_CONTRACTS as auditContracts, auditSchemaSnapshot} from '../src/schema-audit.mjs';
import {TOKEN_TYPES, createTokenCatalogue, loadTokenCatalogue, inventoryCSS, resolveTokenGraph, resolveScopedTokens} from '../src/studio/tokens.mjs';
import {resolvePacks} from '../src/packs.mjs';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const controls = read('src/controls.css'), tokens = resolvePacks(JSON.parse(read('src/tokens.json')));

test('component contracts have stable unique IDs and the same native language in both packs', () => {
  assert.equal(new Set(COMPONENTS.map(item => item.id)).size, COMPONENTS.length);
  for (const component of COMPONENTS) {
    assert.match(component.id, /^[a-z][a-z0-9-]+$/);
    assert.deepEqual(component.packs, ['postvisual', 'personal']);
    assert.ok(component.semantics.tags.length); assert.ok(component.accessibility.keyboard);
    assert.ok(Object.isFrozen(component.props)); assert.ok(component.lifecycle.status); assert.ok(component.renderer.status);
    for (const token of component.tokens) assert.ok(Object.hasOwn(TOKEN_TYPES, token), `${component.id}: ${token}`);
    for (const fixture of component.fixtures) assert.ok(read(fixture.file).includes(`id="${fixture.anchor}"`), `${component.id}: missing fixture ${fixture.anchor}`);
  }
  assert.ok(Object.isFrozen(REGISTRY));
});
test('catalogue and shared CSS role inventory requires an explicit registered owner', () => {
  const sources = [read('src/index.html'), read('src/fixture.html')];
  const roles = new Set(sources.flatMap(html => [...html.matchAll(/class="([^"]*)"/g)].flatMap(match => match[1].split(/\s+/)).filter(name => name.startsWith('ui-')).map(name => name.slice(3))));
  for (const match of controls.matchAll(/\.ui-([a-z-]+)/g)) roles.add(match[1]);
  for (const role of roles) assert.ok(Object.hasOwn(ROLE_OWNERS, role), `Register catalogue role ui-${role}`);
  for (const owner of Object.values(ROLE_OWNERS)) assert.ok(COMPONENTS.some(item => item.id === owner), `Missing role owner: ${owner}`);
  // Native controls with no shared class are part of coverage, too.
  const native = new Set(COMPONENTS.flatMap(item => item.semantics.tags));
  for (const tag of ['button', 'a', 'input', 'select', 'textarea', 'summary', 'details', 'dialog', 'progress', 'meter', 'fieldset', 'table', 'audio', 'video']) assert.ok(native.has(tag), `Unregistered native ${tag}`);
});
test('library filters do not depend on whether an app uses a component', () => {
  assert.equal(listComponents({pack: 'postvisual'}).length, COMPONENTS.length);
  assert.equal(listComponents({pack: 'personal'}).length, COMPONENTS.length);
  assert.ok(listComponents({text: 'toggle'}).some(item => item.id === 'toggle'));
  assert.ok(listComponents({authorable: true}).every(item => item.renderer.status === 'document-only'));
  assert.ok(listComponents({authorable: false}).some(item => item.id === 'dialog'));
});
test('schema auditing projects the exact registry objects and accepts quiet actions and form popouts', () => {
  assert.equal(auditContracts, AUDIT_CONTRACTS);
  const report = auditSchemaSnapshot({schemaVersion: 1, appId: 'demo', viewId: 'form', elements: [
    {id: 'save', tag: 'button', roles: ['action'], attributes: {'data-ui-variant': 'quiet'}, counts: {'action-label': 1, 'action-icon': 0}},
    {id: 'form', tag: 'form', roles: ['popout'], attributes: {}, counts: {'popout-header': 1, 'popout-body': 1, 'popout-footer': 1}}
  ], coverage: {matched: 2, captured: 2, truncated: false}});
  assert.deepEqual(report.findings, []); assert.deepEqual(report.coverage.contracts, ['action', 'field', 'review-workspace', 'popout', 'action-feedback']);
});
test('all JSON/CSS tokens have descriptors, source locations and declared consumer projections', () => {
  const catalogue = loadTokenCatalogue();
  const inventory = inventoryCSS(controls);
  const names = new Set([...inventory.declarations, ...inventory.uses].map(item => item.id));
  for (const pack of Object.values(tokens)) for (const set of Object.values(pack)) for (const name of Object.keys(set)) names.add('--ui-' + name);
  assert.deepEqual(catalogue.tokens.map(item => item.id).sort(), [...names].sort());
  assert.deepEqual([...names].sort(), Object.keys(TOKEN_TYPES).sort());
  for (const item of catalogue.tokens) {
    assert.ok(item.declarations.length || item.uses.length, item.id);
    assert.deepEqual(item.consumers, COMPONENTS.filter(component => component.tokens.includes(item.id)).map(component => component.id));
  }
  assert.equal(catalogue.coverage.computedStyles, false);
  assert.equal(catalogue.tokens.find(item => item.id === '--ui-switch-width').resolution, 'requires-renderer');
});
test('token sources resolve pack/mode/density/pointer precedence without changing CSS', () => {
  for (const pack of ['postvisual', 'personal']) for (const mode of ['light', 'dark']) for (const density of ['default', 'compact', 'dense', 'comfortable']) for (const pointer of ['fine', 'coarse']) {
    const c = createTokenCatalogue({tokens, controls, pack, mode, density, pointer});
    const height = pointer === 'coarse' ? '44px' : ({default: tokens[pack].defaults['control-height'], compact: '30px', dense: '24px', comfortable: '44px'})[density];
    assert.equal(c.resolved['--ui-control-height'].value, height);
    assert.equal(c.resolved['--ui-primary'].value, tokens[pack][mode].primary);
    assert.equal(c.resolved['--ui-radius'].value, tokens[pack].defaults.radius);
    assert.equal(c.resolved['--ui-playhead-color'].value, tokens[pack][mode].primary);
  }
  assert.equal(read('src/controls.css'), controls);
});
test('typed alias graph detects cycles, missing references, unit errors and type errors', () => {
  const c = loadTokenCatalogue();
  for (const overrides of [
    {'--ui-primary': {ref: '--ui-playhead-color'}}, {'--ui-primary': {ref: '--unknown'}},
    {'--ui-primary': {ref: '--ui-gap'}}, {'--ui-gap': '12'}, {'--ui-gap': 'calc(1px + 2px)'},
    {'--ui-control-weight': 1200}, {'--ui-primary': '#12345'}, {'--ui-primary': '#123456; color:red'},
    {'--ui-font': 'serif'}, {'primitive.primary': '#000000'}
  ]) assert.throws(() => resolveTokenGraph(c.definitions, overrides));
});
test('mirror token provenance points to real source values or explicit override locations', () => {
  const mirrored = {postvisual: tokens.postvisual, personal: {mirror: 'postvisual', overrides: {dark: {accent: '#123456'}}}};
  const catalogue = createTokenCatalogue({tokens: mirrored, controls, pack: 'personal', mode: 'dark'});
  assert.equal(catalogue.resolved['--ui-primary'].origin.pointer, '/postvisual/dark/primary');
  assert.equal(catalogue.resolved['--ui-primary'].origin.inheritedFromPack, 'postvisual');
  assert.equal(catalogue.resolved['--ui-accent'].origin.pointer, '/personal/overrides/dark/accent');
  assert.equal(catalogue.resolved['--ui-accent'].value, '#123456');
});
test('alias resolution distinguishes primitives, semantic/component tokens and override origins', () => {
  const c = loadTokenCatalogue();
  assert.equal(c.definitions['primitive.primary'].layer, 'primitive'); assert.equal(c.definitions['--ui-primary'].layer, 'semantic');
  assert.equal(c.definitions['--ui-playhead-color'].layer, 'component');
  const document = resolveScopedTokens(c, {'--ui-primary': '#123456'});
  assert.equal(document['--ui-playhead-color'].value, '#123456');
  assert.equal(document['--ui-playhead-color'].inheritedFrom.scope, 'document');
  const node = resolveScopedTokens(c, {'--ui-primary': '#123456'}, {'--ui-primary': '#abcdef'}, 'save');
  assert.equal(node['--ui-playhead-color'].value, '#abcdef'); assert.equal(node['--ui-primary'].origin.scope, 'node:save');
  assert.equal(c.resolved['--ui-primary'].origin.file, 'src/tokens.json');
});
test('token inventory retains nested contexts and fails on unknown tokens instead of silently omitting them', () => {
  const input = '@layer ui.tokens { [data-ui] { --ui-gap: 6px; content:"{;:}"; } @media(pointer:coarse) { [data-ui] { --ui-gap: 8px; } } }';
  const inventory = inventoryCSS(input);
  assert.equal(inventory.declarations.length, 2); assert.deepEqual(inventory.declarations[1].context, ['@layer ui.tokens', '@media(pointer:coarse)', '[data-ui]']);
  assert.throws(() => inventoryCSS('[data-ui] { --ui-gap: 6px;'));
  assert.throws(() => createTokenCatalogue({tokens, controls: controls + '\n[data-ui]{--ui-unknown:1px}'}), /Unregistered shared token/);
});
test('studio modules and contracts never enter the consumer bundle or automatic style channel', () => {
  const build = read('scripts/build.mjs');
  assert.doesNotMatch(build, /studio|schema-audit/);
  assert.doesNotMatch(read('src/runtime.js') + read('src/components.js') + read('src/diagnostics.js'), /studio\/|schema-audit|authoring/i);
});

test('compound CSS, scoped rules and quoted text never masquerade as resolved root defaults', () => {
  const extra = '\n@layer ui.tokens { [data-ui] { --ui-primary:color-mix(in srgb,#fff,#000); } .ui-card { --ui-gap:50px; } }';
  const c = createTokenCatalogue({tokens, controls: controls + extra});
  assert.equal(c.resolved['--ui-primary'].available, false); assert.equal(c.resolved['--ui-playhead-color'].available, false);
  assert.equal(c.resolved['--ui-gap'].value, '6px');
  assert.throws(() => resolveTokenGraph(c.definitions, {'--ui-accent': {ref: '--ui-primary'}}), /needs a renderer/);
  assert.equal(resolveTokenGraph(c.definitions, {'--ui-primary': '#123456'})['--ui-playhead-color'].value, '#123456');
  assert.deepEqual(inventoryCSS('[data-ui]{content:"var(--ui-unknown)";}').uses, []);
  const declaration = inventoryCSS('[data-ui] {\n /* context */\n --ui-gap: 6px;\n}').declarations[0];
  assert.equal(declaration.line, 3);
});

test('rule expectation changes cannot reuse an exception for old expected evidence', () => {
  const snapshot = {schemaVersion: 1, appId: 'demo', viewId: 'review', elements: [
    {id: 'action', tag: 'div', roles: ['action'], attributes: {}, counts: {'action-label': 1, 'action-icon': 0}}
  ], coverage: {matched: 1, captured: 1, truncated: false}};
  const finding = auditSchemaSnapshot(snapshot).findings[0];
  assert.deepEqual(JSON.parse(decodeURIComponent(finding.fingerprint.slice('ui-schema-v1:'.length))), ['demo', 'review', 'action', finding.rule, finding.expected, 'div']);
});
