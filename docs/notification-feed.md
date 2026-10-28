# Notification feed (optional)

`data-ui="portal"` is a distinct presentation profile, not an application framework. It uses the same native actions, fields, disclosure behavior, focus states and accessibility as Personal/Postvisual. The optional sheet does not change either existing pack or the core bundle manifest. Load it after `v1/styles.css`.

Generic components are `.ui-compose`, `.ui-feed`, `.ui-notification`, `.ui-notification-body`, `.ui-notification-mark`, `.ui-notification-content`, `.ui-notification-meta`, `.ui-notification-title`, `.ui-notification-actions` and `.ui-notification-receipt`. Portal owns page composition, queue policy, request IDs and receipts. No Portal source or user data is included here.

Appearance is separate from component semantics: `--ui-compose-radius`, `--ui-compose-inset`, `--ui-notification-inset`, `--ui-notification-gap`, `--ui-notification-mark-size`, `--ui-notification-radius` and `--ui-notification-surface` allow an app profile to look different without duplicating controls. The Portal profile uses compact divider-separated rows and a rounded composer. Coarse-pointer controls remain at least 44px; narrow layout does not shrink touch targets.

## Build, preview and install

Run the normal `npm run build` first for the core catalogue, then:

```sh
node scripts/build-notification-feed.mjs
python3 -m http.server 8090 --bind 127.0.0.1 --directory public
# Open http://127.0.0.1:8090/notification-feed.html in a headed browser.
node --test test/notification-feed.test.mjs
node scripts/install-notification-feed.mjs --target ../portal/internal/web/assets/shared-ui
node scripts/install-notification-feed.mjs --target ../portal/internal/web/assets/shared-ui --check
```

The installer owns exactly `notification-feed.css`, `swipe-actions.mjs` and `notification-feed.bundle.json`. Its manifest hashes both sources; it leaves the existing baseline, runtime and unrelated optional packages alone. No remote code is downloaded or executed. The optional sheet has independent limits of 8KiB raw / 2.5KiB gzip; it does not consume or raise the core 36KiB / 8KiB budget.

## Gestures are optional shortcuts

Import `mountSwipeActions(root)` from the local `swipe-actions.mjs`. Mark a row `data-ui-swipe`, with meaningful `data-ui-swipe-right="Reply"` and `data-ui-swipe-left="Dismiss"` labels. Handle `ui:swipe` by opening the existing native reply disclosure or activating its native dismissal control. All actions must remain available without gestures or JavaScript. A swipe must never imply approval. A native `summary` is excluded unless it explicitly opts in with `data-ui-swipe-start`; opt in only the row heading, keeping links and controls excluded. A committed swipe consumes its synthetic click so the heading does not toggle twice, while the next intentional press and keyboard activation remain native.

The helper has no fetch, storage, timers or application state. It locks horizontal intention, respects vertical scrolling, excludes controls/text selection/edge navigation, cancels on multi-touch, pointer cancellation, focus loss or hidden views, and commits only after an 80px gesture. `data-ui-swipe-disabled` or `aria-busy="true"` suppresses it. Applications must also reject dismissal of unsent/pending replies. Call its returned cleanup on teardown and remount after a restored page.

The catalogue is synthetic. Portal's actual request and persistence acceptance is a separate consumer gate; visual testing alone does not establish it.
