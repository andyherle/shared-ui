import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {COMPOSITION_CONTRACTS} from '../src/studio/registry.mjs';

function setup() {
  let writes = 0;
  class Element {
    constructor(doc, tag) {
      this.nodeType = 1; this.ownerDocument = doc; this.localName = tag;
      this.children = []; this.parentNode = null; this.isConnected = false;
      this.properties = new Map(); this.priorities = new Map(); this._className = '';
      this.dataset = new Proxy({}, {set(target, key, value) {writes++; target[key] = value; return true;}, deleteProperty(target, key) {writes++; return delete target[key];}});
      this.classList = {contains: name => this.className.split(/\s+/).includes(name)};
      this.style = {
        getPropertyValue: name => this.properties.get(name) ?? '',
        getPropertyPriority: name => this.priorities.get(name) ?? '',
        setProperty: (name, value, priority = '') => {writes++; this.properties.set(name, value); this.priorities.set(name, priority);},
        removeProperty: name => {writes++; this.priorities.delete(name); this.properties.delete(name);}
      };
    }
    get className() {return this._className;}
    set className(value) {writes++; this._className = value;}
    append(...children) {for (const child of children) {child.remove(); this.children.push(child); child.parentNode = this;}}
    contains(target) {return this === target || this.children.some(child => child.contains(target));}
    remove() {if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null;}
  }
  const doc = {createElement: tag => new Element(doc, tag)};
  const UI = {compositionContracts: COMPOSITION_CONTRACTS};
  vm.runInNewContext(fs.readFileSync(new URL('../src/compositions.js', import.meta.url), 'utf8'), {window:{SharedUI:UI, document:doc}});
  const group = (scope, id = 'control-group') => UI.createComposition(id, {header:doc.createElement('h3'), body:doc.createElement('input')}, scope ? {scope} : {});
  const view = handle => JSON.stringify({data:{...handle.element.dataset}, styles:[...handle.element.properties], classes:Object.fromEntries(Object.entries(handle.slots).map(([key, el]) => [key, el.className]))});
  return {UI, doc, group, view, writes:() => writes};
}

test('unchanged effective settings perform zero DOM writes', () => {
  const h = setup(), scope = h.UI.createCompositionScope(), group = h.group(scope);
  const before = h.writes();
  group.setLayout({}); scope.setDefaults({}, {expectedRevision:0});
  assert.equal(h.writes(), before);
  assert.equal(scope.getState().revision, 1, 'An accepted operation still advances its revision');
});

test('adoption cannot erase an existing override marker while leaving its style active', () => {
  const h = setup(), group = h.group(undefined, 'review-workspace');
  group.setLayout({overrides:{gap:'8px', aside:'22rem', reason:'Synthetic inspector requires space'}});
  const root = group.element; group.dispose(); const before = h.view(group);
  assert.throws(() => h.UI.adoptComposition(root, {overrides:{}}));
  assert.equal(h.view(group), before);
  assert.throws(() => h.UI.adoptComposition(root, {overrides:{gap:'8px',reason:'Partial declaration must not clear aside'}}));
  assert.throws(() => h.UI.adoptComposition(root, {overrides:{gap:'9px',aside:'22rem',reason:'Changed values must be explicit after adoption'}}));
  const adopted = h.UI.adoptComposition(root, {overrides:{gap:'8px',aside:'22rem',reason:'Synthetic inspector requires space'}});
  assert.equal(adopted.getConfiguration().overrides.aside, '22rem');
});

test('a failed shared update restores all affected groups and retains the revision', () => {
  const h = setup(), scope = h.UI.createCompositionScope(), a = h.group(scope), b = h.group(scope);
  const before = [h.view(a), h.view(b)];
  let injected = false;
  Object.defineProperty(b.slots.body, 'className', {get() {return this._className;}, set(value) {
    this._className = value;
    if (!injected && value === 'ui-grid') {injected = true; throw new Error('Injected native write failure');}
  }});
  assert.throws(() => scope.setDefaults({'control-group':{variant:'grid'}}, {expectedRevision:0}), /Injected/);
  assert.deepEqual([h.view(a), h.view(b)], before);
  assert.equal(scope.getState().revision, 0);
  scope.setDefaults({'control-group':{variant:'grid'}}, {expectedRevision:0});
  assert.equal(a.getConfiguration().variant, 'grid'); assert.equal(b.getConfiguration().variant, 'grid');
});

