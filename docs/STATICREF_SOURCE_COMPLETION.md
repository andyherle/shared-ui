# Source-complete coordinator handoff — StaticRef first, Aura second

**Purpose:** Finish coordinator-owned source work and supply one reproducible handoff
for a **separately user-initiated Codex local setup**. This is NOT authorization
to run a process, start Codex, disable confinement, merge, publish, migrate or
deploy. Source checks and browser acceptance are different outcomes.

## Source pins and evidence classes

| Source | Required source/revision (review snapshot; recheck moving heads) | Evidence |
| --- | --- | --- |
| Shared-ui canonical composition draft PR #4 | `3c5c7fad13fd68940d2d50ba55ddeb04799e2e7d` | CI `145/145`; source only |
| Shared-ui managed launcher draft PR #5 (stacked on PR #3) | Source after this handoff's final commit; check PR head and its successful CI run | Source-only runner tests; no fixture or browser |
| Shared-ui offline index draft PR #3 | `1e655db520471587f280a2cc377313d67106093b` | Source CI green |
| Shared-ui desktop width draft PR #2 | `5333901c80cccd75aa56146c6ca67ffc6152f61b` | Source CI green, uninstalled |
| StaticRef fixture source draft PR #32 | `2e6d2bbb31fb5e2010c87cce79b4065dc5ed1a3d` | Prepared app source; currently unrun |
| StaticRef heading fix draft PR #31 | `d0139bd231b3cb5b1bf02df6b7380d975d992f5e` | Separate, intended behavior change; unmerged |
| Shared-ui baseline source for v1.10.2 | `4982908e9a251bc58026fa7a565b75d727984c5f` | Match generated output to installed bytes before claiming baseline |
| Aura app draft PR #36 | `7b7a50e13bcdc50972d4a57e113178887e76dd60` | **Second** consumer; moving owner branch, not StaticRef acceptance |

**Do not substitute a mutable branch ref, the original StaticRef v1.10.2
fixture entrypoint or an earlier PR #32 head for these pins.**
The StaticRef managed entrypoint is
`tests/browser/serve_ui_review.py`, not `serve_ui_fixture.py`.
The latter remains the existing app-owned synthetic assembler it imports.
The PR #31 changes are deliberately excluded from PR #32, so **PR #32 alone
must never be called the combined heading-fix candidate**.

### UI bundle digest inventory — measurements versus unknowns

- **Measured by PR #4 GitHub Actions source build:** candidate stylesheet
  SHA256 `11bea36b6fac53a2f85b6c1dee199365b888722eb65971a4b489caf4835acaae`,
  34,090 bytes raw / 7,611 bytes gzip, proposed bundled release `1.11.0`.
- **NOT measured/staged in an independent approved review environment:**
  candidate `runtime.js`, `icons.svg`, `manifest.json` SHA256, complete
  four-file aggregate digest, and independently rehashed candidate `styles.css`.
  Source CI is not an installed candidate receipt.
- **StaticRef checked-in v1.10.2 baseline manifest values**, not independently
  staged/rehashed in this handoff:
  `styles.css=188be7615bc18d1c6cc28c599d1a69966f24d854f96e69f340373db90621cf0c`;
  `runtime.js=1223678ae0662a7655f407a91b653757ea0f051ca0d012fe9355a2b2cb993908`;
  `icons.svg=459743407f6c933a8c8d8d625e73c5bc1a4312e890d9699d533e2e71d5daef1e`;
  `manifest.json=35014eb9ac42ed0365026bbf21bbba4ff64636426051aa42132b6daa01f6a635`.
  From those four metadata values, the **calculated**, not byte-reverified,
  PR #5 sorted compact JSON SHA256 aggregate is
  `ca7f341e4ffa0fe656eb6f23297af1716802439bc1d48708f5f29d4e092db835`.
- **Unknown until separately constructed:** the clean combined StaticRef
  `combinedAppSha`, reviewer evidence digest, exact fixture/browser run,
  OS isolation attestation, any user release sign-off. Do not fill unknown
  fields with guessed literals or mark `verified`.

The four-file aggregate is exactly:
`SHA256(UTF8(JSON.stringify({files:{icons.svg:<sha>,manifest.json:<sha>,runtime.js:<sha>,styles.css:<sha>}})))`
with lexicographically sorted file keys, compact punctuation, no trailing
newline. Python: `json.dumps({"files": hashes}, sort_keys=True,
separators=(",",":"), ensure_ascii=True)`. Pin the complete compatible
CSS/runtime/icons/manifest quartet; no CSS-only candidate release.

## Exact clean combined StaticRef snapshot — future Codex commands, NOT run here

Use an **approved isolated disposable** Git checkout, NOT StaticRef's active
worktree or Aura Core. The only intended application source difference from
fixture PR #32 is the four-file PR #31 patch:

