# Shared UI

**Consistency is the first design priority.** The same component uses the same padding, text sizing, spacing and positional order everywhere. Each semantic role has one shared definition at a given density. Improve the shared owner and catalogue before adopting it in an app; do not create local exceptions for visual novelty or convenience.

One native HTML control language for Aura, StaticRef and Portal. Personal mirrors Postvisual, with explicit overrides available through Studio. Theme, control density and application layout are separate choices.

The package has no runtime dependencies. Shared CSS is bounded to 36 KiB raw and 8 KiB gzip, including the shared floating review panel. Build and source validation use Node's standard library:

```sh
npm run check
```

## Integration

Serve `public/v1/styles.css` and `runtime.js` with the application's own assets. Mark the human-facing document `<html data-ui="postvisual">` or `<html data-ui="personal">`. Put application styles in `@layer app`. Use `data-ui-density="compact"`, `dense`, or `comfortable` on the document root or a control group. Compact desktop controls use 30 px buttons and fields with 6 px gaps. Dense controls use 24 px buttons, 26 px fields and 4 px gaps. Coarse pointers retain 44 px targets and 16 px native field text. Effects, images, video and output-only renderer documents keep their own rendering.

Use native `button`, `input`, `select`, `textarea`, `details` and `dialog`. Actions use the standard outlined control. `data-ui-variant="primary"` emphasizes the main action and `danger` identifies destructive actions. Common controls have one paint definition; app CSS supplies layout only. `.ui-toolbar`, `.ui-menu`, `.ui-menu-panel`, `.ui-panel`, `.ui-section-title` and `.ui-prose` express reusable roles. Headings H1–H6 are defined independently of control density.

Layout CSS may position and size application-specific media, timelines, canvases and rows. Common control paint belongs here. Use semantic `--ui-*` variables instead of page-specific palettes. Content colors such as a user's color parameter or collaborator identity remain content data.

## Control/config panels

Use `<aside class="ui-control-panel" data-ui-density="compact">` on an existing control surface. Compact starts at 12 px text and 30 px controls. `SharedUI.createControlScale(panel, {fontSize:12})` retains the existing absolute size API: `setFontSize(number)`, `refresh()` and `dispose()`. For a per-app **default zoom-like scale**, use `SharedUI.createControlScale(panel, {scale:0.83})`, or put `data-ui-control-scale="0.83"` on the panel or an ancestor and call `createControlScale(panel)`. A ratio of 0.83 makes controls roughly two browser zoom-out steps more compact without scaling the canvas or page. `setScale(number)` updates the ratio, and `setFontSize(number)` switches back to absolute sizing; passing both options throws. Ratios recalculate against each density's original control size, so `micro` and `compact` keep their own proportions. Any positive finite size or ratio scales native controls, labels, icons, switches and spacing without transforms, DOM replacement or compounding. Coarse pointers retain 44 px targets and at least 16 px field text. CSS refresh and pointer changes recalculate the baseline; hidden views defer work. Disposal restores prior inline tokens and releases listeners. Applications own persistence and should keep the scale setting outside the scaled panel.

`micro` remains an optional precision-desktop profile: 12 px control minimum, 10 px text/icons and 2 px group gaps. Native fields, longer labels and multiline editors may grow; nothing clips text to force a row height.

The role supplies operational typography; it does not replace the effects inspector. Compose the same `.ui-effects-inspector`, `SharedUI.adoptPropertyRow`, native choice, colour and boolean controls, scrub fields, keyframe actions and expression editors used at larger densities. The name → Keyframe → FX → value order, aligned columns, reset gestures, focus, selected states and keyboard behavior are unchanged. Omit nested density attributes so all fields and actions inherit one profile.

```html
<aside id="controls" class="ui-effects-inspector ui-panel ui-pad ui-stack ui-control-panel"
       data-ui-density="compact" aria-label="Transform"></aside>
<script>
const panel = document.getElementById('controls');
const row = document.createElement('div');
const visible = SharedUI.createBooleanControl({label:'Visible', value:true, variant:'controller'});
panel.append(row);
SharedUI.adoptPropertyRow(row, {name:'Visible', control:visible.element});
// Existing app callbacks still own values, History and saving.
</script>
```

Use `details.ui-section` for deeper controls and `.ui-popout` for a bounded inspector. Do not scale the DOM with transforms or CSS zoom. Remove old panel/row padding, heading heights and field sizing when adopting this role; keep only app placement and domain row geometry in `@layer app`. The **Compact controller** catalogue uses the exact same component builder as **Shared effects inspector**. Its density and font-size settings change tokens on the existing nodes, retaining values, keyframes and open expression drafts.

For lightboxes, compose `.ui-control-panel` with `.ui-review-dock` and `createReviewControls` using the existing native tags, rating, commands and navigation. The app still owns values, navigation, History and saving.

## Automatic updates

Successful pushes to `main` build and publish a v1 manifest and an immutable, integrity-addressed stylesheet through GitHub Pages. Apps retain their bundled baseline and check for compatible style updates in the background every five minutes while visible. Same-origin views coordinate checks with a short storage lease and BroadcastChannel notifications. The browser's shared asset cache handles the stylesheet bytes.

Mark only the bundled UI sheet with `data-ui-baseline` on its `link` or `style` element. An update becomes active only after the replacement stylesheet loads and its integrity check passes; it then removes that marked sheet so deleted rules disappear. Keep app layout in a separate unmarked sheet. A failed fetch or offline session retains the working appearance. Releases older than the bundled runtime contract are rejected even if the page omits its version attribute; a newer declared page version raises that floor. Style refresh never rebuilds the page or changes playback, forms, focus, selection, renderer identity or application state. Hidden pages stop checking; closing a page cleans up its listeners and channel. Browser behavior code stays bundled with each app and is upgraded through its normal code release.

Allow `https://andyherle.github.io` in `style-src` and `connect-src` when using automatic updates. Keep scripts same-origin. No app credentials or user content are sent to the style source; update requests omit credentials and referrers. Use a bundled revision when a deployment must remain visually frozen. A major control-contract change requires a new version channel and an application migration.

## Style Lab

The catalogue demonstrates working controls rather than a sheet of static mockups: buttons and busy states; native fields and validation; selects, suggestions, searchable choices and tags; menus, tabs and disclosures; dialogs, drawers, popovers, tooltips and feedback; tables, selection and pagination; draggable Canvas cards and inspectors; timeline scrubbing and easing; images, audio, video, ratings and lightboxes; H1–H6 and Markdown-shaped content; a shared SVG icon sprite.

Choose Postvisual or Personal, light or dark, and density in the header. Appearance choices belong to that browser tab, so different viewers can compare packs independently. The lab uses one live event stream per origin when Web Locks is available, and shares style releases across views. Hidden pages relinquish the stream, pause sample media and stop the sample playback loop. Standard browser media controls retain platform behavior.

The stylesheet styles rendered Markdown HTML; it does not parse Markdown. Keep each app's existing Markdown parser and wrap its output in `.ui-prose` or `.markdown`.

### Local macOS host

Keep the editable repository in your dev folder as `shared-ui`. These commands run from that directory:

```sh
./style-lab start       # Install/start the dedicated background host
./style-lab status
./style-lab refresh     # Build dev source and apply it to the running host
./style-lab watch       # Live refresh while editing src; Ctrl-C ends the watcher
./style-lab restart    # Apply server-code changes
./style-lab stop
./style-lab uninstall  # Remove this service; retain source and logs
```

macOS background services run from a derived deployment in `~/Library/Application Support/Background Services/Shared UI Style Lab/site`. The dev repository is the editable source of truth. `refresh`, `watch` and `restart` copy builds in one direction. The generated deployment is not a second source to edit. Logs live beside it as `server.log` and `error.log`. The service starts when you log in and restarts after an unexpected exit. Its loopback port is 41910; the Mac must be awake and online for the tailnet link to work.

The tailnet route is configured separately:

```sh
tailscale serve --bg --https=10000 --yes http://127.0.0.1:41910
```

Open **https://<your-device>.<your-tailnet>.ts.net:10000/**. Tailscale Serve requires tailnet access. Existing routes are independent. To remove only this route: `tailscale serve --https=10000 off`.

The header's **Refresh CSS** button applies a build in place. Source edits made in the dev repository reach the host through `watch` or the CLI `refresh` command. HTML/JS changes show **Reload interface**, which intentionally reloads the page only when clicked. CSS and layout refresh preserve control state. A failed build keeps the previous working release.

For a foreground preview on macOS or other platforms, use `npm start`. It binds only to 127.0.0.1 and watches src directly. Stop the managed service first if using the same port, or set `SHARED_UI_PORT=41911` for the foreground preview.

## Published source

The public source is `https://github.com/andyherle/shared-ui`. GitHub Pages publishes the catalogue at `https://andyherle.github.io/shared-ui/` and the automatic stylesheet channel at `https://andyherle.github.io/shared-ui/v1/manifest.json`.

For a standalone page, CSS alone is sufficient:

```html
<html lang="en" data-ui="postvisual" data-theme="dark">
<link rel="stylesheet" href="https://andyherle.github.io/shared-ui/v1/styles.css">
<button data-ui-variant="primary">Save</button>
<article class="ui-prose"><h1>Title</h1><p>Content</p></article>
```

For an application, bundle a baseline and `public/v1/runtime.js` with its own assets to enable compatible CSS updates. Add the baseline revision as `data-ui-revision` to avoid loading the same CSS twice. Place the UI CSS after layout CSS, or put all application CSS in the app cascade layer. Unlayered legacy declarations win over layered rules, so adopting the source contract requires removing competing page-level control styles. A single additional stylesheet cannot remove drift from existing unlayered CSS by itself.

Aura and StaticRef use Postvisual; Portal uses Personal. Their layout and domain behavior remain in their own repositories. They receive validated generated baseline assets from this source, rather than maintaining independent button or palette definitions. Studio Blanc is excluded.


## Responsive controls and state

`.ui-actions` aligns controls to the start and wraps them to the available container width. `.ui-toolbar` adds a shared command-bar surface. `.ui-fill` gives buttons and action links equal flexible space; disclosure controls keep their intrinsic width. `data-ui-layout="vertical"` stacks them with visible labels. For an intrinsic group beside other content, use `.ui-inline`; its width follows its content instead of establishing a size query, and its native children wrap when the group is constrained. Use `data-ui-layout="bar"` only for an intentionally scrolling single row. Composed-field captions truncate before they can force a selector outside its border; keep the full accessible name on the native field. Empty `.ui-status` regions occupy no space and reappear when feedback arrives. No per-page button breakpoint is needed. A bounded panel or grid cell can use `.ui-container` as the parent query host for intrinsic groups. Grid tracks that should shrink need `minmax(0,1fr)`; an `auto` track sizes to its content and must use `.ui-inline` for its action group. Size containment cannot derive its own width from descendants.

