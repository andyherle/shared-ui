if(typeof window!=="undefined"&&window.SharedUI)window.SharedUI.compositionContracts={"review-workspace":{"id":"review-workspace","slots":{"header":{"families":["content","layout"],"min":1,"max":4},"toolbar":{"families":["layout","action","field","disclosure"],"min":0,"max":20},"filters":{"families":["layout","field"],"min":0,"max":12},"body":{"families":["layout","content","data","composition","disclosure","feedback","field"],"min":1,"max":20},"aside":{"families":["layout","content","data","composition","disclosure","feedback","field"],"min":0,"max":12},"footer":{"families":["layout","action","feedback","content"],"min":0,"max":12}},"revision":"1","root":{"tag":"article","className":"ui-composition ui-card"},"settings":{"variant":{"values":["standard","split","stack"],"default":"standard","attribute":"uiVariant"},"crowding":{"values":["wrap","scroll","priority"],"default":"wrap","attribute":"uiCrowding"}},"overrides":{"gap":{"property":"--ui-composition-gap","units":["px","rem","em"],"min":0,"max":64,"relativeMax":4},"aside":{"property":"--ui-composition-aside","units":["px","rem","em","%"],"min":128,"max":640,"relativeMin":8,"relativeMax":40,"percentMin":15,"percentMax":60}},"tree":[{"tag":"div","className":"ui-composition-layout","children":[{"tag":"header","className":"ui-composition-header ui-stack","slot":"header"},{"tag":"div","className":"ui-composition-toolbar ui-toolbar","slot":"toolbar"},{"tag":"div","className":"ui-composition-filters","slot":"filters"},{"tag":"div","className":"ui-composition-main","children":[{"tag":"section","className":"ui-composition-body ui-stack","slot":"body"},{"tag":"aside","className":"ui-composition-aside ui-stack","slot":"aside"}]},{"tag":"footer","className":"ui-composition-footer ui-actions","slot":"footer"}]}]},"control-group":{"id":"control-group","slots":{"header":{"families":["content"],"min":1,"max":4},"toolbar":{"families":["layout","action","field","disclosure"],"min":0,"max":20},"body":{"families":["layout","content","data","composition","disclosure","feedback","field"],"min":1,"max":100}},"revision":"1","root":{"tag":"details","className":"ui-section ui-composition"},"settings":{"variant":{"values":["stack","grid"],"default":"stack","attribute":"uiVariant","slotClasses":{"slot":"body","values":{"stack":"ui-stack","grid":"ui-grid"}}}},"overrides":{},"tree":[{"tag":"summary","slot":"header"},{"tag":"div","className":"ui-actions","slot":"toolbar"},{"tag":"div","className":"ui-stack","slot":"body"}]}};
/* Canonical native compositions. The build projects contracts from Studio's registry.
 * Scope state is presentation only: no transport, storage, app values or callbacks. */
