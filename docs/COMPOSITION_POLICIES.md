# Shared control groups and layout defaults

Source release: 1.20.0. This is a bundled behavior update, not a remote CSS feature.

## One definition

`src/studio/registry.mjs` owns composition slots, native shells, supported settings,
and typed overrides. The build emits that small static contract into the native
runtime. It does not include the Studio engine, store, tokens, private views or
bindings. Studio previews use the same factory as application code.

`review-workspace@1` retains its existing slots and variants. `control-group@1`
adds a native `details.ui-section` with a heading, optional related-action row,
and body. It does not use a boxed standalone reveal button. Its body can stack or
use the existing responsive grid. The native heading and open state stay in place.

## Change a group of instances

```js
const layouts = SharedUI.createCompositionScope();
const group = SharedUI.createComposition('control-group', {
  header: heading,       // Native heading, no interactive child actions.
  toolbar: actions,      // Optional genuine related actions, outside the summary.
  body: fields          // Detached app-owned native controls or a parent form.
}, {instanceId: 'app.inspector', scope: layouts});
container.append(group.element);

const defaults = {'control-group': {variant: 'grid'}};
const revision = layouts.getState().revision;
const impact = layouts.preview(defaults, {expectedRevision: revision});
layouts.setDefaults(defaults, {expectedRevision: revision});

// Explicit local choice; other instances still follow their scope.
group.setLayout({variant: 'stack'});
// Reset one setting without losing values, handlers, bindings or open state.
group.setLayout({variant: null});
```

Omitted settings follow the scope, then the shared registry default. A literal
setting is a local pin. `null` or `inherit` removes that pin. `setLayout({})` retains
existing choices. `getConfiguration()` reports each value and its origin.
`setDefaults()` replaces the scope defaults, rather than silently merging them.
An empty object resets the scope to registry defaults. All values and the expected
revision are checked before application. A stale request changes nothing.

A scope holds presentation settings and references to at most 1,000 registered
instances in one document. It has no storage, timers, listeners, network channel,
application values, or action callbacks. Dispose each instance before its scope.
Do not claim that changing a scope in one browser has updated another application.
Cross-application defaults come from the shared source and its normal versioned
consumer release. Applications may pass a reviewed, typed configuration through
their existing configuration path; this API creates no new remote execution path.

## Adopt server-rendered markup without moving live fields

```html
<details class="ui-section ui-composition"
         data-ui-composition="control-group"
         data-ui-composition-revision="1"
         data-ui-composition-instance="app.history">
  <summary data-ui-composition-slot="header"><h3>History</h3></summary>
  <div class="ui-stack" data-ui-composition-slot="body">…existing content…</div>
</details>
```

```js
const handle = SharedUI.adoptComposition(element, {scope: layouts});
```

Adoption validates the exact native hierarchy and revision. It does not clone,
wrap, move or replace any live control. Existing variant attributes become local
pins. Pass `variant: null` to follow the scope explicitly. A root cannot have two
controllers. Existing typed token override markers require their full values and
reason; they are never silently cleared. Disposing an adopted controller leaves
the application's root and contents in place. The server-rendered native UI works
without JavaScript. This is not a general DOM repair or hydration framework.

## Studio and agents

The existing document schema accepts optional `compositionDefaults`. The existing
revision-checked command service supports `set-composition-defaults` and
`reset-composition-layout`. They use normal operation receipts, replay, snapshots,
undo and validation. No second writer was added. Old readers that do not support
this field reject it rather than silently discarding it; update the editor and
its renderer together.

The editor has a Shared layouts panel. It shows changed groups and local choices
before applying the draft. The instance inspector has Follow shared layout.
Saving this draft does not publish to applications. Publish/install/verified view
remain separate states. The UI states this boundary explicitly.

## Validation

`npm run check` runs the source tests and build. For browser acceptance:

```sh
npm install --prefix tools/browser --ignore-scripts
npx --prefix tools/browser playwright install --with-deps chromium webkit
npm run composition:browser
UI_TEST_BROWSER=webkit npm run composition:browser
```

The optional test dependency stays outside the consumer package. Browser checks
cover the real Studio editor/service, real keyed renderer, native forms, connected
markup adoption, both packs/themes, narrow and desktop views, keyboard toggles,
Undo, focused text, selection, pins/reset and zero node moves during layout edits.
Chromium/WebKit automation is not a real iPhone acceptance claim.

The library catalogue is not proof that every application has adopted this release.
Each applicable consumer still needs a verified source/bundle migration. Keep the
old input and save contracts in those apps. Never close the disclosure defect only
because the new shared component exists.
