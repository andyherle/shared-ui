import {createAppearanceController} from './controller.mjs';
import {validateRegistry, parseDeclarations, formatDeclarations} from './schema.mjs';
import {parseAppearancePatch, serializeAppearancePatch} from './persistence.mjs';

/** One human editor reused by opted-in applications and Studio.
 * All app changes are made by the controller's owned stylesheet.
 */
export function mountAppearanceEditor({host, registry, document: doc = host?.ownerDocument,
    initial = {}, persistence = null, onChange, readOnly = false} = {}) {
  if (!host || !doc || host.ownerDocument !== doc) throw new Error('Appearance needs an owned host in its target document.');
  registry = validateRegistry(registry);
  const win = doc.defaultView, root = doc.createElement('section');
  root.className = 'appearance-editor ui-stack';
  root.setAttribute('aria-label', 'Module appearance');
  const make = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const listeners = [], moduleListeners = [];
  const listen = (node, type, handler) => {node.addEventListener(type, handler); listeners.push(() => node.removeEventListener(type, handler));};
  const button = (text, handler) => {const node = make('button', '', text); node.type = 'button'; if (handler) listen(node, 'click', handler); return node;};
  const field = (text, control) => {const node = make('label', 'ui-field'); node.append(make('span', 'ui-label', text), control); return node;};
  const status = make('p', 'ui-status appearance-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const say = (text, state = 'neutral') => {status.textContent = text; status.dataset.state = state;};
  let disposed = false, loading = !!persistence, saving = false, loadBlocked = false, revision = 0;
  let baseline, selected = registry.modules[0].id, cssDirty = false, applying = false;
  let pendingSave = null, exportURL = null, restoreDialog;
  const controller = createAppearanceController({registry, document: doc, initial});
  baseline = JSON.stringify(controller.getState().overrides);
  const picker = make('select');
  picker.setAttribute('aria-label', 'Appearance module');
  for (const module of registry.modules) {const option = make('option', '', module.label); option.value = module.id; picker.append(option);}
  const description = make('p', 'ui-meta'), controls = make('div', 'appearance-controls ui-stack');
  const tools = make('div', 'ui-actions appearance-tools');
  const undo = button('Undo', () => work(() => controller.undo()));
  const redo = button('Redo', () => work(() => controller.redo()));
  const compare = button('Show original', () => {if (!loading) controller.compareBaseline(!controller.getState().comparing);});
  compare.setAttribute('aria-pressed', 'false');
  const reset = button('Reset module', () => work(() => controller.reset(selected)));
  tools.append(undo, redo, compare, reset);
  const advanced = make('details', 'ui-section');
  const summary = make('summary'); summary.append(make('h3', '', 'CSS declarations'), make('p', 'ui-meta', 'Edit the registered variables for this module.'));
  const css = make('textarea', 'appearance-code');
  css.setAttribute('aria-label', 'Module CSS declarations'); css.spellcheck = false; css.rows = 7;
  const cssActions = make('div', 'ui-actions');
  const applyCSS = button('Apply CSS', () => work(() => {
    const values = parseDeclarations(module(), css.value);
    controller.setModule(selected, values); cssDirty = false; css.setCustomValidity(''); refresh();
    say('CSS applied to the current preview.');
  }));
  const discardCSS = button('Revert text', () => {cssDirty = false; css.setCustomValidity(''); refresh();});
  cssActions.append(applyCSS, discardCSS);
  advanced.append(summary, css, cssActions);
  const source = make('details', 'ui-section');
  const sourceSummary = make('summary'); sourceSummary.append(make('h3', '', 'Source CSS'));
  const sourcePath = make('p', 'ui-meta appearance-source-path'), sourceCode = make('pre', 'appearance-code');
  source.append(sourceSummary, sourcePath, sourceCode);
  const actions = make('div', 'ui-actions appearance-tools');
  const save = button('Save profile', () => saveProfile());
  save.dataset.uiVariant = 'primary'; save.dataset.uiLabel = 'always';
  const reload = button('Load saved', () => loadSaved(true));
  const exportButton = button('Export patch', () => work(() => {
    if (cssDirty) throw new Error('Apply or revert the CSS text before exporting.');
    const blob = new win.Blob([serializeAppearancePatch(registry, controller.getState().overrides)], {type: 'application/json'});
    if (exportURL) win.URL.revokeObjectURL(exportURL);
    exportURL = win.URL.createObjectURL(blob);
    const anchor = make('a'); anchor.href = exportURL; anchor.download = registry.id + '.appearance.json';
    root.append(anchor); anchor.click(); anchor.remove();
    say('Exported this profile as a reusable appearance patch.');
  }));
  const importInput = make('input'); importInput.type = 'file'; importInput.accept = '.json,application/json'; importInput.hidden = true;
  const importButton = button('Import patch', () => importInput.click());
  actions.append(save, reload, exportButton, importButton, importInput);
  root.append(field('Control', picker), description, tools, controls, advanced, source, actions, status);
  host.append(root);

  function module() {return registry.modules.find(item => item.id === selected);}
  function work(fn) {
    if (loading) {say('Wait for the saved profile to finish loading.', 'warning'); return;}
    if (readOnly) {say('This appearance profile is read only.', 'warning'); return;}
    try {if (controller.getState().comparing) controller.compareBaseline(false); fn();} catch (error) {say(error.message, 'error');}
  }
  function changed() {return JSON.stringify(controller.getState().overrides) !== baseline || cssDirty;}
  function refresh() {
    if (disposed) return;
    const state = controller.getState(), active = doc.activeElement;
    undo.disabled = readOnly || loading || !state.canUndo;
    redo.disabled = readOnly || loading || !state.canRedo;
    compare.disabled = loading;
    compare.textContent = state.comparing ? 'Show changes' : 'Show original';
    compare.setAttribute('aria-pressed', String(!!state.comparing));
    reset.disabled = readOnly || loading;
    picker.disabled = loading;
    save.disabled = readOnly || !persistence || loading || saving || loadBlocked || (!changed() && !pendingSave);
    reload.disabled = !persistence || loading || saving;
    importButton.disabled = readOnly || loading;
    exportButton.disabled = loading || cssDirty;
    applyCSS.disabled = readOnly || loading || !cssDirty;
    discardCSS.disabled = loading || !cssDirty;
    css.disabled = readOnly || loading;
    if (!cssDirty && active !== css) css.value = formatDeclarations(module(), state.overrides[selected] ?? {});
    for (const row of controls.children) {
      const descriptor = module().controls.find(item => item.property === row.dataset.property);
      if (!descriptor) continue;
      const value = state.overrides[selected]?.[descriptor.property];
      const input = row.querySelector('[data-appearance-value]');
      if (active !== input) input.value = value === undefined ? '' : descriptor.type === 'length' ? String(parseFloat(value)) : value;
      input.disabled = readOnly || loading;
      row.querySelector('button').disabled = readOnly || loading || value === undefined;
      const range = row.querySelector('input[type="range"]');
      if (range) {
        if (active !== range) range.value = value === undefined ? parseFloat(descriptor.default ?? descriptor.min ?? '0') : parseFloat(value);
        range.disabled = readOnly || loading;
      }
      row.querySelector('[data-origin]').textContent = value === undefined ? 'Inherited' + (descriptor.default ? ' · ' + descriptor.default : '') : value;
    }
    onChange?.({...state, dirty: changed(), saving, loading, revision});
  }
  function renderModule() {
    for (const remove of moduleListeners.splice(0)) remove();
    const moduleListen = (node, type, handler) => {node.addEventListener(type, handler); moduleListeners.push(() => node.removeEventListener(type, handler));};
    controls.replaceChildren();
    const current = module();
    description.textContent = current.description ?? '';
    sourcePath.textContent = current.source?.path ?? 'Registered application module';
    sourceCode.textContent = current.source?.cssText ?? 'This registration has no source CSS excerpt.';
    for (const descriptor of current.controls) {
      const row = make('div', 'appearance-control ui-stack'); row.dataset.property = descriptor.property;
      const line = make('div', 'ui-actions');
      let input;
      if (descriptor.type === 'enum') {
        input = make('select'); const inherited = make('option', '', 'Inherited'); inherited.value = ''; input.append(inherited);
        for (const value of descriptor.options) {const option = make('option', '', value); option.value = value; input.append(option);}
      } else {
        input = make('input'); input.type = 'text';
        input.inputMode = ['length', 'number'].includes(descriptor.type) ? 'decimal' : 'text';
        input.placeholder = descriptor.default ? String(descriptor.default).replace(/(?:px|rem)$/, '') : 'Inherited';
        input.autocomplete = 'off'; input.spellcheck = false;
      }
      input.dataset.appearanceValue = ''; input.setAttribute('aria-label', descriptor.label); input.title = descriptor.property;
      const unit = descriptor.type === 'length' ? ' (' + (descriptor.unit ?? 'px') + ')' : '';
      const origin = make('small', 'ui-meta'); origin.dataset.origin = '';
      const resetValue = button('Reset');
      moduleListen(resetValue, 'click', () => work(() => {controller.set(selected, descriptor.property, null); input.setCustomValidity(''); refresh();}));
      resetValue.setAttribute('aria-label', 'Reset ' + descriptor.label);
      line.append(field(descriptor.label + unit, input), resetValue);
      const edit = () => {
        if (readOnly || loading) return;
        try {
          const raw = input.value.trim();
          const value = !raw ? null : descriptor.type === 'length' ? raw + (descriptor.unit ?? 'px') : raw;
          if (controller.getState().comparing) controller.compareBaseline(false);
          controller.set(selected, descriptor.property, value);
          input.setCustomValidity(''); say('Preview updated. Save when you want to keep the changes.');
        } catch (error) {input.setCustomValidity(error.message); say(error.message, 'error');}
      };
      moduleListen(input, 'input', event => {if (!event.isComposing) edit();});
      moduleListen(input, 'compositionend', edit);
      moduleListen(input, 'focus', () => controller.beginGesture?.());
      moduleListen(input, 'blur', () => {controller.endGesture?.(); refresh();});
      row.append(line);
      if (['length', 'number'].includes(descriptor.type) && Number.isFinite(descriptor.min) && Number.isFinite(descriptor.max)) {
        const range = make('input'); range.type = 'range'; range.min = descriptor.min; range.max = descriptor.max;
        range.step = descriptor.type === 'number' && descriptor.max <= 1 ? '0.01' : descriptor.unit === 'rem' ? '0.05' : '1';
        range.setAttribute('aria-label', descriptor.label + ' slider');
        moduleListen(range, 'pointerdown', () => controller.beginGesture?.());
        moduleListen(range, 'keydown', event => {if (event.key.startsWith('Arrow')) controller.beginGesture?.();});
        moduleListen(range, 'input', () => work(() => controller.set(selected, descriptor.property, range.value + (descriptor.type === 'length' ? descriptor.unit ?? 'px' : ''))));
        for (const event of ['change', 'blur', 'pointercancel']) moduleListen(range, event, () => controller.endGesture?.());
        row.append(range);
      }
      row.append(origin); controls.append(row);
    }
    cssDirty = false; css.value = formatDeclarations(current, controller.getState().overrides[selected] ?? {});
    refresh();
  }
  async function saveProfile() {
    if (!persistence || saving || loading || loadBlocked || readOnly) return;
    if (cssDirty) {say('Apply or revert the CSS text before saving.', 'warning'); return;}
    saving = true; refresh();
    // A failed Studio transport may have committed. Keep the exact old request
    // available for retry even when the user continues working on the preview.
    pendingSave ??= {overrides: structuredClone(controller.getState().overrides), expectedRevision: revision};
    say('Saving profile…', 'pending');
    try {
      const result = await persistence.save(pendingSave.overrides, {expectedRevision: pendingSave.expectedRevision});
      if (disposed) return;
      revision = result.revision; baseline = JSON.stringify(result.overrides); pendingSave = null;
      say(changed() ? 'Profile saved. Your newer preview edits are still unsaved.' : 'Profile saved.', 'success');
    } catch (error) {
      if (['REVISION_CONFLICT', 'REGISTRY_MISMATCH'].includes(error.code)) {loadBlocked = true; pendingSave = null;}
      else if (error.code && !['OPERATION_FAILED', 'NETWORK_ERROR'].includes(error.code)) pendingSave = null;
      say(error.message, 'error');
    } finally {saving = false; refresh();}
  }
  async function loadSaved(explicit = false) {
    if (!persistence || saving || loading && explicit) return;
    if (explicit && (changed() || pendingSave)) {
      if (!restoreDialog) {
        restoreDialog = make('dialog', 'ui-popout');
        const header = make('header'); header.append(make('h2', '', 'Load the saved profile?'));
        const body = make('p', 'ui-pad', 'This replaces your current preview and CSS text. Export a patch first if you want to keep them.');
        body.dataset.uiPopoutBody = '';
        const footer = make('footer', 'ui-actions');
        footer.append(button('Keep editing', () => restoreDialog.close()), button('Load saved profile', () => {restoreDialog.close(); performLoad();}));
        restoreDialog.append(header, body, footer); root.append(restoreDialog);
      }
      restoreDialog.showModal(); return;
    }
    return performLoad();
  }
  async function performLoad() {
    loading = true; refresh(); say('Loading saved profile…', 'pending');
    try {
      const result = await persistence.load();
      if (disposed) return;
      revision = result.revision; baseline = JSON.stringify(result.overrides); pendingSave = null; loadBlocked = false; cssDirty = false;
      applying = true;
      try {controller.replace(result.overrides);} finally {applying = false;}
      say(revision ? 'Saved profile loaded.' : 'Change a control to preview its appearance.'); renderModule();
    } catch (error) {
      // Never silently overwrite an unreadable or newer-schema saved profile.
      loadBlocked = true; say(error.message, 'error');
    } finally {loading = false; refresh();}
  }
  listen(picker, 'change', () => {
    if (cssDirty) {picker.value = selected; say('Apply or revert the CSS text before changing modules.', 'warning'); return;}
    controller.endGesture?.(); selected = picker.value; renderModule();
  });
  listen(css, 'input', () => {cssDirty = true; css.setCustomValidity(''); refresh();});
  listen(importInput, 'change', async () => {
    const file = importInput.files?.[0]; if (!file) return;
    try {
      if (file.size > 131072) throw new Error('Appearance patch is too large.');
      const patch = parseAppearancePatch(registry, await file.text());
      if (disposed) return;
      controller.replace(patch.overrides); cssDirty = false; renderModule(); say('Patch imported into the preview. Save to keep it.');
    } catch (error) {say(error.message, 'error');}
    finally {importInput.value = '';}
  });
  const unsubscribe = controller.subscribe(() => {if (!applying) refresh();});
  renderModule();
  const ready = persistence ? performLoad() : Promise.resolve().then(() => {loading = false; say('Preview changes here; export a patch to keep them.'); refresh();});
  const beforeUnload = event => {if (changed() || pendingSave) {event.preventDefault(); event.returnValue = '';}};
  if (win) listen(win, 'beforeunload', beforeUnload);
  return Object.freeze({
    controller, ready,
    get dirty() {return changed() || !!pendingSave;},
    dispose() {
      if (disposed) return; disposed = true; unsubscribe?.();
      for (const remove of [...listeners, ...moduleListeners]) remove();
      if (exportURL) win.URL.revokeObjectURL(exportURL);
      if (restoreDialog?.open) restoreDialog.close();
      controller.dispose(); root.remove(); persistence?.close?.();
    }
  });
}
