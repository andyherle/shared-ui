const $ = selector => document.querySelector(selector);
const el = (tag, className, text) => {const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;};
const uid = prefix => prefix + '-' + crypto.randomUUID();
SharedUI.instance?.dispose(); // Studio previews the bundled revision; it never hot-publishes drafts.
const session = {get(key) {try {return sessionStorage.getItem(key);} catch {return null;}}, set(key, value) {try {sessionStorage.setItem(key, value);} catch {}}};
let token = location.hash.slice(1) || session.get('studio-token');
if (location.hash) {session.set('studio-token', token); history.replaceState(null, '', location.pathname);}
// Pasting a new launch link into this tab is a same-document navigation. Reload
// to adopt the new process credential and permissions; beforeunload protects edits.
window.addEventListener('hashchange', () => {if (location.hash) location.reload();});
let record = null, selected = null, components = [], catalogue = null, views = [], icons = [], writable = false;
let pending = null, busy = false, loading = true, stopped = false, pollTimer, inspectorTicket = 0;
let baseline = null, pinnedBaseline = null, impactTicket = 0, dividerPointer = null;
const dirty = new Set(), requests = new Set(), previewData = new Map(), tokenChoices = new Map();
function action(label, icon, handler, options = {}) {
  const button = el('button'); button.type = 'button';
  SharedUI.adoptAction(button, {label, icon, ariaLabel: options.ariaLabel ?? label, sprite: '/v1/icons.svg'});
  if (options.primary) {button.dataset.uiVariant = 'primary'; button.dataset.uiLabel = 'always';}
  if (options.danger) button.dataset.uiVariant = 'danger';
  if (handler) button.addEventListener('click', () => run(handler));
  return button;
}
function field(label, control) {const wrapper = el('label', 'ui-field'); wrapper.append(el('span', 'ui-label', label), control); return wrapper;}
function select(options, name, value) {
  const input = el('select'); if (name) {input.name = name; input.setAttribute('aria-label', name);}
  for (const option of options) {const [id, label] = Array.isArray(option) ? option : [option, option]; const item = el('option', '', label); item.value = id; input.append(item);}
  if (value !== undefined) input.value = value; return input;
}
function input(name, value = '', type = 'text') {const node = el('input'); node.name = name; node.type = type; node.value = value; node.setAttribute('aria-label', name); return node;}
function message(text, state = 'neutral') {$('#message').textContent = text; $('#message').dataset.state = state;}
async function run(work) {try {await work();} catch (error) {message(error.message, 'error');}}
async function api(method, args = {}) {
  const controller = new AbortController(); requests.add(controller);
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({method, args}), signal: controller.signal, credentials: 'omit'});
    const value = await response.json();
    if (!response.ok || value.error) throw Object.assign(new Error(value.error?.message ?? 'Studio request failed'), value.error, {status: response.status});
    return value.result;
  } finally {clearTimeout(timeout); requests.delete(controller);}
}
function available() {
  if (!writable) throw new Error('This connection is read only. Restart the local service with --write to edit drafts.');
  if (busy || loading || pending) throw new Error('Resolve the current request before making another change.');
  if (!record) throw new Error('Create or open a document first.');
}
function safeNavigation() {if (dirty.size) {message('Apply your form changes before switching, or discard them.', 'warning'); return false;} return !busy && !loading && !pending;}
async function readAction(work) {
  if (busy || loading || pending) return;
  loading = true; updateButtons();
  try {await work();} finally {loading = false; updateButtons();}
}
function updateButtons() {
  const label = record?.undo?.direction === 'redo' ? 'Redo latest' : 'Undo latest';
  SharedUI.setActionLabel($('#undo'), label, {ariaLabel: label, title: label, icon: record?.undo?.direction === 'redo' ? 'redo' : 'undo', sprite: '/v1/icons.svg'});
  $('#undo').disabled = !writable || !record?.undo || busy || loading || !!pending;
  $('#new-document').disabled = !writable || busy || loading || !!pending;
  $('#documents').disabled = busy || loading || !!pending;
  for (const id of ['refresh', 'discard', 'reload', 'document-scope']) $('#' + id).disabled = busy || loading || !!pending;
  $('#retry').disabled = busy || loading;
  for (const form of document.querySelectorAll('form')) for (const control of form.elements) {
    const locked = !writable || busy || loading || !!pending;
    if (locked && !Object.hasOwn(control.dataset, 'studioDisabled')) {control.dataset.studioDisabled = String(control.disabled); control.disabled = true;}
    else if (!locked && Object.hasOwn(control.dataset, 'studioDisabled')) {control.disabled = control.dataset.studioDisabled === 'true'; delete control.dataset.studioDisabled;}
  }
  // These controls are presentation only, and stay usable in read-only sessions.
  $('#preview-width').disabled = false;
  $('#quick-snapshot').disabled = !record || !writable || busy || loading || !!pending;
}
function conflict(text, retry = false) {
  $('#conflict').hidden = false; $('#conflict-message').textContent = text; $('#retry').hidden = !retry;
}
async function execute(request) {
  if (busy) return;
  const focused = document.activeElement, focusId = focused?.id, focusOwner = focused?.closest('form')?.id;
  const focusName = focused?.name || focused?.getAttribute('aria-label'), selection = [focused?.selectionStart, focused?.selectionEnd];
  pending = request; busy = true; updateButtons(); message('Saving draft…', 'pending');
  try {
    await api('document.command', request.args);
    // Read after a replay too: its receipt can describe an older revision.
    const next = await api('document.read', {documentId: request.args.documentId});
    await loadRecord(next); pending = null; dirty.clear(); $('#conflict').hidden = true; message('Draft saved locally.', 'success'); return true;
  } catch (error) {
    const uncertain = !error.status || error.status >= 500;
    if (!uncertain) pending = null;
    if (error.code === 'REVISION_CONFLICT') conflict(`Another editor changed this document (current revision ${error.details.actualRevision}). Your fields remain here. Load the current revision to discard unsubmitted fields and review the changes.`);
    else if (uncertain) conflict('The connection was interrupted. The change may already be saved. Retry the identical request to recover its result safely.', true);
    message(error.message, 'error'); return false;
  } finally {
    busy = false; updateButtons();
    const owner = focusOwner ? document.getElementById(focusOwner) : document;
    const target = (focusId && document.getElementById(focusId)) || (focusName && [...(owner?.querySelectorAll('input,select,button') ?? [])].find(control => (control.name || control.getAttribute('aria-label')) === focusName));
    if (target && !target.disabled && target.getClientRects().length) {
      target.focus(); if (selection.every(Number.isInteger)) target.setSelectionRange?.(...selection);
    }
  }
}
async function command(operation, documentId = record?.documentId, expectedRevision = record?.revision) {
  available();
  const forms = {'set-props': 'props-form', 'set-bindings': 'bindings-form', 'set-token': 'token-form', 'reset-token': 'token-form', 'set-context': 'context-form', rename: 'rename-form', 'save-version': 'save-form', 'rename-version': 'rename-' + operation.versionId};
  if ([...dirty].some(form => form !== forms[operation.type])) throw new Error('Apply or discard the other form changes first.');
  await execute({args: {documentId, expectedRevision, operationId: uid('op'), command: operation}});
}
function parentOf(id) {
  for (const parent of Object.values(record.document.nodes)) for (const [slot, children] of Object.entries(parent.slots)) {
    const index = children.indexOf(id); if (index !== -1) return {parentId: parent.id, slot, index, children};
  }
}
function descriptor(id) {return components.find(item => item.id === id);}
function slotsFor(component, excluding) {
  const result = [];
  for (const parent of Object.values(record?.document.nodes ?? {})) {
    if (parent.id === excluding) continue;
    for (const [slot, contract] of Object.entries(descriptor(parent.componentId).slots)) {
      const count = (parent.slots[slot] ?? []).filter(id => id !== excluding).length;
      if (contract.families.includes(component.family) && count < contract.max) result.push({parentId: parent.id, slot, index: count});
    }
  }
  return result;
}
function defaultNode(component, id = uid('node')) {
  const props = {};
  for (const [key, schema] of Object.entries(component.props)) {
    if (key === 'icon') props[key] = 'check';
    else if (schema.type === 'string') props[key] = key === 'label' ? component.name : '';
    else if (schema.type === 'boolean') props[key] = false;
    else if (schema.type === 'enum') props[key] = schema.values[0];
    else props[key] = schema.min ?? 1;
  }
  return {id, componentId: component.id, props, tokens: {}, bindings: {}, slots: Object.fromEntries(Object.keys(component.slots).map(slot => [slot, []])),
    ...(component.layouts?.length ? {layout: {kind: component.layouts[0]}} : {})};
}
function newNodeTree(component) {
  const node = defaultNode(component), descendants = {};
  for (const [slot, contract] of Object.entries(component.slots)) for (let i = 0; i < contract.min; i++) {
    const child = defaultNode(descriptor('stack')); node.slots[slot].push(child.id); descendants[child.id] = child;
  }
  return {node, descendants};
}
function sendPreview(frame, doc, selection = null, colors = catalogue, key = record?.documentId) {
  const data = {type: 'studio-render', document: doc, options: {selection, primitives: colors?.resolved ?? {}, documentId: key}};
  previewData.set(frame, data); frame.contentWindow?.postMessage(data, location.origin);
}
function renderLibrary() {
  const target = $('#library'), search = $('#search').value.toLowerCase(), family = $('#family').value;
  target.replaceChildren();
  for (const component of components.filter(item => (!family || item.family === family) && `${item.name} ${item.id}`.toLowerCase().includes(search))) {
    const button = action(component.name, component.renderer.status === 'document-only' ? 'add' : 'info', () => showComponent(component), {ariaLabel: `Inspect ${component.name}`});
    button.classList.add('ui-item'); button.querySelector('.ui-label').classList.add('ui-truncate'); target.append(button);
  }
  SharedUI.refreshActions(document);
}
function showComponent(component) {
  const target = $('#component-detail'); for (const frame of target.querySelectorAll('iframe')) previewData.delete(frame); target.hidden = false; target.replaceChildren();
  target.append(el('h3', 'ui-section-title', component.name), el('p', 'ui-meta', component.accessibility.keyboard));
  target.append(el('p', 'ui-meta', `Variants: ${component.variants.join(', ')}. States: ${component.states.join(', ') || 'native'}.`));
  const link = el('a', '', 'Open catalogue example'); link.href = 'https://andyherle.github.io/shared-ui/' + (component.fixtures[0].file.endsWith('fixture.html') ? 'fixture.html' : '') + '#' + component.fixtures[0].anchor;
  link.target = '_blank'; link.rel = 'noreferrer'; target.append(link);
  if (component.renderer.status !== 'document-only') {target.append(el('p', 'ui-meta', 'Catalogue preview only. This component has no document renderer yet.')); return;}
  const sample = newNodeTree(component), frame = el('iframe', 'studio-sample'); frame.title = component.name + ' preview'; frame.src = '/preview.html'; target.append(frame);
  sendPreview(frame, {pack: record?.document.pack ?? 'postvisual', mode: record?.document.mode ?? 'dark', density: 'compact', tokens: {}, root: sample.node.id, nodes: {[sample.node.id]: sample.node, ...sample.descendants}});
  if (!record?.document.root) {target.append(el('p', 'ui-meta', 'Open a composition or variation to add this component.')); return;}
  const destinations = slotsFor(component);
  if (!destinations.length) {target.append(el('p', 'ui-meta', 'This document has no compatible slot.')); return;}
  const destination = select(destinations.map((entry, index) => [String(index), `${entry.parentId} / ${entry.slot}`]), 'Add to');
  const selectedIndex = destinations.findIndex(entry => entry.parentId === selected); if (selectedIndex >= 0) destination.value = String(selectedIndex);
  const add = action('Add component', 'add', async () => {
    const tree = newNodeTree(component);
    const slot = destinations[+destination.value], index = record.document.nodes[slot.parentId]?.slots[slot.slot]?.length ?? 0;
    await command({type: 'insert-node', ...tree, ...slot, index});
    if (record.document.nodes[tree.node.id]) selectNode(tree.node.id);
  }, {primary: true}); add.disabled = !writable;
  target.append(field('Add to', destination), add);
}
function selectNode(id) {
  if (!safeNavigation()) return;
  selected = id;
  $('#advanced').open = true;
  if (record) session.set('studio-node:' + record.documentId, id ?? '');
  for (const button of $('#tree').querySelectorAll('[data-tree-id]')) button.setAttribute('aria-current', String(button.dataset.treeId === id));
  $('#preview').contentWindow?.postMessage({type: 'studio-selection', nodeId: id}, location.origin);
  run(renderInspector);
}
const tokenName = id => ({'--ui-accent': 'Accent color', '--ui-primary': 'Primary action color', '--ui-gap': 'Spacing', '--ui-radius': 'Corner radius', '--ui-control-height': 'Control height', '--ui-body-size': 'Text size'}[id] ?? id.replace('--ui-', '').replaceAll('-', ' '));
function comparisonMode() {
  const mode = $('#preview-mode').value;
  $('#canvas').dataset.mode = mode;
  $('#baseline-field').hidden = mode === 'live'; $('#pin-before').hidden = mode === 'live';
  $('#before-preview').inert = mode !== 'split';
  $('#compare-divider').tabIndex = mode === 'wipe' ? 0 : -1;
  $('#compare-divider').hidden = mode !== 'wipe';
  $('#after-label').textContent = mode === 'live' ? 'Live draft' : 'After · live draft';
  $('#preview-caption').textContent = mode === 'wipe' ? 'Drag the line to reveal changes. Arrow keys move it; Home and End show either side.' : 'Agent edits appear here automatically. Click a component to inspect it.';
  session.set('studio-preview-mode', mode);
}
function dividerPosition(value) {
  value = Math.max(0, Math.min(100, value));
  $('#canvas').style.setProperty('--studio-compare', value + '%');
  $('#compare-divider').setAttribute('aria-valuenow', String(Math.round(value)));
  $('#compare-divider').setAttribute('aria-valuetext', `${Math.round(value)}% before, ${100 - Math.round(value)}% after`);
}
function renderBaselinePicker() {
  const picker = $('#baseline'); picker.replaceChildren();
  const local = el('option', '', pinnedBaseline?.name ?? 'When opened'); local.value = ''; picker.append(local);
  for (const version of record?.versions ?? []) {
    const option = el('option', '', version.name + (version.archived ? ' · archived' : '')); option.value = version.id; picker.append(option);
  }
  picker.value = baseline?.versionId ?? '';
  $('#before-label').textContent = 'Before · ' + (baseline?.name ?? 'When opened');
}
async function chooseBaseline(versionId = '', pin = false) {
  if (!record) return;
  if (pin) pinnedBaseline = {documentId: record.documentId, document: structuredClone(record.document), catalogue, name: `Revision ${record.revision}`, versionId: '', key: `before:${record.documentId}:${record.revision}`};
  if (!versionId) {baseline = pinnedBaseline; renderBaselinePicker(); sendPreview($('#before-preview'), baseline.document, null, baseline.catalogue, baseline.key); return;}
  const saved = versionId ? await api('document.read', {documentId: record.documentId, versionId}) : null;
  const value = saved?.document ?? record.document;
  const colors = await api('tokens.list', {pack: value.pack, mode: value.mode, density: value.density});
  baseline = {documentId: record.documentId, document: structuredClone(value), catalogue: colors, versionId,
    name: saved?.version.name ?? `Revision ${record.revision}`};
  renderBaselinePicker(); sendPreview($('#before-preview'), baseline.document, null, colors, `before:${record.documentId}:${versionId || record.revision}`);
}
async function renderImpact() {
  if (!record) return;
  const ticket = ++impactTicket, picker = $('#impact-token'), previous = picker.value || '--ui-primary';
  picker.replaceChildren();
  for (const item of catalogue.tokens.filter(item => item.editable)) {const option = el('option', '', tokenName(item.id)); option.value = item.id; picker.append(option);}
  picker.value = previous;
  const impact = await api('document.impact', {documentId: record.documentId, token: picker.value});
  if (ticket !== impactTicket || impact.revision !== record.revision) return;
  const target = $('#impact-tree'); target.replaceChildren();
  const source = el('section', 'ui-stack');
  source.append(el('h3', 'ui-section-title', tokenName(impact.token)), el('p', 'ui-value', impact.value.value ?? 'Context dependent'));
  const derived = impact.tokens.filter(item => item.id !== impact.token), branches = el('ul');
  for (const item of derived) branches.append(el('li', '', tokenName(item.id)));
  source.append(el('p', 'ui-meta', derived.length ? `Flows into ${derived.length} related values` : 'Used directly by components'));
  if (derived.length) source.append(branches);
  const current = el('section', 'ui-stack'); current.append(el('h3', 'ui-section-title', `In this preview · ${impact.nodes.length}`));
  const nodes = el('ul');
  for (const node of impact.nodes) {
    const li = el('li'), button = action(node.name, 'eye', () => {selectNode(node.id); $('#advanced').scrollIntoView({block: 'start', behavior: 'smooth'});});
    button.classList.add('ui-item'); button.dataset.uiLabel = 'always'; li.append(button); nodes.append(li);
  }
  current.append(impact.nodes.length ? nodes : el('p', 'ui-meta', record.document.root ? 'No declared users in this draft.' : 'The example controls show this token draft.'));
  const library = el('details', 'ui-section'), summary = el('summary'); summary.append(el('h3', '', `Shared component types · ${impact.components.length}`), el('p', 'ui-meta', 'Potential consumers across the library'));
  const types = el('ul'); for (const item of impact.components) types.append(el('li', '', item.name)); library.append(summary, types);
  const consumers = el('ul', 'studio-impact-branches');
  for (const branch of [current, library]) {const li = el('li'); li.append(branch); consumers.append(li);}
  target.append(source, consumers); SharedUI.refreshActions(document);
}
function renderTree() {
  const target = $('#tree'); target.replaceChildren();
  if (!record?.document.root) return;
  const list = ids => {
    const ol = el('ol');
    for (const id of ids) {
      const node = record.document.nodes[id], li = el('li');
      const button = action(node.props.label || descriptor(node.componentId).name, node.props.icon ?? 'file-text', () => selectNode(id), {ariaLabel: `Select ${node.props.label || node.componentId} (${id})`});
      button.classList.add('ui-item'); button.dataset.treeId = id; button.setAttribute('aria-current', String(id === selected));
      button.querySelector('.ui-label').classList.add('ui-truncate');
      button.draggable = writable && id !== record.document.root;
      button.addEventListener('dragstart', event => {if (!safeNavigation()) return event.preventDefault(); event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move';});
      button.addEventListener('dragover', event => {if (writable) event.preventDefault();});
      button.addEventListener('drop', event => {event.preventDefault(); run(async () => {
        const sourceId = event.dataTransfer.getData('text/plain'); if (!record.document.nodes[sourceId] || sourceId === id) return;
        let destination = parentOf(id);
        if (destination) {const source = parentOf(sourceId); if (source?.parentId === destination.parentId && source.slot === destination.slot && source.index < destination.index) destination.index--;}
        else destination = slotsFor(descriptor(record.document.nodes[sourceId].componentId), sourceId).find(item => item.parentId === id);
        if (!destination) throw new Error('No compatible destination slot.');
        await command({type: 'move-node', nodeId: sourceId, parentId: destination.parentId, slot: destination.slot, index: destination.index});
      });});
      button.addEventListener('keydown', event => {if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {event.preventDefault(); run(() => reorder(id, event.key === 'ArrowUp' ? -1 : 1));}});
      li.append(button);
      for (const children of Object.values(node.slots)) if (children.length) li.append(list(children));
      ol.append(li);
    }
    return ol;
  };
  target.append(list([record.document.root])); SharedUI.refreshActions(document);
}
async function reorder(id, delta) {
  if (dirty.size) throw new Error('Apply or discard your fields before moving a node.');
  const destination = parentOf(id); if (!destination) return;
  const index = destination.index + delta; if (index < 0 || index >= destination.children.length) return;
  selected = id; await command({type: 'move-node', nodeId: id, parentId: destination.parentId, slot: destination.slot, index});
  [...$('#tree').querySelectorAll('button')].find(button => button.dataset.treeId === id)?.focus();
}
function propControl(name, schema, value) {
  let control;
  if (name === 'icon') control = select(icons, name, value ?? 'check');
  else if (schema.type === 'enum') control = select(schema.values, name, value ?? schema.values[0]);
  else if (schema.type === 'boolean') {control = input(name, '', 'checkbox'); control.checked = !!value;}
  else {control = input(name, value ?? '', schema.type === 'number' ? 'number' : 'text'); if (schema.max) control.maxLength = schema.max; if (schema.min !== undefined) control.min = schema.min; if (schema.type === 'number') {control.max = schema.max ?? 10000; control.step = 'any';}}
  control.id = 'prop-' + name;
  if (['label', 'icon'].includes(name)) control.required = true;
  return field(name.replaceAll('-', ' '), control);
}
async function renderInspector() {
  const ticket = ++inspectorTicket, node = record?.document.nodes[selected], component = node && descriptor(node.componentId);
  $('#selection-title').textContent = node ? component.name : 'Document tokens';
  $('#selection-context').textContent = record ? `${record.documentId} · revision ${record.revision}${node ? ' · ' + node.id : ' · document scope'}` : 'Create a document to begin.';
  $('#props').replaceChildren(); $('#node-actions').replaceChildren(); $('#bindings').replaceChildren(); $('#tokens').replaceChildren();
  $('#props-form').hidden = !node || Object.keys(component.props).length === 0;
  if (!record) return;
  if (node) {
    for (const [name, schema] of Object.entries(component.props)) $('#props').append(propControl(name, schema, node.props[name]));
    const discard = action('Discard form changes', 'close', async () => {dirty.clear(); await loadRecord(record);});
    $('#node-actions').append(discard);
    if (component.layouts?.length > 1) {
      const layout = select(component.layouts, 'Layout', node.layout?.kind ?? component.layouts[0]);
      const row = el('div', 'ui-actions'); row.append(field('Layout', layout), action('Apply layout', 'controls', () => command({type: 'set-layout', nodeId: node.id, layout: {kind: layout.value}}))); $('#node-actions').append(row);
    }
    const peers = components.filter(item => item.renderer.status === 'document-only' && item.family === component.family);
    const swap = select(peers.map(item => [item.id, item.name]), 'Replacement component', node.componentId);
    const row = el('div', 'ui-actions'); row.append(field('Swap', swap), action('Swap component', 'refresh', () => {
      const replacement = descriptor(swap.value), defaults = defaultNode(replacement).props;
      for (const key of Object.keys(defaults)) if (Object.hasOwn(node.props, key)) defaults[key] = node.props[key];
      return command({type: 'swap-node', nodeId: node.id, componentId: swap.value, props: defaults});
    })); $('#node-actions').append(row);
    if (node.id !== record.document.root) {
      const destinations = slotsFor(component, node.id), destination = select(destinations.map((entry, index) => [String(index), `${entry.parentId} / ${entry.slot}`]), 'Move destination');
      const index = input('Position', 0, 'number'); index.min = 0; index.step = 1;
      const current = parentOf(node.id), match = destinations.findIndex(entry => entry.parentId === current.parentId && entry.slot === current.slot);
      if (match >= 0) {destination.value = String(match); index.value = current.index;}
      const move = el('div', 'ui-stack'); move.append(field('Move to', destination), field('Position · starts at 0', index));
      const actions = el('div', 'ui-actions'); actions.append(action('Move', 'move', () => command({type: 'move-node', nodeId: node.id, parentId: destinations[+destination.value].parentId, slot: destinations[+destination.value].slot, index: +index.value})),
        action('Move up', 'arrow-up', () => reorder(node.id, -1)), action('Move down', 'arrow-down', () => reorder(node.id, 1)),
        action('Remove subtree', 'trash', () => command({type: 'remove-node', nodeId: node.id}), {danger: true}));
      move.append(actions); $('#node-actions').append(move);
    }
    const bindingSlots = Object.entries(component.bindings);
    if (bindingSlots.length) {
      const form = el('form', 'ui-stack'); form.id = 'bindings-form';
      const view = views.find(item => item.appId === record.document.target.appId && item.viewId === record.document.target.viewId);
      for (const [slot, type] of bindingSlots) form.append(field(slot, select([['', 'Unbound'], ...Object.entries(view.bindings).filter(([, kind]) => kind === type).map(([id]) => [id, id])], slot, node.bindings[slot] ?? '')));
      const button = action('Apply bindings', 'link'); button.type = 'submit'; const row = el('div', 'ui-actions'); row.append(button); form.append(row);
      form.onsubmit = event => {event.preventDefault(); run(() => command({type: 'set-bindings', nodeId: node.id, bindings: Object.fromEntries([...new FormData(form)].filter(([, value]) => value))}));};
      $('#bindings').append(form);
    } else $('#bindings').append(el('p', 'ui-meta', 'This component has no application bindings.'));
  }
  const result = await api('document.tokens', {documentId: record.documentId, ...(node ? {nodeId: node.id} : {})});
  if (ticket !== inspectorTicket) return;
  if (result.revision !== record.revision) {
    $('#tokens').append(el('p', 'ui-meta', 'This draft changed while tokens were loading. Load the current revision.'));
    conflict('Another session changed this draft. Load the current revision to inspect its token values.'); return;
  }
  const names = catalogue.tokens.filter(item => item.editable && (!component || component.tokens.includes(item.id)));
  if (!names.length) {$('#tokens').append(el('p', 'ui-meta', 'No editable tokens at this scope.')); updateButtons(); return;}
  const scopeKey = `${record.documentId}/${node?.id ?? 'document'}`;
  const picker = select(names.map(item => [item.id, item.id.replace('--ui-', '')]), 'Token'), tokenForm = el('form', 'ui-stack'); tokenForm.id = 'token-form';
  if (names.some(item => item.id === tokenChoices.get(scopeKey))) picker.value = tokenChoices.get(scopeKey);
  tokenChoices.set(scopeKey, picker.value);
  const detail = el('div', 'ui-stack'); tokenForm.append(field('Token', picker), detail); $('#tokens').append(tokenForm);
  const draw = () => {
    const item = names.find(value => value.id === picker.value), resolved = result.resolved[item.id], overrides = node ? node.tokens : record.document.tokens;
    const value = overrides[item.id], mode = select(['Value', 'Alias'], 'Value mode', value?.ref ? 'Alias' : 'Value');
    const literal = input('Token value', value?.ref ? resolved.value ?? '' : value ?? resolved.value ?? '', item.type === 'number' ? 'number' : 'text'); literal.required = true;
    const aliases = select(Object.entries(catalogue.definitions).filter(([id, definition]) => id !== item.id && definition.type === item.type && catalogue.resolved[id]?.available).map(([id]) => id), 'Alias token', value?.ref);
    const source = resolved.origin?.scope ?? 'renderer';
    detail.replaceChildren(el('p', 'ui-meta', `${Object.hasOwn(overrides, item.id) ? 'Overridden here' : 'Inherited'} · ${source} · ${resolved.available ? resolved.value : 'computed by native CSS'}`));
    const consumers = el('details', 'ui-section'), summary = el('summary'); summary.append(el('h3', '', `Consumers · ${item.consumers.length}`)); consumers.append(summary, el('p', 'ui-meta studio-facts', item.consumers.join(', ') || 'Shared interface')); detail.append(consumers);
    const literalField = field(item.type === 'color' ? 'Hex color' : item.type === 'length' ? 'Length · e.g. 8px' : 'Number', literal), aliasField = field('Reference', aliases);
    detail.append(field('Source', mode), literalField, aliasField);
    function modeChanged() {literalField.hidden = mode.value !== 'Value'; literal.disabled = mode.value !== 'Value'; aliasField.hidden = mode.value !== 'Alias'; aliases.disabled = mode.value !== 'Alias';}
    mode.onchange = modeChanged; modeChanged();
    const buttons = el('div', 'ui-actions'), save = action('Apply token', 'check', null, {primary: true}); save.type = 'submit';
    const reset = action('Reset to inherited', 'refresh', () => command({type: 'reset-token', ...(node ? {nodeId: node.id} : {}), token: item.id})); reset.disabled = !writable || !Object.hasOwn(overrides, item.id);
    buttons.append(save, reset); detail.append(buttons);
    tokenForm.onsubmit = event => {event.preventDefault(); run(() => command({type: 'set-token', ...(node ? {nodeId: node.id} : {}), token: item.id,
      value: mode.value === 'Alias' ? {ref: aliases.value} : item.type === 'number' ? +literal.value : literal.value}));};
  };
  picker.onchange = () => {
    if (dirty.has('token-form')) {picker.value = tokenChoices.get(scopeKey); message('Apply or discard this token value before choosing another token.', 'warning'); return;}
    tokenChoices.set(scopeKey, picker.value); draw();
  }; draw();
  updateButtons(); SharedUI.refreshActions(document);
}
function renderVersions() {
  const expanded = new Set([...$('#versions').querySelectorAll('details[open]')].map(item => item.dataset.versionId));
  $('#versions').replaceChildren();
  for (const version of record?.versions ?? []) {
    const section = el('details', 'ui-section'), summary = el('summary');
    section.dataset.versionId = version.id; section.open = expanded.has(version.id);
    const heading = el('h3', 'ui-truncate', version.name); heading.title = version.name;
    summary.append(heading, el('p', 'ui-meta', `Snapshot of revision ${version.sourceRevision}${version.archived ? ' · archived' : ''}`)); section.append(summary);
    const rename = el('form', 'ui-stack'), name = input('Saved version name', version.name); rename.id = 'rename-' + version.id; name.required = true; name.maxLength = 200;
    const renameActions = el('div', 'ui-actions'); renameActions.append(action('Rename version', 'edit', () => command({type: 'rename-version', versionId: version.id, name: name.value})));
    rename.append(field('Name', name), renameActions);
    rename.onsubmit = event => {event.preventDefault(); run(() => command({type: 'rename-version', versionId: version.id, name: name.value}));};
    const actions = el('div', 'ui-actions');
    actions.append(action('Compare', 'columns', () => readAction(() => compare(version))), action(version.archived ? 'Unarchive' : 'Archive', 'folder', () => command({type: version.archived ? 'unarchive-version' : 'archive-version', versionId: version.id})));
    if (!version.archived) actions.append(action('Duplicate', 'copy', () => command({type: 'duplicate', sourceDocumentId: record.documentId, sourceRevision: record.revision, versionId: version.id, name: version.name.slice(0, 195) + ' copy'}, uid('draft'), 0)),
      action('Restore snapshot', 'refresh', () => command({type: 'restore-version', versionId: version.id})));
    section.append(rename, actions); $('#versions').append(section);
  }
}
async function compare(version) {
  const changes = await api('document.compare', {documentId: record.documentId, beforeVersionId: version.id, includeDocuments: true});
  const target = $('#comparison'); target.replaceChildren(); $('#compare-title').textContent = `${version.name} → working draft`;
  const previews = el('div', 'studio-comparison');
  for (const [label, value] of [[version.name, changes.beforeDocument], [`Working · revision ${changes.revision}`, changes.afterDocument]]) {
    const colors = await api('tokens.list', {pack: value.pack, mode: value.mode, density: value.density});
    const pane = el('section', 'ui-stack'), frame = el('iframe'); frame.title = label; frame.src = '/preview.html';
    pane.append(el('h3', 'ui-section-title', label), frame); previews.append(pane); previewData.set(frame, {type: 'studio-render', document: value, options: {primitives: colors.resolved}});
  }
  target.append(previews, el('p', 'ui-meta', `${changes.changes.length} changed values. Comparison does not change the working draft.`));
  for (const change of changes.changes) {const row = el('p', 'studio-change'); row.append(el('strong', '', change.path), document.createTextNode(` · ${JSON.stringify(change.before) ?? 'absent'} → ${JSON.stringify(change.after) ?? 'absent'}`)); target.append(row);}
  $('#compare-dialog').showModal();
}
async function listDocuments() {
  const result = await api('documents.list');
  $('#documents').replaceChildren();
  if (!result.documents.length) {const empty = el('option', '', 'No saved documents'); empty.value = ''; $('#documents').append(empty);}
  for (const item of result.documents) {const option = el('option', '', `${item.name} · ${item.target.appId}/${item.target.viewId}`); option.value = item.documentId; $('#documents').append(option);}
  if (record) $('#documents').value = record.documentId;
  return result.documents;
}
async function loadRecord(next) {
  const nextCatalogue = await api('tokens.list', {pack: next.document.pack, mode: next.document.mode, density: next.document.density});
  const previousId = record?.documentId; record = next;
  if (previousId !== record.documentId) {
    const saved = session.get('studio-node:' + record.documentId); selected = saved && record.document.nodes[saved] ? saved : null;
  } else if (selected !== null && !record.document.nodes[selected]) selected = record.document.root;
  session.set('studio-document', record.documentId);
  catalogue = nextCatalogue;
  const html = document.documentElement; html.dataset.ui = record.document.pack; html.dataset.theme = record.document.mode; html.dataset.uiDensity = record.document.density;
  $('#document-context').textContent = `${record.document.name} · ${writable ? 'Private draft' : 'Read only'}`;
  $('#live-status').textContent = `Revision ${record.revision} · watching for agent changes`;
  $('#rename-form').elements.name.value = record.document.name;
  for (const key of ['pack', 'mode', 'density']) $('#context-form').elements[key].value = record.document[key];
  await listDocuments(); renderTree(); renderVersions(); await renderInspector(); sendPreview($('#preview'), record.document, selected); updateButtons();
  if (previousId !== record.documentId || !baseline) {
    baseline = pinnedBaseline = {documentId: record.documentId, document: structuredClone(record.document), catalogue, name: `Opened at revision ${record.revision}`, versionId: '', key: `before:${record.documentId}:${record.revision}`};
    sendPreview($('#before-preview'), baseline.document, null, catalogue, `before:${record.documentId}:${record.revision}`);
  }
  renderBaselinePicker(); await renderImpact();
  for (const [frame, payload] of previewData) if (frame.classList.contains('studio-sample')) sendPreview(frame, {...payload.document, pack: record.document.pack, mode: record.document.mode, density: record.document.density});
}
async function poll() {
  if (stopped || document.hidden) return;
  try {
    if (record && !busy && !loading && !pending) {
      const result = await api('documents.list'), current = result.documents.find(item => item.documentId === record.documentId);
      if (current && current.revision !== record.revision) {
        if (dirty.size || document.activeElement?.closest('form')) conflict(`An agent or another editor saved revision ${current.revision}. Your fields are preserved. Apply them or load the new revision.`);
        else await readAction(async () => {await loadRecord(await api('document.read', {documentId: record.documentId})); $('#conflict').hidden = true; message('Live preview updated.', 'success');});
      }
    }
  } catch { /* User initiated reads/writes surface errors; passive polling stays quiet. */ }
  finally {if (!stopped && !document.hidden) pollTimer = setTimeout(poll, 4000);}
}
for (const button of document.querySelectorAll('button[data-icon]')) SharedUI.adoptAction(button, {icon: button.dataset.icon, label: button.textContent, sprite: '/v1/icons.svg'});
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => $('#' + button.dataset.close).close();
$('#new-dialog').addEventListener('close', () => dirty.delete('create-form'));
$('#compare-dialog').addEventListener('close', () => {for (const frame of $('#comparison').querySelectorAll('iframe')) previewData.delete(frame); $('#comparison').replaceChildren();});
$('#new-document').onclick = () => {if (safeNavigation()) $('#new-dialog').showModal();};
$('#refresh').onclick = () => run(async () => {if (!safeNavigation()) return; await readAction(async () => {await listDocuments(); if (record) await loadRecord(await api('document.read', {documentId: record.documentId}));});});
$('#discard').onclick = () => run(() => readAction(async () => {dirty.clear(); if (record) await loadRecord(record);}));
$('#documents').onchange = () => run(async () => {if (!safeNavigation()) {$('#documents').value = record?.documentId ?? ''; return;} await readAction(async () => {selected = null; await loadRecord(await api('document.read', {documentId: $('#documents').value}));});});
$('#undo').onclick = () => run(() => command({type: 'undo', operationId: record.undo.operationId}));
$('#retry').onclick = () => run(() => pending && execute(pending));
$('#reload').onclick = () => run(() => readAction(async () => {dirty.clear(); await loadRecord(await api('document.read', {documentId: record.documentId})); $('#conflict').hidden = true;}));
$('#document-scope').onclick = () => selectNode(null);
$('#preview-width').onchange = () => {$('#canvas').dataset.width = $('#preview-width').value;};
$('#preview-mode').value = ['live', 'split', 'wipe'].includes(session.get('studio-preview-mode')) ? session.get('studio-preview-mode') : 'live';
$('#preview-mode').onchange = comparisonMode; comparisonMode(); dividerPosition(50);
$('#baseline').onchange = () => run(() => readAction(() => chooseBaseline($('#baseline').value)));
$('#pin-before').onclick = () => run(() => readAction(() => chooseBaseline('', true)));
$('#quick-snapshot').onclick = () => run(() => command({type: 'save-version', versionId: uid('version'), name: `Snapshot · ${new Date().toLocaleString()}`}));
$('#impact-token').onchange = () => run(renderImpact);
$('#edit-impact-token').onclick = () => {
  if (!record || !safeNavigation()) return;
  tokenChoices.set(`${record.documentId}/document`, $('#impact-token').value); selectNode(null); $('#advanced').scrollIntoView({block: 'start', behavior: 'smooth'});
};
const divider = $('#compare-divider');
divider.addEventListener('pointerdown', event => {if (event.button !== 0) return; dividerPointer = event.pointerId; divider.setPointerCapture(event.pointerId); event.preventDefault(); divider.focus();});
divider.addEventListener('pointermove', event => {if (event.pointerId !== dividerPointer) return; const bounds = $('#canvas').getBoundingClientRect(); dividerPosition((event.clientX - bounds.left) / bounds.width * 100);});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) divider.addEventListener(type, () => {dividerPointer = null;});
divider.addEventListener('keydown', event => {
  const value = +divider.getAttribute('aria-valuenow'), step = event.shiftKey ? 10 : 1;
  const next = {ArrowLeft: value - step, ArrowRight: value + step, Home: 0, End: 100}[event.key];
  if (next !== undefined) {event.preventDefault(); dividerPosition(next);}
});
$('#search').oninput = renderLibrary; $('#family').onchange = renderLibrary;
document.addEventListener('input', event => {const form = event.target.closest('form'); if (form?.id && event.target.name !== 'Token' && event.target.id !== 'preview-width') dirty.add(form.id);});
$('#context-form').onsubmit = event => {event.preventDefault(); run(() => command({type: 'set-context', ...Object.fromEntries(new FormData(event.currentTarget))}));};
$('#rename-form').onsubmit = event => {event.preventDefault(); run(() => command({type: 'rename', name: event.currentTarget.elements.name.value}));};
$('#save-form').onsubmit = event => {event.preventDefault(); run(() => command({type: 'save-version', versionId: uid('version'), name: event.currentTarget.elements.name.value}));};
$('#props-form').onsubmit = event => {
  event.preventDefault(); run(() => {
    const node = record.document.nodes[selected], props = {};
    for (const [name, schema] of Object.entries(descriptor(node.componentId).props)) {
      const control = $('#props-form').elements[name]; props[name] = schema.type === 'boolean' ? control.checked : schema.type === 'number' ? +control.value : control.value;
    }
    return command({type: 'set-props', nodeId: selected, props});
  });
};
$('#create-form').onsubmit = event => {
  event.preventDefault(); run(async () => {
    if (!writable || busy || loading || pending) return;
    const form = event.currentTarget, view = views[+form.elements.view.value], kind = form.elements.kind.value;
    const root = defaultNode(descriptor('stack'), 'root');
    const doc = {schemaVersion: 1, kind, name: form.elements.name.value, target: {appId: view.appId, viewId: view.viewId}, pack: document.documentElement.dataset.ui, mode: document.documentElement.dataset.theme, density: 'compact', root: kind === 'tokens' ? null : root.id, nodes: kind === 'tokens' ? {} : {[root.id]: root}, tokens: {}};
    const completed = await execute({args: {documentId: uid('draft'), expectedRevision: 0, operationId: uid('create'), command: {type: 'create', document: doc}}});
    if (completed) $('#new-dialog').close();
  });
};
window.addEventListener('message', event => {
  if (event.origin !== location.origin) return;
  if (event.data?.type === 'studio-ready') {for (const [frame, payload] of previewData) if (frame.contentWindow === event.source) event.source.postMessage(payload, location.origin);}
  if (event.source === $('#preview').contentWindow && event.data?.type === 'studio-select' && record?.document.nodes[event.data.nodeId]) selectNode(event.data.nodeId);
  if (event.data?.type === 'studio-scroll' && $('#preview-mode').value !== 'live') {
    const frames = [$('#preview'), $('#before-preview')];
    if (frames.some(frame => frame.contentWindow === event.source)) for (const frame of frames) if (frame.contentWindow !== event.source) frame.contentWindow?.postMessage({type: 'studio-scroll-to', x: event.data.x, y: event.data.y}, location.origin);
  }
});
document.addEventListener('visibilitychange', () => {clearTimeout(pollTimer); if (!document.hidden) pollTimer = setTimeout(poll, 100);});
window.addEventListener('pagehide', () => {stopped = true; clearTimeout(pollTimer); for (const controller of requests) controller.abort(); previewData.clear(); SharedUI.disposeActions?.(document);}, {once: true});
window.addEventListener('beforeunload', event => {if (dirty.size || pending) {event.preventDefault(); event.returnValue = '';}});
updateButtons();
await run(async () => {
  const [description, registered] = await Promise.all([api('describe'), api('views.list')]);
  writable = description.permissions.write; components = description.registry.components; icons = description.icons; views = registered.views.filter(view => view.adapter === 'document');
  for (const family of [...new Set(components.map(item => item.family))]) {const option = el('option', '', family); option.value = family; $('#family').append(option);}
  views.forEach((view, index) => {const option = el('option', '', `${view.appId} / ${view.viewId}`); option.value = index; $('#create-form').elements.view.append(option);});
  const documents = await listDocuments(); renderLibrary();
  if (documents.length) await loadRecord(await api('document.read', {documentId: documents.find(item => item.documentId === session.get('studio-document'))?.documentId ?? documents[0].documentId}));
  else {updateButtons(); message(writable ? 'Create a document, then add components from the library.' : 'No drafts in this read-only store.');}
  pollTimer = setTimeout(poll, 4000);
});
loading = false; updateButtons();
