# Live module appearance editing

## What this adds

An opted-in application can mount one native Appearance inspector for several registered controls. Typed controls and a CSS declaration editor update an owned stylesheet on the existing page. The preview has no network or persistence dependency and is coalesced to the next animation frame. The app's forms, inputs, selection, handlers and data model remain its own.

The first consumer is maintained in the private StaticRef repository: colour-dialog chrome and the visible canvas drag indicator. This repository contains only the reusable engine and generic synthetic examples.

The initial integration installs executable modules once. Thereafter the user changes registered values, saves a profile, imports a patch, compares the original, or undoes an edit without rebuilding the app. Adding new behavior, new structural markup, or a property not yet registered still requires source work. The browser/OS-owned popup of a native colour input is outside page CSS.

## Human workflow

1. Open **Appearance** in an opted-in app.
2. Select a control, then adjust a value or slider. Existing controls remain interactive.
3. Switch to another registered control in the same session.
4. **Show original / Show changes** compares with the initial application appearance.
5. **Save profile** persists the whole set. Previewing does not write application data.
6. **CSS declarations** accepts the registered variables for the selected module. **Source CSS** shows its source path and the app-owned excerpt.
7. **Export patch / Import patch** moves the profile as a small JSON file. Registry identity and revision must match before any value applies.
8. **Reset** removes a property override and uses the source value; **Reset module** removes that module's overrides. Undo/redo operate on the preview. A saved profile can be loaded explicitly.

The advanced editor is a deliberately bounded custom-property declaration editor. It does not accept arbitrary selectors, rule blocks, imports, URLs, scripts, expressions or undeclared properties. Source CSS is inspectable, while supported declarations are editable. This is not an arbitrary CSS parser.

## Existing Studio integration

The same inspector is served at **/appearance.html** by the existing Studio server and linked from its document editor. It reads explicitly registered appearance views; this does not establish a connection to a remote running application.

Appearance documents use the existing document store, expected revisions, operation IDs, full-state validation, saved versions, comparison and latest-change undo. A single set-appearance command updates multiple modules atomically. No second private store or publication API is introduced. Existing native composition documents still use their original inspector.

The **/appearance-demo.html** route is a generic live example on the same Studio server. It uses local browser profiles so no write-enabled service is required for the demonstration. Its sample forms/colours are synthetic. The visible **Run style checks** button prepares DOM identity, selection, disclosure, native form submission, two-module editing and undo/redo checks; a pass applies only to that browser and sample. It does not certify real consumer behavior or native IME.

## Browser integration

The optional source dependency closure is:

- schema.mjs: bounded module registrations, declaration validation and compilation.
- controller.mjs: native-DOM-preserving preview, frame coalescing, comparison and undo/redo.
- editor.mjs: one native human inspector.
- persistence.mjs: portable patches and IndexedDB profiles.
- editor.css: optional editor layout using shared native controls and palette tokens.

Mount it in an owned inline section or a native modeless dialog. The caller owns that host. Closing a host need not dispose the active profile; call dispose when its owning view is actually released. There is no second draggable-panel implementation. The existing shared floating panel can own this host after its separate integration.

~~~js
import {mountAppearanceEditor} from '/shared-ui/appearance/editor.mjs';
import {createLocalAppearancePersistence} from '/shared-ui/appearance/persistence.mjs';

const editor = mountAppearanceEditor({
  host: document.getElementById('appearanceHost'),
  registry, // reviewed registration from this application's source
  persistence: createLocalAppearancePersistence({registry})
});
await editor.ready;
// Retain this instance while closing/reopening its host.
~~~

The editor creates no application DOM. The stylesheet has no data-ui-baseline marker and does not replace the installed stylesheet. It never emits the broad ui:styles event for every slider value, so unrelated overview/media caches are not invalidated. All selector/property mappings come from the reviewed registration; imported patches carry values only.

### Registration and source ownership

A registry is versioned and contains stable module IDs, a reviewed selector, a source path/optional excerpt, and typed CSS variables. The private application owns this file. It is not a replacement for the six-app fixture owner manifest.

