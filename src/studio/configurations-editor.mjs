const $ = id => document.getElementById(id), uid = prefix => prefix + '-' + crypto.randomUUID();
const session = {get(key) {try {return sessionStorage.getItem(key);} catch {return null;}}, set(key, value) {try {if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value);} catch {}}};
SharedUI.instance?.dispose();
const token = location.hash.slice(1) || session.get('studio-token');
if (location.hash) {session.set('studio-token', token); history.replaceState(null, '', location.pathname);}
window.addEventListener('hashchange', () => {if (location.hash) location.reload();});
for (const button of document.querySelectorAll('[data-icon]')) SharedUI.adoptAction(button, {icon: button.dataset.icon, label: button.textContent, sprite: '/v1/icons.svg'});
let record, preview, items = [], permissions = {}, dirty = new Set(), busy = false, reading = false, stopped = false, timer, pending = null;
const controllers = new Set();
try {pending = JSON.parse(session.get('studio-configuration-request') || 'null');} catch {}
SharedUI.reserveText($('status'), ['', 'Saving configuration…', 'Configuration saved locally.', 'Running shared tests and build…', 'Preparing and pushing the validated release…', 'Validation passed. This exact revision is ready to publish.']);
const status = (text, state = 'neutral') => {SharedUI.setText($('status'), text); $('status').dataset.state = state;};
const run = work => Promise.resolve().then(work).catch(error => status(error.message, 'error'));
async function api(method, args = {}) {
  const controller = new AbortController(); controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), ['configuration.validate', 'configuration.publish'].includes(method) ? 180000 : 15000);
  try {
    const response = await fetch('/api', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, body: JSON.stringify({method, args}), signal: controller.signal, credentials: 'omit'});
    const value = await response.json();
    if (!response.ok || value.error) throw Object.assign(new Error(value.error?.message ?? 'Studio request failed'), value.error, {status: response.status});
    return value.result;
  } finally {clearTimeout(timeout); controllers.delete(controller);}
}
function remember(request) {pending = request; session.set('studio-configuration-request', request ? JSON.stringify(request) : null); if (!request) $('recovery').hidden = true;}
function option(value, label) {const node = document.createElement('option'); node.value = value; node.textContent = label; return node;}
function text(tag, value, className) {const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node;}
function button(label, icon, handler, mutates = true) {
  const node = document.createElement('button'); node.type = 'button'; SharedUI.adoptAction(node, {label, icon, sprite: '/v1/icons.svg'}); if (mutates) node.dataset.mutates = 'true'; node.onclick = () => run(handler); return node;
}
function validation() {return Object.values(record?.validations ?? {}).map(value => value.result).reverse().find(value => value.revision === record.revision && value.effectiveHash === record.effectiveHash && value.sourceHash === record.sourceHash);}
function update() {
  const locked = busy || reading || !!pending;
  for (const control of document.querySelectorAll('button,input,select')) {
    const presentation = ['theme', 'density', 'width', 'preview-mode'].includes(control.id);
    control.disabled = !presentation && (locked || (!permissions.write && (control.closest('form') || control.dataset.mutates || ['duplicate', 'snapshot', 'reset-value', 'detach', 'reset-source', 'validate'].includes(control.id))));
  }
  $('retry').disabled = busy; $('load-current').disabled = busy;
  $('publish').disabled = locked || !permissions.publish || !validation() || dirty.size > 0 || !preview?.affectedPacks.length;
  $('detach').disabled ||= !record?.definition.mirror;
  $('publish-permission').textContent = permissions.publish ? 'Publishes shared CSS through origin/main and GitHub Pages.' : 'Publishing is disabled for this connection. Launch Studio with --write --publish to enable it.';
}
function canNavigate() {if (dirty.size) {status('Apply or discard the form changes first.', 'warning'); return false;} return !busy && !reading && !pending;}
function valuePicker() {
  const scope = $('scope').value, previous = $('token').value;
  $('token').replaceChildren(...Object.keys(record.values[scope]).map(name => option(name, name.replaceAll('-', ' '))));
  if (Object.hasOwn(record.values[scope], previous)) $('token').value = previous;
  drawValue();
}
function drawValue() {
  const scope = $('scope').value, key = $('token').value, overridden = !record.definition.mirror || Object.hasOwn(record.definition.overrides[scope], key);
  $('value').value = record.values[scope][key]; $('value-label').textContent = key.replaceAll('-', ' ');
  $('value-origin').textContent = record.definition.mirror ? overridden ? `Override in ${record.name} · reset to follow the source again.` : `Inherited from ${record.definition.mirror}` : 'Independent configuration value';
}
function sendPreviews() {
  if (!preview || !record) return;
  for (const [id, css] of [['before', preview.beforeCSS], ['after', preview.css]]) $(id).contentWindow?.postMessage({type: 'configuration-render', css, pack: record.pack, theme: $('theme').value, density: $('density').value}, location.origin);
  $('before-pane').hidden = $('preview-mode').value === 'live'; $('previews').dataset.width = $('width').value;
  Object.assign(document.documentElement.dataset, {ui: record.pack, theme: $('theme').value}); SharedUI.refreshActions(document);
}
async function compare() {
  const args = {configurationId: record.configurationId, ...($('baseline').value ? {snapshotId: $('baseline').value} : {})};
  const [compiled, comparison] = await Promise.all([api('configuration.preview', args), api('configuration.compare', args)]);
  if (compiled.revision !== record.revision || comparison.revision !== record.revision) throw new Error('Configuration changed while loading. Refresh to review the current revision.');
  preview = compiled; sendPreviews();
  $('changes').replaceChildren(...comparison.changes.map(change => text('p', `${change.path} · ${change.before ?? 'absent'} → ${change.after ?? 'absent'}`)));
  $('change-count').textContent = `${comparison.changes.length} changed values`;
  $('release-scope').textContent = compiled.affectedPacks.length ? `Updates ${compiled.affectedPacks.map(id => id === 'personal' ? 'Personal' : 'Postvisual').join(' and ')}${compiled.affectedPacks.length > 1 ? ' together' : ''}.` : 'This configuration matches source.';
  const checked = validation();
  $('validation').textContent = checked ? `Validated revision ${checked.revision} · ${checked.cssBytes.toLocaleString()} bytes CSS · ${checked.gzipBytes.toLocaleString()} bytes gzip. Tests and build passed.` : `${compiled.cssBytes.toLocaleString()} bytes CSS · ${compiled.gzipBytes.toLocaleString()} bytes gzip. Validate this revision before publishing.`;
  update();
}
async function load(id) {
  reading = true; update();
  try {await loadRecord(id);} finally {reading = false; update();}
}
async function loadRecord(id = record?.configurationId ?? session.get('studio-configuration') ?? 'postvisual') {
  const list = await api('configurations.list'); items = list.configurations;
  record = await api('configuration.read', {configurationId: items.some(item => item.configurationId === id) ? id : 'postvisual'});
  const unfinished = Object.values(record.receipts).find(receipt => ['publishing', 'retry-required'].includes(receipt.result.status) && receipt.request);
  if (!pending && unfinished) {remember({method: 'configuration.publish', args: unfinished.request}); $('recovery').hidden = false;}
  session.set('studio-configuration', record.configurationId);
  $('configuration').replaceChildren(...items.map(item => option(item.configurationId, item.name + (item.mirror ? ' · mirror' : '')))); $('configuration').value = record.configurationId;
  $('name').textContent = record.name;
  $('context').textContent = `${record.pack === 'personal' ? 'Personal' : 'Postvisual'} release target · revision ${record.revision}${record.dirty ? ' · working changes' : ' · matches source'}`;
  const overrideCount = record.definition.mirror ? Object.values(record.definition.overrides).reduce((sum, values) => sum + Object.keys(values).length, 0) : 0;
  $('inheritance').textContent = record.definition.mirror ? `Follows ${items.find(item => item.configurationId === record.definition.mirror)?.name ?? record.definition.mirror} · ${overrideCount} overrides` : 'Independent configuration';
  if (record.sourceChanged) status('Shared source changed. Compare your values, then reset to source before preparing another release.', 'warning');
  $('rename').value = record.name;
  $('mirror-source').replaceChildren(...items.filter(item => item.configurationId !== record.configurationId && item.pack !== record.pack).map(item => option(item.configurationId, item.name)));
  const baseline = $('baseline').value;
  $('baseline').replaceChildren(option('', 'Current source'), ...Object.entries(record.snapshots).map(([id, snapshot]) => option(id, snapshot.name)));
  if (record.snapshots[baseline]) $('baseline').value = baseline;
  $('snapshots').replaceChildren();
  for (const [id, snapshot] of Object.entries(record.snapshots)) {
    const section = document.createElement('section'); section.className = 'ui-stack'; section.append(text('h4', snapshot.name, 'ui-section-title'));
    const actions = document.createElement('div'); actions.className = 'ui-actions';
    actions.append(button('Compare', 'columns', async () => {if (!canNavigate()) return; $('baseline').value = id; $('preview-mode').value = 'compare'; await compare();}, false), button('Restore exact values', 'refresh', () => command({type: 'restore', snapshotId: id})));
    section.append(actions); $('snapshots').append(section);
  }
  $('publications').replaceChildren(...record.publications.map(receipt => {
    const node = text('p', `Pushed ${receipt.commit.slice(0, 12)} · GitHub Pages workflow `), link = text('a', 'View deployment'); link.href = receipt.workflowURL; link.target = '_blank'; link.rel = 'noreferrer'; node.append(link); return node;
  }));
  valuePicker(); await compare(); update();
}
async function execute(request) {
  if (busy) return;
  remember(request); busy = true; update();
  $('check-details').hidden = true;
  const active = document.activeElement, selection = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;
  status(request.method === 'configuration.validate' ? 'Running shared tests and build…' : request.method === 'configuration.publish' ? 'Preparing and pushing the validated release…' : 'Saving configuration…', 'pending');
  try {
    const result = await api(request.method, request.args);
    remember(null); dirty.clear(); await load(request.args.configurationId);
    status(result.status === 'pushed' ? `Release pushed as ${result.commit.slice(0, 12)}. GitHub Pages deployment is pending.` : request.method === 'configuration.validate' ? 'Validation passed. This exact revision is ready to publish.' : 'Configuration saved locally.', 'success');
    return true;
  } catch (error) {
    if (error.details?.output) {$('check-details').hidden = false; $('check-details').open = true; $('check-output').textContent = error.details.output;}
    if (error.status && error.status < 500) remember(null);
    else {$('recovery').hidden = false; $('recovery-text').textContent = 'The request may have completed. Retry the same request to recover its receipt.';}
    if (error.code === 'REVISION_CONFLICT' || error.code === 'SOURCE_CONFLICT') {$('recovery').hidden = false; $('recovery-text').textContent = 'The draft or source changed. Your fields are preserved. Load the current revision to discard them and review the changes.';}
    status(error.message, 'error'); return false;
  } finally {
    busy = false; update();
    if (active?.isConnected && !active.disabled) {active.focus(); if (selection?.every(Number.isInteger)) active.setSelectionRange(...selection);}
  }
}
async function command(operation, id = record.configurationId, revision = record.revision, form) {
  if (busy || pending || !permissions.write) return;
  if ([...dirty].some(name => name !== form)) throw new Error('Apply or discard the other form changes first.');
  return execute({method: 'configuration.command', args: {configurationId: id, expectedRevision: revision, operationId: uid('edit'), command: operation}});
}
for (const id of ['theme', 'density', 'width', 'preview-mode']) {
  const saved = session.get('studio-configuration-' + id);
  if ([...$(id).options].some(option => option.value === saved)) $(id).value = saved;
  $(id).onchange = () => {session.set('studio-configuration-' + id, $(id).value); sendPreviews();};
}
$('baseline').onchange = () => run(() => canNavigate() && compare());
$('scope').onchange = () => {if (!canNavigate()) {$('scope').value = $('value-form').dataset.scope ?? 'defaults'; return;} valuePicker(); $('value-form').dataset.scope = $('scope').value;};
$('token').onchange = () => {if (dirty.has('value-form')) {$('token').value = $('value-form').dataset.token; status('Apply or discard this value first.', 'warning'); return;} drawValue(); $('value-form').dataset.token = $('token').value;};
$('value').oninput = () => {$('value-form').dataset.token = $('token').value; $('value-form').dataset.scope = $('scope').value;};
document.addEventListener('input', event => {const form = event.target.closest('form'); if (form) {dirty.add(form.id); update();}});
$('value-form').onsubmit = event => {event.preventDefault(); run(() => command({type: 'set-value', scope: $('scope').value, token: $('token').value, value: $('value').value}, undefined, undefined, 'value-form'));};
$('reset-value').onclick = () => run(() => command({type: 'reset-value', scope: $('scope').value, token: $('token').value}, undefined, undefined, 'value-form'));
$('rename-form').onsubmit = event => {event.preventDefault(); run(() => command({type: 'rename', name: $('rename').value}, undefined, undefined, 'rename-form'));};
$('mirror-form').onsubmit = event => {event.preventDefault(); run(() => command({type: 'mirror', sourceId: $('mirror-source').value}, undefined, undefined, 'mirror-form'));};
$('detach').onclick = () => run(() => command({type: 'detach'}));
$('reset-source').onclick = () => run(() => command({type: 'reset-source'}));
$('snapshot').onclick = () => run(() => command({type: 'snapshot', snapshotId: uid('snapshot'), name: `Revision ${record.revision} · ${new Date().toLocaleString()}`}));
$('discard').onclick = () => {if (busy || pending) return; dirty.clear(); $('rename').value = record.name; drawValue(); update();};
$('refresh').onclick = () => run(() => canNavigate() && load());
$('configuration').onchange = () => {const id = $('configuration').value; if (!canNavigate()) {$('configuration').value = record.configurationId; return;} run(() => load(id));};
$('validate').onclick = () => run(() => canNavigate() && execute({method: 'configuration.validate', args: {configurationId: record.configurationId, expectedRevision: record.revision, operationId: uid('validation')}}));
$('publish').onclick = () => run(() => canNavigate() && execute({method: 'configuration.publish', args: {configurationId: record.configurationId, expectedRevision: record.revision, validationId: validation().validationId, operationId: uid('publish')}}));
$('retry').onclick = () => run(() => pending && execute(pending));
$('load-current').onclick = () => run(async () => {dirty.clear(); remember(null); await load();});
$('duplicate').onclick = () => {if (!canNavigate()) return; const form = $('duplicate-form'); form.elements.name.value = record.name.slice(0, 195) + ' copy'; form.elements.pack.value = record.pack; $('duplicate-dialog').showModal();};
$('cancel-duplicate').onclick = () => $('duplicate-dialog').close();
$('duplicate-dialog').addEventListener('close', () => dirty.delete('duplicate-form'));
$('duplicate-form').onsubmit = event => {event.preventDefault(); const form = event.currentTarget; run(async () => {if (await command({type: 'duplicate', sourceId: record.configurationId, sourceRevision: record.revision, name: form.elements.name.value, pack: form.elements.pack.value}, uid('configuration'), 0, 'duplicate-form')) $('duplicate-dialog').close();});};
window.addEventListener('message', event => {if (event.origin === location.origin && event.data?.type === 'configuration-ready' && ['before', 'after'].some(id => $(id).contentWindow === event.source)) sendPreviews();});
async function poll() {
  if (stopped || document.hidden) return;
  try {
    if (!busy && !reading && !pending && record) {
      const current = await api('configuration.read', {configurationId: record.configurationId});
      if (current.revision !== record.revision || current.effectiveHash !== record.effectiveHash || current.sourceHash !== record.sourceHash || current.activityHash !== record.activityHash) {
        if (dirty.size || document.activeElement?.closest('form')) {status('An agent or another editor changed this configuration. Your fields are preserved; load the current revision when ready.', 'warning'); $('recovery').hidden = false;}
        else await load();
      }
    }
  } catch {} finally {if (!stopped && !document.hidden) timer = setTimeout(poll, 4000);}
}
document.addEventListener('visibilitychange', () => {clearTimeout(timer); if (!document.hidden) timer = setTimeout(poll, 100);});
window.addEventListener('beforeunload', event => {if (dirty.size || pending) {event.preventDefault(); event.returnValue = '';}});
window.addEventListener('pagehide', () => {stopped = true; clearTimeout(timer); for (const controller of controllers) controller.abort(); SharedUI.disposeActions?.(document);}, {once: true});
await run(async () => {permissions = (await api('describe')).permissions; await load(); if (pending) {$('recovery').hidden = false; status('Recover the pending request before editing.', 'warning');} timer = setTimeout(poll, 4000);});
