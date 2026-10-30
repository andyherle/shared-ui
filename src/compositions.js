/* Canonical native compositions. The build projects contracts from Studio's registry.
 * Scope state is presentation only: no transport, storage, app values or callbacks. */
(() => {
  'use strict';
  if (typeof window === 'undefined' || !window.SharedUI) return;
  const UI = window.SharedUI, contracts = UI.compositionContracts;
  if (!contracts) throw new Error('Composition registry is missing; install the complete shared bundle');
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  // Accept ordinary records from this window or another realm, not host objects.
  const plain = value => {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || Object.getPrototypeOf(proto) === null &&
      Object.getOwnPropertyDescriptor(proto, 'constructor')?.value?.name === 'Object';
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const freeze = value => { if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);} return value; };
  freeze(contracts);
  const scopes = new WeakMap(), owners = new WeakMap();
  const getContract = id => {
    if (typeof id !== 'string' || !own(contracts, id)) throw new TypeError('Unknown canonical composition: ' + id);
    return contracts[id];
  };
  function keys(value, allowed, message) {
    if (!plain(value) || Reflect.ownKeys(value).some(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return typeof key !== 'string' || !allowed.includes(key) || !descriptor.enumerable || !own(descriptor, 'value');
    })) throw new TypeError(message);
  }
  function available(state) {
    if (state?.busy) throw new Error('Composition update is already in progress');
    if (state?.recoveryRequired) throw new Error('Composition needs recovery; dispose and adopt the verified markup again');
  }
  function commit(operations, failedRecovery) {
    const attempted = [];
    try {
      for (const operation of operations) {attempted.push(operation); operation.apply(operation.next);}
    } catch (error) {
      const failures = [];
      for (const operation of attempted.reverse()) {
        try {operation.apply(operation.before);} catch (failure) {failures.push(failure);}
      }
      if (failures.length) {
        failedRecovery();
        throw new AggregateError([error, ...failures], 'Layout update failed and recovery did not complete');
      }
      throw error;
    }
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
    available(state);
    if (state.document && state.document !== doc) throw new TypeError('Composition scope cannot span DOM documents');
    if (state.members.size >= 1000) throw new RangeError('Composition scope instance limit exceeded');
    return state;
  }
  function controller(contract, root, hosts, options, created) {
    const doc = root.ownerDocument, state = scopeFor(options.scope, doc);
    if (owners.has(root)) throw new Error('Composition already has a controller');
    const {scope, instanceId, document, open, ...settings} = options;
    let config = configuration(contract, settings), disposed = false, busy = false, recoveryRequired = false;
    const identity = instanceId ?? root.dataset.uiCompositionInstance;
    instance(identity);
    const parents = new Map([...hosts].map(([key, host]) => [key, host.parentNode]));
    function check() {
      if (disposed) throw new Error('Composition disposed');
      available({busy, recoveryRequired}); available(state);
      if (root.ownerDocument !== doc || [...hosts].some(([key, host]) =>
        host.ownerDocument !== doc || host.parentNode !== parents.get(key) || !root.contains(host)))
        throw new Error('Composition structure changed; dispose and adopt the new markup explicitly');
    }
    const planWrite = (resolved, next) => {
      const operations = [];
      const data = (key, value) => {
        const before = root.dataset[key];
        if (before === value) return;
        operations.push({before, next:value, apply(value) {
          if (root.dataset[key] === value) return;
          if (value === undefined) delete root.dataset[key]; else root.dataset[key] = value;
        }});
      };
      for (const [key, rule] of Object.entries(contract.settings)) {
        data(rule.attribute, resolved.values[key]);
        if (rule.slotClasses && hosts.has(rule.slotClasses.slot)) {
          const host = hosts.get(rule.slotClasses.slot), managed = Object.values(rule.slotClasses.values);
          const before = host.className;
          const after = before.split(/\s+/).filter(name => name && !managed.includes(name)).concat(rule.slotClasses.values[resolved.values[key]]).join(' ');
          if (before !== after) operations.push({before, next:after, apply(value) {if (host.className !== value) host.className = value;}});
        }
      }
      for (const [key, rule] of Object.entries(contract.overrides)) {
        if (config.overrides[key] === undefined && next.overrides[key] === undefined) continue;
        const before = {value:root.style.getPropertyValue(rule.property), priority:root.style.getPropertyPriority(rule.property)};
        const after = {value:next.overrides[key] ?? '', priority:''};
        if (before.value !== after.value || before.priority !== after.priority) operations.push({before, next:after, apply(value) {
          if (root.style.getPropertyValue(rule.property) === value.value && root.style.getPropertyPriority(rule.property) === value.priority) return;
          if (value.value) root.style.setProperty(rule.property, value.value, value.priority); else root.style.removeProperty(rule.property);
        }});
      }
      const overridden = Object.keys(next.overrides).filter(key => key !== 'reason');
      data('uiCompositionOrigin', overridden.length ? 'instance' : 'canonical');
      data('uiCompositionOverrides', overridden.length ? overridden.join(',') : undefined);
      const pinned = Object.keys(contract.settings).filter(key => own(next.local, key));
      data('uiLayoutOverrides', pinned.length ? pinned.join(',') : undefined);
      return operations;
    };
    const member = {
      plan(defaults) {
        check();
        const before = resolve(contract, config, state?.defaults ?? {}), after = resolve(contract, config, defaults);
        return {contract:contract.id, changed:Object.keys(contract.settings).filter(key => before.values[key] !== after.values[key]),
          pinned:Object.keys(config.local), operations:planWrite(after, config)};
      }
    };
    // Adoption may fail during a native write. Restore only our presentation fields.
    const initial = planWrite(resolve(contract, config, state?.defaults ?? {}), config);
    for (const [key, value] of Object.entries({uiComposition:contract.id, uiCompositionRevision:contract.revision,
      ...(identity !== undefined ? {uiCompositionInstance:identity} : {})})) {
      const before = root.dataset[key];
      if (before !== value) initial.push({before, next:value, apply(value) {
        if (root.dataset[key] === value) return;
        if (value === undefined) delete root.dataset[key]; else root.dataset[key] = value;
      }});
    }
    if (created && contract.root.tag === 'details') root.open = open ?? true;
    if (state) state.busy = true;
    try {commit(initial, () => {if (state) state.recoveryRequired = true;});}
    finally {if (state) state.busy = false;}
    if (state) {state.document ??= doc; state.members.add(member);}
    const handle = Object.freeze({
      element:root, slots:Object.freeze(Object.fromEntries(hosts)),
      getConfiguration() {
        const resolved = resolve(contract, config, state?.defaults ?? {});
        return freeze({id:contract.id, revision:contract.revision, instanceId:identity ?? null,
          ...resolved.values, layoutSources:resolved.sources, policyRevision:state?.revision ?? null,
          origin:root.dataset.uiCompositionOrigin, overrides:{...config.overrides}, recoveryRequired:recoveryRequired || !!state?.recoveryRequired});
      },
      setLayout(next = {}) {
        check();
        const updated = configuration(contract, next, config);
        const operations = planWrite(resolve(contract, updated, state?.defaults ?? {}), updated);
        busy = true; if (state) state.busy = true;
        try {
          commit(operations, () => {recoveryRequired = true; if (state) state.recoveryRequired = true;});
          config = updated;
        } finally {busy = false; if (state) state.busy = false;}
        return this.getConfiguration();
      },
      dispose() {
        if (disposed) return;
        if (busy || state?.busy) throw new Error('Composition update is already in progress');
        disposed = true; state?.members.delete(member); owners.delete(root);
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
      const dynamic = Object.values(contract.settings).filter(rule => rule.slotClasses && rule.slotClasses.slot === spec.slot);
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
    const declared = root.dataset.uiCompositionOverrides?.split(',') ?? [];
    const rawOverrides = options.overrides ?? {};
    if (new Set(declared).size !== declared.length || declared.some(key => !own(contract.overrides, key)))
      throw new TypeError('Unknown or repeated declared typed overrides');
    for (const [key, rule] of Object.entries(contract.overrides)) {
      const value = root.style.getPropertyValue(rule.property);
      if (declared.includes(key) || value) {
        if (!own(rawOverrides, key) || !value || value.trim() !== rawOverrides[key] || root.style.getPropertyPriority(rule.property))
          throw new TypeError('Adoption needs the exact declared typed overrides and reason; change them after adoption');
      }
    }
    return controller(contract, root, hosts, {...inferred,...options}, false);
  };
  UI.createCompositionScope = (defaults = {}) => {
    const state = {defaults:validateDefaults(defaults), revision:0, members:new Set(), document:null, disposed:false, busy:false, recoveryRequired:false};
    function prepare(next, options) {
      keys(options, ['expectedRevision'], 'Unknown composition revision option');
      const {expectedRevision} = options;
      available(state);
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
      getState() {return freeze({revision:state.revision, defaults:copy(state.defaults), registered:state.members.size, disposed:state.disposed, recoveryRequired:state.recoveryRequired});},
      preview(next, options = {}) {const {plans} = prepare(next, options); return freeze({revision:state.revision,...report(plans)});},
      setDefaults(next, options = {}) {
        const {validated,plans} = prepare(next, options), result = report(plans);
        if (state.revision === Number.MAX_SAFE_INTEGER) throw new RangeError('Composition scope revision limit');
        // Prepare every delta first. A failed write restores prior presentation and revision.
        state.busy = true;
        try {
          commit(plans.flatMap(plan => plan.operations), () => {state.recoveryRequired = true;});
          state.defaults = validated; state.revision++;
        } finally {state.busy = false;}
        return freeze({revision:state.revision,...result});
      },
      dispose() {if (state.busy) throw new Error('Composition update is already in progress'); if (state.members.size) throw new Error('Dispose composition handles before their scope'); state.disposed = true;}
    });
    scopes.set(api,state); return api;
  };
})();
