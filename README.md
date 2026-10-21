# Shared UI

One native HTML control language for Aura, StaticRef and Portal. Personal mirrors Postvisual, with explicit overrides available through Studio. Theme, control density and application layout are separate choices.

The package has no runtime dependencies. Shared CSS is bounded to 36 KiB raw and 8 KiB gzip, including the shared floating review panel. Build and source validation use Node's standard library:

```sh
npm run check
```

## Integration

Serve `public/v1/styles.css` and `runtime.js` with the application's own assets. Mark the human-facing document `<html data-ui="postvisual">` or `<html data-ui="personal">`. Put application styles in `@layer app`. Use `data-ui-density="compact"`, `dense`, or `comfortable` on the document root or a control group. Compact desktop controls use 30 px buttons and fields with 6 px gaps. Dense controls use 24 px buttons, 26 px fields and 4 px gaps. Coarse pointers retain 44 px targets and 16 px native field text. Effects, images, video and output-only renderer documents keep their own rendering.

Use native `button`, `input`, `select`, `textarea`, `details` and `dialog`. Actions use the standard outlined control. `data-ui-variant="primary"` emphasizes the main action and `danger` identifies destructive actions. Common controls have one paint definition; app CSS supplies layout only. `.ui-toolbar`, `.ui-menu`, `.ui-menu-panel`, `.ui-panel`, `.ui-section-title` and `.ui-prose` express reusable roles. Headings H1–H6 are defined independently of control density.

Layout CSS may position and size application-specific media, timelines, canvases and rows. Common control paint belongs here. Use semantic `--ui-*` variables instead of page-specific palettes. Content colors such as a user's color parameter or collaborator identity remain content data.

## Automatic updates

Successful pushes to `main` build and publish a v1 manifest and an immutable, integrity-addressed stylesheet through GitHub Pages. Apps retain their bundled baseline and check for compatible style updates in the background every five minutes while visible. Same-origin views coordinate checks with a short storage lease and BroadcastChannel notifications. The browser's shared asset cache handles the stylesheet bytes.

Mark only the bundled UI sheet with `data-ui-baseline` on its `link` or `style` element. An update becomes active only after the replacement stylesheet loads and its integrity check passes; it then removes that marked sheet so deleted rules disappear. Keep app layout in a separate unmarked sheet. A failed fetch or offline session retains the working appearance. Style refresh never rebuilds the page or changes playback, forms, focus, selection, renderer identity or application state. Hidden pages stop checking; closing a page cleans up its listeners and channel. Browser behavior code stays bundled with each app and is upgraded through its normal code release.

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

`.ui-actions` aligns controls to the start and wraps them to the available container width. `.ui-toolbar` adds a shared command-bar surface. `.ui-fill` gives buttons and action links equal flexible space; disclosure controls keep their intrinsic width. `data-ui-layout="vertical"` stacks them with visible labels. For an intrinsic group beside other content, use `.ui-inline`; its width follows its content instead of establishing a size query. No per-page button breakpoint is needed. A bounded panel or grid cell can use `.ui-container` as the parent query host for intrinsic groups. Grid tracks that should shrink need `minmax(0,1fr)`; an `auto` track sizes to its content and must use `.ui-inline` for its action group. Size containment cannot derive its own width from descendants.