```sh
FIXTURE=2e6d2bbb31fb5e2010c87cce79b4065dc5ed1a3d
FIX=d0139bd231b3cb5b1bf02df6b7380d975d992f5e
BASE=fb409a4883fae7e461c77ae21685e8dc3e0b40da
# Use a reviewed disposable path in the approved isolated host.
ROOT=/absolute/disposable/staticref-combined
git clone --no-checkout <approved-StaticRef-remote-url> "$ROOT"
git -C "$ROOT" fetch origin \
  refs/heads/test/staticref-ui-fixtures-20261016 \
  refs/heads/fix/canvas-heading-input-zoom-20261016
test "$(git -C "$ROOT" rev-parse origin/test/staticref-ui-fixtures-20261016)" = "$FIXTURE"
test "$(git -C "$ROOT" rev-parse origin/fix/canvas-heading-input-zoom-20261016)" = "$FIX"
git -C "$ROOT" checkout --detach "$FIXTURE"
set -- staticref/web/canvas.js staticref/web/canvas.css \
  tests/canvas-client.test.mjs docs/CANVAS.md
git -C "$ROOT" diff "$BASE" "$FIX" -- "$@" | git -C "$ROOT" apply --check
git -C "$ROOT" diff "$BASE" "$FIX" -- "$@" | git -C "$ROOT" apply
git -C "$ROOT" add -- "$@"
# Confirm exactly these four staged files and Git blob IDs BEFORE committing.
git -C "$ROOT" diff --cached --name-only
for p in "$@"; do
  printf '%s  %s\n' "$(git -C "$ROOT" rev-parse ":$p")" "$p"
done
git -C "$ROOT" -c user.name='Synthetic Review' \
  -c user.email='synthetic-review@invalid.local' \
  commit -m 'Synthetic review ONLY: PR32 fixture plus four PR31 heading files'
COMBINED=$(git -C "$ROOT" rev-parse HEAD)
test -z "$(git -C "$ROOT" status --porcelain --untracked-files=all)"
git -C "$ROOT" diff --name-only "$FIXTURE" HEAD
printf 'Exact synthetic combined commit: %s\n' "$COMBINED"
```

The **four committed Git blob SHA-1 values** (not UI asset SHA256) must
match exactly, in addition to the path-only diff above:

| File | Git blob in intended PR #31 |
| --- | --- |
| `staticref/web/canvas.js` | `dda63a89ef5a36573bfc9caa2de2ea2b9ff20b6` |
| `staticref/web/canvas.css` | `8c3736db9476f74d718ebf46a97a14e26d573673` |
| `tests/canvas-client.test.mjs` | `83337e0d10233b9d786a0592aa5a37915e3a417f` |
| `docs/CANVAS.md` | `d99842c18066fb3f27ab94fb52391b0ff0ccd33d` |

**Do not merge PR #31 or #32, push the synthetic commit, patch generated UI
assets, or create a combined branch in any production checkout.**
The coordinator's `review-host.mjs` source proof independently checks:
clean `HEAD=combinedAppSha`, `fixturePr32Sha` ancestor, exactly four
different paths versus `fixturePr32Sha`, and matching four Git blobs at
both combined HEAD and `headingFixPr31Sha`. Missing fix commit objects or
stale Canvas fail closed. Preserve three immutable provenance inputs:
`fixturePr32Sha`, `headingFixPr31Sha` and new `combinedAppSha`.

## Exact coordinator startup interface — no second app manager

In PR #5's **private 0600 review plan** use **one `apps[]` member at
first**. Its StaticRef fields must include:

```json
{
  "id": "staticref",
  "repository": "andyherle/StaticRef",
  "root": "/absolute/disposable/staticref-combined",
  "sha": "<new 40hex COMBINED>",
  "port": 8769,
  "manifest": "/absolute/disposable/staticref-combined/tests/browser/ui-fixture-manifest.json",
  "reviewRoute": "/reference/c/editorial/?fixture=normal",
  "healthPath": "/__fixture__/review-lock.json",
  "sourceProof": {
    "fixtureSha": "2e6d2bbb31fb5e2010c87cce79b4065dc5ed1a3d",
    "fixSha": "d0139bd231b3cb5b1bf02df6b7380d975d992f5e"
  },
  "start": {
    "binary": "/absolute/pinned/python3",
    "binarySha256": "<actual 64hex executable>",
    "args": ["tests/browser/serve_ui_review.py", "--port=8769"],
    "sourceFiles": ["tests/browser/serve_ui_review.py"]
  },
  "tests": {
    "canvas": {
      "binary": "/absolute/pinned/node",
      "binarySha256": "<actual 64hex executable>",
      "args": ["--test", "tests/canvas-client.test.mjs"],
      "sourceFiles": ["tests/canvas-client.test.mjs"]
    },
    "review-source": {
      "binary": "/absolute/pinned/python3",
      "binarySha256": "<actual 64hex executable>",
      "args": ["-m", "unittest", "discover", "-s", "tests", "-p", "test_ui_review.py", "-v"],
      "sourceFiles": ["tests/test_ui_review.py"]
    },
    "browser": {
      "binary": "/absolute/pinned/node",
      "binarySha256": "<actual 64hex executable>",
      "args": ["tests/browser/verify_ui_review.mjs"],
      "sourceFiles": ["tests/browser/verify_ui_review.mjs"]
    }
  }
}
```

