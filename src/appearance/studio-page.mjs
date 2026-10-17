import {mountAppearanceEditor} from './editor.mjs';
import {createStudioAppearancePersistence} from './studio-persistence.mjs';
const $ = selector => document.querySelector(selector);
SharedUI.instance?.dispose();
let token = location.hash.slice(1);
try {token ||= sessionStorage.getItem('studio-token'); if (token) sessionStorage.setItem('studio-token', token);} catch {}
if (location.hash) history.replaceState(null, '', location.pathname);
const requests = new Set();
let editor, registrations = [], profiles = [], writable = false, selectedView = '', selectedDocument = '', busy = false, stopped = false;
async function request(value) {
  const controller = new AbortController(); requests.add(controller);
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
      body: JSON.stringify(value), signal: controller.signal, credentials: 'omit'});
    const body = await response.json();
    if (!response.ok || body.error) throw Object.assign(new Error(body.error?.message ?? 'Studio could not complete this request.'), body.error, {status: response.status});
    return body.result;
  } finally {clearTimeout(timeout); requests.delete(controller);}
}
function say(text) {$('#appearance-page-status').textContent = text;}
function option(value, label) {const node = document.createElement('option'); node.value = value; node.textContent = label; return node;}
const viewKey = view => view.appId + '/' + view.viewId;
function updateButtons() {for (const id of ['appearance-view', 'appearance-profile']) $('#' + id).disabled = busy; $('#appearance-new').disabled = busy || !writable || !registrations.length;}
async function listProfiles() {
  profiles = (await request({method: 'documents.list', args: {}})).documents.filter(item => item.scope.kind === 'appearance');
  const select = $('#appearance-profile'); select.replaceChildren();
  for (const profile of profiles.filter(item => viewKey(item.target) === selectedView)) select.append(option(profile.documentId, profile.name));
  if (selectedDocument && ![...select.options].some(item => item.value === selectedDocument)) select.append(option(selectedDocument, 'New appearance profile'));
  select.value = selectedDocument;
}
async function openProfile(documentId) {
  const view = registrations.find(item => viewKey(item) === selectedView); if (!view) return;
  busy = true; updateButtons();
  try {
    const {registry} = await request({method: 'appearance.registry', args: {appId: view.appId, viewId: view.viewId}});
    if (stopped) return;
    editor?.dispose();
    selectedDocument = documentId || 'appearance-' + crypto.randomUUID();
    const persistence = createStudioAppearancePersistence({request, documentId: selectedDocument, appId: view.appId, viewId: view.viewId, registry});
    editor = mountAppearanceEditor({host: $('#appearance-host'), registry, readOnly: !writable, persistence: {
      load: () => persistence.load(),
      async save(overrides, options) {
        const result = await persistence.save(overrides, {...options, name: view.appId + ' / ' + view.viewId + ' appearance'});
        if (!stopped) await listProfiles();
        return result;
      }
    }});
    await editor.ready; await listProfiles();
    say('Profiles use the existing Studio revision, version and undo service. This page does not mount the private application.');
  } catch (error) {say(error.message);}
  finally {busy = false; updateButtons();}
}
function maySwitch() {if (editor?.dirty) {say('Save or export the current profile before switching. Load saved to discard its preview.'); return false;} return !busy;}
$('#appearance-view').addEventListener('change', async event => {
  if (!maySwitch()) {event.target.value = selectedView; return;}
  selectedView = event.target.value; selectedDocument = '';
  const first = profiles.find(item => viewKey(item.target) === selectedView);
  await openProfile(first?.documentId);
});
$('#appearance-profile').addEventListener('change', async event => {
  if (!maySwitch()) {event.target.value = selectedDocument; return;}
  await openProfile(event.target.value);
});
$('#appearance-new').addEventListener('click', () => {if (maySwitch()) openProfile(null);});
window.addEventListener('pagehide', () => {stopped = true; editor?.dispose(); for (const pending of requests) pending.abort();}, {once: true});
try {
  busy = true; updateButtons();
  const [description, views] = await Promise.all([request({method: 'describe'}), request({method: 'views.list'})]);
  writable = description.permissions.write; registrations = views.views.filter(view => view.adapter === 'appearance');
  for (const view of registrations) $('#appearance-view').append(option(viewKey(view), viewKey(view)));
  selectedView = registrations[0] ? viewKey(registrations[0]) : '';
  await listProfiles();
  if (selectedView) await openProfile(profiles.find(item => viewKey(item.target) === selectedView)?.documentId);
  else say('No appearance views are registered in this Studio session. Use the live editor in an opted-in app, or try the synthetic example.');
} catch (error) {say(error.message);}
finally {busy = false; updateButtons();}
