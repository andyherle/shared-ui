/* Native, keyed preview renderer. Text is inert; bindings never execute here. */
export const RENDERED_COMPONENTS = Object.freeze(['action', 'button', 'link', 'icon-action', 'text-input', 'textarea', 'checkbox', 'switch', 'toggle', 'actions', 'toolbar', 'group', 'grid', 'split', 'stack', 'card', 'panel', 'status', 'notice', 'text', 'review-workspace']);
const make = (doc, tag, className) => {const element = doc.createElement(tag); if (className) element.className = className; return element;};
export function createRenderer(root, {onSelect = () => {}} = {}) {
  const doc = root.ownerDocument, UI = doc.defaultView.SharedUI, entries = new Map();
  let selected = null, documentKey;
  function tokens(element, values, primitives) {
    for (const name of [...element.style]) if (name.startsWith('--ui-')) element.style.removeProperty(name);
    for (const [name, value] of Object.entries(values)) {
      const css = value && typeof value === 'object' ? value.ref.startsWith('--ui-') ? `var(${value.ref})` : primitives[value.ref]?.value : value;
      if (css !== undefined) element.style.setProperty(name, String(css));
    }
  }
  function build(node) {
    const id = node.componentId;
    let el, control, label, compositionSlots;
    if (['action', 'button', 'icon-action', 'link'].includes(id)) {
      el = make(doc, id === 'link' ? 'a' : 'button');
      if (id === 'link') el.href = '#preview'; else el.type = 'button';
    } else if (['text-input', 'textarea'].includes(id)) {
      el = make(doc, 'label', id === 'textarea' ? 'ui-stack' : 'ui-field'); label = make(doc, 'span', 'ui-label');
      control = make(doc, id === 'textarea' ? 'textarea' : 'input'); el.append(label, control);
    } else if (['checkbox', 'switch', 'toggle'].includes(id)) {
      el = make(doc, 'label', id === 'checkbox' ? 'ui-check' : `ui-${id}`);
      control = make(doc, 'input'); control.type = 'checkbox'; label = make(doc, 'span', 'ui-label'); el.append(control, label);
      if (id === 'toggle') {
        const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), use = doc.createElementNS(svg.namespaceURI, 'use');
        svg.classList.add('ui-icon'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.append(use); el.prepend(svg);
      }
    } else if (id === 'review-workspace') {
      el = make(doc, 'article', 'ui-composition ui-card');
      const frame = make(doc, 'div', 'ui-composition-layout');
      const main = make(doc, 'div', 'ui-composition-main');
      compositionSlots = new Map();
      const slot = (key, tag, className, parent) => {
        const host = make(doc, tag, className); host.dataset.uiCompositionSlot = key;
        compositionSlots.set(key, host); parent.append(host);
      };
      slot('header', 'header', 'ui-composition-header ui-stack', frame);
      slot('toolbar', 'div', 'ui-composition-toolbar ui-toolbar', frame);
      slot('filters', 'div', 'ui-composition-filters', frame);
      slot('body', 'section', 'ui-composition-body ui-stack', main);
      slot('aside', 'aside', 'ui-composition-aside ui-stack', main);
      frame.append(main);
      slot('footer', 'footer', 'ui-composition-footer ui-actions', frame);
      el.append(frame);
    } else if (id === 'group') {
      el = make(doc, 'fieldset', 'ui-group'); label = make(doc, 'legend'); el.append(label);
    } else if (['status', 'notice', 'text'].includes(id)) el = make(doc, node.props.role === 'heading' ? 'h3' : 'p', id === 'text' ? '' : `ui-${id}`);
    else el = make(doc, ['card', 'panel'].includes(id) ? 'article' : 'div', `ui-${id}${['card', 'panel'].includes(id) ? ' ui-pad' : ''}`);
    el.dataset.nodeId = node.id; el.classList.add('ui-selectable');
    return {el, control, label, componentId: id, role: node.props.role, slots: compositionSlots ?? new Map()};
  }
  function update(node, entry, primitives) {
    const {el, control, label} = entry, props = node.props, id = node.componentId;
    if (['action', 'button', 'icon-action', 'link'].includes(id)) {
      UI.adoptAction(el, {icon: props.icon ?? 'check', label: props.label, ariaLabel: props.label, title: props.label,
        iconOnly: id === 'icon-action' || props.labelMode === 'hidden', sprite: '/v1/icons.svg'});
      el.dataset.uiLabel = id === 'icon-action' ? 'hidden' : props.labelMode ?? 'auto';
      if (id === 'link') el.setAttribute('aria-disabled', String(!!props.disabled)); else el.disabled = !!props.disabled;
    }
    if (control) {
      if (id === 'text-input') control.type = props.type ?? 'text';
      if (id === 'textarea') control.rows = props.rows ?? 3;
      if (id === 'checkbox') control.type = props.kind ?? 'checkbox';
      control.disabled = !!props.disabled; control.required = !!props.required; control.readOnly = !!props.readonly;
      control.placeholder = props.placeholder ?? ''; control.setAttribute('aria-label', props.label);
    }
    if (label) label.textContent = props.label ?? '';
    if (id === 'review-workspace') {
      el.dataset.uiComposition = 'review-workspace'; el.dataset.uiCompositionRevision = '1';
      el.dataset.uiCrowding = props.crowding ?? 'wrap';
      const layoutOverrides = ['gap','aside'].filter(key => Object.hasOwn(node.tokens, '--ui-composition-' + key));
      if (layoutOverrides.length) el.dataset.uiCompositionOverrides = layoutOverrides.join(',');
      else delete el.dataset.uiCompositionOverrides;
      for (const [slot, host] of entry.slots) host.hidden = !(node.slots[slot]?.length);
    }
    if (id === 'toggle') {el.querySelector('use').setAttribute('href', `/v1/icons.svg#ui-${props.icon}`); el.dataset.uiLabel = props.labelMode ?? 'auto';}
    if (['status', 'notice', 'text'].includes(id)) {
      el.textContent = props.label; el.classList.toggle('ui-meta', props.role === 'meta');
      el.classList.toggle('ui-section-title', props.role === 'heading'); el.classList.toggle('ui-value', props.role === 'value');
      if (props.state && props.state !== 'neutral') el.dataset.state = props.state; else delete el.dataset.state;
    }
    if (props.variant && props.variant !== 'default') el.dataset.uiVariant = props.variant; else delete el.dataset.uiVariant;
    if (id === 'review-workspace') el.dataset.uiVariant = props.variant ?? 'standard';
    if (props.align) el.dataset.uiAlign = props.align; else delete el.dataset.uiAlign;
    el.classList.toggle('ui-fill', !!props.fill); el.classList.toggle('ui-header', !!props.header);
    if (['stack', 'column'].includes(node.layout?.kind) && id !== 'actions') el.classList.add('ui-stack');
    else if (id !== 'stack') el.classList.remove('ui-stack');
    if (node.layout?.kind === 'column') el.dataset.uiLayout = id === 'actions' ? 'vertical' : 'column'; else delete el.dataset.uiLayout;
    UI.setSelection(el, node.id === selected);
    tokens(el, node.tokens, primitives);
  }
  function render(document, {selection = selected, primitives = {}, documentId = null} = {}) {
    if (documentKey !== documentId) {UI.disposeActions?.(doc); entries.clear(); root.replaceChildren(); documentKey = documentId;}
    selected = selection;
    if (document.root === null) {
      const node = (id, componentId, props, slots = {}) => ({id, componentId, props, slots, tokens: {}, bindings: {}});
      document = {...document, root: 'token-specimen', nodes: {
        'token-specimen': node('token-specimen', 'card', {}, {children: ['token-heading', 'token-field', 'token-actions']}),
        'token-heading': node('token-heading', 'text', {label: 'Token preview', role: 'heading'}),
        'token-field': node('token-field', 'text-input', {label: 'Example field', placeholder: 'Native controls inherit your tokens'}),
        'token-actions': node('token-actions', 'actions', {}, {children: ['token-primary', 'token-secondary']}),
        'token-primary': node('token-primary', 'action', {label: 'Primary action', icon: 'check', variant: 'primary'}),
        'token-secondary': node('token-secondary', 'action', {label: 'Secondary action', icon: 'close'})
      }};
      document.nodes['token-specimen'].layout = {kind: 'stack'};
    }
    const html = doc.documentElement;
    html.dataset.ui = document.pack; html.dataset.theme = document.mode; html.dataset.uiDensity = document.density;
    tokens(html, document.tokens, primitives);
    const seen = new Set();
    const visit = id => {
      const node = document.nodes[id];
      if (!RENDERED_COMPONENTS.includes(node.componentId)) throw new Error(`No native preview for ${node.componentId}`);
      let entry = entries.get(id);
      if (!entry || entry.componentId !== node.componentId || entry.role !== node.props.role) {
        const previous = entry; entry = build(node); entries.set(id, entry); previous?.el.replaceWith(entry.el);
      }
      seen.add(id); update(node, entry, primitives);
      const containers = [];
      for (const [slot, ids] of Object.entries(node.slots)) {
        let container = entry.el;
        if (node.componentId === 'review-workspace') container = entry.slots.get(slot);
        if (node.componentId === 'split') {
          container = entry.slots.get(slot);
          if (!container) {container = make(doc, 'section', 'ui-stack'); entry.slots.set(slot, container);}
          if (slot === 'main') container.dataset.uiMain = ''; containers.push(container);
        }
        const children = ids.map(visit);
        reconcile(container, children, container === entry.el && entry.label ? [entry.label] : []);
      }
      if (node.componentId === 'split') reconcile(entry.el, containers);
      return entry.el;
    };
    reconcile(root, [visit(document.root)]);
    for (const [id, entry] of entries) if (!seen.has(id)) {entry.el.remove(); entries.delete(id);}
    UI.refreshActions?.(doc);
  }
  function reconcile(parent, children, prefix = []) {
    const desired = [...prefix, ...children];
    desired.forEach((element, index) => {if (parent.children[index] !== element) parent.insertBefore(element, parent.children[index] ?? null);});
    for (const element of [...parent.children]) if (!desired.includes(element)) element.remove();
  }
  function click(event) {
    const element = event.target.closest('[data-node-id]');
    if (!element) return;
    // Editing selects the object; it never activates an app binding or a navigation.
    event.preventDefault(); event.stopPropagation(); onSelect(element.dataset.nodeId);
  }
  root.addEventListener('click', click, true);
  return {render, select(id) {selected = id; for (const [key, entry] of entries) UI.setSelection(entry.el, key === id);},
    dispose() {root.removeEventListener('click', click, true); UI.disposeActions?.(doc); entries.clear(); root.replaceChildren();}};
}