An action consists of a decorative `svg.ui-icon` and a `span.ui-label`, plus a complete accessible name. When expanded controls no longer fit, every eligible caption in the row gives way together, including primary actions and composed-field captions. Native selected values remain visible. `data-ui-label="always"` keeps that action readable while its neighbors compact; `hidden` identifies a deliberate symbol control such as a rating or zoom step. Narrow rows containing only actions distribute buttons evenly when each fits its share. Use `.ui-fill` for an explicitly equal row. Intrinsic nested groups share one fit decision; a horizontal parent does not hide labels in a nested vertical group. Native selectors retain their selected value. `.ui-search` grows horizontally within action rows; a standalone search field never grows into unused panel height. Coarse pointers retain 44 px targets and 16 px field text. Native date/time fields include the [iOS padding containment workaround](https://bugs.webkit.org/show_bug.cgi?id=301648), preserving native pickers.

Use `SharedUI.adoptAction(element, {icon, label, ariaLabel, iconOnly, title, sprite})` when creating a native action. It retains the element and its handlers, preserves existing ARIA and titles unless explicitly replaced, and uses the app's same-origin sprite. `SharedUI.setActionLabel(element, label, {ariaLabel})` changes a label without removing its icon. A scoped ResizeObserver watches registered action groups and their immediate row, with one queued fit per size change. It stops in hidden views and releases observers, listeners and queued work on disposal. There is no global DOM observer, polling loop, framework, or automatic DOM rebuilding. Dynamic adoption refreshes a group only when its action changes; call `SharedUI.observeActions(group)` after adding or removing controls and `SharedUI.refreshActions(document)` after other layout changes.

`details.ui-section` is the default for collapsing content below a heading: its native heading (normally `<h5>`) uses the default shared heading typography and spans its container, with one full-width line below the text and no button outline. Put it inside the component padding so the line shares its margins. Native open state, focus and keyboard behavior are retained. Use it for inspector groups, record sections and optional in-place details.

`details.ui-disclosure` and `.ui-disclosure-body` provide a button-triggered disclosure in an action row. The summary inherits the same action appearance and states, sizes to its caption, and never stretches across a row. Its only extra UI is the native disclosure indicator. Put Reply beside the other actions in their `.ui-actions` row; its `.ui-disclosure-body` opens below the row. Collapsing retains the same DOM, values and handlers. Use `fieldset.ui-group` with a `legend` to name a related set of controls; it adds no behavior or application state. `.ui-mono` or `data-ui-font="mono"` keeps code fields in the shared monospace font.

For a record detail or inspector, show ordinary facts in native `<section class="ui-stack">` blocks headed by `.ui-section-title`. Keep actions beside their subject in `.ui-actions`; a filename should open its exact document, and a source link should open the full original. Use a disclosure for optional controls or an individual row that opens for more context. Do not substitute a stack of disclosure buttons for the sections of one record, or put one read-only disclosure inside another. When many secondary facts belong together, use one Details control and plain headings inside its body. The catalogue's “Record detail” example demonstrates the visible hierarchy in both packs.

For repeated decision cards, use a native `article.ui-card.ui-pad.ui-stack`. Put common commands in a stable `.ui-actions` row aligned to the end: Reply, Details, Dismiss. Use `details.ui-disclosure` for Reply and Details; use the shared `arrow-left`, `info` and `close` icons with `data-ui-label="hidden"`, `data-ui-variant="quiet"` and accessible names. Keep this order and placement across plain, choice and approval cards. Variable answer controls live in their own `.ui-actions` form. Hosts may position the native summaries in their existing card header slots using domain geometry and semantic tokens; preserve the native disclosure, full-width reply body and focus. The Compact decisions catalogue compares the three card kinds.

`SharedUI.createSubmitGuard(form,{buttons,canSubmit})` keeps native submit buttons disabled until the form's enabled fields are valid and `canSubmit()` returns true. Mark default targets with `data-ui-submit` or pass `buttons`. For an optional choice, the application also checks that an answer was actually supplied; a placeholder is not an answer. The helper listens to input, change and native reset, blocks premature implicit submission, and leaves controls in their slots. Call `refresh()` after restoring a draft or changing app-owned pending/saved state; call `dispose()` when removing the form. It releases listeners and restores the original disabled flags. Native validation/submission remains the no-JavaScript fallback; do not server-render a permanently disabled submit button that needs JavaScript to unlock.

For a review card, put the decision form first. Keep a file link with a `.ui-truncate` label, full accessible name and `data-ui-label="always"` beside one native Details control in `.ui-actions.ui-fill`; the filename then truncates visibly instead of collapsing into a lone icon. Put secondary facts in that single disclosure body as headed content, never as a stack of narrow disclosure buttons. The file link opens the document, so a second Preview control is redundant. If there is no peer file link, use one `details.ui-disclosure[data-ui-layout="full"]` below the decisions; its summary spans the available width. For Previous/Next navigation, group those links in `.ui-actions.ui-inline` and put the position after the pair, outside the group. The catalogue's “Review a file” card demonstrates these patterns at narrow and desktop widths.

`--ui-range-thumb` fixes shared slider geometry for sibling timeline markers. `.ui-range` is the optional common track/thumb skin.

`aria-pressed` (including native `mixed` partial selection), `aria-selected`, `aria-invalid`, `aria-busy`, native `disabled` and `aria-disabled` express shared states. `.ui-status` and `.ui-notice` accept `data-state="pending|success|error|warning"`; empty status rows disappear. Notices add a quiet tint and colored border to the written feedback; success statuses show a check and pending statuses show a spinner. Personal inherits Postvisual's palette and typography; coarse pointers retain 16 px native field text, including borderless `.ui-inline-field` composition. Native menu summaries, buttons, button links, radio choices, and fields share focus and state definitions.

`.ui-field` composes a native input or select with icons, an inline `.ui-label`, or adjacent actions using one field border and focus indicator. Use it for selectors such as Zoom, with the label inside the field instead of a separate heading. A readonly URL input plus a Copy action keeps long links to one line while retaining native selection and keyboard copy. `.ui-truncate` keeps compact filenames to one line; retain the complete text in the accessible name/title. Apps must reuse these native DOM patterns and action helpers rather than inventing custom controls. Native `progress` uses the pack track and accent. Plain Markdown details retain native markers and body typography. `.ui-card` is a quiet surface; `.ui-panel` is a raised overlay. `.ui-item` keeps a structured clickable row's app layout with common control paint. `.ui-swatch` renders a data color inside the standard touch target. `.ui-graphic-action` preserves a native icon action’s physical target inside a scaled world without changing app placement. `.ui-resize-handle` separates the visual handle from its hit area. A transformed world can publish its positive zoom as `--ui-graphic-scale`; the shared hit area and visual handle stay the same physical size. Update that variable when zoom changes, using the existing viewport controller. Timeline markers use `--ui-playhead-color`, `--ui-playhead-outline` and `--ui-playhead-width` for theme contrast. Graphic controls retain app-layer touch gestures; resize handles use `touch-action:none`. Clipped rows can set `--ui-focus-offset` to a negative inset while retaining shared focus paint. Use `data-ui-surface="graphic"` for positioned interactive diagrams, `media` for preview buttons, and `.ui-inline-field` for in-place canvas text. In-place fields retain app-layer padding and resize geometry so a canvas card keeps its writing inset and its own handles. These explicit roles preserve domain geometry without creating new palettes or control implementations.

## One outer content width

`--ui-page-width` is a **single shared semantic setting**, set to `70%` in
both source packs and exposed through Studio's typed token inventory.
Applications control *where* this inherited setting applies. Per the cascade
ownership rule, the **application** owns page layout in `@layer app`, while
shared-ui owns tokens, control paint, states and interaction helpers.

Adopting applications should have one full-width content host (inside their
sidebar, chrome and navigation) and **exactly one direct page root**:

```html
<div data-ui-page-host>
  <main data-ui-page-root>
    <article class="ui-card ui-stack">Actual app components and handlers</article>
  </main>
</div>
```

Implement the same small *layout recipe* in the consuming app's `@layer app`:

```css
@layer app {
  [data-ui-page-host] { container-type:inline-size; inline-size:100%; min-inline-size:0; }
  [data-ui-page-host] > [data-ui-page-root] { inline-size:min(var(--ui-page-width),calc(100% - 32px),96rem); min-inline-size:0; margin-inline:auto; }
  @container (max-width:48rem) { [data-ui-page-host] > [data-ui-page-root] { inline-size:calc(100% - 32px); } }
  @media (max-width:48rem) { [data-ui-page-host] > [data-ui-page-root] { inline-size:calc(100% - 32px); } }
  [data-ui-page-root][data-ui-page-mode=full] { inline-size:calc(100% - 32px); }
}
```

This deliberately shares the **value**, not application structure. One-time
application layout placement prevents reapplying 70% to every child. Desktop
content is at most 70% of the host, with a 96rem bound and 16px minimum side
gutters. The container query makes a narrow app pane responsive even inside
a wide browser. The viewport fallback covers narrow screens where a named
host cannot be established. Nested cards, row grids, tables and inspectors
should use the space available within the root (`min-width:0`,
`minmax(0,1fr)` as needed) and should **not** mount another `data-ui-page-root`.
For a full workspace/canvas view, set `data-ui-page-mode="full"` on the
*outer* root rather than constraining the transformed world. The page-host
is a full-width block, not an action container; don't nest it into a panel
that already consumes a parent width.

`src/lab.css` contains the complete generic fixture using this app-layer
recipe; no application-specific page layout is pushed through shared
`src/controls.css`. As a result, the shared 36 KiB raw / 8 KiB gzip stylesheet cap stays
intact and existing consumers do not change until their own isolated PR
adopts the layout. Test 390px, 768px, full desktop, a 360px embedded pane,
coarse pointer, keyboard, zoom and state preservation before adopting.

## Live app previews from source

Double-click **App previews.command** in this source folder, or run:

```sh
npm run previews
```

This opens **App previews** at http://127.0.0.1:41911/previews and watches this
checkout's `src/`. The Style Lab header also has **App previews**. Choose Portal,
Aura, StaticRef, Ledger (PV or Personal), Postvisual Home, or Documents (PV or
Personal). Each button starts its app once and opens it; repeated clicks reuse it.
Portal signs into synthetic state automatically. Keep the terminal running;
Ctrl-C stops the launcher and its owned preview processes. Run the command again
to reopen an already running launcher. Use `SHARED_UI_PORT=41913 npm run previews`
if another service owns the default port; `npm run previews -- --no-open` skips
opening the system browser.

Shared CSS refreshes in place after a successful build, preserving text, focus,
open disclosures and playback. Failed builds retain the last working assets.
Shared JavaScript or icons offer **Reload shared UI** inside each app; save or
finish your current interaction before clicking it. No bundle reinstall or app
restart is needed for shared-ui edits. Hidden views catch up when shown again.

The preview launcher expects sibling source folders `portal`, `aura`, `staticref`,
`pv-ledger`, `postvisual-home`, and `vault-store`. Node, Go, Python 3.12+ (the local
venv or Homebrew Python on macOS), ffmpeg and each app's existing dependencies
must be installed. Missing dependencies report a startup error and local log
folder. All fixture state is synthetic. Aura uses a disposable Core copy and an
empty effects library, StaticRef uses generated media, Ledger uses demo books,
Home uses a sample inventory, and Documents uses sample files.

### What am I editing?

- `shared-ui/src/` owns the common controls. These previews load its current
  validated assets directly through a loopback source overlay.
- Each app's checkout owns its pages, handlers and domain layout. Opening a
  preview does not move that code into shared-ui. App code is loaded at launch;
  Portal embeds its app code, and Aura/StaticRef stage disposable source copies.
  Restart the launcher after app-code changes. Shared-ui changes stay live.
- Generated app bundles remain unchanged during previewing. Production still
  requires `npm run check`, the shared installer plus `--check`, and an app release
  to ship JavaScript/icons. Local edits do not publish the automatic CSS channel.

This foreground mode is separate from the installed background Style Lab and
from immutable brokered review runs. `npm start` still serves only Style Lab;
`npm run previews` enables the explicit local app-launching routes. Private app
source and fixture state stay outside shared-ui's generated/public output.

Preview routes require their exact loopback Host and same-origin writes. Fixture
upstreams must be loopback HTTP origins. Malformed requests and unavailable source
assets return errors without terminating the launcher. Event streams are capped
at 64; closing the launcher ends streams and waits for owned child cleanup.
Restarted fixtures receive fresh scratch directories. These are trusted local
development processes; the separately brokered review workflow supplies OS isolation.

## Packaging the baseline

Run from this repository to update an app's generated assets:

```sh
node scripts/install.mjs --target /path/to/app/shared-ui-assets
node scripts/install.mjs --target /path/to/app/shared-ui-assets --check
```

The installer validates the canonical release and browser code before writing exactly `styles.css`, `runtime.js`, `icons.svg`, `manifest.json`, and `bundle.json`. Identical bytes are left untouched. The bundle records every file hash; `--check` rejects generated drift. Deployment uses those local assets with no Node runtime requirement.

The baseline, debug, timeline and PDF installers share destination validation and
exclusive random staging. They reject linked output directories and linked or
non-regular asset entries, validate every destination before replacing any asset,
and stage all changed bytes before publication. `--check` creates nothing. Each
file replacement is atomic, with the manifest last; a multi-file release is not a
filesystem transaction. Run one writer per destination and verify with `--check`.
The build also syntax-checks every emitted script, including concatenated runtime
modules, before replacing working output. See [the tooling audit](docs/TOOLING_AUDIT.md)
for coverage and remaining boundaries.

Set `data-ui-version` and `data-ui-revision` from the bundled manifest. A page rejects automatic CSS older than its bundled contract, accepts compatible v1 releases, and keeps its working baseline on failure. Automatic updates carry CSS; helper code and icon additions ship through the normal app release and the same installer.

Native `.ui-menu` panels overlay their trigger and align inside the viewport by default; opening one does not stretch a toolbar. Use `ui-menu data-ui-position="overlay"` for a menu whose app layout already anchors its position. The pack preserves that geometry while owning its controls and paint. `ui-selectable` gives media buttons and composite cards the same selection outline. Native controls expose selection through their valid ARIA state; composite content can expose `data-ui-selected="true"` or `"mixed"` without changing its article semantics. The outline and focus target follow `--ui-graphic-scale` in a zoomable canvas.

## Compact workspace typography

### File preview cards

Compose a file card as a native `article.ui-card.ui-stack`, a
`button.ui-media-button` with a complete accessible preview name, and a
`div.ui-pad.ui-stack` caption. The preview contains an `aria-hidden` visual
(image, canvas, or a text excerpt); the caption uses a quiet native
`a.ui-action.ui-item` with the shared file icon and `.ui-label.ui-truncate`.
Keep Copy, Info and Download in a separate `.ui-actions.ui-inline` group so
there are no nested interactive elements. Use `SharedUI.adoptAction` for
these actions and preserve a direct file URL on the filename link.

The app owns card columns, preview aspect ratio, media fitting and row geometry.
Existing media, card, action and typography roles own all paint and states.
A list can use the same native actions beside a small preview. Tables inside
file viewers use a focusable `.ui-table-scroll` with an accessible name around
`table.ui-table[data-ui-variant=sheet]`, a caption and scoped column headers.
The Media catalogue demonstrates this composition with synthetic content.

Use `.ui-chrome` for operational panels and data tables, `.ui-section-title` for a compact panel heading, and `.ui-meta` for secondary text and paths. `.ui-value` is the shared numeric summary type. Full H1–H6 and `.ui-prose` remain document typography; do not use them to size a small storage label or table header. Density and palette remain independent, so Personal and Postvisual chrome have the same geometry at the same density.

`.ui-stack` owns vertical rhythm and clears child block margins. `.ui-pad` uses twice the shared gap as surface padding. Apply them to native cards and sections; keep domain grids and structured row placement in the app layer. `.ui-tabs` supplies start-aligned native tabs and the selected underline. For an icon-backed view navigation line, use `.ui-tabs.ui-actions[data-ui-layout="bar"]` and leave labels eligible for compaction; narrow icons then share the full row, while each link keeps its accessible name. `.ui-actions` / ordinary `.ui-toolbar` default to start alignment; `.ui-header` defaults to end alignment and reserves identity space at the start. Request `data-ui-align="center"` or `"end"` deliberately. `data-ui-variant="quiet"` keeps native actions and focus with a quiet resting surface, for list rows and filenames. Use `.ui-truncate` on the label for compact filenames and retain the full accessible name/title.

The catalogue's **Workspace scale and alignment** section demonstrates these roles in a reusable, data-free example.

Use native `label.ui-check` for checkbox and radio rows. It aligns the glyph and caption on one line and retains the shared control-height hit target, including coarse pointers.

Native labels retain application row placement. The shared pack does not force every label or its inputs into a vertical stack; use `.ui-field` for one composed field and `.ui-choice` for a native checkbox/radio row. App-layer flex/grid placement survives a compatible CSS refresh.


## Restored Postvisual controls

Postvisual uses StaticRef's pre-migration neutral palette and quiet, compact control geometry. The source reference is StaticRef `ec8e9ab` (`staticref/web/app.css` and `gallery-visual.css`); current application behavior remains in its own repository. Menu commands align to the start and use small readable captions rather than centered full-width button labels.

Use native `.ui-toolbar` with `data-ui-layout="joined"` for one continuous command surface. Compose its controls with `.ui-actions.ui-inline`, `.ui-field`, and `.ui-icon-button`; keep app CSS to command placement and domain sizing. The toolbar stays on one row; a constrained application's scrolling region keeps overflow commands reachable. Primary actions still use the normal primary state.

Native `details.ui-disclosure` inside `.ui-actions` keeps its summary on the command line in both states; its `.ui-disclosure-body` opens on a full row below the commands. Use `.ui-actions.ui-inline` on a native form that provides an adjacent submit action. Apply `.ui-stack` to cards and form bodies for explicit shared rhythm. Hidden icon actions keep their target width in `.ui-fill`; visible primary captions retain flexible room. `.ui-container` establishes a query host without replacing application-owned widths.


### Labelled native selector

The reusable selector is a native `label.ui-field` containing a `span.ui-label` and a native `select` with an accessible name. The caption and value share one border and focus indicator. Shared UI places the caption at the start and the selected value at the end, reserves the native picker indicator, and allows the field to shrink within its container. Applications supply options and placement; do not add select widths, padding, fonts, or border overrides. The Compact commands catalogue shows Gallery mode, including a long selected value for narrow containers.

```html
<label class="ui-field">
  <span class="ui-label">Gallery mode</span>
  <select aria-label="Gallery mode">
    <option>Browse</option><option>Rate</option><option>Review</option>
  </select>
</label>
```


## Adaptive groups and header bars

Use `.ui-toolbar.ui-header.ui-chrome` for a shared operational header: a compact full-width surface with a single bottom separator. Keep identity/status placement in the app layer; use `.ui-actions.ui-inline` for its command group. The trailing group gets a full row and its own caption fitting when the header narrows. Keep title and status together in an inline group. Ordinary toolbars keep their rounded surface.

A native priority group uses `details.ui-disclosure.ui-overflow`, an icon summary, and `.ui-actions.ui-disclosure-body`. Put less-used controls inside it. At initialization Shared UI flattens those controls into the row when they fit. It first compacts the row’s captions together, then collapses whole priority groups into a native expanding tile. `data-ui-priority="0"` collapses before `1`; `data-ui-label="always"` keeps its own caption visible. Intrinsic subgroups share the outer row’s priorities. Without JavaScript it remains a usable native disclosure. Normal wrapping is the final fallback when the essential controls alone cannot fit.

```html
<div class="ui-actions">
  <button class="ui-action" data-ui-variant="primary" aria-label="Save">
    <svg class="ui-icon" aria-hidden="true"><use href="/shared-ui/icons.svg#ui-save"/></svg>
    <span class="ui-label">Save</span>
  </button>
  <details class="ui-disclosure ui-overflow" data-ui-priority="0">
    <summary class="ui-action" data-ui-label="hidden" aria-label="More actions" title="More actions">
      <svg class="ui-icon" aria-hidden="true"><use href="/shared-ui/icons.svg#ui-more"/></svg>
      <span class="ui-label">More actions</span>
    </summary>
    <div class="ui-actions ui-disclosure-body">… native secondary controls …</div>
  </details>
</div>
```

For controls created by an app, `SharedUI.createOverflow(actions, {label, priority, sprite})` wraps the existing nodes once in that same native pattern. It returns the details element. Existing values, IDs, handlers, form ownership and accessible names stay intact; resize never reparents them. Use explicit priorities rather than guessing a control's importance. A user's open tile and focused control remain reachable through resizing. The expanded tile shows full captions for its secondary controls; Escape closes it and returns focus to its native summary. `SharedUI.disposeActions(document)` releases the group's shared lifecycle. The catalogue demonstrates the three stages and a search field inside a tall panel.

For the quiet label/value selector, apply `data-ui-variant="quiet"` to `label.ui-field` and use `strong.ui-label` for the caption. The native selected value sits at the end of the row, the picker remains native, and the shared focus indicator and invalid/disabled states still apply.

`.ui-value-control` aligns a native `.ui-range` input with a native numeric input: the range uses remaining row space and the exact value reserves twelve character widths. Use native labels or accessible names; values and precision remain application-owned.


## Authored card colors and placement

Use `SharedUI.setCardColor(card, hex)` on a native `.ui-card` to fill the whole
card with a user-authored six-digit color and choose readable foreground text.
Pass `null` to restore the saved UI theme. These colors are document content,
not a third application palette. Native color inputs and `.ui-swatch` actions
can edit that value. The Canvas catalogue demonstrates this in both packs.

While dragging, set `data-ui-dragging="true"`; remove it on release and set
`data-ui-placing="true"` for the shared placement animation. Clear placing on
`animationend` (and at the next gesture). Reduced motion disables the placement animation.
Dragging preserves exact card bounds with a subtle fade, and placement restores opacity.
Use a quiet native `button.ui-drag-handle[data-ui-variant=quiet]` above editable card
text, with a complete accessible name and `.ui-label.ui-sr-only`. Leave the grip
visually empty; do not add move arrows or decorative handle glyphs. Keep its
44 px physical hit area reachable, and preserve native keyboard focus and movement.
Applications own its placement and pointer/keyboard movement. Use
`data-ui-layout="column"` for square column surfaces and
`data-ui-variant="flat"` on their member cards for flush, square media.
Publish `--ui-graphic-scale` for physically sized controls and focus. `.ui-guide`
paints alignment guides; the app owns their positions and lengths.


## Component tokens and control fixture

Postvisual and Personal share every component type, subtype, native DOM pattern and interaction. Personal inherits Postvisual's semantic values; explicit mirror overrides provide intentional differences. `--ui-control-size`, `--ui-control-weight`, `--ui-control-inset`, and the density-scoped `--ui-control-font` govern commands, selector captions, values and checkbox rows together. Action rows stretch controls to the same line height. Fit measurements use expanded token geometry without temporarily changing the rendered row, so compact padding cannot create resize oscillation.

Use `label.ui-check.ui-field` for an inline caption and native checkbox in the same control surface as a selector. Operational menu commands and field rows use a shared SVG `.ui-icon` before `.ui-label`; include the icon on every row in that group. Put related choices in `fieldset.ui-group`; remove redundant helper prose.

Use `.ui-tags` for wrapping tags and `button.ui-tag` for a removable pill; a readonly tag uses `span.ui-tag`. `--ui-tag-height` and the semantic palette own its size and colors. Put the entry input inside a native `form.ui-field` or `label.ui-field` beside the pills. The entry sizes to its text using native `field-sizing`, retains a usable fallback width, and keeps the shared focus target.

`SharedUI.createTagInput(input, {options, excluded, onCommit})` adds pill suggestions to that existing input. Supply functions returning known and selected tag strings, and an application-owned commit callback. Enter and comma commit literal text; arrows plus Enter commit an explicitly selected suggestion; comma-separated paste commits once; Escape dismisses suggestions; Shift+Enter remains available to the application. The callback receives the captured text after the input clears. The returned `draw`, `hide`, `flush`, and `dispose` methods retain native input ownership and release listeners and suggestion nodes. Storage, autosave, deduplication and navigation stay with the application.

Use `data-ui-layout="bar"` on a native `.ui-actions` or `.ui-toolbar` for a single adaptive command line that scrolls after compaction if its essential controls still cannot fit. Keep symbol/value groups intrinsic with `.ui-inline`.

The **Control fixture** demonstrates the same markup in both packs: right-aligned headers; icon menus; selector and checkbox subtypes; long, disabled and readonly values; stable links; a media dock and keyboard tag suggestions; native task forms and disclosures; inline toggles and native capture submission; Canvas actions; pending actions; and long, Unicode and punctuated tags. Its phone, panel, desktop and fit presets exercise each group without application data.

## Aligned native forms and inline toggles

Use `.ui-grid` for content-independent panels and cards. It creates as many columns as fit, then wraps without a page breakpoint. `--ui-grid-min` sets the preferred minimum (14rem by default), and `--ui-grid-gap` sets spacing. Children may contain any native content; the grid and its items can shrink without horizontal overflow. Add `data-ui-grid="fill"` for tile galleries so a short final row leaves unused tracks instead of stretching one tile across the container. Use `.ui-split` for an aside and primary region: mark the primary child `data-ui-main`, in either DOM order. Its flex tracks wrap into full rows when they cannot both fit; `--ui-aside` and `--ui-main` set their preferred widths. Use `.ui-stack` inside a card, `.ui-actions` for commands, and `.ui-popout` when a panel needs a visible header and footer around scrolling content. The catalogue's Adaptive panel layout fixture shows mixed content at phone, panel and desktop widths.

Use `.ui-form` for a responsive field grid. It shares the grid sizing variables, with a 24rem minimum and twice the normal gap by default. Each direct native label occupies three shared subgrid tracks: caption, control, and optional description. Controls align at the top even beside multiline descriptions or taller native multi-selects. Put full-width placement in app CSS.

`label.ui-toggle.ui-action` is the inline two-state action subtype. Compose it with a decorative shared SVG, `.ui-label`, and a native `input[type=checkbox][role=switch]` at the end. Give the input an accessible name that remains available when captions compact. Name/value/checked/disabled retain native form behavior without JavaScript. The small trailing switch uses `--ui-switch-width`, `--ui-switch-height`, `--ui-switch-thumb` and `--ui-switch-inset`; it shares action font, padding, height, focus, pressed paint and group fitting. `.ui-switch` is the standalone larger switch subtype. Both packs expose both types with identical DOM and behavior.

Native `meter` and `progress` share the same track and fill. `.ui-skeleton` is the common content-loading surface. A single-input `.ui-field` grows only in a horizontal action row, so stacked forms retain control height. Open action disclosures keep every summary on their command line; native contents expand beneath without moving inputs or losing drafts.

## Embedded native views

The same stylesheet also supports a native element with `data-ui="personal"`
or `data-ui="postvisual"`. For a plugin inside a host with its own theme, attach
a native open shadow root to the plugin's content element, append the bundled
stylesheet and a `section[data-ui][data-theme]`, then build the usual native form
inside that section. Build synchronously from the plugin bundle; no iframe,
inline script or document load event is needed. Import the bundled CommonJS
runtime for `adoptAction` and `setActionLabel`. Do not call the document theme
mount or change the host's root attributes. The host owns the view's theme.

Keep captions visible with `data-ui-label="always"` where needed. Call
`SharedUI.releaseActions(section)` before removing an embedded view; this
releases only that view's action observers and leaves other views intact.
The catalogue's Embedded native form demonstrates the same controls in a
shadow root, including native keyboard submission and retained form values.


## Media selection, context bars and launchers

Use `SharedUI.setSelection(card, selected)` on a positioned native media article.
It exposes `data-ui-selected` (`true`, `false`, or `mixed`) and paints a foreground
selection ring above media. Keep each media opener a native button; a separate
native checkbox or selection action provides touch and keyboard selection.
The application owns selected IDs, Shift-click ranges and single-click opening.

Use `aside.ui-toolbar.ui-context-bar` with a `role=status` count and native actions.
`data-ui-position="floating"` anchors it above the safe area. Put secondary actions
in `details.ui-disclosure.ui-overflow`; the shared adaptive behavior keeps its
menu reachable above the bar. Preserve labels on primary actions with
`data-ui-label="always"`. Hidden context bars have no focusable controls.

`SharedUI.setSortDirection(button, 'asc'|'desc', {sprite})` updates the arrow,
current direction and accessible reverse action together, preserving the button.
`SharedUI.createBackToTop(button, {scrollTarget, focusTarget, sprite})` enhances
an existing native button for a window or scrolling element. Place it beside a
scrolling panel or use `data-ui-position="viewport"` for a page. It appears after
240px, respects reduced motion, returns keyboard focus to the target, pauses in
hidden views and provides `update()` / `dispose()` for application lifecycles.

An app shortcut is a native `a.ui-action.ui-app-tile[data-ui-variant=quiet]` with `span.ui-card.ui-app-symbol` containing a
shared SVG and `span.ui-label`. Both packs use the same quiet tile and typography.
Use `SharedUI.setAppColor(tile, '#rrggbb')` for authored icon colors, or a validated
`--ui-app-color` value on server-rendered tiles. App CSS owns grid columns (Portal
uses four on phones) and placement. `data-ui-editing`, `data-ui-dragging` and
`aria-busy` expose edit, drag and save states. Keep native URLs and focus intact.

Shared headers stick to the top of their scrolling ancestor. Place them outside
padded page content for edge-to-edge coverage. Mark a back navigation action
`.ui-back`; it (or its immediate intrinsic group) stays at the start of a header.
The catalogue's Selection and navigation section demonstrates these contracts.

### Stable changing text

Pass `labelStates: ['Save', 'Saving…', 'Saved']` to `SharedUI.adoptAction` once,
then use `SharedUI.setActionLabel` as the action changes. The label reserves the
widest state in the current font; busy feedback occupies the same 18 px icon slot.
Reserved `.ui-status` text also retains an 18 px feedback slot across neutral,
pending, success and error states.
The same reservation participates in caption fitting, so a state change cannot
make neighboring commands compact and expand. Include translated states when
the application's language changes.

For a status or other text container, call `SharedUI.reserveText(element, states)`
once and `SharedUI.setText(element, currentText)` for updates. Hidden reservations
contain no text nodes and are excluded from accessibility; `textContent` still
returns only the current value. Existing native actions, focus and handlers stay
intact. Use these helpers rather than replacing the reserved container's children.
Text outside the declared states can still grow; register the complete finite
state list. The Control fixture cycles Live, Unsaved changes, Saving, Saved and
Save failed and reports any movement of neighboring commands.

### Consumer checks

Run `npm run audit -- --root /path/to/apps` to discover installed bundles,
verify every recorded file hash and release identity, and report stale CSS,
runtime and icon bundles. Multiple `--root` arguments are supported; `--target`
checks one exact asset directory. The command is read-only and exits nonzero
for drift or an outdated bundle, making it usable as a consumer release gate.
`--allow-stale` separates a valid older release from authored bundle corruption.
Reports stay local; application source and data never enter the catalogue.

In an application's browser checks, call `SharedUI.auditControls(header)` after
each meaningful state. It reports missing native action semantics, labels, shared
icons, overflowing or overlapping controls and height drift. For changing text,
take `before = SharedUI.captureLayout(header)`, trigger the real operation, wait
for layout, and assert `SharedUI.compareLayout(before)` is empty. The checks are
explicit, scoped and read-only: no background observer, polling or application
state access. Run the same flows for both packs, desktop/narrow containers,
keyboard and multiple views. Bundle checks detect release drift; browser checks
catch rendered regressions. Domain interactions still require application tests.

Headers center their controls vertically, so a multiline identity cannot stretch
buttons or leave a menu summary shorter than its neighbors. Intrinsic
`.ui-actions.ui-inline` groups compact and wrap within the available width. Use a small set of primary
commands and a native `details.ui-menu` for secondary workspace actions; use
adaptive priority groups only when expansion is useful. The Control fixture
demonstrates both gallery and workspace headers.

### Bounded zoom steps

Use an intrinsic native group with two `button[type=button]` children marked
`data-ui-zoom="out"` and `data-ui-zoom="in"`. Give the group an accessible name.
`SharedUI.createZoom(group, {min, max, step, value, onChange, sprite})` adopts
the shared minus/plus icons, clamps each step and disables the native button at
its limit. `outLabel` and `inLabel` can name domain actions such as Smaller tiles
and Larger tiles. There is no slider or disclosure. An optional
`output[data-ui-zoom=value]` displays `format(value)`; `.ui-sr-only` keeps that
value available to assistive technology when only the buttons should be visible.

Applications own persistence and viewport changes in `onChange(value)`.
`setValue(value)` synchronizes external changes without calling `onChange` or
rounding a saved preference to a different step. `dispose()` releases listeners;
normal page unload also disposes the helper. Native Tab, Enter and Space work
without custom key handling. The Control fixture demonstrates 72–420 px tile
sizes in 20 px steps, with the final step clamped to the bound.

## Spreadsheet tables

Use a native `table.ui-table[data-ui-variant="sheet"]` inside `.ui-table-scroll`
for line-by-line scanning. It supplies 11 px type, tabular numerals, cell dividers,
alternating rows, sticky headings and shared hover/focus/selection states. Use
`th scope="col"`, `.ui-number` on numeric columns and `data-ui-selected="true"`
on the selected row. Keep a native `.ui-item.ui-action` link with a shared icon
and `.ui-label.ui-truncate` for opening row context. Retain full text in its title
and accessible name. Coarse pointers keep 44 px action targets; narrow containers
scroll horizontally rather than turning each record into a tall card. The resize
helper retains the configured total width as the scrollable floor. Use
`data-ui-sticky-first` when the leading cell identifies each row, so that context
remains visible while scrolling.

`.ui-success`, `.ui-error`, `.ui-warning` and `.ui-muted` give cells semantic color.
Always include signs or explicit state text, so color is never the only cue.
Use native `.ui-disclosure` for optional totals, explanations and row details.


Native date, time, datetime, month and week inputs inside `.ui-field` retain
their intrinsic picker width, including when empty, in compact action rows.
Use the same caption + native input pattern as a labelled selector. Let the
shared action group wrap; do not add application-specific input widths. The
Control fixture includes an empty From date, a populated To date and a time.


### Clickable column sorting

`SharedUI.createTableSort(table, {column:'date', direction:'desc', manual:false, onChange, getValue, sprite})`
adds native quiet action buttons to the column headers and keeps `aria-sort` current.
With no options, the default is the first sortable column, ascending. A heading
cycles ascending → descending → the configured default on three clicks;
`reset()` restores that default. Existing row nodes and selection are retained.
Each header has a stable `data-column`; use `data-ui-sort-type="number"` for numbers,
`data-sort-value` on a cell for an unformatted value, and `data-ui-sort-disabled`
on a header that is not sortable. ISO dates sort naturally. Missing values stay
last. Existing row nodes, links, focus and selection survive sorting. Only the
body moves; applications calculate derived values before sorting.
For server pagination use `manual:true`: the callback receives `{column,direction}`
and the app sorts the entire filtered dataset before selecting a page. Never
sort only the visible page while implying a full-dataset sort. Call `refresh()`
after replacing rows; `dispose()` restores the original headings and listeners.
Use `.ui-color` with the `--ui-color` custom property on any cell or text element
for an application-supplied colour, for example `style="--ui-color:var(--ui-accent)"`.
The application owns its meaning and accessible labels; the kit supplies only paint.

### Quiet table toolbar

`SharedUI.createTableToolbar(table, container, {sprite, search:true, sorting:true, onChange})`
combines row search, a live result count, three-step header sorting, resizing and
column reordering. One quiet native **Table options** menu contains the named
column switches and **Reset view**. Hidden columns keep their named switch for
one-click recovery; at least one stays visible. Resizing remains a drag-only
boundary gesture. Filtering retains existing row nodes, links and selection.
`refresh()` handles newly rendered rows; `dispose()` restores hidden rows and
releases its controls/listeners. Apps retain their data and persistence.

Use `search:false` when an app already supplies dataset search, and `sorting:false`
for paginated or grouped datasets that require app-owned server sorting. The
client helper must never present page-only sorting as sorting the whole dataset.

### Adjustable columns and stable lightboxes

`SharedUI.createColumnManager(table, container, {order, hidden, pinFirst, onBeforeChange, onChange})`
composes shared column dragging with native checkbox fields in an existing disclosure
body. Its `state` is `{order, hidden}` for application persistence. The first column
can stay pinned and visible; at least one column remains visible. Dispose a column
resizer in `onBeforeChange` and recreate it in `onChange`. `dispose()` removes its
controls/listeners and restores the table; the catalogue demonstrates this pattern.


`SharedUI.createColumnDrag(table, {order, pinFirst, onBeforeChange, onChange})`
lets someone drag a native column heading to reorder the sheet. Give each
heading a unique `data-column` ID; every row needs one cell per heading, without
spans. A focused heading moves with Option + Left/Right, while a resize handle
retains its own pointer and keyboard behavior. The returned `state` is `{order}`
for application persistence. `pinFirst` keeps an identifying column in place.
The helper moves existing cells, preserving their links and handlers. `reset()`
restores source order; `dispose()` restores the original table, attributes and
listeners. Call `dispose()` on an active column resizer in `onBeforeChange`,
then create a new resizer in `onChange`. The catalogue's Spreadsheet scan
demonstrates both direct gestures without a separate column editor.

`SharedUI.createColumnResize(table, {min:72, max:1200, widths, onChange})`
enhances a native sheet with one header per column and no existing colgroup.
The table fills its container. A quiet line at each internal column boundary has
a larger pointer target: drag it to redistribute the adjacent columns without
moving the table edge. Use Left/Right (Shift for one pixel), Home/End or
double-click to reset a boundary. Escape or pointer cancellation restores the
starting widths. Narrow containers scroll when minimum column widths require it.
Applications own saved proportions through `onChange(widths)`; validate them per
view. `reset()` restores initial proportions; `dispose()` restores the native
table.

For dense record or review information, use native `details.ui-section` with
`summary` containing an `h3` or `h4` `.ui-section-title` and a short `.ui-meta`
context line. The heading itself opens the section; it is not painted as a
button. Put the exact data, media and actions inside. Leave critical facts
visible before the sections, and open an urgent section by default. Group
technical receipts, paths and raw entries under one meaningful section instead
of showing a wall of code or a row of disclosure buttons. The catalogue's
Record detail example demonstrates this in both packs.

Use `.ui-popout` on a native `dialog` for an overlay, on a direct child
`form` when the entire dialog submits or an in-page editor needs native
submission, or on `article` for an in-page record or review. Give it three direct children: `header`, a
`[data-ui-popout-body]` scrolling area, and `footer`. The shell keeps the header
and footer in view while only the body scrolls. Put the title and close action
on separate header rows; put decisions and previous/next navigation in the
footer. Keep the few facts needed for a decision visible, then use heading-led
sections for deeper information in the body. This
same shell works in both packs and at phone width; apps provide domain content
and may set `--ui-popout-space` for surrounding page chrome or
`--ui-popout-width` and `--ui-popout-height` for a wider or taller record.
The shell fits short content and caps long content at the available viewport.
Keep important text on its own line: headings and status in the header,
decisions in a `.ui-actions.ui-fill` row, then position text and navigation in
separate footer rows. Use the same shared action element for each button or
link; `.ui-fill` shares the available width among labeled controls while an
icon-only action keeps its natural width. The catalogue's Popout shell example
uses a native dialog.

`SharedUI.createLightbox(dialog, {onNavigate, onClose})` enhances a native dialog
with this content-sized popout frame, capped at 42rem × 760px and by the viewport. Use three direct
children: `header`, `[data-ui-lightbox-body]` scroll area, and `footer`.
The helper marks the body as `[data-ui-popout-body]`. `open(trigger)` remembers focus, `close()` uses native dialog
closure, and `dispose()` releases listeners. Escape and backdrop clicks dismiss;
Left/Right call `onNavigate(-1|1)` outside editable controls and text selections.
Native buttons remain available for navigation. The catalogue's media lightbox
uses this helper. All content, request cancellation and navigation state belong
to the app; keep the same dialog and replace only its content.

Stable geometry is a shared design goal: reserve the expected area for changing
content, keep toolbars and navigation in place, and scroll variable content
inside it. Use `reserveText` for status labels and native disclosures for optional
detail. Load a visible stable shell immediately; async results fill that shell.
Never move the surrounding table when selection changes or a lightbox opens.

Icon-only information uses native `details.ui-disclosure` with a `summary.ui-action[data-ui-label="hidden"]`, a shared `info` icon and an accessible name. The hidden-label summary omits the chevron and keeps the full shared control target. Use `data-ui-variant="quiet"` for a soft information or dismiss symbol; the catalogue’s compact reply row demonstrates both.


## Canonical reusable compositions

Beyond palettes and individual controls, the native
[review-workspace@1 contract](docs/COMPOSITIONS.md) provides a stable reusable
panel with named header/toolbar/filters/body/aside/footer slots, real native
form and event ownership, composable nested instances, container-aware
standard/split/stack variants and wrap/scroll/priority crowding. Use
`SharedUI.createComposition('review-workspace', slots, options)` from a
**bundled application runtime**, not copied app markup/CSS. A
`setLayout` switch retains the original nodes, focus and unsaved values.
Typed `--ui-composition-gap` and `--ui-composition-aside` values are
shared across both packs; intentional per-instance deviations require a
reason and expose an audit marker. Studio registers this as an authorable
node with a native keyed preview and explicit override provenance;
source-level structural drift is warning-only.

From this source checkout, `npm run dev` serves the local-only
[interactive synthetic composition review](http://127.0.0.1:41910/#compositions).
No consumer receives its new runtime helper until a normal explicit
bundle upgrade; compatible CSS refresh alone cannot install JavaScript.
The source/CI checks are separate from actual multi-app browser acceptance.
See the contract for 390px/narrow/full and real-app fixture requirements.
## Fleet UI fixture index

For multi-app convergence, each owner builds a local, UI-only fixture **using
their actual templates and handlers**, with deterministic synthetic adapters.
Keep application fixture code, data, routes and manifests in the owning
repository. The public shared-ui repository contains only the versioned
[fixture manifest contract](docs/FIXTURE_MANIFEST.md), an offline
`scripts/fixture-index.mjs` generator and a mock-only Style Lab example
(`fixtures/manifest.example.json`). The index does **not** launch apps or
claim browser verification; a fixture is verified only with source-backed run
evidence. A shared token's adoption is independent of the fixture harness.

## Isolated candidate review (foreground, not a release)

The [managed fixture review launcher](docs/MANAGED_REVIEW_LAUNCHER.md)
adds **manual start/status/test/stop** around app-owned real-code synthetic
fixture servers, reusing PR #3's strict offline fixture index. It pins
clean application/shared-ui SHAs and immutable complete candidate/baseline
bundle SHA256 digests. It **fails closed** unless a separate audited
OS isolation broker proves the required network/filesystem prohibitions.
It has no automatic browser runner, daemon, installer or promotion pathway;
app integrations and runtime/browser acceptance are separate owner work.
The source-only CLI is `npm run review:managed -- --config /absolute/private/review-plan.json`.
All six consumer owners are discoverable with `npm run review:owners`;
the [six-consumer managed registry and candidate handoff](docs/SIX_CONSUMER_REVIEW_HANDOFF.md)
separates individual source readiness and BLOCKED candidates from the
unchanged two-child runtime limit. For the user's later Codex execution, the
[StaticRef-first source-completion handoff](docs/STATICREF_SOURCE_COMPLETION.md)
pins the intended PR #31 Canvas blobs, prescribes one clean disposable
combined commit, and treats existing Canvas **and** gallery/lightbox behavior
as release-blocking. Physical native IME and user hands-on approval remain
mandatory; this work does not authorize promotion.

The [shared floating review panel](docs/FLOATING_REVIEW_PANEL.md) has
one native touch/keyboard-repositionable implementation for all app-owned
fixture bars, truthful installed-code versus local-candidate labels, and
a separately pinned fixture-only stylesheet companion for an unchanged
installed 1.10.2 baseline. This work does not make a local fixture live
production or change the canonical complete four-file bundle selection.

## Shared UI Studio

Studio development tooling shares a versioned catalogue registry, typed token
inventory and a private local document service. It supports revision-checked
commands, named snapshots, scoped overrides, compatible node swaps/moves,
comparison and undo through one API and JSON CLI. The runtime and automatic CSS
channel remain independent. The local visual editor renders 20 authorable native
components, with scoped tokens, typed bindings, slots, saved versions and conflicts.
The preview supports live changes, side-by-side snapshots and a draggable comparison
line, with a declared dependency tree. Advanced editing stays collapsed by default.
The optional official-SDK adapter provides stdio and authenticated local HTTP MCP.
After installing it, `./studio` starts a temporary editor + MCP session; Ctrl-C stops
both. No background service is installed.
Private drafts and registrations stay outside Git working trees.

The [configuration workspace](docs/STUDIO_CONFIGURATIONS.md) manages Postvisual
and its Personal mirror, independent duplicates, native previews, comparisons,
snapshots and full isolated validation. `./studio --publish` separately enables
exact-revision publication through the existing GitHub Pages workflow, from both
the editor and Portal MCP. Documents remain private view compositions.

Start with [the editor and MCP setup](docs/STUDIO_EDITOR_MCP.md) and
[public/private downstream releases](docs/STUDIO_RELEASES.md). Also see
[the foundation API](docs/STUDIO_FOUNDATION.md) and
[the Studio implementation direction](docs/STUDIO.md). Run `npm run studio -- --describe` for generated contract discovery, `npm run check` for validation, and
`npm run studio:browser` for the isolated browser fixture.

## Centred editable headings

Use `.ui-editable-heading.ui-section-title` with either a direct `.ui-prose` preview
or native `.ui-inline-field` input and an optional `.ui-meta` count. The shared
component owns the 8 px top inset, centred text in both states and transparent
native editor. Toggle the native `hidden` attribute when entering or leaving
editing; apps own edit events, data and board placement. Keep the preview and
input in the same component so input alignment inherits the centred heading.
Both states are demonstrated in the Control fixture for both packs.

## Anchored colour palette

`SharedUI.createColorPicker(trigger, {value, onChange, title})` creates a native
nonmodal popout next to its trigger. Call its `open()` from the trigger's native
click command, `setValue(value, {mixed})` when selection changes, and `dispose()`
when removing the view. The top row is Neutral, muted red with white text, warm yellow, checkmark green and Translucent; saturated everyday pastels follow,
then a native colour input and validated six-digit hex editor. Swatches retain accessible names without visible captions or arrows. It owns bounded positioning, Escape/outside
dismissal and focus return; listeners for viewport movement exist only while open.
`SharedUI.setCardColor` keeps the authored hex value while deriving readable
light/dark fills and ink. White becomes near black in dark mode. Colour resolutions
are cached with a bounded128-entry cache, and CSS changes theme without JS repaint.
Use `.ui-board-grid` and toggle `data-ui-interacting=true` during a drag; apps own
the grid's world-space size and offset. The catalogue demonstrates the picker.

Pastel swatches and cards use the same resolved fill in both themes; only near-white neutral changes to off-black. Inline code and code blocks use the shared paired `--ui-prose-code-fill` / `--ui-prose-code-ink` tokens, so authored card text cannot turn code black-on-black.

Use `.ui-header[data-ui-layout=workspace]` with navigation, status and actions slots (`data-ui-header-nav`, `data-ui-header-status`, `data-ui-header-actions`) for a balanced header: back/home left, commands right, status centred independently of side widths. Narrow layouts keep status centred on its own row.

Output renderers use `SharedUI.createCardColorResolver(root)`: `resolve(color)` returns the actual native card fill, ink, border and font after theme resolution. Its bounded cache avoids resolving styles per card or frame; theme/pack/revision changes invalidate it. Call `invalidate()` after other appearance changes and `dispose()` when removing the renderer. Never pass unresolved CSS variables or `light-dark()` strings to Canvas paint.

Shared selectable media/cards use one thin outline. `.ui-resize-handle` keeps its physical hit target while painting only a diagonal corner grip on selected-card hover or keyboard focus; no dot or duplicate selection border is drawn.

Compose movable media with `ui-card ui-selectable ui-draggable`, `data-ui-resize="aspect"`, a named `ui-resize-handle` button and `ui-fit-media` on the image/video. The shared sheet owns selection, hover grip and native grab/resize cursors. The owning application keeps geometry, aspect-preserving pointer/keyboard resizing, persistence and pointer capture. Never add a separate drag strip. `ui-fit-media` fills a bounded stage using `object-fit:contain`, including upscaling low-resolution video without stretching or cropping.

For a lightbox, call `SharedUI.fitMedia(media, stage)` after inserting its native image/video and dispose the returned controller before replacement/closure. It observes the bounded stage and loaded metadata, and sizes the element itself to the aspect-preserving contain rectangle, including upscaling. Native video controls therefore stay over the picture rather than a letterboxed full-stage element. It performs no playback or application-state changes.

Tag entry uses the same native field font and border as other controls. `.ui-tag` defaults to padded neutral grey; selected tags explicitly set `aria-pressed="true"`. `createTagInput` anchors suggestions outside layout; the opt-in wrapping layout keeps its entry separate from a bounded chip list. Use `.ui-review-dock.ui-panel.ui-stack` for centered lower media controls with safe-area-aware bottom clearance; the application supplies contents and a positioned stage.

`fitMedia(media, stage, {controlsOnIntent:true})` keeps a native video’s controls hidden when inserted, then reveals them on actual pointer movement, touch or keyboard focus. Disposal restores native attributes. Center review command/tag rows using the common `data-ui-align="center"` modifier on `ui-actions`/`ui-tags`.

The shared `ui-card-container ui-card ui-stack` composition separates a primary `button[data-ui-surface="graphic"]` from a native footer (`ui-actions ui-pad`, `data-ui-align="end"`) containing `details.ui-menu`. Use `ui-pad ui-stack` for primary text so content and footer share one edge. Keep previews in the primary button and menu actions outside it; no detached floating menu or nested interactive targets.

Action feedback lives on the action. `SharedUI.setActionState(button,{state:'idle'|'pending'|'success'|'error',message,sprite})` preserves native handlers, label sizing and focus, shows the shared yellow pending spinner or crisp green check, and puts accessible announcements inside the button. `runAction(button,asyncOperation,{pending,success,sprite})` manages the same lifecycle and rethrows failures. Call it for save, submit, confirm and other action results; use the same API for automatic saves. The structural audit flags standalone state feedback without a button owner. Background health/presence may explicitly declare `data-ui-feedback="background"`; that exception does not cover action results. Header status stays centered in the same row instead of moving beneath commands.

`SharedUI.createFullscreen(button,{scope:dialog,sprite})` adopts a native Fullscreen action for photo and video lightboxes. Give the native dialog one content container marked `data-ui-lightbox-content` with the shared `ui-lightbox` class, and put all media and commands inside it. The helper requests fullscreen on that container: browsers forbid requesting it on a dialog, and fullscreening an ancestor can cover a modal in the top layer. Domain layout stays on the content container. The existing viewer, controls, focus, media node and playback position remain in place. An explicit non-dialog `target` is also supported; outside a lightbox the default is the document root. The label, icon and pressed state follow native fullscreen changes, including Escape. A browser without document fullscreen can use native video fullscreen; unsupported actions are hidden. Call `refresh()` after replacing media, `exit()` to leave, and `dispose()` to release listeners. Closing the scope exits only fullscreen entered by this controller, including a request still completing. Request failures use shared action feedback. The catalogue's Motion tile opens a synthetic video in the same viewer as photos.

The shared `ui-lightbox` shell fills the viewport without a second panel frame. Its `[data-ui-lightbox-body]` owns the media or same-origin gallery iframe and its optional `[data-ui-lightbox-close]` uses the standard close action at the top edge. Put multiple top-edge commands in one native `.ui-actions.ui-inline[data-ui-lightbox-actions]` group. Catalogue and Canvas use the same shell; the gallery retains domain navigation, metadata flushing and playback inside it.

`createAvatar(name,{document,size:24})` composes the shared tag tokens into a fixed, passive circular presence indicator. Full names stay in the accessible label/title rather than affecting row geometry.

`installZoomShortcuts(document,{canZoom,onZoom})` shares Command+Up/Right/+ and Command+Down/Left/− with native field, composed-path and IME guards. Apps supply bounded content transforms; never scale chrome. Dispose removes all handlers. `createZoomFeedback(document).show(percent)` updates one persistent, bottom-centered native minus/percentage/plus toolbar per document. It emits `ui:zoom` with direction −1/0/+1; zero resets. Apps own bounds and content geometry. The zoom group uses the same readable control surface as its context toolbar. Native dialogs, menus and popovers suspend it automatically. Apps call `setVisible(false)` for custom overlays or non-content routes and restore it on close; dispose removes its listeners. The unframed `.ui-review-dock.ui-stack` centers review actions and tags without a surrounding panel border.

`createValueTransition({value,onChange,duration:110,view})` eases content values to a target on animation frames. Read `.target` when accumulating repeated shortcuts; `.value` is the current frame. The callback receives `{final}` so apps persist once at the end. `cancel` stops work for a direct gesture; `dispose` releases listeners. Hidden views settle without background animation; reduced-motion preferences use the final value immediately. Never apply content zoom to UI chrome.

`createZoomSteps()` shares gentle repeated content zoom: `next(direction)` returns a 10% factor, then 15% and 20% for presses within 240ms in the same direction. A pause, direction change or `next(0)` resets the burst. Use the same instance for keyboard and toolbar actions.

### Compact numerical fields

Use the existing native `label.ui-field` with `span.ui-label` and
`input[type=number]` for frame, duration and amount fields. The numeric subtype
reserves eight character widths and shrinks within its container; density and
coarse-pointer rules keep the common field height and native text size. Keep
`min`, `max`, `step`, precision, validation and values with the application.
No extra wrapper or number-stepper runtime is needed. The Fields catalogue
demonstrates integer, decimal and readonly values. Slider/exact-value rows use
`.ui-value-control`, which reserves twelve characters for precise values.

## Header navigation, command menus and filters

Use `data-ui-header-nav` for optional Home/Back/Exit navigation on the left and
`data-ui-header-actions` for commands on the right. Mark the native application
`details.ui-menu` with `data-ui-header-menu`; it stays last, with a `menu` icon
and a named, hidden `.ui-label`. A launcher link is navigation, never a menu trigger.
The header can wrap into available container space. Controls use native density;
content zoom never scales application chrome.

Command panels use `.ui-menu-panel`, independently sized from their trigger and
bounded to the viewport (20rem by default; `--ui-menu-width` overrides it). Group long command menus with native `fieldset.ui-group` / `legend` and an inner `.ui-actions` stack. Forms and filters additionally use `.ui-form-panel`:
fields keep their borders and choices keep their pressed states. Compose native
`.ui-field`, `fieldset.ui-group`, `.ui-actions.ui-fill` and `.ui-stack`; applications
own the field values and filtering. No custom filter typography or control paint.

`SharedUI.createAdaptiveSlot(node,{container:header,target:menuSlot})` moves the
same secondary native control into a menu below the shared 32rem header-container
threshold, then restores its original position. Keep the target inside the header.
It preserves values and handlers, defers moves while the control is focused,
suspends in hidden views and exposes `refresh()`/`dispose()`. Use an empty
`.ui-secondary-slot` in the menu. The Control fixture demonstrates this with Sort.
These runtime/markup changes require an explicit complete consumer bundle upgrade.
Studio MCP discovers the patterns; private document edits do not patch application
source or install runtime upgrades.

### Compact function controls

Compose a property row with `.ui-actions.ui-inline`, a native labelled `.ui-field` number input and shared keyframe/expression actions. `SharedUI.createFunctionControl(input, {step, min, max})` adds horizontal numeric scrubbing to that same input (a text input may also accept app-validated expressions): drag while unfocused; click or Tab to type; Shift multiplies by ten, Alt divides by ten. Touch retains native numeric entry. Bounds and step can be getters. It emits native `input` samples and one final `change`, leaving live state and History with the app. Escape, pointer cancellation or a hidden document restore the original value; `dispose()` releases capture and listeners. Do not replace authored easing when updating a value. Put undo/redo in the top command bar when History exists; use the right-hand menu for secondary Controls and Present actions.

Open native menu panels use the same viewport fitting in both packs: maintain the trigger edge, flip above when below cannot fit, bound scrolling to available height and restore summary focus on Escape. Keep panel forms on `.ui-form-panel`; command menus and forms share native action controls. Apps keep content and semantic handlers.

### Shared effects inspector

`SharedUI.adoptPropertyRow(row,{name,control,actions})` owns the native inspector row: a flexible name, its adjacent action slot and an aligned value column. It moves the original controls once, preserving their IDs, handlers and focused drafts. Use `createBooleanControl` for a native checkbox field with explicit On/Off value and `createColourValue` for one native colour/hex field. Numeric/expression fields use `createFunctionControl`; applications validate expressions through their existing engine. The kit owns control paint and row geometry; applications own values, keyframes, formulas, resets and History. The catalogue demonstrates all three types together in both packs.

`SharedUI.setExpressionState(input,{expression,result,error,base,keyframed})` adds an accent `fx` marker beside the original value. When keyframes coexist, supply their evaluated base so the description explains the base → expression result. Keep result text readable; muted text is reserved for metadata, rather than implying the value is disabled. The visible field shows the result while unfocused; native hover/accessibility text exposes the expression and return value. The kit never evaluates expressions.

`createBooleanControl({label,value,variant:'controller',onChange})` is the compact Controller toggle. It uses the conventional shared switch with visible On/Off text and native checkbox keyboard/accessibility states. The regular variant retains the same established switch; inspector row geometry stays consistent.

`createExpressionEditor({label,suggestions,onCommit,sprite})` returns a named native `trigger`, multiline `input`, and `element` form. Put the trigger in the property action slot and the form beneath the row. It owns completion at the caret, composition-safe typing, native Base/Result read-only fields and a right-aligned Clear/Apply group, retryable validation, Ctrl/Command+Enter apply, Tab completion, Escape cancellation and draft-preserving `sync({expression,base,value,error})`. Use `setSuggestions` for live vocabularies and `flush` before Save/exit; `dispose` removes listeners. The application owns evaluation and History. Display the live result in the compact field, show the independent base on focus/scrub, and keep the fx indicator while driven. Comfortable scrub bounds can grow after explicit typed entry; genuine input limits remain application-owned.

`setKeyframeState(action,{present,keyframed,sprite})` separates the current frame from animation: the ordinary blue pressed surface means the property has keys anywhere; a solid foreground-colour diamond means a key exists at the playhead, and a hollow diamond means it does not. Clicking an existing key selects its editable base; deletion stays in the timeline. Editable and read-only fields share the same unfilled surface; read-only text uses the shared monospace font and retains native selection/copy.

`createChoiceControl({label,options,value,searchable,onChange})` composes a native select or the shared searchable combobox in one field. `sync(value,options)` preserves focused entry; arbitrary search text never becomes an enum value. Dispose it with its row. The combobox handles IME composition, arrows, Enter, Escape and outside dismissal.

`createCurveControl({label,points,defaults,onChange})` presents a normalized cubic response in the compact inspector. Four coordinates define the handles; optional fifth/sixth coordinates enable editable endpoints. Native exact fields, presets, pointer capture, keyboard adjustment and Escape/hidden-view cancellation share the same control paint. `sync({points,defaults,available})` leaves an active drag intact; `dispose()` releases listeners. Applications map coordinates to scalar targets and commit through their existing History.

`createResponseControl` and `createIntervalControl` share power-response and two-endpoint controls. They accept descriptor metadata, app-supplied numerical model functions and callbacks; the kit owns DOM, theme, focus and pointer/keyboard interaction while the consumer owns accepted values and state. They are demonstrated alongside native choice, text, read-only and action controls in the effects inspector catalogue.

Inspector rows use name → Keyframe → FX → value in both visual and keyboard
order. Value fields share a start column and extend to the right edge. Actions
consume only their actual width inside the name area, so names without actions
can use that space instead of leaving a reserved rail. Narrow rows give the
name/action area a larger share while retaining usable value fields. Omit
`actions` for read-only output rows; their names use the full name area too.
`setPropertyState(row,{active,description,color})` colours the existing name and
updates its native hover description; automation never inserts a status line or
moves neighbouring rows. The owning app supplies the sampled value.
Choice controls accept `sprite` for the local shared icon bundle. A searchable
choice has one `.ui-combobox.ui-field` shell, a borderless native text input and a
unboxed shared chevron action; ordinary choices use a native select in the same shell.

The native `.ui-effects-inspector` composition is the shared **Effects control
panel** catalogue component. It groups property rows, including native multiple
selects, with shared choices, switches, colours, curves and expression fields.
Use an existing named section or group; no application state or second wrapper
is required. State evaluation, validation and undo remain consumer-owned.

`setPropertyAction(row,{onReset,onActivate})` makes the existing property name a
native action. Double-click resets through the owning application's default and
History operation. An optional `onActivate` reveals an associated timeline event:
the name is blue and a single click or focused Enter/Space navigates. Names without events do nothing
on a single pointer click; focused Enter/Space resets. Callback updates preserve
the same node and prevent concurrent resets. Omit both callbacks for read-only rows.
`orderPropertyActions(group)` retains the native Keyframe → FX order. Event
navigation belongs on the name; no separate Event, curve or reset button is used.
The inline fx indicator accepts `onActivate`, `controls`, `expanded` and `label`;
use the editor’s `toggle()` so either FX trigger opens/closes the same draft.

Editable and read-only fields are unfilled in both packs. Read-only fields
and native outputs use `--ui-font-mono`, preserving native selection and copy.
Content-oriented inline editing retains its explicit role.

### Inline text suggestions

`SharedUI.createTextSuggestions(input, {label, onSelect})` attaches the shared listbox to an existing native input or textarea without wrapping or replacing it. Call `show([{label, ...data}])` with application-ranked results and `hide()` when the caret leaves the completion. The helper owns viewport fitting, pointer selection, arrows, Enter/Tab selection, Escape, IME guards, dismissal and accessible active options. The application owns triggers, asynchronous retrieval, stale-response checks and text replacement. Call `dispose()` when removing the field. The Selectors & search catalogue demonstrates file mentions.

## Optional debug console

The reusable [debug console](docs/DEBUG.md) provides evaluated-state tables, sampled all-channel plots, lane views and machine-style diagnostic traces. It is a separate reviewed add-on, with a portable packet/adapter API and no application state or transport. Open `public/debug.html` for the interactive synthetic fixtures.

### Independent workspace panels and timeline scrubber

`SharedUI.createPanelToggles({items, selected, maxSelected:2, onChange})` connects native buttons and existing panel elements. Each item is `{id,button,panel}`. Buttons retain independent `aria-pressed` states; a second press closes a panel. At most two panels are visible, replacing the oldest selection when a third opens. `show(id)` reveals a panel without toggling it closed; `dispose()` releases listeners. Host layout owns panel placement.

For native line playheads, load the optional, separately validated `v1/timeline.css` with `scripts/install-timeline.mjs`, then add `data-ui-timeline` to `.ui-range`. `.ui-timeline-ticks` shares tick typography and line paint; hosts position ticks using actual frame bounds. The base CSS budget is unchanged.

### Section actions and preview inspection

`SharedUI.createSectionActions({root,actions,sprite,fill:true,iconOnly:false,onChange})` adds native **Expand all** and **Collapse all** actions for `details.ui-section` within a root. Hidden sections remain untouched. It changes only native open state and reports `{open,sections}` for host-owned persistence. `refresh()` updates disabled states after host filtering or insertion; `dispose()` releases buttons/listeners. Pass `fill:false` to retain an authored intrinsic `.ui-inline` group and `iconOnly:true` for compact commands with complete accessible names. No section or form field is recreated.

`SharedUI.createMediaViewport({surface,content,minScale:.125,maxScale:32,onChange})` lets a bounded preview inspect existing pixels without changing content dimensions or application state. Two-finger scroll/wheel pans; pinch or Ctrl/Alt/Command-wheel zooms around the pointer; Space + primary drag or middle drag also pans; Shift-wheel pans horizontally; double-click fits. Focus the surface for +/− zoom, arrow-key pan and 0/Escape to fit. Toolbar buttons, fields and editable content retain their native interaction. `zoom(factor,point)`, `pan(x,y)`, `fit()`, `.state` and `dispose()` allow host controls and cleanup. The host owns placement, clipping and existing creative overlays; `onChange` can reproject overlays. Transforms affect only the content node, leaving UI chrome unscaled. The Control fixture demonstrates both helpers with native sections and an SVG image.

Media viewport hosts can set `keyboard:false` to reserve all keys for transport/editors, or `spacePan:false` to reserve Space alone. `setEnabled(false)` cancels an active preview gesture and lets native host scene tools receive pointer/wheel gestures; enabling restores preview inspection without changing its transform.

### Preview catalogues and proof sheets

`SharedUI.createPreviewCatalogue({root,onSelect,onManage,sprite})` uses native media cards, caption actions, the shared grid and selection states. `update(items,selectedId)` accepts `{id,label,image,detail}`; images are contained in 16:9 previews. Stable cards retain focus; `dispose()` releases the owned DOM. The host owns collections, filtering, scene activation, image URLs and source/state identity.

`SharedUI.renderProofSheet({items,title,width:3840,height:2160,background,color,font,signal})` composes loaded image previews onto a canvas, with contained 16:9 cells and measured labels. It returns `{canvas,cells}`. The host must supply real render outputs and label their sampling; the helper never invents data or changes a scene. Callers may supply theme typography/palette values and download the canvas as PNG. The catalogue includes a synthetic interactive fixture.

### Responsive media review and touch intent

Place a `.ui-review-dock.ui-stack[data-ui-position="flow"]` footer after the
application's bounded media stage. Apps own stage geometry; the bottom controls
reserve their own space and respect safe areas. The first child holds secondary
tools and scrolls when expanded on short screens; the final navigation row stays
visible. Put Previous/Next in the footer's final
`.ui-actions.ui-fill` row. Keep secondary review controls in a native
`details.ui-section`. Both packs share this layout; the media catalogue demonstrates it.

`SharedUI.createPressHold(root,{onHold,accept,delay:450,tolerance:10})` recognizes a
stationary primary touch or pen press. Return false from `onHold(event)` to decline
it. Native scroll remains available; movement, a second pointer, cancellation,
hidden views and blur cancel the timer. An accepted hold consumes the following
pointer click without consuming keyboard activation. `cancel()` clears pending
intent; `dispose()` removes listeners and timers. Hosts own selection, capture,
panning, dragging and persistence, and must retain a visible keyboard/tap action.
Resize handles retain their native target without requiring hover, so they work with touch as well as a pointer.

Open native menus observe their panel size so late field/font reflow remains inside the viewport. Closing menus and disposing a document release that observer.


### Container context toolbar

`SharedUI.createContextToolbar(toolbar,{container:document.body,zoom:feedback.element})`
keeps the existing native action row centered in its container and the zoom group
right aligned with safe-area padding. A body container uses viewport coordinates;
a positioned element uses its own bounds. Register every native action with `adoptAction` (including actions in nested
`.ui-actions.ui-inline` groups); captions compact together through the normal
shared action fitting. The toolbar retains its intrinsic width within the dock
bounds. Context tools use 80% opacity while idle on hover-capable pointers. Zoom controls
are transparent while idle and reveal on hover, keyboard focus, or a changed zoom
value. They return to idle 1.2 seconds after the last zoom change; repeated redraws
at the same zoom do not keep them visible. Their reserved layout space remains
stable. Touch controls remain fully opaque. Hidden views, overlays and disposal
cancel the activity timer; restoring a view does not flash the controls. Narrow containers center zoom above the command row when the two cannot
coexist. The dock allows 16 px side padding (respecting safe areas) and keeps a
6 px separation from right-aligned zoom so commands can use the available width. No controls are cloned. Call
`refresh()` after visibility changes and `dispose()` to restore owned nodes and
release observers/listeners. `createZoomFeedback` exposes `.element` and defaults
to the same padded bottom-right position. Selected positioned media cards paint
the shared contrast border above their content; apps must not add selection paint.

Action fitting follows a group's current parent when an adopted toolbar moves
into a context dock. It releases the old container observer so captions expand
and compact against the dock's available space.


`SharedUI.createResizablePanel(panel,{container,side:'right',min:240,max:640,minMain:280,value:352,property:'--ui-aside',onChange})` adds one accessible native separator. Drag with mouse/touch or use Left/Right (Shift for larger steps), Home/End and Escape. The container receives the bounded shared sizing property; the application owns panel placement and persistence. Narrow containers disable the horizontal handle. Cancellation, hidden views and disposal release capture/observers and preserve content. This is a resize primitive, not a docking/workspace manager. Positioned panels must establish their existing positioning context.

Composed `.ui-field` textarea controls share the outer field border, fill the available value area and retain native vertical resizing. Hidden tag suggestions reserve no empty rows.

Caption compaction priority is explicitly opt-in: mark only unmistakable actions
such as Previous/Next arrows with `data-ui-compact-priority="0"`. Lower numeric
ranks lose captions first, unranked actions last. Equal-fill rows retain natural
width for those compacted arrows and balance the remaining labelled controls.
Labels return when space allows; accessible names remain intact. Ordinary groups
continue to compact together. The Media review example demonstrates this option.

Use `data-ui-align="start"` on an action stack to align its native command
captions with the same left edge as menu commands. Property rows make tag entry
fill their value column, preserving the existing native input and chips.

### Compact suggestions and inspector actions

`createSuggestedInput(input,{options,excluded,onCommit,limit:6})` accepts arbitrary
text with optional prefix suggestions. It preserves the existing input and uses
a viewport-bounded overlay: focus and suggestion changes never reserve a new row
or move adjacent controls. Arrow keys select a suggestion; Enter otherwise commits
the literal entry, Escape dismisses, and IME composition remains native. No ghost
text or routine draft notice is inserted. Applications retain their commit model.
`createTagInput` uses this same overlay globally and adds comma-separated commits
and shared tag choices. Dispose either helper with the owning field.

`adoptPropertyAction(row,{name,action,icon,label:name,sprite})` places the original
native button/link in the same value column as Aura's inspector inputs, with its
name at the left and a named icon in a full-width compact action box. Existing
handlers, native links and shared pending/success/error feedback stay intact.
The Effects control panel catalogue demonstrates both primitives in both packs.

Panel resize separators follow the panel's actual vertical bounds, so a shared
full-width workspace footer remains clear. Native builders declare action icons
and factories retain ownership; consumers must not repaint factory controls with
legacy post-render label/icon decoration.

`data-ui-layout="wrap"` is an explicit intrinsic wrapping action group. It sizes
from its controls without size containment, stays bounded by its parent and
wraps normally. Use it for centered review tools with a tag row aligned below;
ordinary full-width action groups retain their existing containment.

### Workspace control bars and compact sections

Use the **review dock** (`.ui-review-dock[data-ui-position="flow"]`) for persistent media navigation and its optional review actions. Keep it in a reserved workspace row outside the media/inspector split. Use `createContextToolbar` for selection-dependent canvas tools anchored to a container, with optional zoom controls. Both compose the same native `.ui-actions` controls; the application owns only workspace tracks and media placement. They are separate compositions, not separate button implementations.

Compact inspector groups use native `details.ui-section`: a left disclosure triangle, a bold top-level heading and quieter nested headings (`data-ui-level="2"`). Existing draggable application headings with their own collapse state may adopt `.ui-section-heading` plus `aria-expanded` and keyboard handling; retain their original nodes and handlers. Suggested inputs anchor an overlay to the exact field width, without a new flow row.

`createTagInput(input, {field, chips, ...suggestions})` can retain a native field and selected-chip list on one stable row. The entry keeps its width while the chip strip scrolls horizontally. Pass the existing nodes; the application retains tag persistence and removal handlers. Suggestions remain a field-width overlay and never resize the inspector.

`SharedUI.createColorWheel({root, values:[], choices:[], multiple:false, label, onChange})` supplies a native colour-wheel action, visible selection nodes and individually named removal actions. Click adds a node or removes a selected node; drag adjusts a node (mouse, pen or touch), with pointer capture and Escape/cancel restoring its starting selection. The wheel fills its container and shows a perimeter ring, highlighted pointer/drag target and live hex feedback. Arrow keys choose hue/saturation, Enter toggles and Delete removes. `multiple:true` allows up to 32 nodes; an optional hex `choices` palette snaps selections for categorical filters. Omitting choices permits arbitrary hue/saturation values for picker integrations. `setValues` updates without emitting; `clear` emits; `dispose` releases listeners and drawing buffers. The hue/saturation graphic is generated locally and sends no content or telemetry.

Search bars use the existing native `.ui-field.ui-search` pattern with a decorative shared search SVG, a named `input[type=search]`, and the browser's native clear/search keyboard behavior. Adopt the existing input instead of replacing it.

Native menus evaluate the original composed click path when dismissing outside
clicks. Removing a selected tag or colour during its click does not close its
containing menu; a real outside click and Escape retain normal dismissal.

Consumer browser checks should run `SharedUI.auditControls(workspace)` after toolbar reflow. It reports native icon commands missing `adoptAction` registration as `unadopted-action`, alongside height drift and overlapping controls. Test nested context groups in narrow and wide containers; a painted button alone does not satisfy the shared action contract.

Run `node test/serve-context-toolbar.mjs` and open its loopback URL for the real browser contract fixture. **Run toolbar checks** exercises both packs through repeated 320/560/1000 px resizing, checks nested native actions, constant control height, centered bounds, zoom separation and keyboard visibility, and proves the audit rejects an unregistered icon command. It uses synthetic controls only.

Additional viewport commands such as Back to top compose inside `createZoomFeedback(...).element` as existing adopted native actions. Use icon-only captions with complete accessible names, then call `observeActions` on that group. They share its surface, opacity, keyboard visibility and container fitting; keep scroll/reset semantics application-owned. Do not create a separately positioned floating button beside the dock.

### Safe workspace and grouped review controls

Use `.ui-safe` on fullscreen workspace chrome, popouts or a dock that needs an explicit content inset. `--ui-safe-inset` defaults to two shared gaps (12 px compact, 8 px dense); padding also respects the largest device safe-area inset on all four edges. Ordinary `.ui-pad` spacing remains two shared gaps and ignores safe inset overrides. Read resolved `padding` to measure that default; a fallback does not declare the custom property. Apply it once at each actual chrome boundary rather than nesting padded wrappers. Existing `--ui-page-width` owns the outer page width, `--ui-popout-width` / `--ui-popout-height` bound panels, and `--ui-dock-width` bounds review docks (64rem by default). Context toolbars also honor `--ui-safe-inset` for viewport/container clearance. Applications own workspace tracks and media geometry in `@layer app`.

`SharedUI.createReviewControls(root,{rating,actions,tags,navigation,layout:'bar',iconOnly:false})` adopts existing native slots. Rating stays one coherent group; commands and navigation wrap within the available width. The bar caps its width with `--ui-dock-width`; tags receive a readable full-width field before yielding to another row. Use `iconOnly:true` for deliberately compact media commands; accessible names and handlers remain. `addAction(existingButton)` registers dynamic commands, `refresh()` handles visibility, and `dispose()` restores owned styles. The default `layout:'stacked'` retains the earlier separate centered rows.

Use `createTagInput(input,{field,chips,layout:'wrap',...options})` for an inspector or review bar. The entry stays above a real wrapping chip list; `--ui-tag-list-height` caps that list to three control rows by default. Excess tags remain reachable with native vertical scrolling and keyboard focus. Long text wraps inside each chip. Suggestions stay in a field-anchored overlay, and resizing does not rebuild fields, change drafts or commit tags. The earlier `inline` and `stacked` horizontal list layouts remain explicit choices. No narrow field width is imposed on plain `.ui-tags` markup.

`createResizablePanel(panel,{container,min,max,minMain,value,...options})` uses the container's content width, excluding safe padding. It publishes `data-ui-resize-layout="side"` when both minimum panel and main widths fit, or `"stack"` otherwise. Domain grid CSS can follow that signal instead of adding a viewport breakpoint. It retains the preferred panel width across temporary shrinking; explicit resizing updates that preference. The separator follows the actual panel boundary. Disposal restores the prior property and layout attribute.

The catalogue demonstrates live wrapped tags and bounded review controls. The loopback fixture server's `/review` exercises both packs and themes at 390/800/1440 px, repeated shrinking/growing, bounded long-tag lists, native draft/focus retention, suggestions, keyboard access and resize separator placement.

### Shared colour and command panels

`createColorPanel({root, choices, multiple, value, onChange})` renders a responsive native swatch grid; `setChoices` updates available colours and `setValue` updates selection without app paint. Choices are `[name, CSS colour]` pairs; `SharedUI.cardColors` is the shared default palette used by `createColorPicker`. Colour pickers toggle closed when their trigger is used again and size to their contents. `createFilterButton` uses the standard filter icon, caption and container-driven compaction. `createConfirmAction(trigger,{message,label,onConfirm})` supplies an anchored keyboard-accessible confirmation with Cancel first. Apps explicitly bind its `open` method and retain the original action's domain handler.

Controller Boolean controls keep their native checkbox and form/change semantics, expose On/Off in the property value column, and use the inverted pressed surface. Context docks cap command width at 1200 px and one parent owns the fit of intrinsic nested groups, including groups moved from another container.

For before/after text, use one unified diff inside a closed `details.ui-section`: `div.ui-prose > pre.ui-mono > code`. Keep unchanged context, prefix removed lines with `-` and added lines with `+`, and escape source text. Use `span.ui-error` for removed lines and `span.ui-success` for added lines; the signs keep the meaning clear without color. Preserve the original reviewed text independently of this display.

Swatch panels also accept `groups:[{label:'Default',choices:[[name,value],…]},…]`. `setGroups` changes named sections; `setChoices` returns to a flat grid. `buttons` remains a flattened list and `setValue`/`onChange` keep the same values. `cardColorGroups` combines default/approval choices, followed by ten pastels. Groups share equal, button-sized columns; pickers hide their headings and use the compact value-column schema. Anchored confirmations and colour panels adopt the trigger's native dialog when opened, preserving modal keyboard focus and accessibility.


## Collection filters

Use the same native form for tables, galleries, lists and search results. Put the search `.ui-field.ui-search` beside `details.ui-disclosure[data-ui-filter]` in `.ui-actions.ui-toolbar`. Its `summary.ui-action` uses the filter icon. Put criterion `.ui-field` labels inside `.ui-disclosure-body.ui-stack > .ui-grid`, then Apply submit and Reset actions. The existing grid lays fields out as rows when wide and wraps when narrow. For an anchored gallery menu, keep `details.ui-menu[data-ui-filter]` and `.ui-menu-panel` instead; the controller preserves authored placement and classes. A closed disclosure takes only its trigger's space; opening retains the native nodes and values. The Collection filters catalogue demonstrates matching table records.

`SharedUI.createFilterMenu(form,{label:'Filters',sprite,defaults:{},onChange(values,{reason,active})})` enhances the authored form. Mark native named inputs/selects with `data-ui-filter-field`; hidden routing fields stay unmarked. Empty is the default unless `defaults[name]` or `data-ui-filter-default` specifies another value. Checkbox/radio groups and multiselects return arrays. The summary counts active criteria, excluding disabled fields; `refresh()` rescans dynamically added criteria. `values` and `active` expose current state. `clear()` restores declared defaults, preserving routing fields, nodes, focus and open state. Mark its Reset action `data-ui-filter-clear`; provide a real reset URL for the no-JavaScript fallback. Escape closes the panel and returns focus to its summary; a second click toggles it natively. `dispose()` releases listeners without altering form contents. Apps own query matching, counts, navigation and debouncing: the helper never submits forms or stores app data. Native Apply works without JavaScript; `onChange` can update gallery results live or submit on explicit clear. Both packs share this contract.

Context toolbars accept an existing `status` node: `createContextToolbar(toolbar,{container,zoom,status})` places it in a separate shared context box centered above commands. Its text never consumes command width; hide the node when no selection is active. Disposal restores the original node. Wide command rows may use up to 1200 px within symmetric zoom clearance and safe margins. Colour pickers use separator-only palette groups (`createColorPanel` also accepts `headings:false`) and compact property rows for Custom colour and Hex.

The card palette places neutral/transparent first, then approval colours in one five-swatch group, followed by ten pastels. Pickers omit group headings and separate groups with padding. Responsive swatch grids share equal columns across groups and choose balanced row counts; native hit targets remain bounded by the container.

Swatches cap both dimensions at the shared control height; extra container width never enlarges colour targets. The panel retains its full container width with consistent gaps and centered rows.

Every `createColorPanel` owns one padded shared field box around its swatches.
Gallery filters, card pickers and catalogue panels therefore share the same
border and spacing; consumers must not add a second field wrapper.

Inside a floating context dock, authored `details.ui-overflow` groups use the shared anchored native menu contract. Opening More never adds an in-flow row or changes dock height; secondary actions keep complete captions in a vertical menu. Existing nodes, handlers, values and original composition are retained and restored on disposal.

Card pickers give the swatches the full panel width: five columns for the default group and two five-column pastel rows at ordinary phone and desktop widths. Custom colour and Hex use aligned compact property rows below the palette. The swatch group has one shared field border and an accessible name; no redundant side label consumes its width.


### Numbered document links

Use `SharedUI.adoptNumberedAction(link,{number:1,label:'Bank statement.pdf',ariaLabel:'Statement 1: Bank statement.pdf',sprite:'./shared-ui/icons.svg'})` for an ordered group of document links. It retains the native link and shared action paint, focus and sizing, with a square numeral SVG in place of the file icon. Use `data-ui-variant="quiet"` and a `.ui-label.ui-truncate`; keep the complete filename and recorded location in its accessible name/title. Put the links together in `.ui-actions` and leave captions adaptive: at narrow widths the captions collapse together into square numbered icons. `number` must be a positive safe integer and is a position within the displayed group, not an inferred document identity. Re-adopting the same number retains its glyph node. The app owns hrefs, ordering and document preview behavior. The catalogue's Numbered document links demonstrates the native pattern.


### Distinct icons within a bar

Each distinct action in one bar must use a distinct icon. Repeated document links use numbered square icons so their collapsed controls remain distinguishable. Keep accessible names and tooltips complete when captions collapse. All eligible captions in a navigation bar collapse together; do not force a few labels to stay visible while their neighbours collapse.


Review toolbars can use `createReviewControls(root,{layout:"bar",navigation,...})`
with the existing native navigation group inside the same root. Rating, commands,
inline tag entry and navigation share one row when the container permits, then
wrap without hiding actions behind a second toggle. The default stacked layout
remains available. The catalogue demonstrates the adaptive bar; tag inputs retain
their existing native entry and chips.

Popout headers, bodies, footers and native menu panels use two shared gap units
of edge padding. A form-wrapped dialog uses the same default 42rem shell width
as a direct `.ui-popout` dialog; use the documented width token for domain needs.
Context docks keep 24px bottom clearance, retain their nodes through browser
back/forward restoration, and refresh their bounds on return.

### Guided lessons

`SharedUI.createGuide({root, sprite, onBack, onSkip, onRestart, onNext})` creates a nonmodal native popover with shared actions and a selection marker around a real control. Call `open()` and `update()` with `{title, text, position, total, target, canNext, nextLabel, status}`. A target can be a connected element or a resolver; call `refresh()` after the application changes views or selection. The component owns bounded viewport positioning, native control focus, Escape, resize/scroll handling, hidden-view suspension and disposal. It never changes the target, submits a form, advances on a timer, or stores application state. Lessons and successful-action events belong to the consumer. `canNext` is for explanatory steps; action steps advance only after their consumer receives acknowledgment. Close or dispose the guide before leaving its view. The catalogue demonstrates a real form acknowledgment and coaching inside an anchored native tray in both packs. A guide follows its target into an open popover, including one inside a modal dialog, so Focus control does not light-dismiss the target tray. No animation is used, including with Reduce Motion.

### Compact native review and choice trays (1.16)

Use `createReviewControls(root,{layout:'rows',rating,actions,tags,navigation,iconOnly:false,sprite})` for a separate tags row above one adaptive command bar. The shared helper groups the existing command nodes once; resizing never rebuilds them. `--ui-dock-width` defaults to `70%`, and `--ui-dock-max-width` defaults to `64rem`. Supply a media/workspace bound through that token when appropriate. The composition expands to available width in a narrow container; it consumes the percentage once, making its `.ui-review-dock` parent full width. The parent has no outer scrollport hiding primary commands; the tag list owns its bounded scrolling. Navigation uses its natural action widths in wrapping layouts; an authored `.ui-fill` is suspended so unequal labels cannot be squeezed into equal narrow cells. Dispose restores authored slots and styles.

`createTagInput(input,{field,chips,layout:'field',...suggestions})` composes committed tags and the native entry in the existing `.ui-field` shell, using one border and focus indicator. Supply the existing form/field shell around the input, not a bare input. Chips and the trailing input share one wrapping flow, like a recipient field. There is no split input/chip column. The whole field is bounded to three control rows (`--ui-tag-list-height` overrides it); native vertical scrolling keeps every tag and the input reachable. Only initial adoption moves the chips inside the shell. The same nodes, native submission, input value and removal handlers remain; dispose restores placement. Dense tags use the native control padding and a 20px minimum, while coarse pointers retain 44px targets.

Use `adoptPropertyRow(row,{name,control,actions,layout:'compact'})` for a small inspector. It gives related rows an aligned eight-character label column (`--ui-property-label-width` overrides it) and the rest to the value, using the current shared density. The default technical property composition remains unchanged. For simple settings use `<label class="ui-check"><input type="checkbox">Show metadata</label>` rather than a separate On/Off command. Put record actions in `.ui-actions[data-ui-layout="vertical"][data-ui-align="start"]`; adopted SVG and text stay left aligned together.

A searchable recent-choice tray composes an existing native search input, `.ui-actions[data-ui-layout="vertical"][data-ui-align="start"]` choice buttons and optionally a separate small create form inside `.ui-popout`. Set `--ui-popout-width:22rem` for a small tray. Call `createAnchoredPopover(trigger,{element,onClose})` with that authored native popover. It owns dialog-parent placement, viewport bounds, resizing, scrolling, native light dismissal, Escape and focus return. It returns `open`, `close`, `refresh`, `setTrigger(nextTrigger)` and `dispose`. Closing does not destroy or reset content. The application retains choice history, search filtering, persistence, uncertain requests and retry state. Ordinary keys remain native inside the tray and do not escape into domain shortcuts.

`createResponsiveSlot(field,{primary,fallback,minWidth:240})` moves one existing search field between two stable hosts. Keep the primary host in a shrinkable allocated header track; it remains measurable while empty. Put the fallback host first in the filter section; the helper hides that empty host while search is in the header. Use a named native form. The helper retains native form association when the field leaves its form, defers relocation through IME composition, and preserves focus/caret. Moving a focused search into a closed native details section opens that section. Filter forms include associated external controls in values, counts, changes and clear. Dispose restores placement and attributes. Never clone or mirror the search input.

Use `.ui-link` on a native anchor, button or summary for a compact underlined text action. It shares the unframed native control reset and the shared visible focus indicator. Native summary keyboard activation keeps full documents available behind a compact disclosure, as shown in the catalogue.

Native panel/popover entrances use a 90ms opacity and 2px slide with Web Animations, without fill or layout-height animation. Native details bodies fade without a transform so absolute header controls keep their containing block throughout opening. `animatePanel(element)` also supports an explicitly revealed panel. Native actions, focus and input proceed immediately; the element is never recreated. Hidden documents and Reduce Motion skip/cancel the animation. The audit checks declared missing SVGs, hidden icon paint, empty symbol geometry and malformed references without fetching a sprite; consumers should additionally verify their same-origin sprite request and symbol IDs in browser fixtures.

The loopback browser fixture server also exposes `/compact`. **Run compact native checks** verifies both packs at 390/1440 px, the 70% review composition, tag-shell and disposal identity, and two independent documents with native search form association, focused fallback opening, caret/IME retention, anchored-popover Escape focus return and Reduce Motion suppression.

Context docks reserve the zoom slot while an overlay temporarily hides its controls; opening More never changes caption fit. `runAction` accepts `successState:'idle'` for repeatable semantic actions (Hide/Show): completion is announced without replacing the action icon or retaining success paint. Colour panels accept `maxColumns` (default 5), allowing a compact filter palette without changing card-picker geometry.

Anchored popovers accept `bindTrigger:false` when an existing command adapter already owns click handling. The app then calls `toggle` from its click command (or `open`/`close` explicitly); the helper still owns bounds, dismissal, ARIA and focus. This avoids two click handlers toggling the same menu twice.

Action feedback retains an existing semantic icon through success/error and re-adoption; iconless actions may use a feedback glyph. Busy feedback remains immediate. Item rows align text to the start, including a truncated label that fills the remaining row.


### Action appearance, visual choices and content width (1.17)

`SharedUI.setActionLayout(root,'beside'|'icons'|'above')` applies an inherited appearance to native adopted actions without replacing their SVG, caption, focus or listeners. Beside is the standard icon and caption. Icons uses a 26px glyph in a target at least 48px; Above uses a 32px glyph in a target at least 80px with the caption underneath. Coarse pointers retain at least 44px. Native headers, menu panels, composed `.ui-field` controls, `.ui-item` rows and physically scaled graphic actions retain beside layout. Call this helper when restoring or changing the application's saved appearance; the returned `data-ui-action-layout` attribute reports the setting and is not a CSS-only switch. Action groups keep their existing fit: captions collapse together only when required; opening More cannot change it. If even the large icon targets cannot fit a bar, the registered group temporarily uses normal-density icon targets; growing restores its saved appearance. Applications own persistence. `adoptAction` also gives newly added header/menu/field/item commands their readable defaults.

`createAdaptiveDensity(root,{container=root})` opts a workspace into actual-container density: below 360px Dense, below 760px Compact, 760–1600px Base, above 1600px Comfortable. It retains desktop 24px minima and coarse-pointer 44px targets. Its scoped ResizeObserver suspends in hidden documents; `refresh()` handles explicit placement changes and `dispose()` restores the prior density and releases listeners. Controls, input values, form association and IME remain native. Do not run it on a box whose width is determined by its controls.

Compose a visual library, board or help destination with a native button or link: `.ui-visual-card.ui-stack.ui-item`, first child `[data-ui-card-preview]`, then `.ui-label` and `.ui-meta`. Use `.ui-fit-media` on a decorative preview image (`alt=""`); retain a complete accessible name on the native card. Shared UI supplies paint, focus, spacing, full captions and the default 16:9 preview. Applications own source URLs, preview geometry overrides, selection and activation. A parent `.ui-grid` supplies responsive tracks; set `--ui-grid-min` for the content. Never adopt the whole preview card as an icon action: it is already one native compound choice. Selection uses the existing `.ui-selectable` and semantic ARIA/data state.

`.ui-content.ui-pad` gives ordinary pages shared gutters and a centered width based on the actual parent: fill narrow containers up to 48rem, honor `--ui-page-width` above that, and cap at 96rem. Apply it once. Canvas/media workspaces keep domain tracks. Existing `.ui-popout` owns bounded header/body/footer panels: use `--ui-popout-width:22rem` for a compact choice tray, place scrolling choices in `[data-ui-popout-body]`, and keep decisions in the direct footer. A short Help menu uses visual destinations, not a full-screen document. The Action appearance catalogue demonstrates all three modes, native draft retention and visual choices in both packs.

This release removes undocumented pre-SharedUI control aliases and generic SVG wrappers. Use native controls, the documented `.ui-*` roles, `data-ui-variant`, and `svg.ui-icon`. Field/toolbar/list surface paint is consolidated with their existing native definitions; generated assets remain one-way build output.


For a centered bounded tile grid, keep the existing `.ui-grid` with default `auto-fit`, set `--ui-grid-min:20rem; --ui-grid-max:30rem`, and use `justify-content:center` as domain geometry. One visual card then grows to 30rem and centers; several cards form centered rows and wrap inside the actual container. The maximum defaults to `1fr` for ordinary forms and grids. Do not use `data-ui-grid="fill"` for this composition: fill intentionally reserves empty tracks. The bounded-grid catalogue demonstrates one, three and six native visual choices.

Composed checkbox and radio labels (`.ui-check.ui-field` / `.ui-choice.ui-field`) retain the native field minimum, including 26px Dense fields. Ordinary checks and buttons retain the control minimum (24px Dense); coarse pointers retain at least44px. The catalogue's Audio tools checkbox demonstrates the composition beside a native search-and-Copy field.

Each density boundary resolves field padding from its own control padding. A compact search field stays 30px high even inside a comfortable page or after a responsive slot moves it out of a dense menu. Coarse-pointer fields retain the shared 44px minimum.

Use `label.ui-icon-choice.ui-action` for a full-surface toggle choice: shared SVG, `.ui-label`, then a native checkbox or radio. The label owns the visible surface and focus ring; the native input retains checked state, keyboard activation and form submission without a separate square checkbox. The catalogue demonstrates Group by Colour and Show hidden.

### Semantic labels in compact toolbars

Use `data-ui-label="always"` for navigation and decisions whose identity must stay visible. `ui-item` record names and labelled menu choices also retain their captions in icon-only appearance. Icon-only toolbar preferences apply to decorative action captions, not the names of records or destinations. Reflow clears a prior compact state when a caption becomes explicit.


### Compact component tree

Load the opt-in `control-tree.css` alongside `styles.css` in pages that use
this component. The main Shared UI stylesheet remains unchanged for other apps.

A component hierarchy can reuse the same compact rows and keyboard behavior across apps.
The app owns its navigation state, control data, and the editor shown for the selected row:

```js
const tree = SharedUI.createCompactControlTree({
  navigation, // rows(query), key(id,key,query), toggle(id), select(id), selected
  sprite: '/shared-ui/icons.svg',
  onSelect: componentId => openControls(componentId),
  onChange: () => saveNavigation(),
});
sidebar.append(tree.element);
tree.render();
```

Rows may declare `id`, `parent`, `label`, `depth`, `children`, `expanded`,
`protected`, `available`, and `selectors`. A row with selectors exposes a variation
accent, while folders retain ARIA hierarchy, keyboard expansion, typeahead and focus
after re-render. Use `tree.setQuery(text)` for search. Hosts can pass
`onContextMenu(row,event)` for domain-specific Copy/Archive commands; no
destructive action is built into Shared UI. Controls stay owned by the selected
component, without repeated Advanced subgroups or a separate popup.

Launcher tiles use `.ui-app-tile` with `.ui-app-symbol` and `.ui-label`. Shared UI owns the compact 56 px symbol, control typography and wrapping captions aligned beneath the icons. Launcher tiles retain this column layout and their destination captions in every action appearance. Do not force one-line captions or override tile height in an app. Native page scrolling and pinch zoom stay available outside explicitly opted-in canvas/drag surfaces. The Compact decisions catalogue exercises nested forms, long captions, feedback and native Reply disclosure in one bounded card.

A fixed mobile launcher row can set `--ui-fill:4`, `--ui-grid-min:0px` and `--ui-grid-max:1fr` on `.ui-grid`; center and bound the grid with domain placement. Keep shared tile sizing and touch targets.

Launcher layout regression: serve the repository and open `test/app-tiles.browser.html`. Run its checks to verify destination captions beneath symbols in both packs, both themes, every action appearance and narrow/desktop containers.


### Compact response-curve values

Use `createCurveValue(options)` in a property row for a cubic response curve. It accepts the same label, points, defaults, invert, axis labels, endpoint labels, onChange and onError as `createCurveControl`, plus the local sprite. Its native value button shows a small live curve preview; opening it reveals the existing full editor in a bounded `.ui-popout`. Exact handle fields are disclosed deliberately. Escape, outside dismissal, focus return, native keyboard handles and draft preservation use the shared popover/editor owners. `sync`, `open`, `close` and `dispose` retain those same nodes. The consumer owns accepted values, scalar mapping and History. The Effects control panel catalogue demonstrates it in both packs.


Switchable rows in the compact control tree expose a native choices action when `onContextMenu` is supplied. Pointer, touch and keyboard users can open the same application-owned choices; right-click and Shift+F10 remain available. The action never selects a variation by itself, and rows without choices gain no action. Native child controls keep their normal editing keys.


### Clear decisions, feedback and removable filters (1.21)

Explicitly visible action labels wrap within narrow buttons instead of overflowing. Primary actions retain their visible caption by default when adopted, including narrow containers and icon appearance. An explicit `iconOnly:true` or `data-ui-label="hidden"` still requests a symbol. Property actions keep the action verb beside the glyph. Existing nodes, native submission and saved appearance remain intact.

Use `.ui-info`, `.ui-success`, `.ui-warning` or `.ui-error` on `.ui-status` or `.ui-tag` for contextual, successful, attention-needed or failed states. Always include meaningful text: colour never replaces the state name. Do not use success to imply that a local override is wrong, or error to mean merely different. Foundations demonstrates this contract in both packs.

Composed fields show one focus ring on the field shell. Explicit `aria-invalid="true"` or native `:user-invalid` marks that same outer border; describe the correction with associated text. Field values, native validation and keyboard behavior stay native.

Pass `summary: host` to `createFilterMenu` with an authored `<div class="ui-actions ui-tags" data-ui-filter-summary aria-label="Active filters"></div>` outside the native details. Active criteria become labelled removable chips; removing one restores just that criterion's configured default. Other filters, disabled controls, drafts and menu state survive. `clear(name)` provides the same operation programmatically; `clear()` clears all enabled criteria. The native form `reset` event refreshes state after the browser restores defaults; a cancelled reset does nothing. Chips retain their nodes through refresh, focus moves to another chip or the filter summary on removal, and disposal removes only owned chips/listeners. The Collection filters catalogue demonstrates this pattern.

Standard property rows bound their label column to 18 characters (or 35% in a narrow panel), reserve two action slots so values stay aligned, and leave the rest for the value. `--ui-property-actions-width` can declare a different shared action gutter. Set `--ui-property-label-width` to tune a domain's label width. This removes wide empty label gutters without compressing native value fields. Compact, leading-actions and trailing layouts retain their existing contracts.

Static responses are cached with gzip level 9. The builder, Studio validator and local host measure/use the same compression; source and generated CSS remain bounded to 36 KiB raw / 8 KiB gzip.

Coarse pointers reset composed-field padding with their 44px density. A comfortable desktop profile no longer leaves oversized internal padding when the same container is used on touch.

Status messages use the reading font; numeric outputs and read-only values retain monospace. Repeatable action completion is announced in the existing polite live region while the action keeps its stable accessible name.
