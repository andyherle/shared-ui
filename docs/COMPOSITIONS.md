# Canonical native compositions — review-workspace@1

**Status:** Source-only contract proposed in coordinator PR; **not** an
installed consumer release, local Studio publication or fleet acceptance.
Previous shared-ui PRs for one-time page width and the offline fixture index
remain separate and unmerged. This contract is additive to their tokens and
manifest schema.

## Why a canonical composition

Colors and individual controls do not prevent six applications from
copying toolbar, form, inspector and review-panel markup and slowly drifting.
`review-workspace@1` is the first versioned reusable **structure plus
interaction layout**. It assembles existing SharedUI controls into one
discoverable set of stable named slots, supported variants, responsive
crowding and explicit overrides. The shared source controls these contracts;
the application owns business data and handler logic. Source CSS and
runtime helpers update centrally with normal versioned consumer installs,
not by copying app overrides six times.

The existing Studio registry exposes a `review-workspace` authorable component
with the **same identity, slot names and typed tokens**. Studio documents
retain immutable node IDs, revision-checked commands, private version
snapshots and node-scoped overrides. Studio's keyed renderer now provides
a native composition preview; it does not execute app bindings or claim
the local draft has been propagated into an application. The private
Studio configuration/mirroring system is intentionally unchanged.

## Stable DOM and slots

The composer creates a native `article.ui-card.ui-composition`:

```html
<article class="ui-card ui-composition"
         data-ui-composition="review-workspace"
         data-ui-composition-revision="1"
         data-ui-variant="standard"
         data-ui-crowding="wrap">
  <div class="ui-composition-layout">
    <header data-ui-composition-slot="header">…</header>
    <div class="ui-composition-toolbar ui-toolbar" data-ui-composition-slot="toolbar">…</div>
    <div data-ui-composition-slot="filters">…</div>
    <div class="ui-composition-main">
      <section data-ui-composition-slot="body">… real form or live content …</section>
      <aside data-ui-composition-slot="aside">… nested controls or another composition …</aside>
    </div>
    <footer data-ui-composition-slot="footer">… navigation / native submit …</footer>
  </div>
</article>
```

`header` and `body` are required; `toolbar`, `filters`, `aside`,
and `footer` are optional. The native root, revision, slot names,
root-to-frame hierarchy and optional-slot cardinalities are the audit
contract. The composer omits unused optional nodes; the Studio editor
retains stable empty hosts but marks them `hidden` until populated. The
layout ignores hidden asides. Nested compositions use their own
`container-type:inline-size`, so a 390px inspector cannot inherit a wide
parent's split decision.

**Do not invent another `.ui-card` or `.ui-toolbar` paint system.** Header
uses a native heading, toolbar uses `.ui-actions`, fields retain
`.ui-field`/native form ownership, body can use `.ui-section`,
`.ui-table-scroll`, notices and nested compositions. The complete
form remains **one native `form` inside the body**; a Save button in
the footer uses `form="my-form-id"` rather than nesting or forwarding
submit through a custom controller. App handlers, validation, undo/redo,
authorization and persistence are never implemented by this composition.

## Reuse without copying markup

The consumer's application creates its normal native controls and attaches
its existing listeners to those nodes. The shared factory creates only
the canonical shell around **detached** supplied nodes:

```js
const reviewForm = document.createElement('form');
reviewForm.id = 'review-42';
// Add the app's existing native fields and handlers to reviewForm.

const save = document.createElement('button');
save.type = 'submit';
save.setAttribute('form', reviewForm.id);
save.textContent = 'Save';

const panel = SharedUI.createComposition('review-workspace', {
  header: titleHeading,                   // native heading
  toolbar: nativeActions,                // .ui-actions with live callbacks
  filters: nativeFilterForm,             // optional independent native form
  body: reviewForm,
  aside: nativeInspector,                // can itself contain a composition
  footer: save
}, {
  instanceId: 'example-review-42',
  variant: 'standard',
  crowding: 'wrap'
});
mountPoint.append(panel.element);

// No slot moves, cloning, replacement or input reset:
panel.setLayout({variant: 'split', crowding: 'scroll'});

// Reviewed exception: typed, discoverable and reasoned.
panel.setLayout({overrides: {
  aside: '22rem',
  reason: 'Long inspector controls require wider line lengths'
}});
const configuration = panel.getConfiguration();
panel.dispose(); // Explicit view unmount, no shared global cleanup.
```

This function accepts native elements or arrays of elements only. It rejects
unknown variants/slots, duplicate elements, different DOM documents, already
connected elements and overlapping nested slot roots. It does not evaluate
strings or HTML and does not attach listeners, observers, fetches, timers,
global state or background refresh loops. Slot elements are appended **once**.
`setLayout` only updates supported attributes and tokens, retaining the
same event handlers, selection, composing input, native focus, values and
open disclosures. Use stable `instanceId` when the app has a stable
view identity; it is not a request for a database identifier.

