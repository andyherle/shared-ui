import {freeze, SCHEMA_VERSION} from './validation.mjs';

const text = {type: 'string', max: 500};
const flag = {type: 'boolean'};
const choice = (...values) => ({type: 'enum', values});
const actionProps = {label: text, icon: {type: 'string', max: 80}, variant: choice('default', 'primary', 'danger', 'quiet'), disabled: flag, labelMode: choice('auto', 'always', 'hidden')};
const fieldProps = {label: text, placeholder: text, disabled: flag, required: flag, readonly: flag};
const flow = {children: {families: ['action', 'field', 'layout', 'content', 'feedback', 'disclosure'], min: 0, max: 100}};
const paint = ['--ui-surface', '--ui-text', '--ui-control', '--ui-radius', '--ui-control-height', '--ui-control-size', '--ui-gap', '--ui-primary', '--ui-on-primary'];
const fieldTokens = ['--ui-field-height', '--ui-field-padding', '--ui-radius-small', '--ui-control', '--ui-surface', '--ui-text', '--ui-control-size'];
const surfaceTokens = ['--ui-surface', '--ui-text', '--ui-line-strong', '--ui-radius', '--ui-gap'];
const checks = {
  action: [
    {id: 'action-label', selector: ':scope > .ui-label', min: 1, max: 1, expected: 'Exactly one direct .ui-label child.'},
    {id: 'action-icon', selector: ':scope > svg:not(.ui-icon)', min: 0, max: 0, expected: 'Every direct SVG uses .ui-icon.'}
  ],
  field: [{id: 'field-control', selector: 'input,select,textarea', min: 1, expected: 'At least one native input, select or textarea.'}],
  popout: [
    {id: 'popout-header', selector: ':scope > header', min: 1, max: 1, expected: 'Exactly one direct header.'},
    {id: 'popout-body', selector: ':scope > [data-ui-popout-body]', min: 1, max: 1, expected: 'Exactly one direct [data-ui-popout-body] child.'},
    {id: 'popout-footer', selector: ':scope > footer', min: 1, max: 1, expected: 'Exactly one direct footer.'}
  ]
};
// Explicit definitions, not a list inferred from CSS selectors. Fixtures reuse the
// Style Lab. Authoring availability describes JSON support, not a live app adapter.
function component(id, name, family, selector, tags, fixture, options = {}) {
  return {id, name, family, selector, semantics: {tags}, packs: ['postvisual', 'personal'],
    props: {}, variants: ['default'], states: [], tokens: [], slots: {}, bindings: {},
    accessibility: {name: 'Use native semantics and an accessible name for interactive content.', keyboard: 'Preserve native focus order and keyboard behavior.'},
    renderer: {id: 'style-lab-native', status: 'catalogue-only'},
    fixtures: [{file: ['control-fixture','floating-review'].includes(fixture) ? 'src/fixture.html' : 'src/index.html', anchor: fixture}],
    lifecycle: {status: 'stable', since: 1, replacement: null}, audit: null,
    ...options};
}
const editable = {renderer: {id: 'native-document', status: 'document-only'}};
export const COMPONENTS = freeze([
  component('action', 'Native action', 'action', '.ui-action', ['button', 'a', 'summary', 'label'], 'buttons', {
    ...editable, props: actionProps, variants: ['default', 'primary', 'danger', 'quiet'], states: ['disabled', 'busy', 'pressed', 'mixed', 'current'], tokens: paint,
    bindings: {activate: 'action'}, audit: {selector: '.ui-action', tags: ['button', 'a', 'summary', 'label'], attributes: {'data-ui-variant': ['primary', 'danger', 'quiet']}, checks: checks.action}}),
  component('button', 'CSS-only native button', 'action', 'button', ['button'], 'buttons', {...editable, props: actionProps, variants: ['default', 'primary', 'danger', 'quiet'], states: ['disabled', 'busy', 'pressed'], tokens: paint, bindings: {activate: 'action'}}),
  component('link', 'Action link', 'action', 'a.ui-action,a.ui-button', ['a'], 'buttons', {...editable, props: actionProps, tokens: paint, bindings: {navigate: 'navigation'}}),
  component('icon-action', 'Icon action', 'action', '.ui-icon-button,[data-ui-label="hidden"]', ['button', 'a', 'summary'], 'buttons', {...editable, props: actionProps, tokens: paint, bindings: {activate: 'action'}}),
  component('field', 'Composed field', 'field', '.ui-field', ['label', 'div', 'form'], 'responsive', {
    props: {variant: choice('default', 'quiet')}, variants: ['default', 'quiet'], tokens: fieldTokens,
    audit: {selector: '.ui-field', checks: checks.field}}),
  component('text-input', 'Native input', 'field', 'input:not([type="checkbox"],[type="radio"],[type="range"],[type="color"],[type="file"])', ['input'], 'fields', {
    ...editable, props: {...fieldProps, type: choice('text', 'email', 'password', 'search', 'number', 'url', 'tel', 'date', 'time', 'datetime-local', 'month', 'week')}, states: ['invalid', 'disabled', 'readonly'], tokens: fieldTokens, bindings: {value: 'value'}}),
  component('textarea', 'Text area', 'field', 'textarea', ['textarea'], 'fields', {...editable, props: {...fieldProps, rows: {type: 'number', min: 1, max: 30}}, variants: ['default', 'inline'], states: ['invalid', 'readonly', 'disabled'], tokens: fieldTokens, bindings: {value: 'value'}}),
  component('select', 'Native selector', 'field', 'select', ['select'], 'choice', {props: {...fieldProps, multiple: flag}, variants: ['default', 'multiple', 'composed', 'quiet'], states: ['disabled', 'invalid'], tokens: fieldTokens, bindings: {value: 'value'}}),
  component('checkbox', 'Checkbox or radio', 'field', '.ui-check,input[type="checkbox"],input[type="radio"]', ['label', 'input'], 'fields', {...editable, props: {label: text, disabled: flag, kind: choice('checkbox', 'radio')}, variants: ['checkbox', 'radio', 'composed'], states: ['checked', 'mixed', 'disabled'], tokens: fieldTokens, bindings: {checked: 'boolean'}}),
  component('switch', 'Standalone switch', 'field', '.ui-switch', ['label'], 'fields', {...editable, props: {label: text, disabled: flag}, states: ['checked', 'disabled'], tokens: [...paint, '--ui-switch-width', '--ui-switch-height', '--ui-switch-thumb', '--ui-switch-inset'], bindings: {checked: 'boolean'}}),
  component('toggle', 'Inline toggle', 'field', '.ui-toggle', ['label'], 'control-fixture', {...editable, props: actionProps, states: ['checked', 'disabled'], tokens: [...paint, '--ui-switch-width', '--ui-switch-height', '--ui-switch-thumb', '--ui-switch-inset'], bindings: {checked: 'boolean'}}),
  component('range', 'Range input', 'field', 'input[type="range"]', ['input'], 'choice', {props: {label: text, min: {type: 'number'}, max: {type: 'number'}, step: {type: 'number', min: 0}}, tokens: ['--ui-range-thumb', '--ui-range-width', '--ui-control-height', '--ui-accent'], bindings: {value: 'value'}}),
  component('value-control', 'Range with exact value', 'field', '.ui-value-control', ['div'], 'adaptive-groups', {tokens: fieldTokens}),
  component('file-input', 'File picker', 'field', 'input[type="file"]', ['input'], 'fields', {props: {label: text, multiple: flag, disabled: flag}, tokens: fieldTokens}),
  component('color-input', 'Authored color picker', 'field', 'input[type="color"]', ['input'], 'choice', {tokens: fieldTokens}),
  component('suggestions', 'Native suggestions', 'field', 'input[list]', ['input', 'datalist'], 'choice', {tokens: fieldTokens}),
  component('combobox', 'Searchable choice', 'field', '.ui-combobox', ['div'], 'choice', {tokens: fieldTokens, accessibility: {name: 'Name the input and connect its listbox.', keyboard: 'Arrows select, Enter commits, Escape dismisses.'}}),
  component('tags', 'Tag entry', 'field', '.ui-tags', ['span', 'div'], 'choice', {variants: ['editable', 'readonly'], tokens: ['--ui-tag-height', '--ui-tag-font', '--ui-tag-padding', '--ui-tag-radius', '--ui-tag-size'], accessibility: {name: 'Name the entry and each removal action.', keyboard: 'Enter/comma commit; arrows and Enter choose; Escape dismisses.'}}),
  component('swatch', 'Authored color swatch', 'action', '.ui-swatch', ['button'], 'responsive', {states: ['pressed'], tokens: ['--ui-swatch-value', '--ui-accent']}),
  component('actions', 'Adaptive action group', 'layout', '.ui-actions', ['div', 'nav', 'form'], 'responsive', {...editable, props: {align: choice('start', 'center', 'end'), fill: flag}, variants: ['row', 'vertical', 'bar', 'inline', 'fill'], tokens: ['--ui-gap', '--ui-control-height'], slots: {children: {families: ['action', 'field', 'disclosure', 'feedback'], min: 0, max: 30}}, layouts: ['row', 'column']}),
  component('toolbar', 'Toolbar and header', 'layout', '.ui-toolbar', ['div', 'header', 'aside'], 'adaptive-groups', {...editable, props: {header: flag}, variants: ['default', 'joined', 'header', 'bar'], tokens: surfaceTokens, slots: flow, layouts: ['row']}),
  component('group', 'Native field group', 'layout', '.ui-group', ['fieldset'], 'responsive', {...editable, props: {label: text}, tokens: surfaceTokens, slots: flow, layouts: ['row', 'column']}),
  component('grid', 'Responsive grid', 'layout', '.ui-grid', ['div', 'section'], 'control-fixture', {...editable, props: {fill: flag}, tokens: ['--ui-grid-min', '--ui-grid-gap', '--ui-gap'], slots: flow, layouts: ['grid']}),
  component('split', 'Responsive split', 'layout', '.ui-split', ['div', 'section'], 'control-fixture', {...editable, tokens: ['--ui-aside', '--ui-main', '--ui-gap'], slots: {aside: {...flow.children, max: 1}, main: {...flow.children, min: 1, max: 1}}, layouts: ['split']}),
  component('stack', 'Vertical stack', 'layout', '.ui-stack', ['div', 'section', 'article'], 'workspace-density', {...editable, tokens: ['--ui-gap'], slots: flow, layouts: ['stack']}),
  component('form', 'Aligned native form', 'layout', '.ui-form', ['form', 'div'], 'fields', {tokens: ['--ui-grid-min', '--ui-grid-gap', '--ui-form-column', '--ui-gap'], slots: flow, accessibility: {name: 'Use native labels and validation.', keyboard: 'Native submission; retain input focus and form values.'}}),
  component('card', 'Card', 'layout', '.ui-card', ['article', 'div', 'button'], 'workspace-density', {...editable, props: {variant: choice('default', 'flat')}, variants: ['default', 'flat', 'column'], tokens: [...surfaceTokens, '--ui-card-fill', '--ui-card-ink'], slots: flow, layouts: ['stack', 'column']}),
  component('panel', 'Panel', 'layout', '.ui-panel', ['article', 'section', 'aside', 'div', 'dialog'], 'foundations', {...editable, tokens: surfaceTokens, slots: flow, layouts: ['stack', 'column']}),
  component('disclosure', 'Native disclosure', 'disclosure', '.ui-disclosure', ['details'], 'responsive', {props: {label: text, open: flag}, tokens: paint, slots: flow, accessibility: {name: 'Use a native summary.', keyboard: 'Enter/Space toggle; preserve the same content nodes.'}}),
  component('section', 'Record detail section', 'disclosure', '.ui-section', ['details'], 'control-fixture', {props: {label: text, context: text, open: flag}, tokens: surfaceTokens, slots: flow}),
  component('menu', 'Native command menu', 'disclosure', '.ui-menu', ['details'], 'navigation', {variants: ['default', 'overlay'], tokens: surfaceTokens, accessibility: {name: 'Name the native summary.', keyboard: 'Native toggle and focus order; Escape dismisses enhanced menus.'}}),
  component('overflow', 'Priority action disclosure', 'disclosure', '.ui-overflow', ['details'], 'adaptive-groups', {props: {priority: {type: 'number', min: 0, max: 100}}, tokens: paint, accessibility: {name: 'Name the summary even when its label compacts.', keyboard: 'Escape closes and restores summary focus.'}}),
  component('tabs', 'Tabs', 'navigation', '.ui-tabs', ['div', 'nav'], 'navigation', {states: ['selected', 'disabled'], tokens: paint, accessibility: {name: 'Connect tab and panel IDs; expose selected state.', keyboard: 'Arrow/Home/End navigation with one tab stop.'}}),
  component('breadcrumb', 'Breadcrumb', 'navigation', 'nav[aria-label="Breadcrumb"]', ['nav'], 'navigation', {tokens: ['--ui-text', '--ui-muted']}),
  component('pagination', 'Pagination', 'navigation', 'nav[aria-label="Pagination"]', ['nav'], 'data', {tokens: paint}),
  component('dialog', 'Native dialog', 'overlay', 'dialog', ['dialog'], 'sample-dialog', {variants: ['default', 'drawer', 'confirmation'], tokens: surfaceTokens, accessibility: {name: 'Name the dialog from its heading.', keyboard: 'Native modal focus, Escape dismissal, restore trigger focus.'}}),
  component('popout', 'Bounded review shell', 'overlay', '.ui-popout', ['dialog', 'article', 'form'], 'control-fixture', {tokens: [...surfaceTokens, '--ui-popout-width', '--ui-popout-height', '--ui-popout-space'], slots: {header: flow.children, body: flow.children, footer: flow.children}, audit: {selector: '.ui-popout', tags: ['dialog', 'article', 'form'], checks: checks.popout}}),
  component('floating-panel', 'Viewport floating review panel', 'overlay', '.ui-floating-panel', ['aside', 'section', 'div'], 'floating-review', {
    variants: ['bottom-right','bottom-left','top-right','top-left'], states: ['collapsed','expanded','dragging'],
    tokens: surfaceTokens, accessibility: {name: 'Keep human source/deployment identity visible and use a separate labeled move handle.',
      keyboard: 'Handle arrows move 16 px, Shift+arrows move 48 px, Home resets; native reset button also works by keyboard.'}}),
  component('popover', 'Native popover', 'overlay', '[popover]', ['div'], 'overlays', {tokens: surfaceTokens}),
  component('tooltip', 'Tooltip', 'feedback', '[role="tooltip"]', ['span'], 'overlays', {tokens: surfaceTokens, accessibility: {name: 'Connect descriptive text with aria-describedby.', keyboard: 'Visible on keyboard focus as well as hover.'}}),
  component('status', 'Reserved status text', 'feedback', '.ui-status', ['p', 'span', 'output'], 'control-fixture', {...editable, props: {label: text, state: choice('neutral', 'pending', 'success', 'error')}, states: ['neutral', 'pending', 'success', 'error'], tokens: ['--ui-text', '--ui-good', '--ui-bad', '--ui-muted']}),
  component('notice', 'Notice', 'feedback', '.ui-notice', ['p', 'div'], 'overlays', {...editable, props: {label: text, state: choice('neutral', 'success', 'error', 'warning')}, states: ['success', 'error', 'warning'], tokens: [...surfaceTokens, '--ui-good', '--ui-bad', '--ui-warning']}),
  component('progress', 'Progress and meter', 'feedback', 'progress,meter', ['progress', 'meter'], 'overlays', {variants: ['progress', 'meter', 'indeterminate'], tokens: ['--ui-control', '--ui-accent']}),
  component('skeleton', 'Loading placeholder', 'feedback', '.ui-skeleton', ['span', 'div'], 'overlays', {tokens: ['--ui-surface-soft', '--ui-radius']}),
  component('table', 'Native data table', 'data', '.ui-table', ['table'], 'data', {variants: ['default', 'sheet'], states: ['selected', 'sorted', 'resizing', 'reordering'], tokens: ['--ui-surface', '--ui-surface-soft', '--ui-line', '--ui-control-height', '--ui-gap'], accessibility: {name: 'Provide a caption, scoped headings and a named scroll region.', keyboard: 'Column move: Option+Left/Right. Resize: arrows, Shift, Home/End; Escape cancels.'}}),
  component('selection', 'Media selection', 'data', '.ui-selectable', ['article', 'button'], 'selection-navigation', {states: ['selected', 'mixed'], tokens: ['--ui-accent', '--ui-bg', '--ui-graphic-scale']}),
  component('context-bar', 'Selection context bar', 'layout', '.ui-context-bar', ['aside'], 'selection-navigation', {variants: ['inline', 'floating'], tokens: surfaceTokens}),
  component('app-tile', 'Application shortcut', 'navigation', '.ui-app-tile', ['a'], 'selection-navigation', {states: ['editing', 'dragging', 'busy'], tokens: ['--ui-app-color', ...surfaceTokens]}),
  component('back-to-top', 'Back to top', 'action', '.ui-back-to-top', ['button'], 'selection-navigation', {tokens: paint, accessibility: {name: 'Name the destination.', keyboard: 'Activation restores focus to the destination; respects reduced motion.'}}),
  component('zoom', 'Bounded zoom steps', 'action', '[data-ui-zoom]', ['button', 'output'], 'control-fixture', {states: ['minimum', 'maximum'], tokens: paint}),
  component('drag-handle', 'Canvas drag handle', 'action', '.ui-drag-handle', ['button'], 'workspace', {tokens: ['--ui-graphic-scale'], accessibility: {name: 'Name the move operation.', keyboard: 'Owning app supplies keyboard movement; preserve native focus.'}}),
  component('media', 'Native media', 'content', 'img,video,audio', ['img', 'video', 'audio'], 'media', {variants: ['image', 'video', 'audio'], tokens: ['--ui-media']}),
  component('media-action', 'Media opener', 'action', '.ui-media-button,[data-ui-surface="media"]', ['button'], 'media', {tokens: ['--ui-media'], accessibility: {name: 'Name the preview; keep other actions outside this button.', keyboard: 'Native Tab, Enter and Space.'}}),
  component('lightbox', 'Media lightbox', 'overlay', 'dialog:has([data-ui-lightbox-body])', ['dialog'], 'lightbox', {tokens: ['--ui-popout-width', '--ui-popout-height', '--ui-media'], accessibility: {name: 'Name the dialog and navigation actions.', keyboard: 'Escape closes. Left/Right navigate outside editable controls and selections.'}}),
  component('file-card', 'File preview card', 'composition', '.ui-card:has(.ui-media-button)', ['article'], 'file-previews', {tokens: surfaceTokens}),
  component('prose', 'Document typography', 'content', '.ui-prose', ['article'], 'content', {tokens: ['--ui-body-size', '--ui-font', '--ui-h1', '--ui-h2', '--ui-h3', '--ui-h4', '--ui-h5', '--ui-h6']}),
  component('text', 'Operational text', 'content', '.ui-meta,.ui-section-title,.ui-value', ['p', 'span', 'strong', 'h3', 'h4'], 'workspace-density', {...editable, props: {label: text, role: choice('body', 'meta', 'heading', 'value')}, tokens: ['--ui-text', '--ui-muted', '--ui-control-size']}),
  component('icon', 'Shared SVG icon', 'content', 'svg.ui-icon', ['svg'], 'icons', {tokens: ['--ui-text']}),
  component('timeline', 'Timeline composition', 'composition', '#timeline', ['section'], 'timeline', {tokens: ['--ui-playhead-color', '--ui-playhead-outline', '--ui-playhead-width']}),
  component('embedded-form', 'Embedded native form', 'composition', '#embedded-form', ['template'], 'embedded', {tokens: surfaceTokens})
]);
export const REGISTRY = freeze({schemaVersion: SCHEMA_VERSION, packs: ['postvisual', 'personal'], components: COMPONENTS});
export const AUDIT_CONTRACTS = freeze(COMPONENTS.filter(item => item.audit).map(item => ({id: item.id, description: item.name, ...item.audit})));
export function getComponent(id) { return COMPONENTS.find(item => item.id === id); }
export function listComponents({text = '', family, pack, status, authorable} = {}) {
  const query = text.toLocaleLowerCase();
  return COMPONENTS.filter(item => (!query || `${item.id} ${item.name}`.toLocaleLowerCase().includes(query)) &&
    (!family || family === item.family) && (!pack || item.packs.includes(pack)) &&
    (!status || status === item.lifecycle.status) && (authorable === undefined || authorable === (item.renderer.status === 'document-only')));
}
// Roles that are parts, modifiers or helpers rather than independent components.
// This explicit classification makes newly introduced catalogue roles fail coverage.
export const ROLE_OWNERS = freeze({
  action: 'action', actions: 'actions', 'app-symbol': 'app-tile', 'app-tile': 'app-tile', back: 'toolbar',
  'back-to-top': 'back-to-top', button: 'button', card: 'card', check: 'checkbox', choice: 'checkbox',
  chrome: 'text', 'column-resize': 'table', combobox: 'combobox', container: 'actions', 'context-bar': 'context-bar',
  'floating-panel':'floating-panel', 'floating-chrome':'floating-panel', 'floating-controls':'floating-panel',
  'floating-handle':'floating-panel', 'floating-reset':'floating-panel', 'floating-name':'floating-panel',
  'floating-variant':'floating-panel', 'floating-deployment':'floating-panel', 'floating-identity':'floating-panel',
  'floating-provenance':'floating-panel', 'floating-source-list':'floating-panel',
  danger: 'action', disclosure: 'disclosure', 'disclosure-body': 'disclosure', 'drag-handle': 'drag-handle', dynamic: 'action',
  error: 'notice', field: 'field', fill: 'actions', form: 'form', 'graphic-action': 'drag-handle', grid: 'grid', group: 'group',
  guide: 'drag-handle', header: 'toolbar', icon: 'icon', 'icon-button': 'icon-action', 'icon-choice': 'checkbox', inline: 'actions',
  'inline-field': 'textarea', item: 'action', label: 'action', listbox: 'combobox', 'media-button': 'media-action',
  menu: 'menu', 'menu-panel': 'menu', meta: 'text', mono: 'prose', muted: 'text', notice: 'notice', number: 'table',
  option: 'combobox', overflow: 'overflow', pad: 'panel', panel: 'panel', popout: 'popout', primary: 'action', prose: 'prose',
  range: 'range', 'resize-handle': 'table', search: 'text-input', section: 'section', 'section-title': 'text', selectable: 'selection',
  skeleton: 'skeleton', split: 'split', 'sr-only': 'text', stack: 'stack', status: 'status', success: 'notice', swatch: 'swatch',
  switch: 'switch', table: 'table', 'table-scroll': 'table', tabs: 'tabs', tag: 'tags', tags: 'tags', toggle: 'toggle',
  toolbar: 'toolbar', truncate: 'text', value: 'text', 'value-control': 'value-control', warning: 'notice'
});