This excerpt belongs inside PR #5's existing **single** plan schema, with
`schemaVersion:1`, private `receiptDir`, two pinned immutable
`bundles:[baseline,candidate]`, and separately pinned
`isolation:{binary,binarySha256,policy,policySha256}`.
Do not create new app lock field names. The manager appends existing startup
flags `--ui-variant --ui-source-sha --ui-bundle-dir --ui-bundle-sha256
--app-sha --seed --review-root` plus StaticRef's already supported
`--fixture-route --fixture-source-sha --require-heading-fix-sha`.
A normal owner's response at **`/__fixture__/review-lock.json`** must
corroborate actual served file hashes, exact app/UI SHA, bundle digest,
pack, variant and `seed-1`; the candidate must report the two
`review-workspace@1` collection/manager instances. This lock is not proof
of the PR #31 source; the coordinator's separate Git sourceProof is.

No new OS isolation implementation exists in PR #5. **Never** relax its
fail-closed admission merely to open a page. The approved Codex environment
must supply a reviewed broker that satisfies the pinned
`shared-ui-review-os-isolation-v1` verify/run contract and true
external/other-loopback/network, source-write, production filesystem and
service-worker egress denial. Preinstall vetted Node, Python, Playwright
and Chromium **outside live app mounts**. Browser contexts use empty
storage/cookies/extensions, block service workers and reject all
nonfixture network origins. Use distinct clean **build** checkouts to
generate candidate bundles; copy/read-only-stage the four candidate files
outside the separately **clean** app/shared-ui source roots used for PR #5
admission. This has not been performed.

Once the prerequisites exist, PR #5's sole foreground TTY control is:

```sh
# From its exact clean source checkout with pinned private config:
npm run review:managed -- --config /absolute/private/review-plan.json
# At review> (user-controlled, one StaticRef child at a time):
status
start staticref candidate seed-1
test staticref review-source
test staticref canvas
test staticref browser
index
stop staticref
exit
```

The app serves actual synthetic real UI at
`http://127.0.0.1:8769/reference/c/editorial/?fixture=normal`
(collection editor), `http://127.0.0.1:8769/reference/?fixture=many`
(gallery/mosaic), `http://127.0.0.1:8769/reference/a/00000000-0000-4000-8000-000000000001/?fixture=unicode`
(lightbox), and
`http://127.0.0.1:8769/canvas/projects/00000000-0000-4000-8000-000000000901?fixture=zoom`
(real Canvas). None are current hosted URLs; these links **require the
approved foreground server running**. No new browser executor was
launched here. The existing fixture-index script is offline and can
generate additional links without accepting a runtime health assertion.

## RELEASE-BLOCKING: equivalent three-lane comparison

Use the **same synthetic dataset/seed**, app fixture routes, display
state, browser build, widths and time ordering. All review lanes are
sequential on owned port 8769, with **fresh independent storage/browser
contexts and explicit stop/start**. Preserve exact files, SHA locks,
screenshots/DOM metrics and unrun or failed results:

| Lane | Exact app snapshot | Exact UI bundle | What may change |
| --- | --- | --- | --- |
| A — installed old-production baseline | clean PR32 fixture HEAD, **without** PR31; `sourceProof` omitted | staged v1.10.2 baseline | Establish old existing Canvas/gallery behavior; record known heading defects instead of silently normalizing them |
| B — fix31-only | exact clean combined PR32+4 PR31 blobs, `sourceProof` required | **same** staged v1.10.2 baseline | Only PR31 heading click/IME/pointer capture/44-world-unit grip may differ from A; other Canvas/gallery functionality must remain equivalent |
| C — PR4 candidate | **same** combined app SHA as B, `sourceProof` required | separately staged PR4 v1.11.0 quartet | Compare all B behavior with C; review-workspace/controls may change only as explicitly documented, not Canvas world or adaptive gallery |

