# Shared UI

One native HTML control language for Aura, StaticRef and Portal. Postvisual follows StaticRef's neutral media-first interface; Personal follows Portal. Theme, control density and application layout are separate choices.

The package has no runtime dependencies. Build and validation use Node's standard library:

```sh
npm run check
```

## Integration

Serve `public/v1/styles.css` and `runtime.js` with the application's own assets. Mark the human-facing document `<html data-ui="postvisual">` or `<html data-ui="personal">`. Put application styles in `@layer app`. Use `data-ui-density="compact"`, `dense`, or `comfortable` on a control group. Effects, images, video and output-only renderer documents keep their own rendering.

Use native `button`, `input`, `select`, `textarea`, `details` and `dialog`. Button variants are `data-ui-variant="primary"`, `quiet`, or `danger`. Existing `.primary`, `.text-button`, `.plain-button`, `.button` and `.icon-button` classes share these definitions during adoption. `.ui-toolbar`, `.ui-menu`, `.ui-menu-panel`, `.ui-panel`, `.ui-section-title` and `.ui-prose` express reusable roles. Headings H1–H6 are defined independently of control density.

Layout CSS may position and size application-specific media, timelines, canvases and rows. Common control paint belongs here. Use semantic `--ui-*` variables instead of page-specific palettes. Content colors such as a user's color parameter or collaborator identity remain content data.

## Automatic updates

Successful pushes to `main` build and publish a v1 manifest and an immutable, integrity-addressed stylesheet through GitHub Pages. Apps retain their bundled baseline and check for compatible style updates in the background every five minutes while visible. Same-origin views coordinate checks with a short storage lease and BroadcastChannel notifications. The browser's shared asset cache handles the stylesheet bytes.

An update becomes active only after the replacement stylesheet loads and its integrity check passes. A failed fetch or offline session retains the working appearance. Style refresh never rebuilds the page or changes playback, forms, focus, selection, renderer identity or application state. Hidden pages stop checking; closing a page cleans up its listeners and channel. Browser behavior code stays bundled with each app and is upgraded through its normal code release.

Allow `https://andyherle.github.io` in `style-src` and `connect-src` when using automatic updates. Keep scripts same-origin. No app credentials or user content are sent to the style source; update requests omit credentials and referrers. Use a bundled revision when a deployment must remain visually frozen. A major control-contract change requires a new version channel and an application migration.

## Style Lab

The catalogue demonstrates working controls rather than a sheet of static mockups: buttons and busy states; native fields and validation; selects, suggestions, searchable choices and tags; menus, tabs and disclosures; dialogs, drawers, popovers, tooltips and feedback; tables, selection and pagination; draggable Canvas cards and inspectors; timeline scrubbing and easing; images, audio, video, ratings and lightboxes; H1–H6 and Markdown-shaped content; a 31-icon SVG sprite.

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

The lab is a reviewable foundation for app adoption. Creating it does not rewrite Aura, StaticRef or Portal. Adopt one app surface at a time, preserve domain behavior and renderer isolation, and verify the actual app before shipping. Studio Blanc is excluded.