test('a failed local update restores both DOM and configuration', () => {
  const h = setup(), panel = h.group(undefined, 'review-workspace'), before = h.view(panel);
  const write = panel.element.style.setProperty; let injected = false;
  panel.element.style.setProperty = (...args) => {write(...args); if (!injected) {injected = true; throw new Error('Injected style failure');}};
  assert.throws(() => panel.setLayout({variant:'split', overrides:{gap:'8px', reason:'Synthetic fault test'}}), /Injected/);
  assert.equal(h.view(panel), before);
  assert.equal(panel.getConfiguration().variant, 'standard');
});

test('input records reject inherited settings, hidden keys and getters without executing them', () => {
  const h = setup(); let reads = 0;
  const getter = Object.defineProperty({}, 'control-group', {enumerable:true, get() {reads++; return {variant:'grid'};}});
  for (const value of [new Date(), new Map(), Object.create({'control-group':{variant:'grid'}}), getter,
    Object.defineProperty({}, 'hidden', {value:true}), {[Symbol('hidden')]:true}]) {
    assert.throws(() => h.UI.createCompositionScope(value));
  }
  assert.equal(reads, 0);
  const scope = h.UI.createCompositionScope(Object.assign(Object.create(null), {'control-group':{variant:'grid'}}));
  assert.equal(h.group(scope).getConfiguration().variant, 'grid');
});

test('every optional workspace slot combination can adopt its existing native shell', () => {
  const h = setup(), optional = ['toolbar','filters','aside','footer'];
  for (let mask = 0; mask < 16; mask++) {
    const slots = {header:h.doc.createElement('h3'), body:h.doc.createElement('form')};
    for (const [bit, key] of optional.entries()) if (mask & (1 << bit)) slots[key] = h.doc.createElement('div');
    const created = h.UI.createComposition('review-workspace', slots), root = created.element;
    created.dispose(); const adopted = h.UI.adoptComposition(root);
    assert.equal(adopted.slots.body.children[0], slots.body);
    assert.equal(Object.keys(adopted.slots).length, Object.keys(slots).length);
    adopted.setLayout({variant:'stack'}); adopted.dispose();
  }
});

test('a second edit or disposal cannot re-enter an active scope update', () => {
  const h = setup(), scope = h.UI.createCompositionScope(), group = h.group(scope);
  let entered = false;
  Object.defineProperty(group.slots.body, 'className', {get() {return this._className;}, set(value) {
    if (!entered) {
      entered = true;
      for (const action of [() => scope.setDefaults({}, {expectedRevision:0}),
        () => scope.preview({}, {expectedRevision:0}), () => group.setLayout({variant:'stack'}),
        () => group.dispose(), () => scope.dispose(), () => h.group(scope)]) assert.throws(action, /in progress/);
    }
    this._className = value;
  }});
  scope.setDefaults({'control-group':{variant:'grid'}}, {expectedRevision:0});
  assert.ok(entered); assert.equal(scope.getState().revision, 1);
  assert.equal(scope.getState().registered, 1); group.dispose(); scope.dispose();
});

test('incomplete recovery is explicit and blocks later edits until the scope is replaced', () => {
  const h = setup(), scope = h.UI.createCompositionScope(), group = h.group(scope);
  Object.defineProperty(group.slots.body, 'className', {get() {return this._className;}, set(value) {
    if (value === 'ui-grid') {this._className = value; throw new Error('Injected write failure');}
    throw new Error('Injected rollback failure');
  }});
  assert.throws(() => scope.setDefaults({'control-group':{variant:'grid'}}, {expectedRevision:0}), /recovery did not complete/);
  assert.equal(scope.getState().recoveryRequired, true); assert.equal(scope.getState().revision, 0);
  assert.equal(group.getConfiguration().recoveryRequired, true);
  assert.throws(() => group.setLayout({variant:'grid'}), /needs recovery/);
  assert.throws(() => scope.setDefaults({}, {expectedRevision:0}), /needs recovery/);
  group.dispose(); scope.dispose(); assert.equal(scope.getState().registered, 0);
});

