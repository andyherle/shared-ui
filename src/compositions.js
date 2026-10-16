/* Native canonical compositions: shells only, no app state, transport or listeners. */
(() => {
  'use strict';
  if (typeof window === 'undefined' || !window.SharedUI) return;
  const UI = window.SharedUI;
  const ID = 'review-workspace', REVISION = '1';
  const SLOTS = ['header', 'toolbar', 'filters', 'body', 'aside', 'footer'];
  const VARIANTS = ['standard', 'split', 'stack'];
  const CROWDING = ['wrap', 'scroll', 'priority'];
  const OVERRIDES = Object.freeze({
    gap: {property: '--ui-composition-gap', min: 0, max: 64, units: ['px', 'rem', 'em']},
    aside: {property: '--ui-composition-aside', min: 0, max: 640, units: ['px', 'rem', 'em', '%']}
  });
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  function length(value, spec, name) {
    const match = typeof value === 'string' && /^(\d+(?:\.\d+)?|\.\d+)(px|rem|em|%)$/.exec(value);
    if (!match || !spec.units.includes(match[2])) throw new TypeError('Invalid ' + name + ' length');
    const amount = Number(match[1]), unit = match[2], max = unit === '%' ? (name === 'aside' ? 60 : 100) : unit === 'rem' || unit === 'em' ? (name === 'aside' ? 40 : 4) : spec.max;
    const min = name === 'aside' ? unit === 'px' ? 128 : unit === '%' ? 15 : 8 : 0;
    if (!Number.isFinite(amount) || amount < min || amount > max) throw new RangeError('Out-of-range ' + name);
    return value;
  }
  function configuration(options = {}) {
    if (!plain(options) || Object.keys(options).some(key => !['variant', 'crowding', 'overrides', 'instanceId', 'document'].includes(key)))
      throw new TypeError('Unknown composition option');
    const variant = options.variant ?? 'standard', crowding = options.crowding ?? 'wrap';
    if (!VARIANTS.includes(variant) || !CROWDING.includes(crowding)) throw new TypeError('Unknown composition variant or crowding');
    const raw = options.overrides ?? {}, overrides = {};
    if (!plain(raw) || Object.keys(raw).some(key => !['gap', 'aside', 'reason'].includes(key))) throw new TypeError('Unknown composition override');
    for (const [key, spec] of Object.entries(OVERRIDES)) {
      if (raw[key] !== undefined) overrides[key] = length(raw[key], spec, key);
    }
    const count = Object.keys(overrides).length;
    if (count) {
      if (typeof raw.reason !== 'string' || raw.reason.trim().length < 4 || raw.reason.length > 200 ||
          /[\u0000-\u001f\u007f]/.test(raw.reason)) throw new TypeError('Layout overrides need a concise reason');
      overrides.reason = raw.reason.trim();
    } else if (raw.reason !== undefined) throw new TypeError('Reason without a layout override');
    return {variant, crowding, overrides};
  }
  UI.createComposition = (componentId, slots, options = {}) => {
    if (componentId !== ID) throw new TypeError('Unknown canonical composition: ' + componentId);
    if (!plain(slots) || Object.keys(slots).some(key => !SLOTS.includes(key))) throw new TypeError('Unknown composition slot');
    const doc = options.document || SLOTS.flatMap(key => slots[key] == null ? [] : Array.isArray(slots[key]) ? slots[key] : [slots[key]])[0]?.ownerDocument || window.document;
    if (!doc || typeof doc.createElement !== 'function') throw new TypeError('DOM document required');
    const instanceId = options.instanceId;
    if (instanceId !== undefined && (typeof instanceId !== 'string' || !/^[a-z][a-z0-9.-]{1,79}$/.test(instanceId))) throw new TypeError('Invalid stable instance identity');
    let config = configuration(options);
    const nodes = new Map(), seen = new Set();
    for (const key of SLOTS) {
      const value = slots[key], group = value == null ? [] : Array.isArray(value) ? value : [value];
      if ((key === 'header' || key === 'body') && group.length === 0) throw new TypeError('Missing required composition slot: ' + key);
      if (group.length > 100) throw new RangeError('Too many slot elements');
      for (const item of group) {
        if (item?.nodeType !== 1 || item.ownerDocument !== doc || item.isConnected || seen.has(item))
          throw new TypeError('Slot elements must be unique, detached native DOM nodes');
        for (const prior of seen) if (item.contains?.(prior) || prior.contains?.(item))
          throw new TypeError('Nested slot elements must be passed through one parent');
        seen.add(item);
      }
      nodes.set(key, group);
    }
    const make = (tag, cls, slot) => {
      const el = doc.createElement(tag);
      if (cls) el.className = cls;
      if (slot) el.dataset.uiCompositionSlot = slot;
      return el;
    };
    const root = make('article', 'ui-composition ui-card');
    root.dataset.uiComposition = ID; root.dataset.uiCompositionRevision = REVISION;
    if (instanceId) root.dataset.uiCompositionInstance = instanceId;
    const frame = make('div', 'ui-composition-layout');
    const hosts = new Map();
    function insert(key, tag, cls, into) {
      if (!nodes.get(key).length) return;
      const host = make(tag, cls, key);
      host.append(...nodes.get(key)); into.append(host); hosts.set(key, host);
    }
    insert('header', 'header', 'ui-composition-header ui-stack', frame);
    insert('toolbar', 'div', 'ui-composition-toolbar ui-toolbar', frame);
    insert('filters', 'div', 'ui-composition-filters', frame);
    const main = make('div', 'ui-composition-main');
    insert('body', 'section', 'ui-composition-body ui-stack', main);
    insert('aside', 'aside', 'ui-composition-aside ui-stack', main);
    frame.append(main);
    insert('footer', 'footer', 'ui-composition-footer ui-actions', frame);
    root.append(frame);
    let disposed = false;
    function apply(next) {
      const previous = config.overrides;
      for (const key of Object.keys(OVERRIDES)) if (previous[key] !== undefined) root.style.removeProperty(OVERRIDES[key].property);
      for (const key of Object.keys(OVERRIDES)) if (next.overrides[key] !== undefined) root.style.setProperty(OVERRIDES[key].property, next.overrides[key]);
      root.dataset.uiVariant = next.variant; root.dataset.uiCrowding = next.crowding;
      root.dataset.uiCompositionOrigin = Object.keys(next.overrides).some(key => key !== 'reason') ? 'instance' : 'canonical';
      const keys = Object.keys(next.overrides).filter(key => key !== 'reason');
      if (keys.length) root.dataset.uiCompositionOverrides = keys.join(',');
      else delete root.dataset.uiCompositionOverrides;
      config = next;
    }
    apply(config);
    return Object.freeze({
      element: root,
      slots: Object.freeze(Object.fromEntries(hosts)),
      getConfiguration() {
        return Object.freeze({id: ID, revision: REVISION, instanceId: instanceId ?? null, variant: config.variant,
          crowding: config.crowding, origin: root.dataset.uiCompositionOrigin, overrides: Object.freeze({...config.overrides})});
      },
      setLayout(next = {}) {
        if (disposed) throw new Error('Composition disposed');
        if (!plain(next) || Object.keys(next).some(key => !['variant', 'crowding', 'overrides'].includes(key))) throw new TypeError('Invalid layout update');
        const updated = configuration({variant: next.variant ?? config.variant, crowding: next.crowding ?? config.crowding,
          overrides: next.overrides === undefined ? config.overrides : next.overrides});
        apply(updated); // Existing DOM and callbacks remain unchanged; container CSS handles reflow.
        return this.getConfiguration();
      },
      dispose() {
        if (disposed) return; disposed = true; root.remove();
        // No listeners, timers, observers or global coordination were created.
      }
    });
  };
})();