(() => {
  'use strict';
  if (typeof window === 'undefined' || !window.SharedUI) return;
  const UI = window.SharedUI, contracts = UI.compositionContracts;
  if (!contracts) throw new Error('Composition registry is missing; install the complete shared bundle');
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  const freeze = value => { if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);} return value; };
  freeze(contracts);
  const scopes = new WeakMap(), owners = new WeakMap();
  const getContract = id => {
    if (!own(contracts, id)) throw new TypeError('Unknown canonical composition: ' + id);
    return contracts[id];
  };
  function keys(value, allowed, message) {
    if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new TypeError(message);
  }
  function length(value, spec, name) {
    const match = typeof value === 'string' && /^(\d+(?:\.\d+)?|\.\d+)(px|rem|em|%)$/.exec(value);
    if (!match || !spec.units.includes(match[2])) throw new TypeError('Invalid ' + name + ' length');
    const amount = Number(match[1]), unit = match[2];
    const min = unit === '%' ? spec.percentMin : unit === 'px' ? spec.min : spec.relativeMin ?? spec.min;
    const max = unit === '%' ? spec.percentMax : unit === 'px' ? spec.max : spec.relativeMax;
    if (!Number.isFinite(amount) || amount < min || amount > max) throw new RangeError('Out-of-range ' + name);
    return value;
  }
  function validateDefaults(value) {
    keys(value, Object.keys(contracts), 'Unknown composition defaults');
    const result = {};
    for (const [id, settings] of Object.entries(value)) {
      const contract = getContract(id); keys(settings, Object.keys(contract.settings), 'Unknown composition setting');
      const values = {};
      for (const [key, setting] of Object.entries(settings)) {
        if (!contract.settings[key].values.includes(setting)) throw new TypeError('Invalid ' + id + '.' + key);
        values[key] = setting;
      }
      if (Object.keys(values).length) result[id] = values;
    }
    return result;
  }
  function configuration(contract, options = {}, previous = {local:{}, overrides:{}}) {
    keys(options, [...Object.keys(contract.settings), 'overrides'], 'Unknown composition option');
    const local = {...previous.local};
    for (const [key, value] of Object.entries(options)) if (own(contract.settings, key)) {
      if (value === null || value === 'inherit') delete local[key];
      else {
        if (!contract.settings[key].values.includes(value)) throw new TypeError('Unknown composition ' + key);
        local[key] = value;
      }
    }
    const raw = options.overrides === undefined ? previous.overrides : options.overrides, overrides = {};
    keys(raw, [...Object.keys(contract.overrides), 'reason'], 'Unknown composition override');
    for (const [key, spec] of Object.entries(contract.overrides)) if (raw[key] !== undefined) overrides[key] = length(raw[key], spec, key);
    if (Object.keys(overrides).length) {
      if (typeof raw.reason !== 'string' || raw.reason.trim().length < 4 || raw.reason.length > 200 || /[\u0000-\u001f\u007f]/.test(raw.reason))
        throw new TypeError('Layout overrides need a concise reason');
      overrides.reason = raw.reason.trim();
    } else if (raw.reason !== undefined) throw new TypeError('Reason without a layout override');
    return {local, overrides};
  }
  function resolve(contract, config, defaults) {
    const values = {}, sources = {};
    for (const [key, rule] of Object.entries(contract.settings)) {
      values[key] = own(config.local, key) ? config.local[key] : defaults[contract.id]?.[key] ?? rule.default;
      sources[key] = own(config.local, key) ? 'instance' : own(defaults[contract.id] ?? {}, key) ? 'scope' : 'shared';
    }
    return {values, sources};
  }
  function instance(value) {
    if (value !== undefined && (typeof value !== 'string' || !/^[a-z][a-z0-9.-]{0,79}$/.test(value))) throw new TypeError('Invalid stable instance identity');
  }
  function scopeFor(scope, doc) {
    if (scope === undefined) return null;
    const state = scopes.get(scope);
    if (!state || state.disposed) throw new TypeError('Unknown or disposed composition scope');
    if (state.document && state.document !== doc) throw new TypeError('Composition scope cannot span DOM documents');
    if (state.members.size >= 1000) throw new RangeError('Composition scope instance limit exceeded');
    return state;
  }
  function controller(contract, root, hosts, options, created) {
    const doc = root.ownerDocument, state = scopeFor(options.scope, doc);
    if (owners.has(root)) throw new Error('Composition already has a controller');
    const {scope, instanceId, document, open, ...settings} = options;
    let config = configuration(contract, settings), disposed = false;
    const identity = instanceId ?? root.dataset.uiCompositionInstance;
    instance(identity);
    const write = (resolved, next) => {
      for (const [key, rule] of Object.entries(contract.settings)) {
        root.dataset[rule.attribute] = resolved.values[key];
        if (rule.slotClasses && hosts.has(rule.slotClasses.slot)) {
          const host = hosts.get(rule.slotClasses.slot), managed = Object.values(rule.slotClasses.values);
          host.className = host.className.split(/\s+/).filter(name => name && !managed.includes(name)).concat(rule.slotClasses.values[resolved.values[key]]).join(' ');
        }
      }
      for (const [key, rule] of Object.entries(contract.overrides)) {
        if (config.overrides[key] !== undefined && next.overrides[key] === undefined) root.style.removeProperty(rule.property);
        if (next.overrides[key] !== undefined) root.style.setProperty(rule.property, next.overrides[key]);
      }
      const overridden = Object.keys(next.overrides).filter(key => key !== 'reason');
      root.dataset.uiCompositionOrigin = overridden.length ? 'instance' : 'canonical';
      if (overridden.length) root.dataset.uiCompositionOverrides = overridden.join(','); else delete root.dataset.uiCompositionOverrides;
      const pinned = Object.keys(contract.settings).filter(key => own(next.local, key));
      if (pinned.length) root.dataset.uiLayoutOverrides = pinned.join(','); else delete root.dataset.uiLayoutOverrides;
    };
    const member = {
      plan(defaults) {
        const before = resolve(contract, config, state?.defaults ?? {}), after = resolve(contract, config, defaults);
        return {contract:contract.id, changed:Object.keys(contract.settings).filter(key => before.values[key] !== after.values[key]),
          pinned:Object.keys(config.local), after};
      },
      apply(defaults) {write(resolve(contract, config, defaults), config);}
    };
    root.dataset.uiComposition = contract.id; root.dataset.uiCompositionRevision = contract.revision;
    if (identity !== undefined) root.dataset.uiCompositionInstance = identity;
    if (created && contract.root.tag === 'details') root.open = open ?? true;
    member.apply(state?.defaults ?? {});
    if (state) {state.document ??= doc; state.members.add(member);}
    const handle = Object.freeze({
      element:root, slots:Object.freeze(Object.fromEntries(hosts)),
      getConfiguration() {
        const resolved = resolve(contract, config, state?.defaults ?? {});
        return freeze({id:contract.id, revision:contract.revision, instanceId:identity ?? null,
          ...resolved.values, layoutSources:resolved.sources, policyRevision:state?.revision ?? null,
          origin:root.dataset.uiCompositionOrigin, overrides:{...config.overrides}});
      },
      setLayout(next = {}) {
        if (disposed) throw new Error('Composition disposed');
        const updated = configuration(contract, next, config);
        write(resolve(contract, updated, state?.defaults ?? {}), updated); config = updated;
        return this.getConfiguration();
      },
      dispose() {
        if (disposed) return; disposed = true; state?.members.delete(member); owners.delete(root);
        // An adopted app-owned root is never removed. No listener/timer was created.
        if (created) root.remove();
      }
    });
    owners.set(root, handle); return handle;
  }
  function optionsFor(contract, options) {
    keys(options, [...Object.keys(contract.settings), 'overrides', 'instanceId', 'document', 'scope', ...(contract.root.tag === 'details' ? ['open'] : [])], 'Unknown composition option');
    instance(options.instanceId);
    if (options.open !== undefined && typeof options.open !== 'boolean') throw new TypeError('Open must be a boolean');
    const {scope, instanceId, document, open, ...settings} = options;
    configuration(contract, settings);
  }
  UI.createComposition = (componentId, slots, options = {}) => {
    const contract = getContract(componentId); optionsFor(contract, options);
    const names = Object.keys(contract.slots); keys(slots, names, 'Unknown composition slot');
    const supplied = names.flatMap(key => slots[key] == null ? [] : Array.isArray(slots[key]) ? slots[key] : [slots[key]]);
    const doc = options.document || supplied[0]?.ownerDocument || window.document;
    if (!doc || typeof doc.createElement !== 'function') throw new TypeError('DOM document required');
    scopeFor(options.scope, doc);
    const nodes = new Map(), seen = new Set();
    // Validate the full request before moving even one detached node.
    for (const key of names) {
      const value = slots[key], group = value == null ? [] : Array.isArray(value) ? value : [value];
      const rule = contract.slots[key];
      if (group.length < rule.min) throw new TypeError('Missing required composition slot: ' + key);
      if (group.length > rule.max) throw new RangeError('Too many slot elements: ' + key);
      for (const item of group) {
        if (item?.nodeType !== 1 || item.ownerDocument !== doc || item.isConnected || seen.has(item)) throw new TypeError('Slot elements must be unique, detached native DOM nodes');
        for (const prior of seen) if (item.contains?.(prior) || prior.contains?.(item)) throw new TypeError('Nested slot elements must be passed through one parent');
        seen.add(item);
      }
      nodes.set(key, group);
    }
    const make = spec => {
      const el = doc.createElement(spec.tag); if (spec.className) el.className = spec.className;
      if (spec.slot) el.dataset.uiCompositionSlot = spec.slot;
      return el;
    };
    const root = make(contract.root), hosts = new Map();
    const build = (tree, into) => {for (const spec of tree) {
      if (spec.slot && !nodes.get(spec.slot).length) continue;
      const el = make(spec); into.append(el);
      if (spec.slot) {el.append(...nodes.get(spec.slot)); hosts.set(spec.slot, el);}
      if (spec.children) build(spec.children, el);
    }};
    build(contract.tree, root);
    return controller(contract, root, hosts, options, true);
  };
  UI.adoptComposition = (root, options = {}) => {
    if (!root || root.nodeType !== 1) throw new TypeError('Native composition root required');
    const contract = getContract(root.dataset.uiComposition); optionsFor(contract, options);
    if (owners.has(root)) throw new Error('Composition already has a controller');
    if (root.localName !== contract.root.tag || root.dataset.uiCompositionRevision !== contract.revision) throw new TypeError('Incompatible native composition');
    for (const name of contract.root.className.split(' ')) if (!root.classList.contains(name)) throw new TypeError('Missing native composition role');
    if (options.document && options.document !== root.ownerDocument) throw new TypeError('DOM document mismatch');
    if (options.open !== undefined) throw new TypeError('Adoption preserves the existing open state');
    const hosts = new Map();
    const matchesRole = (el, spec) => {
      const dynamic = Object.values(contract.settings).filter(rule => rule.slotClasses?.slot === spec.slot);
      const managed = dynamic.flatMap(rule => Object.values(rule.slotClasses.values));
      const fixed = (spec.className || '').split(' ').filter(name => name && !managed.includes(name));
      return fixed.every(name => el.classList.contains(name)) && dynamic.every(rule => {
        const value = root.dataset[rule.attribute] ?? rule.default;
        return rule.values.includes(value) && el.classList.contains(rule.slotClasses.values[value]);
      });
    };
    const inspect = (tree, parent) => {
      const found = new Set(); let previous = -1;
      for (const spec of tree) {
        const matches = [...parent.children].filter(el => spec.slot ? el.dataset.uiCompositionSlot === spec.slot :
          el.localName === spec.tag && spec.className.split(' ').every(name => el.classList.contains(name)));
        const required = !spec.slot || contract.slots[spec.slot].min > 0;
        if (matches.length > 1 || (required && matches.length !== 1)) throw new TypeError('Invalid composition structure: ' + (spec.slot || spec.className));
        if (!matches.length) continue;
        const el = matches[0], index = [...parent.children].indexOf(el);
        if (el.localName !== spec.tag || !matchesRole(el, spec) || index <= previous)
          throw new TypeError('Invalid composition slot role or order');
        previous = index; found.add(el);
        if (spec.slot) hosts.set(spec.slot, el); else inspect(spec.children || [], el);
      }
      if ([...parent.children].some(el => !found.has(el))) throw new TypeError('Unexpected composition structural child');
    };
    inspect(contract.tree, root); // No reparenting, wrapping or cloning of live fields.
    const inferred = {};
    for (const [key, rule] of Object.entries(contract.settings)) {
      const value = root.dataset[rule.attribute]; if (value !== undefined) inferred[key] = value;
    }
    if (root.dataset.uiCompositionOverrides && options.overrides === undefined)
      throw new TypeError('Adoption needs the declared typed overrides and reason');
    return controller(contract, root, hosts, {...inferred,...options}, false);
  };
  UI.createCompositionScope = (defaults = {}) => {
    const state = {defaults:validateDefaults(defaults), revision:0, members:new Set(), document:null, disposed:false};
    function prepare(next, expectedRevision) {
      if (state.disposed) throw new Error('Composition scope disposed');
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== state.revision) throw new Error('Composition scope revision conflict');
      const validated = validateDefaults(next), plans = [...state.members].map(member => member.plan(validated));
      return {validated, plans};
    }
    const report = plans => ({registered:plans.length, changed:plans.filter(plan => plan.changed.length).length,
      pinned:plans.filter(plan => plan.pinned.length).length,
      components:Object.fromEntries(Object.keys(contracts).map(id => [id, {registered:plans.filter(plan => plan.contract===id).length,
        changed:plans.filter(plan => plan.contract===id && plan.changed.length).length}]))});
    const api = Object.freeze({
      getState() {return freeze({revision:state.revision, defaults:copy(state.defaults), registered:state.members.size, disposed:state.disposed});},
      preview(next, {expectedRevision} = {}) {const {plans} = prepare(next, expectedRevision); return freeze({revision:state.revision,...report(plans)});},
      setDefaults(next, {expectedRevision} = {}) {
        const {validated,plans} = prepare(next, expectedRevision), result = report(plans);
        if (state.revision === Number.MAX_SAFE_INTEGER) throw new RangeError('Composition scope revision limit');
        // All values and affected instances are validated before applying the presentation update.
        for (const member of state.members) member.apply(validated);
        state.defaults = validated; state.revision++;
        return freeze({revision:state.revision,...result});
      },
      dispose() {if (state.members.size) throw new Error('Dispose composition handles before their scope'); state.disposed = true;}
    });
    scopes.set(api,state); return api;
  };
})();