test('changed slot ownership stops the whole batch before any write', () => {
  const h = setup(), scope = h.UI.createCompositionScope(), a = h.group(scope), b = h.group(scope);
  const before = h.view(a); b.slots.body.remove();
  assert.throws(() => scope.setDefaults({'control-group':{variant:'grid'}}, {expectedRevision:0}), /structure changed/);
  assert.equal(h.view(a), before); assert.equal(scope.getState().revision, 0);
  b.element.append(b.slots.body); scope.setDefaults({'control-group':{variant:'grid'}}, {expectedRevision:0});
  assert.equal(b.getConfiguration().variant, 'grid');
});

test('unknown revision options and accessor revisions fail before reading them', () => {
  const h = setup(), scope = h.UI.createCompositionScope(); let reads = 0;
  assert.throws(() => scope.setDefaults({}, {expectedRevision:0, typo:true}));
  assert.throws(() => scope.preview({}, {get expectedRevision() {reads++; return 0;}}));
  assert.equal(reads, 0); assert.equal(scope.getState().revision, 0);
});

test('unmarked inline styles, unknown override markers and important declarations cannot disappear during adoption', () => {
  for (const mode of ['unmarked','unknown','repeated','important']) {
    const h = setup(), group = h.group(undefined, 'review-workspace'), root = group.element;
    group.dispose(); root.style.setProperty('--ui-composition-gap', '8px', mode === 'important' ? 'important' : '');
    if (mode !== 'unmarked') root.dataset.uiCompositionOverrides = mode === 'unknown' ? 'foreign' : mode === 'repeated' ? 'gap,gap' : 'gap';
    const before = h.view(group);
    assert.throws(() => h.UI.adoptComposition(root, {overrides:mode === 'unmarked' ? {} : {gap:'8px',reason:'Synthetic override'}}));
    assert.equal(h.view(group), before);
  }
});

test('scope capacity rejects the extra instance before moving its input and recovers after disposal', () => {
  const h = setup(), scope = h.UI.createCompositionScope(), groups = [];
  for (let i = 0; i < 1000; i++) groups.push(h.group(scope));
  const heading = h.doc.createElement('h3'), field = h.doc.createElement('input');
  assert.throws(() => h.UI.createComposition('control-group', {header:heading,body:field}, {scope}), /limit/);
  assert.equal(field.parentNode, null); assert.equal(heading.parentNode, null);
  assert.equal(scope.setDefaults({'control-group':{variant:'grid'}}, {expectedRevision:0}).changed, 1000);
  groups.pop().dispose(); groups.push(h.group(scope));
  assert.equal(groups.at(-1).getConfiguration().variant, 'grid');
  groups.forEach(group => group.dispose()); scope.dispose(); assert.equal(scope.getState().registered, 0);
});

test('seeded edit sequences preserve inheritance, pins, rejection and original fields', () => {
  const h = setup(), scope = h.UI.createCompositionScope(), groups = Array.from({length:16}, () => h.group(scope));
  const fields = groups.map(group => group.slots.body.children[0]);
  const pins = Array(16).fill(null); let shared = 'stack', revision = 0, seed = 0x45a31;
  const random = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed;};
  for (let step = 0; step < 4000; step++) {
    const i = random() % groups.length, operation = random() % 5, variant = random() % 2 ? 'grid' : 'stack';
    if (operation === 0) {shared = variant; scope.setDefaults({'control-group':{variant}}, {expectedRevision:revision++});}
    else if (operation === 1) {pins[i] = variant; groups[i].setLayout({variant});}
    else if (operation === 2) {pins[i] = null; groups[i].setLayout({variant:null});}
    else if (operation === 3) {assert.throws(() => scope.setDefaults({}, {expectedRevision:revision + 1}), /revision/);}
    else {assert.throws(() => groups[i].setLayout({variant:'invalid'}));}
    for (const [index, group] of groups.entries()) {
      assert.equal(group.getConfiguration().variant, pins[index] ?? shared);
      assert.equal(group.slots.body.children[0], fields[index]);
    }
    assert.equal(scope.getState().revision, revision);
  }
  groups.forEach(group => group.dispose()); scope.dispose();
});