An action consists of a decorative `svg.ui-icon` and a `span.ui-label`, plus a complete accessible name. When expanded controls no longer fit, every eligible caption in the row gives way together, including primary actions and composed-field captions. Native selected values remain visible. `data-ui-label="always"` keeps that action readable while its neighbors compact; `hidden` identifies a deliberate symbol control such as a rating or zoom step. Narrow rows containing only actions distribute buttons evenly when each fits its share. Use `.ui-fill` for an explicitly equal row. Intrinsic nested groups share one fit decision; a horizontal parent does not hide labels in a nested vertical group. Native selectors retain their selected value. `.ui-search` grows horizontally within action rows; a standalone search field never grows into unused panel height. Coarse pointers retain 44 px targets and 16 px field text. Native date/time fields include the [iOS padding containment workaround](https://bugs.webkit.org/show_bug.cgi?id=301648), preserving native pickers.

Use `SharedUI.adoptAction(element, {icon, label, ariaLabel, iconOnly, title, sprite})` when creating a native action. It retains the element and its handlers, preserves existing ARIA and titles unless explicitly replaced, and uses the app's same-origin sprite. `SharedUI.setActionLabel(element, label, {ariaLabel})` changes a label without removing its icon. A scoped ResizeObserver watches registered action groups and their immediate row, with one queued fit per size change. It stops in hidden views and releases observers, listeners and queued work on disposal. There is no global DOM observer, polling loop, framework, or automatic DOM rebuilding. Dynamic adoption refreshes a group only when its action changes; call `SharedUI.observeActions(group)` after adding or removing controls and `SharedUI.refreshActions(document)` after other layout changes.

`details.ui-section` is the default for collapsing content below a heading: its native heading (normally `<h5>`) uses the default shared heading typography and spans its container, with one full-width line below the text and no button outline. Put it inside the component padding so the line shares its margins. Native open state, focus and keyboard behavior are retained. Use it for inspector groups, record sections and optional in-place details.

`details.ui-disclosure` and `.ui-disclosure-body` provide a button-triggered disclosure in an action row. The summary inherits the same action appearance and states, sizes to its caption, and never stretches across a row. Its only extra UI is the native disclosure indicator. Put Reply beside the other actions in their `.ui-actions` row; its `.ui-disclosure-body` opens below the row. Collapsing retains the same DOM, values and handlers. Use `fieldset.ui-group` with a `legend` to name a related set of controls; it adds no behavior or application state. `.ui-mono` or `data-ui-font="mono"` keeps code fields in the shared monospace font.

For a record detail or inspector, show ordinary facts in native `<section class="ui-stack">` blocks headed by `.ui-section-title`. Keep actions beside their subject in `.ui-actions`; a filename should open its exact document, and a source link should open the full original. Use a disclosure for optional controls or an individual row that opens for more context. Do not substitute a stack of disclosure buttons for the sections of one record, or put one read-only disclosure inside another. When many secondary facts belong together, use one Details control and plain headings inside its body. The catalogue's “Record detail” example demonstrates the visible hierarchy in both packs.

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

## Packaging the baseline

Run from this repository to update an app's generated assets:

```sh
node scripts/install.mjs --target /path/to/app/shared-ui-assets
node scripts/install.mjs --target /path/to/app/shared-ui-assets --check
```

The installer validates the canonical release and browser code before writing exactly `styles.css`, `runtime.js`, `icons.svg`, `manifest.json`, and `bundle.json`. Identical bytes are left untouched. The bundle records every file hash; `--check` rejects generated drift. Deployment uses those local assets with no Node runtime requirement.

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


### Adjustable columns and stable lightboxes

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
with this content-sized popout frame, capped at 900 × 760 and by the viewport. Use three direct
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

Tag entry uses the same native field font and border as other controls. `.ui-tag` defaults to padded neutral grey; selected tags explicitly set `aria-pressed="true"`. `createTagInput` reserves a bounded two-row suggestion slot to prevent layout movement on focus/filtering. Use `.ui-review-dock.ui-panel.ui-stack` for centered lower media controls with safe-area-aware bottom clearance; the application supplies contents and a positioned stage.

`fitMedia(media, stage, {controlsOnIntent:true})` keeps a native video’s controls hidden when inserted, then reveals them on actual pointer movement, touch or keyboard focus. Disposal restores native attributes. Center review command/tag rows using the common `data-ui-align="center"` modifier on `ui-actions`/`ui-tags`.

The shared `ui-card-container ui-card ui-stack` composition separates a primary `button[data-ui-surface="graphic"]` from a native footer (`ui-actions ui-pad`, `data-ui-align="end"`) containing `details.ui-menu`. Use `ui-pad ui-stack` for primary text so content and footer share one edge. Keep previews in the primary button and menu actions outside it; no detached floating menu or nested interactive targets.

Action feedback lives on the action. `SharedUI.setActionState(button,{state:'idle'|'pending'|'success'|'error',message,sprite})` preserves native handlers, label sizing and focus, shows the shared yellow pending spinner or crisp green check, and puts accessible announcements inside the button. `runAction(button,asyncOperation,{pending,success,sprite})` manages the same lifecycle and rethrows failures. Call it for save, submit, confirm and other action results; use the same API for automatic saves. The structural audit flags standalone state feedback without a button owner. Background health/presence may explicitly declare `data-ui-feedback="background"`; that exception does not cover action results. Header status stays centered in the same row instead of moving beneath commands.

The shared `ui-lightbox` shell fills the viewport without a second panel frame. Its `[data-ui-lightbox-body]` owns the media or same-origin gallery iframe and its optional `[data-ui-lightbox-close]` uses the standard close action at the top edge. Catalogue and Canvas use the same shell; the gallery retains domain navigation, metadata flushing and playback inside it.

`createAvatar(name,{document,size:24})` composes the shared tag tokens into a fixed, passive circular presence indicator. Full names stay in the accessible label/title rather than affecting row geometry.

`installZoomShortcuts(document,{canZoom,onZoom})` shares Command+Up/Right/+ and Command+Down/Left/− with native field, composed-path and IME guards. Apps supply bounded content transforms; never scale chrome. Dispose removes all handlers. `createZoomFeedback(document).show(percent)` updates one persistent, bottom-centered native minus/percentage/plus toolbar per document. It emits `ui:zoom` with direction −1/0/+1; zero resets. Apps own bounds and content geometry. Idle opacity increases on hover or keyboard focus. Native dialogs, menus and popovers suspend it automatically. Apps call `setVisible(false)` for custom overlays or non-content routes and restore it on close; dispose removes its listeners. The unframed `.ui-review-dock.ui-stack` centers review actions and tags without a surrounding panel border.

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

`SharedUI.createSectionActions({root,actions,sprite,onChange})` adds native **Expand all** and **Collapse all** actions for `details.ui-section` within a root. Hidden sections remain untouched. It changes only native open state and reports `{open,sections}` for host-owned persistence. `refresh()` updates disabled states after host filtering or insertion; `dispose()` releases buttons/listeners. No section or form field is recreated.

`SharedUI.createMediaViewport({surface,content,minScale:.125,maxScale:32,onChange})` lets a bounded preview inspect existing pixels without changing content dimensions or application state. Two-finger scroll/wheel pans; pinch or Ctrl/Alt/Command-wheel zooms around the pointer; Space + primary drag or middle drag also pans; Shift-wheel pans horizontally; double-click fits. Focus the surface for +/− zoom, arrow-key pan and 0/Escape to fit. Toolbar buttons, fields and editable content retain their native interaction. `zoom(factor,point)`, `pan(x,y)`, `fit()`, `.state` and `dispose()` allow host controls and cleanup. The host owns placement, clipping and existing creative overlays; `onChange` can reproject overlays. Transforms affect only the content node, leaving UI chrome unscaled. The Control fixture demonstrates both helpers with native sections and an SVG image.

Media viewport hosts can set `keyboard:false` to reserve all keys for transport/editors, or `spacePan:false` to reserve Space alone. `setEnabled(false)` cancels an active preview gesture and lets native host scene tools receive pointer/wheel gestures; enabling restores preview inspection without changing its transform.

### Preview catalogues and proof sheets

`SharedUI.createPreviewCatalogue({root,onSelect,onManage,sprite})` uses native media cards, caption actions, the shared grid and selection states. `update(items,selectedId)` accepts `{id,label,image,detail}`; images are contained in 16:9 previews. Stable cards retain focus; `dispose()` releases the owned DOM. The host owns collections, filtering, scene activation, image URLs and source/state identity.

`SharedUI.renderProofSheet({items,title,width:3840,height:2160,background,color,font,signal})` composes loaded image previews onto a canvas, with contained 16:9 cells and measured labels. It returns `{canvas,cells}`. The host must supply real render outputs and label their sampling; the helper never invents data or changes a scene. Callers may supply theme typography/palette values and download the canvas as PNG. The catalogue includes a synthetic interactive fixture.


### Numbered document links

Use `SharedUI.adoptNumberedAction(link,{number:1,label:'Bank statement.pdf',ariaLabel:'Statement 1: Bank statement.pdf',sprite:'./shared-ui/icons.svg'})` for an ordered group of document links. It retains the native link and shared action paint, focus and sizing, with a square numeral SVG in place of the file icon. Use `data-ui-variant="quiet"` and a `.ui-label.ui-truncate`; keep the complete filename and recorded location in its accessible name/title. Put the links together in `.ui-actions` and leave captions adaptive: at narrow widths the captions collapse together into square numbered icons. `number` must be a positive safe integer and is a position within the displayed group, not an inferred document identity. Re-adopting the same number retains its glyph node. The app owns hrefs, ordering and document preview behavior. The catalogue's Numbered document links demonstrates the native pattern.


### Distinct icons within a bar

Each distinct action in one bar must use a distinct icon. Repeated document links use numbered square icons so their collapsed controls remain distinguishable. Keep accessible names and tooltips complete when captions collapse. All eligible captions in a navigation bar collapse together; do not force a few labels to stay visible while their neighbours collapse.
