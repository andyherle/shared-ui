# Shared floating review panel — isolated source candidate

**Owner/source:** [Shared UI draft PR #6](https://github.com/andyherle/shared-ui/pull/6),
branch `feat/shared-floating-review-panel-20261016` stacked on frozen coordinator PR #5
(`91b7c629b0aaceaf3f00c68197d81342aeab0a98`). This is one reusable
shared component, not a StaticRef/Canvas rewrite, browser runner, fixture
manager or new source of live application state. No release or installation.

The user-described image could not be downloaded, so this work uses the actual
StaticRef fixture bar source, `tests/browser/ui-fixture-adapter.js`. Its
`#staticref-ui-fixture-panel` is an existing fixed top-left aside with native
links, Reset/Retry buttons and expandable fixture links; the fixed positioning
can obscure the real application header. No screenshot pixels were inspected.

## Shared implementation and observable behavior

`src/floating-panel.js` provides `SharedUI.createFloatingPanel(existingPanel,
{label,placement,margin,provenance})`. It is appended to built SharedUI
`runtime.js` via `scripts/build.mjs`; the SAME shared helper can also augment
an independently verified installed-baseline runtime in a local fixture.
Loading the factory twice is idempotent. No app-specific copy, no
reimplementation of existing handlers. The single bounded floating CSS
source block is also extracted **from the same shared file**, by
`scripts/build.mjs:floatingPanelFixtureCSS`, into the optional
`public/v1/floating-panel.fixture.css` file. It supplies floating
chrome styles to an **installed baseline fixture** without changing
that baseline's original complete four-file v1.10.2 bundle. The helper
CSS file and `src/floating-panel.js` are **additional, separately pinned,
fixture-only companions**, never replacements for pinned
`styles.css/runtime.js/icons.svg/manifest.json`; this change does not
add a fifth entry to the canonical bundle digest. Build source output
records `floatingFixtureCssSha256` and `floatingHelperSha256` for
the reviewed commit. The local Style Lab server only exposes the
exact CSS companion via its explicit allowlist.

`src/controls.css` supplies the only `ui-floating-*` paint, both Postvisual
and Personal packs. The stable role `floating-panel` and placements
`bottom-right|bottom-left|top-right|top-left` are registered in the existing
Studio catalogue. Actual shared Style Lab `src/fixture.html#floating-review`
uses the factory with the **original native** input, button and nested
Details, which are never reparented/replaced when the shared header is added.

By default the compact panel sits in the **bottom-right visible viewport**,
avoiding the page header. Its *separate button drag handle* uses mouse/stylus
and touch Pointer Events with `setPointerCapture` and `touch-action:none`
only on that handle, not on interactive children. Pointer cancel/lost-capture
and subsequent form input remain safe. Keyboard users focus the Move handle:
arrows move 16 CSS px, Shift+arrows 48 CSS px, Home restores the
selected corner. The visible Reset position button works by keyboard, too.
The root is constrained to the **visual viewport**, including offset
when pinching/scrolling, through window resize, VisualViewport scroll/resize,
orientation change and ResizeObserver of panel content. Max width/height
are clamped to visible space; longer native details scroll within it.
No global keyboard interception, app input movement or browser storage.

## Always-visible truthful human provenance

Even if all tool disclosures are closed, the generated compact header keeps:
a clearly named app/panel; `Installed baseline · code-equivalent only`
or `Local candidate shared-ui`; deployment state; and short app/UI
version or eight-character Git SHA references. If unknown, it explicitly
says unverified. Baseline local fixture status reads
**Local fixture · NOT live production**. Candidate local fixture status
reads **Local fixture · NOT deployed**. The expandable native
`Versions & provenance` provides complete source SHAs and stylesheet
revision. Strings use `textContent`, not injected HTML. Candidate
deployment cannot be declared 'deployed'.

The shared `setProvenance` accepts only:
`appName`, `appVersion`, `appSha` (full 40hex Git SHA),
`uiVersion`, `uiSha` (full 40hex source Git SHA),
`cssRevision` (64hex stylesheet SHA256), `variant`
(`installed|baseline|candidate|unverified|saved:<id>`), and
`deploymentState` (`not-deployed|unverified|deployed`).
Never confuse CSS asset SHA256 with shared-ui source Git SHA. A local
source-unpinned bar must show **unverified**, not assume it is baseline/live.

## Small StaticRef consumer seam — CODEX OWNS APPLICATION ADOPTION

Codex task `01a1479d-409e-71e2-a876-2f9eb8a5d03f` owns actual
StaticRef/shared-ui source and Mac runtime integration. PR #6 DOES NOT
edit its working tree or PR #32, and it does not touch production Canvas,
mosaic, lightbox, dialog or original fixture backend.

Only in a Codex-owned disposable fixture integration:

1. Preserve the **same** `#staticref-ui-fixture-panel`, native
   `<details>`, links, Reset/Retry buttons, and candidate controls.
   Remove only obsolete inline top-left geometry in the fixture adapter.
   Load the **one reviewed shared** `src/floating-panel.js` after
   the selected SharedUI runtime. For the original 1.10.2 baseline, also
   load the companion stylesheet `v1/floating-panel.fixture.css`
   **after** the unchanged installed baseline stylesheet in the
   **disposable fixture response only**; both helper JS and companion CSS
   are independently SHA-pinned from this reviewed PR #6 source.
   A newly rebuilt candidate runtime/styles bundle already contains
   the same shared code/CSS, so do not load a second copy there.
   Keep both companions separate from the *canonical selected quartet*,
   and never install them into tracked v1.10.2 assets or switch them
   through browser URL/query parameters.
2. When that existing panel is attached to `document.body`,
   invoke:

~~~js
const panel = document.getElementById('staticref-ui-fixture-panel');
const floating = window.SharedUI.createFloatingPanel(panel, {
  label: 'StaticRef fixture review',
  provenance: {
    appName: 'StaticRef',
    variant: 'unverified',
    deploymentState: 'unverified'
  }
});
// The app's existing synthetic review-lock, not a SharedUI network API,
// supplies exact selected bundle identity:
const response = await fetch('/__fixture__/review-lock.json', {
  cache: 'no-store', credentials: 'same-origin', redirect: 'error'
});
if (response.ok) {
  const lock = await response.json();
  if (lock.protocol === 'shared-ui-review-health-v1' &&
      lock.mockOnly === true && lock.productionWritesDisabled === true) {
    floating.setProvenance({
      appName: 'StaticRef',
      appSha: lock.appSha, uiSha: lock.uiSha,
      uiVersion: lock.ui_version,
      cssRevision: lock.stylesheet_sha256 || lock.files?.['styles.css'],
      variant: lock.variant,
      deploymentState: 'not-deployed'
    });
  }
}
// Invalid/unpinned health: keep 'unverified' labels.
~~~

No app-specific floating CSS or markup clone. The app's existing
managed launcher must independently validate complete hashes and
clean Git source; a UI label is **not** OS/isolation/authentication proof.

**Important digest boundary:** If PR #6 is incorporated into an exact
new `review-workspace@1` PR #4 candidate, both the bundled
`runtime.js` and `styles.css` bytes change. The Codex-reported
**older candidate quartet** aggregate
`5b841b9c4de63cae2c09ed88e31ad470fa5d5725e2eaa6ad6b818f8e670e62ef`
is valid **only for those old bytes**. Rebuild/stage the new full
`styles.css/runtime.js/icons.svg/manifest.json` quartet, remeasure
all four SHA256s and the original compact sorted JSON aggregate,
repin the new UI source/app checkout, and keep installed
v1.10.2 assets unchanged. PR #6 does not change the canonical
`GET /__fixture__/review-lock.json` schema or release approval.

## Tests and acceptance

**Source tests:** `test/floating-panel.test.mjs` exercises real
source factory/formatters with a deterministic native DOM event model:
pointer/touch capture, cancellation, interactive descendants, keyboard
arrows/Shift/Home, reset, visual viewport offsets/pinch/scroll/resize,
content growth, dispose and original input/button node identity, and
truthful baseline-versus-candidate labels. Existing Studio and release
source CI must also pass.

**Real browser test SOURCE prepared but NOT executed here:**
`test/floating-panel.browser.mjs` uses a separately approved same-origin
Style Lab at `127.0.0.1:41910`, checks actual Chromium DOM/input/focus,
pointer/keyboard/touch/clamping and provenance at
1440/768/390/280px. User now permits **HEADLESS Chrome** automation;
`--headed` remains an option. No browser/server/executor has been
started in this web source turn:

~~~sh
# LATER, in an authorized isolated Mac source checkout; NOT run here.
npm run dev  # starts real Style Lab only in the user's later session
SHARED_UI_FLOATING_ORIGIN=http://127.0.0.1:41910 \
  node test/floating-panel.browser.mjs
# Optional visible Chrome testing:
SHARED_UI_FLOATING_ORIGIN=http://127.0.0.1:41910 \
  node test/floating-panel.browser.mjs --headed
~~~

The historical **32KiB raw CSS** target was optional; this one
reusable shared panel has an explicit **40KiB hard upper bound** in
`scripts/build.mjs` and `test/release.test.mjs`. The exact raw/gzip
measurements belong to this draft's successful CI run, not an estimate.
Any later performance decision should use measured bytes.

Safari is preserved for the user's hands-on cross-browser review.
Genuine native macOS IME, Canvas/gallery/lightbox A→B→C parity,
intended PR #31 heading approval, exact artifact retention before
managed cleanup, manual stop, independent OS isolation and separately
authorized rollback/release remain mandatory. No production merge,
publication, deployment, app rewrite or Safari interference.
