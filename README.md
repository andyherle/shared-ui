# Shared UI

One native HTML control language for Aura, StaticRef and Portal. Postvisual follows StaticRef's neutral media-first interface; Personal follows Portal. Theme, control density and application layout are separate choices.

The package has no runtime dependencies. Shared CSS has a 32 KB raw budget. Build and validation use Node's standard library:

```sh
npm run check
```

## Integration

Serve `public/v1/styles.css` and `runtime.js` with the application's own assets. Mark the human-facing document `<html data-ui="postvisual">` or `<html data-ui="personal">`. Put application styles in `@layer app`. Use `data-ui-density="compact"`, `dense`, or `comfortable` on the document root or a control group. Dense desktop controls use 24 px buttons, 26 px fields and a 4 px group gap; coarse pointers retain larger touch targets. Effects, images, video and output-only renderer documents keep their own rendering.

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

`.ui-actions` aligns controls to the start and wraps them to the available container width. `.ui-toolbar` adds a shared command-bar surface. `.ui-fill` gives actions and native `details.ui-disclosure` wrappers equal flexible space; `data-ui-layout="vertical"` stacks them with visible labels. For an intrinsic group beside other content, use `.ui-inline`; its width follows its content instead of establishing a size query. No per-page button breakpoint is needed. A bounded panel or grid cell can use `.ui-container` as the parent query host for intrinsic groups. Grid tracks that should shrink need `minmax(0,1fr)`; an `auto` track sizes to its content and must use `.ui-inline` for its action group. Size containment cannot derive its own width from descendants.

