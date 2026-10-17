import {mountAppearanceEditor} from './editor.mjs';
import {createLocalAppearancePersistence} from './persistence.mjs';
import {DEMO_APPEARANCE_REGISTRY as registry} from './demo-registry.mjs';
SharedUI.instance?.dispose();
const editor = mountAppearanceEditor({host: document.getElementById('appearanceDemoEditor'), registry,
  persistence: createLocalAppearancePersistence({registry, databaseName: 'shared-ui-appearance-demo'})});
const input = document.getElementById('appearanceDemoInput'), form = input.form, details = document.getElementById('appearanceDemoDetails');
let submits = 0;
form.addEventListener('submit', event => {event.preventDefault(); document.getElementById('appearanceDemoSubmit').textContent = 'Native submissions: ' + ++submits;});
document.getElementById('appearanceTheme').onclick = () => {document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';};
document.getElementById('appearancePack').onclick = () => {document.documentElement.dataset.ui = document.documentElement.dataset.ui === 'personal' ? 'postvisual' : 'personal';};
document.getElementById('appearanceRunChecks').onclick = async () => {
  await editor.ready;
  const saved = editor.controller.getState().overrides;
  const output = document.getElementById('appearanceEvidence'), receipts = [];
  const verify = (condition, name) => {receipts.push((condition ? 'PASS ' : 'FAIL ') + name); if (!condition) throw new Error(name);};
  try {
    input.focus(); input.setSelectionRange(2, 8); const original = input.value, open = details.open;
    editor.controller.beginGesture?.();
    for (let n = 0; n < 100; n++) editor.controller.set('demo.panel', '--demo-panel-width', (240 + n) + 'px');
    editor.controller.endGesture?.();
    editor.controller.flush();
    verify(document.getElementById(input.id) === input && input.form === form, 'native input identity and form owner retained');
    verify(document.activeElement === input && input.selectionStart === 2 && input.selectionEnd === 8 && input.value === original, 'focus, selection and value retained');
    verify(details.open === open, 'disclosure state retained');
    const width = document.getElementById('appearanceDemoPanel').getBoundingClientRect().width;
    verify(width <= 340 && width > 0, 'registered width applied with container clamp');
    verify(getComputedStyle(document.getElementById('appearanceDemoPanel')).getPropertyValue('--demo-panel-width').trim() === '339px', 'latest coalesced value applied');
    editor.controller.set('demo.grip', '--demo-grip-opacity', '0.3'); editor.controller.flush();
    verify(getComputedStyle(document.getElementById('appearanceDemoGrip')).opacity === '0.3', 'second module changes in the same session');
    const beforeSubmit = submits; form.requestSubmit();
    verify(submits === beforeSubmit + 1, 'native submit handler retained');
    editor.controller.undo(); editor.controller.redo(); editor.controller.flush();
    verify(getComputedStyle(document.getElementById('appearanceDemoGrip')).opacity === '0.3', 'undo and redo restore the style');
    receipts.push('Manual gate: genuine macOS IME, touch, multiple views, and actual application parity have not been certified by these checks.');
  } catch (error) {receipts.push('Stopped: ' + error.message);}
  finally {editor.controller.replace(saved); editor.controller.flush(); output.textContent = receipts.join('\n');}
};
window.addEventListener('pagehide', () => editor.dispose(), {once: true});