For existing mounted application UI, retain the app markup/handlers until a
reviewed migration can construct the composition at view creation. Do not
disconnect a focused form and silently reparent it during rendering to
achieve adoption.

## Variants and crowding

| Setting | Values | Behavior |
| --- | --- | --- |
| `variant` | `standard`, `split`, `stack` | Standard splits body/aside at 48rem **composition container** width; split enables it earlier at 36rem; stack never splits. Missing/hidden aside cannot steal a column. All variants stack on narrow hosts. |
| `crowding` | `wrap`, `scroll`, `priority` | Wrap uses the existing shared adaptive button rows. Scroll uses accessible horizontal overflow for the toolbar's `.ui-actions`; no action becomes unreachable or moves into hidden markup. Priority uses the existing native `details.ui-overflow` markup and SharedUI action fitting, not a new overflow controller. |
| `--ui-composition-gap` | 12px default (both packs) | Controls canonical vertical/grid rhythm; a typed Studio length token. |
| `--ui-composition-aside` | 18rem default (both packs) | Controls inspector track, which never repeats the outer 70% page constraint. |

Layout is centrally editable through the two shared tokens and the
registered variants. Per-instance runtime overrides are intentionally
restricted to `gap` and `aside`, with unit/range validation and a mandatory
4–200-character reason. A nonempty override sets
`data-ui-composition-overrides="gap,aside"` (keys only) and stores the reason
in `getConfiguration().overrides.reason`; business/private reasons are
not written to the public catalogue or structural audit. Studio's
`set-token` for an authored workspace likewise requires an explicit
`overrideReason` prop (set the reason **first**, then token). Studio's
existing diff/version inspector is the review surface for the edit.

**An override is not a fork.** When a shared default, focus behavior, theme,
density or responsive rule changes, the composition inherits it except
for the two declared override values. App-specific placement and genuine
full-world canvas geometry remain in its `@layer app`. Never apply
`--ui-page-width:70%` again inside this component; use the independent
page-width PR #2 once on the app's outer content host.

## Drift detection and limitations

`src/studio/registry.mjs` declares native tags, slot cardinalities,
required revision/variant/crowding attributes and permitted override markers.
The existing opt-in `collectSchemaSnapshot` / `auditSchemaSnapshot` can
check them without exporting source text, URLs, form values or HTML. Findings
are warnings; no production interface is killed for a noncanonical state.
Consumer fixtures can capture and compare the exact composition revision
and declared variant at each critical route. Missing structural checks or
a reasoned exception become reviewable PR feedback. Audit **does not**
yet prove computed pixels, source-owner provenance, visual fidelity,
accessibility tree, runtime state or private app installation; those require
separate fixture/browser evidence. Future canonical compositions should extend
this same registry/API, not introduce another ad hoc control language.

## Local clickable review before consumer migration

From the isolated shared-ui **composition PR checkout**, with Node 22+:

```sh
npm run check
npm run studio:mcp:check
npm run dev
```

Open [local synthetic composition lab](http://127.0.0.1:41910/#compositions),
or direct scenarios:

- `http://127.0.0.1:41910/?compositionWidth=390&compositionState=unicode&compositionVariant=split#compositions`
- `http://127.0.0.1:41910/?compositionWidth=260&compositionState=long&compositionCrowding=scroll#compositions`
- `http://127.0.0.1:41910/?compositionWidth=full&compositionState=many&compositionVariant=standard#compositions`

It mounts the **real native factory**, two nested canonical instances,
real native input, footer-owned submit, actions, disclosure, table, mock
retry/conflict/status logic and a visible override readout. Every fixture
is synthetic and local; no backend, client data or application process is
used. Changing layout and width must preserve typed unsaved text, selection,
focus, native IME and open state. The source build/Node tests do **not**
establish browser acceptance; open and interact in real browsers.

Test both packs/light/dark/density, width 260/390/480/960/full host,
keyboard/coarse pointer/IME, many rows, priority overflow, native form
submission, 503 retry/409 conflict, focus/scroll and two open views.
Measure resulting stylesheet **raw and gzip** sizes, runtime bundle growth,
DOM node stability and reflow/interaction timing. This PR permits up to
36 KiB raw **and 8 KiB gzip** (rather than the old 32 KiB raw) so a real
shared composition can replace duplicated private app CSS. It still
forbids external CSS imports and unbounded growth. Record actual
measurements in the PR's validation receipts; the larger allowance
is not itself a performance claim.

## Fleet acceptance criteria

Require at least two **different** app-owned real-template fixture suites
to instantiate the same `review-workspace@1` composition (not copy its
markup/CSS) and demonstrate nested responsive content, live form editing,
crowding mode, stated overrides and audit drift warnings. Then expand
to all suitable surfaces across the six owners, reporting explicit
exceptions for actual canvas/renderer worlds. Route-level fixture
manifests must link real app templates, synthetic adapters and actual
observed runs at 390px, narrow embed, desktop and full view. App agents
continue in their own repos; no live application changes, private-source
imports into public shared-ui, merge, deployment or global publish are
authorized by this document.