A and B require **separate private plan files** because each has a different
full `app.sha`. B and C can use the same plan and switch baseline/candidate
only after an explicit stop. Do not fake the `app.sha`, reuse a browser
profile between lanes or start another StaticRef port. The existing
`tests/browser/verify_ui_review.mjs` is **candidate-specific**, and its
optional `STATICREF_BASELINE_ORIGIN` would require an independently
owned simultaneous process; it **does not** by itself prove the sequential
A/B/C parity matrix. Before a release assertion the app owner must finish
equivalent lane-specific regression receipts or the later user/Codex review
must explicitly label every unsupported comparison unverified.

### Canvas behavior — existing production invariants, not uniformity styling

At minimum compare A→B→C for native heading/paragraph/Markdown H1–H6
editing, text selection/caret/paste, keyboard commit/cancel and IME,
note/media/card focus, selection/highlighting and marquee/multiselect,
pointer capture versus mouse/touch pan, drag-grip movement, snap/reorder,
resize/column membership, 20/50/100/200% zoom/fit/full-world
coordinates, keyboard shortcuts, undo/redo, unsaved draft/storage
persistence and restore, error/409 stale revision/retry, and normal
open/close of outer dialogs/lightboxes. Verify the 44-world-unit grip
never covers the title at low zoom; PR31's intent is deliberately visible,
not quietly masked by a shared control. Synthetic client storage is
**not** server-side persistence authorization. No moving Canvas world
under the 70% page width or applying composition to it.

### Gallery behavior — equally release-blocking

Compare the **actual adaptive mosaic planner** and mixed portrait/square/
panorama card aspect, seam/placement/resize/scroll behavior (including
many-row stress), gallery navigation/search/filter/selection/rating,
pagination or incremental load, natural keyboard/touch targets and
full-mode lightbox navigation, focus return, metadata and synthetic image
URLs. Confirm the correct original gallery and Canvas JS/CSS are used in
all lanes, not copied or replaced by shared demo markup. Do **not**
rewrite mosaic or world geometry to manufacture visual consistency.

### Widths, state and evidence

Use 1440×900 desktop, 768 tablet, 390×844 actual phone,
≤280px embedded/narrow, full-screen Canvas/lightbox, supported
light/dark/density, zoom, keyboard/coarse pointer, selection and scroll.
Exercise empty/long/CJK/RTL/emoji, hundreds of cards, loading/503,
409 conflict and recovery. Record actual Playwright/browser output,
DOM identity, computed position/overflow/hit areas, app/UI full digest,
seed, code SHA, browser/OS version and screenshots. A synthetic dispatched
`CompositionEvent` is **not** evidence of a real Japanese/Chinese IME
session: actual native IME typing, double-click/edit interaction and
physical pointer selection must be tested and **observed by the user**.

### Release authority and rollback

**Every Canvas AND gallery invariant above blocks release until proven on
equivalent real-code baseline and candidate fixtures.** Source CI alone
does not clear any gate. Obtain mandatory **user hands-on sign-off** on
StaticRef Canvas, gallery/lightbox, the intended PR31 heading delta and
the reviewed PR4 control changes before any subsequent separately
authorized production promotion. A side-by-side screenshot cannot
replace functional/persistence/focus testing.

Keep the exact previous installed `styles.css/runtime.js/icons.svg/
manifest.json` pins, previous app source revision and prior layout
configuration available for selective reversal. Later deployment, if
separately authorized, must pass the consumer's normal pinned install/
health checks and repeat representative Canvas/gallery smoke checks.
If a regression occurs, roll back the **whole compatible bundle and the
selected app/fix revision**, verify the previously passed baseline
interactions and hold promotion. There is no promise of zero risk and
no rollout approval in this package.

## Source versus execution ledger

Coordinator-owned source preparation consists only of PR #5's manager,
single-app admission, exact route and committed PR31 proof, supporting
unit regressions and this handoff. GitHub Actions `npm run check` plus
`npm run studio:mcp:check` (with exact new HEAD/run) are **source
validation**, not a browser run.

Remaining independently owned source tests: StaticRef's browser source
currently checks candidate pre-mount forms, responsive controls, mosaic,
lightbox, heading, pointer drag and zoom, but still needs an **equivalent
sequential A/B/C test/receipt** proving existing Canvas
persistence/undo/redo/selection and full gallery behavior rather than
only candidate visuals. The app owner has been asked to finish this in
existing PR #32; it is not coordinator permission to edit their code.
Aura's source adapter remains the **second** cross-consumer proof,
not a prerequisite to one-app StaticRef source review.

Execution **not performed here**: creating/staging the actual three source
lanes, PR4 bundle materialization/full digest, isolator admission, server
launch, actual source tests inside the isolated app snapshot, Playwright
screenshots, real native IME, user hands-on approval, authorization/
persistence/NAS transfer, release/rollback exercise, migration or
deployment. Source-complete does **not** mean runtime or fleet accepted.