An action consists of a decorative `svg.ui-icon` and a `span.ui-label`, plus a complete accessible name. Primary action labels stay visible. At small container widths, secondary action labels give way to the icon; text-only controls stay readable. `data-ui-label="always"` keeps a visible label and `hidden` requests an icon-only control. Nested groups adapt to their own container; a horizontal parent does not hide labels in a nested vertical group. Native selectors retain their selected value. `.ui-search` flexes with its group and takes a full row in narrow toolbars. Coarse pointers retain 44 px targets and 16 px field text. Native date/time fields include the [iOS padding containment workaround](https://bugs.webkit.org/show_bug.cgi?id=301648), preserving native pickers.

Use `SharedUI.adoptAction(element, {icon, label, ariaLabel, iconOnly, title, sprite})` when creating a native action. It retains the element and its handlers, preserves existing ARIA and titles unless explicitly replaced, and uses the app's same-origin sprite. `SharedUI.setActionLabel(element, label, {ariaLabel})` changes a label without removing its icon. There is no global observer, resize loop, framework, or automatic DOM rebuilding.

`details.ui-disclosure` and `.ui-disclosure-body` share a native collapsible section. The summary inherits the same action appearance and states; its only extra UI is the native disclosure indicator. Collapsing retains the same DOM, values and handlers. Use `fieldset.ui-group` with a `legend` to name a related set of controls; it adds no behavior or application state. `.ui-mono` or `data-ui-font="mono"` keeps code fields in the shared monospace font.

`--ui-range-thumb` fixes shared slider geometry for sibling timeline markers. `.ui-range` is the optional common track/thumb skin.

`aria-pressed` (including native `mixed` partial selection), `aria-selected`, `aria-invalid`, `aria-busy`, native `disabled` and `aria-disabled` express shared states. `.ui-status` and `.ui-notice` accept `data-state="pending|success|error|warning"`; empty status rows disappear. Native menu summaries, buttons, button links, radio choices, and fields share focus and state definitions.

`.ui-field` composes a native input or select with icons, an inline `.ui-label`, or adjacent actions using one field border and focus indicator. Use it for selectors such as Zoom, with the label inside the field instead of a separate heading. A readonly URL input plus a Copy action keeps long links to one line while retaining native selection and keyboard copy. `.ui-truncate` keeps compact filenames to one line; retain the complete text in the accessible name/title. Apps must reuse these native DOM patterns and action helpers rather than inventing custom controls. Native `progress` uses the pack track and accent. Plain Markdown details retain native markers and body typography. `.ui-card` is a quiet surface; `.ui-panel` is a raised overlay. `.ui-item` keeps a structured clickable row's app layout with common control paint. `.ui-swatch` renders a data color inside the standard touch target. `.ui-graphic-action` preserves a native icon action’s physical target inside a scaled world without changing app placement. `.ui-resize-handle` separates the visual handle from its hit area. A transformed world can publish its positive zoom as `--ui-graphic-scale`; the shared hit area and visual handle stay the same physical size. Update that variable when zoom changes, using the existing viewport controller. Timeline markers use `--ui-playhead-color`, `--ui-playhead-outline` and `--ui-playhead-width` for theme contrast. Graphic controls retain app-layer touch gestures; resize handles use `touch-action:none`. Clipped rows can set `--ui-focus-offset` to a negative inset while retaining shared focus paint. Use `data-ui-surface="graphic"` for positioned interactive diagrams, `media` for preview buttons, and `.ui-inline-field` for in-place canvas text. In-place fields retain app-layer padding and resize geometry so a canvas card keeps its writing inset and its own handles. These explicit roles preserve domain geometry without creating new palettes or control implementations.

## Packaging the baseline

Run from this repository to update an app's generated assets:

```sh
node scripts/install.mjs --target /path/to/app/shared-ui-assets
node scripts/install.mjs --target /path/to/app/shared-ui-assets --check
```

The installer validates the canonical release and browser code before writing exactly `styles.css`, `runtime.js`, `icons.svg`, `manifest.json`, and `bundle.json`. Identical bytes are left untouched. The bundle records every file hash; `--check` rejects generated drift. Deployment uses those local assets with no Node runtime requirement.

Set `data-ui-version` and `data-ui-revision` from the bundled manifest. A page rejects automatic CSS older than its bundled contract, accepts compatible v1 releases, and keeps its working baseline on failure. Automatic updates carry CSS; helper code and icon additions ship through the normal app release and the same installer.

Use `ui-menu data-ui-position="overlay"` for a menu whose app layout already anchors its position. The pack preserves that geometry while owning its controls and paint. `ui-selectable` gives media buttons and composite cards the same selection outline. Native controls expose selection through their valid ARIA state; composite content can expose `data-ui-selected="true"` or `"mixed"` without changing its article semantics. The outline and focus target follow `--ui-graphic-scale` in a zoomable canvas.

## Compact workspace typography

Use `.ui-chrome` for operational panels and data tables, `.ui-section-title` for a compact panel heading, and `.ui-meta` for secondary text and paths. `.ui-value` is the shared numeric summary type. Full H1–H6 and `.ui-prose` remain document typography; do not use them to size a small storage label or table header. Density and palette remain independent, so Personal and Postvisual chrome have the same geometry at the same density.

`.ui-stack` owns vertical rhythm and clears child block margins. `.ui-pad` uses twice the shared gap as surface padding. Apply them to native cards and sections; keep domain grids and structured row placement in the app layer. `.ui-tabs` supplies start-aligned native tabs and the selected underline. `.ui-actions` / `.ui-toolbar` default to start alignment; request `data-ui-align="center"` or `"end"` deliberately. `data-ui-variant="quiet"` keeps native actions and focus with a quiet resting surface, for list rows and filenames. Use `.ui-truncate` on the label for compact filenames and retain the full accessible name/title.

The catalogue's **Workspace scale and alignment** section demonstrates these roles in a reusable, data-free example.

Use native `label.ui-check` for checkbox and radio rows. It aligns the glyph and caption on one line and retains the shared control-height hit target, including coarse pointers.

Native labels retain application row placement. The shared pack does not force every label or its inputs into a vertical stack; use `.ui-field` for one composed field and `.ui-choice` for a native checkbox/radio row. App-layer flex/grid placement survives a compatible CSS refresh.