~~~json
{
  "schemaVersion": 1,
  "id": "sample-appearance",
  "revision": 1,
  "modules": [{
    "id": "sample.panel",
    "label": "Panel",
    "selector": "#samplePanel",
    "source": {"path": "web/panel.css"},
    "controls": [{
      "property": "--sample-panel-width",
      "label": "Width",
      "type": "length",
      "unit": "px",
      "min": 240,
      "max": 560,
      "default": "320px"
    }]
  }]
}
~~~

App CSS consumes those variables with its own defaults. An empty override profile adds no replacement values. Do not expose authored card colours, app content, authentication state, viewport scale or hit-test geometry as cosmetic variables. A layout dimension also consumed by an app model needs an explicit model/geometry adapter; it cannot be safely changed only in CSS.

### Save behavior

Local profiles use one IndexedDB read/write transaction. Two tabs saving the same revision cannot both overwrite it. An unavailable, corrupt or mismatched store reports an error and keeps the preview available for export; it does not report a save or silently replace the old profile. Cross-device sharing is explicit export/import in this slice.

The Studio persistence adapter takes the existing authenticated request function from its host. It never embeds, saves or forwards an editor credential in a patch. It retains the exact operation on an unknown outcome so an explicit retry can recover the original receipt. A revision conflict preserves the user's preview until they choose what to load/save.

## One-time optional installation

Run only in the integration owner's selected disposable source/review target, from the exact reviewed shared-ui checkout:

~~~sh
node scripts/install-appearance.mjs --target /absolute/selected-app/staticref/web/shared-ui/appearance --source-revision FULL_SHARED_SOURCE_SHA
node scripts/install-appearance.mjs --target /absolute/selected-app/staticref/web/shared-ui/appearance --source-revision FULL_SHARED_SOURCE_SHA --check
~~~

The installer checks the actual Git HEAD and each pinned source blob, copies only the five known optional assets, and writes appearance-bundle.json last with their SHA-256 hashes. It does not build or replace styles.css, runtime.js, icons.svg or manifest.json. It rejects symbolic directories/files and an incorrect source revision.

This is a separate optional code artifact. Existing fixture four-file health alone does not describe it. The integration owner must retain its exact source SHA, optional five-file hashes, app registry/CSS/source SHA and activation state in the private acceptance evidence. If new files are copied into a clean-source review checkout, capture them in the disposable integration source/artifact identity before acceptance. Do not label modified source as the old clean fixture commit. Do not relax the managed launcher's existing isolation/provenance gates to make a new adapter run.

Changing executable modules later is an explicit installation/reload. Editing profile values afterwards does not run this installer, build source or republish global CSS.

## Acceptance and remaining boundaries

Source validation runs through the repository's existing pull-request checks. The first real application acceptance belongs to the existing local Codex integration owner. No new executor, launcher, transport listener or global CSS update channel is part of this feature.

At the final exact source:

- Run the source tests and build gate. The main stylesheet/runtime remain unchanged; source size checks still apply.
- Install the optional closure in the selected isolated app integration target and verify its hashes.
- In a visible headed Mac browser, open the real registered modules, type/select text, open the colour dialog and edit two appearance modules in one session.
- Confirm slider input produces coalesced style writes and no network calls, app save calls, DOM replacement or broad overview invalidations. Record measured timings; no millisecond promise is established by source inspection.
- Confirm old native inputs/forms/dialogs retain identity and selection; check genuine macOS IME, pointer dragging, keyboard zoom, canvas selection, gallery/lightbox and media state separately.
- Save, reload the app, verify restoration, export/import a patch, reject a wrong registry revision, and provoke a stale-tab save conflict.
- Repeatedly open/close/switch modules, inspect listener/style cleanup when the owning view closes, and test light/dark, both packs, 390px width and 200% browser zoom.
- Retain private evidence before scratch cleanup. Leave the managed fixture available for the user's hands-on review until their manual stop.

The actual compact Canvas header is owned by the existing local Codex work. The live-style adapter changes its declared visible indicator and panel appearance only; it does not rewrite Canvas geometry or certify that separate fix. The native colour picker remains native in the first consumer slice. A custom reusable picker would need its own reviewed one-time behavioral implementation.

No default branch merge, deployment, release, production configuration change, app-data migration or global style publication is authorized by a source-ready draft.
