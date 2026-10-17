# Six-consumer candidate review — shared SOURCE handoff

**One launcher, six registered application owners, at most TWO simultaneous
owned fixture processes.** StaticRef FIRST and Aura SECOND are review
priorities, **not a whitelist or order in which app source can be integrated**.
Home, Ledger, Delivery and Portal are supported in the very same source
registry and candidate workflow from outset. Missing pre-mount/SSR integration
or local execution capability must read **BLOCKED**, not unsupported,
not "verified", and never count as a browser acceptance result.

The sole source of six-owner registration is
[`fixtures/review-owners.v1.json`](../fixtures/review-owners.v1.json).
Its typed reader is `scripts/review-registration.mjs`, consumed by the
existing coordinator [draft PR #5](https://github.com/andyherle/shared-ui/pull/5)
manager/host/CLI. This is **not a second manager, editor, composition
factory, style installer or deployment workflow**.

## Read-only registration and per-consumer profiles

From the **exact coordinator PR #5 checkout**:

```sh
npm run review:owners
```

This prints all six registered apps, native profile/pack/port, source-only
baseline/candidate states and reasons. It never starts a process, opens a
browser, reads private credentials or attempts to contact an app.
`npm run review:managed -- --config /absolute/private/review-plan.json`
is the **separate** manually operated foreground lifecycle; its
`review> status` also shows all six, even apps without an exact pinned
private plan. Source status and active runtime status are separate;
unconfigured apps remain `supported:true, configured:false, state:blocked`.
Do not silently drop unavailable candidates.

| Consumer (owner repo/PR) | Native source fixture process/route | Registered pack/profile/port | Source readiness in registry |
| --- | --- | --- | --- |
| **StaticRef** ([draft #32](https://github.com/andyherle/StaticRef/pull/32); fix [#31](https://github.com/andyherle/StaticRef/pull/31) separate) | `python3 tests/browser/serve_ui_review.py --port=8769`; `/reference/c/editorial/?fixture=normal` | postvisual/default/**8769** | baseline prepared; candidate source prepared with **separate exact clean four-file PR31 proof** |
| **Aura** ([draft #36](https://github.com/andyherle/aura/pull/36)) | `node scripts/ui-fixtures.mjs --port=41888`; `/studio?state=default` | postvisual/default/**41888** | baseline prepared; candidate pre-mount real Studio library source prepared |
| **Home** ([draft #1](https://github.com/andyherle/postvisual-home/pull/1)) | `python3 fixture_home.py --port=18795`; `/?view=apps&fixture=default` | postvisual/default/**18795** | baseline prepared; candidate **BLOCKED** pending original Home view composition |
| **Ledger** ([draft #3](https://github.com/andyherle/pv-ledger/pull/3)) | `python3 -m pvledger.server --config config/invoices.demo.json --port=41924`; `/?fixture=sample&seed=7&view=invoices` | postvisual/pv/**41924**, personal/personal/**41925** | baseline prepared; candidate **BLOCKED** pending original native invoice/posting/inspector pre-mount |
| **Delivery** ([draft #2](https://github.com/andyherle/vault-store/pull/2)) | `python3 tests/test_ui_fixture.py --scope pv --port 41927`; `/?fixture=default&frame=desktop#Documents` | postvisual/pv/**41927**, personal/personal/**41928** | baseline prepared; candidate **BLOCKED** pending real document browser/SendModal pre-mount |
| **Portal** ([draft #38](https://github.com/andyherle/portal/pull/38)) | `go test ./internal/web -run '^TestPortalUIFixtureGallery$' -count=1 -timeout 60m -v -args` followed by manager's startup pins; `/fixture` | personal/default/**41915** | baseline prepared; candidate **BLOCKED** pending original SSR/native-form assembly |

*All "prepared" states are source-only and are not passing application
unit tests, live sandbox checks, current URLs, or promises of runtime behavior.*
The baseline examples have been inspected in the owner branches, not started
here. Portal uses its original Go opt-in `httptest.Server` fixture and
only in pinned manager mode binds port 41915; its actual 43-case JSON
manifest is produced at `/fixture/manifest.json` **AFTER startup**, not
stored as an invented checked-in manifest. The coordinator validates the
runtime manifest's loopback origin, app repository and `mockOnly` flags
before marking the session ready and can include the verified JSON in the
existing offline index. If not running, its manifest remains BLOCKED.

Ledger's **Personal** fixture is a separately chosen app `profile` using
41925 and pack `personal`; the app is registered **once**. Delivery's
personal scope is also one alternate profile of the **same** Delivery
consumer, not a seventh app or separate lifecycle manager. Both profiles
are subject to exact app source, package, route and candidate gates.
The current Delivery checked-in offline manifest may not include the
41928 Personal deep link; that profile then stays **BLOCKED at manifest
preflight** until the owner publishes actual app-owned manifest coverage.
No unseen port or route is inferred from a URL.

## ONE canonical source/asset/lock interface

The original coordinator [`docs/MANAGED_REVIEW_LAUNCHER.md`](MANAGED_REVIEW_LAUNCHER.md)
and [hub #37](https://github.com/andyherle/portal/issues/37#issuecomment-6227742804)
remain authoritative. All six receive the SAME startup-only flags
(through app-native Node/Python/Go argv, **not browser query**):

```text
--ui-variant=installed|candidate
--ui-source-sha=<full 40hex source SHA>
--ui-bundle-dir=<separately staged read-only complete bundle>
--ui-bundle-sha256=<SHA256 of compact sorted-key four-file JSON>
--app-sha=<full exact clean owning app Git SHA>
--seed=<registered deterministic seed>
--review-root=<private coordinator-owned 0700 scratch>
```

The coordinator calls `baseline` the **installed** app CLI variant.
Ledger's existing canonical deterministic seed is string `7`, **not**
`seed-1`; the other registered primary profiles use `seed-1`.
The launcher resolves that seed from the selected app profile when
omitted. The app may add existing extra *app-owned fixture* flags for
scope/port/config but cannot rename the shared startup fields.
Shared scrubbed `UI_REVIEW_*` environment supports original test
commands; Portal additionally needs only its existing
`PORTAL_UI_FIXTURE=<owned-scratch/portal-fixture-launch.json>`.
These do not grant access to operational apps or data.

The single app-owned read-only response is exactly
`GET /__fixture__/review-lock.json` with
`protocol:"shared-ui-review-health-v1"`,
`appSha,uiSha,bundleDigest,files,seed,variant,pack`,
`mockOnly:true,productionWritesDisabled:true,realAppCode:true`.
Candidate additionally includes original
`composition:{id:"review-workspace",revision:"1",instances:[...]}`.
The coordinator hashes the **actual immutable staged bytes** (not
declared flags), checks exact clean app/UI Git sources and manifest/SRI,
then checks this response. Source health **does not** prove DOM focus,
user authorization, persistence, genuine native IME or OS isolation.

Selected bundles are **per app and per pack**, not global variants shared
indiscriminately. The existing `plan.bundles[]` accepts optional immutable
`id`; `apps[].bundleRefs:{baseline,candidate}` can independently choose
an exact bundle for each owning app. Without explicit refs, the candidate
must be the **single unambiguous** matching `(pack,variant)`. Every
selected bundle pins `root,sourceRoot,uiSha,pack,variant,digests,bundleDigest`.
The four files are `styles.css, runtime.js, icons.svg, manifest.json`
with the unchanged digest formula
`SHA256(UTF8(JSON({files:sorted per-file SHA256 strings})))`.
Postvisual and Personal must not accidentally cross-select a CSS/runtime
variant or overwrite tracked installed v1.10.2 copies.

### Honest source-readiness and SSR/pre-mount compatibility

A registry state `prepared` means only the app owner has authored the
source adapter; `blocked` means some source integration is still absent.
Both remain **runtime UNRUN**. The two candidate mounts prepared in the
initial sources are StaticRef's real original collection/manager modal
forms and Aura's original detached Studio-library nodes.

Home/Delivery/Ledger/Portal retain their native ownership: no wrapper
around an already connected/focused form, no nested form, no cloned
listeners, no moving an open `dialog.ui-popout` into a splitter/aside,
and no replacement Canvas, gallery mosaic, PDF, accounting or upload
state machine. PR #4's native factory accepts **detached** nodes only.
SSR consumers must construct the canonical shell **before first mount/
hydration** in their own app source, or separately test an explicit
SSR-in-place adapter; no silent connected-node reparenting.

Once an owner finishes its missing candidate source slice, an exact
private plan can update that app's `readiness.candidate` to
`{state:"prepared",reason:"...source test...",sourceSha:<exact app HEAD>}`
and declare `mountEvidence`:
```json
{
  "strategy": "detached-before-first-mount",
  "sourceSha": "<exact clean 40hex app commit>",
  "testFile": "tests/existing_app_owned_mounted_form_regression.py",
  "instanceIds": ["app.original.review"],
  "nativeFormOwner": true,
  "outerDialogHost": true,
  "connectedNodesMoved": false
}
```
For proven original server-side assembly, `strategy` is
`ssr-pre-hydration-tested` instead. These are **source claims**, not
browser proof: the manager checks the exact app SHA and instance
identity, the host checks that `testFile` is a nonempty tracked source
file in the exact **clean** checkout, and the real candidate response
must advertise the actual instance IDs. A checked-in test **still needs
to run and pass** before source acceptance. Without the adapter/evidence,
a candidate remains **BLOCKED before any OS preflight or process
startup**. Do not fabricate a `composition` field for an unmounted
candidate.

StaticRef's additional existing app-owned `sourceProof` and PR31
four-file exact Git blob gate are unchanged and mandatory for the
fix-inclusive candidate. [StaticRef's three-lane A/B/C,
Canvas/gallery release blockers and clean combined source
recipe](STATICREF_SOURCE_COMPLETION.md) remain the first hands-on
review script; no branch merge or old Canvas source substitution
is allowed.

## Reproducible six-owner private plan and local validation

1. Use separate **clean, exact-commit** app and shared-ui checkouts,
   verified build dependencies and an independently approved Mac OS
   isolation broker/policy. No such broker was supplied in this web-agent
   pass; the launcher intentionally refuses execution without its real
   external, foreign-loopback, filesystem/source-write, service-worker
   denial probes. No NAS, credentials or live application mounts.
2. Read `npm run review:owners` for the **six registered** entries.
   Prepare a private 0600 plan following the existing [managed review
   plan schema](MANAGED_REVIEW_LAUNCHER.md), with **up to all six**
   `apps[]` source profiles but at most **two** owned fixture children
   running at any moment. Set each exact `repository,root,sha,profile,
   port,pack,reviewRoute,manifest,healthPath,start,tests`. For Portal's
   `runtime-loopback` manifest profile, `manifest` is optional until
   its original Go fixture generates it. Every app points to its own
   source checkout, never a synthetic copy of the application HTML.
3. Supply 0600 plan `isolation` and exact baseline/candidate quartet
   digests. For per-app packs, pin named `bundle.id` and match the
   owning app `bundleRefs`; the source registry preserves every
   blocked candidate even without an actual candidate digest. No unknown
   full digest should be guessed or treated as measured.
4. After the user initiates Codex **on their Mac**, in one visible
   foreground Terminal:
```text
# Read-only source status: six registered owners, regardless of runtime state.
npm run review:owners
# Later, with a complete approved private plan and OS sandbox:
npm run review:managed -- --config /absolute/private/review-plan.json
review> status
review> start staticref candidate seed-1    # StaticRef FIRST; exact PR31 clean combined commit required
review> test staticref browser              # ONLY if the owner script is genuinely HEADED
review> index
# Leave the managed fixture OPEN while user reviews it.
# After the user explicitly finishes:
review> stop staticref
review> start aura candidate seed-1         # Aura SECOND cross-consumer proof
# Other registered source-ready baselines or subsequently source-ready candidates:
review> start home baseline seed-1
review> start ledger baseline 7
review> start delivery baseline seed-1
review> start portal baseline seed-1
# Never exceed two owned children. Stop a child before starting a third.
# Stop each owned child individually and only then:
review> exit
```
   These lines are a **menu of future individual actions**, NOT one
   unattended batch: each `start` after the two-child cap requires an
   explicit prior `stop <app>`. The user is the manual stop authority.
   No automatic app process, browser, security configuration or Codex
   task was started in preparing this file.
5. Use only the original app browser/source checks, preserve each
   synthetic route and its native form/SSR/Canvas behavior, record
   exact launch/OS/browser/version/viewport/digest/seed and PASS/FAIL,
   and leave **visible headed Chromium on the user's Mac**, test
   progress streaming per assertion and the fixture reachable until
   hands-on review. Native Japanese/Chinese IME must be **genuinely
   entered**, not fabricated `CompositionEvent`. An app's existing
   headless-only script is SOURCE-BLOCKED for watchable acceptance until
   its owner adds opt-in headed/progress support. User-signed approval
   and validated rollback remain mandatory before any future separately
   authorized promotion.

### Per-owner source-only commands (prepared; not executed)

- **StaticRef:** `node --test tests/ui-fixture.test.mjs tests/canvas-client.test.mjs`;
  `python3 -m unittest discover -s tests -p 'test_ui_review.py' -v`;
  `./scripts/sync_shared_ui.sh --check`; isolated
  `node tests/browser/verify_ui_review.mjs` **only once headed
  mode is genuinely implemented**; A/B/C parity and native IME remain
  separate release blockers.
- **Aura:** `node --test tests/ui-fixtures.test.mjs tests/ui-fixtures.browser.test.mjs
  tests/ui-fixture-bundle.test.mjs`, `npm run check:ui`,
  `npm run test:core`; isolated real native Studio/Workshop candidate
  and History/parameter/IME tests, preserving dirty Core untouched.
- **Home:** `make check`; `python3 -m unittest discover -s tests -p 'test_*.py' -v`;
  native server fixture and `docs/FIXTURE_REVIEW_ACCEPTANCE.md` browser
  checklist. Candidate awaits pre-mount source.
- **Ledger:** `make check`; `python3 -m unittest discover -s tests
  -p 'test_ui_review_bundle.py' -v`, `node --check
  tests/ledger_fixture_browser.mjs`; later PV and Personal real table/
  inspector/keyboard parity. Candidate awaits app-owned native integration.
- **Delivery:** `npm run fixture:ui:build`, `npm run fixture:ui:test`,
  `npm test`, `npm run fixture:ui:browser` (headed app-owner opt-in
  required), native SendModal upload/verification/cancel and original
  document-browser parity. Candidate awaits app-owned pre-mount.
- **Portal:** `go test ./...`, `go vet ./...`,
  `node --test internal/web/testdata/*.test.cjs`; later managed
  `PORTAL_UI_FIXTURE=<private scratch>`
  `go test ./internal/web -run '^TestPortalUIFixtureGallery$' -count=1
  -timeout 60m -v -args` with coordinator startup pins, real
  `/fixture/manifest.json` and native original forms. Candidate awaits
  independently checked SSR-before-mount adapter.

**Source readiness is not runtime acceptance.** Do not label a health
response, index, Node/Go/Python source test, proposed SHA or synthetic
IME as a passing live browser test. Native Canvas AND gallery/lightbox
parity, PR31's visibly intended differences, source-pinned rollback and
the user's own hands-on approval are release-blocking. For all six
consumers, the same rules apply to underlying domain behavior; UI
evidence cannot establish ledger persistence, authorization or NAS
transfer. Existing installed bundles/variants remain unchanged.

## Remaining independently owned source work

- **StaticRef:** source tests for equivalent sequential A/B/C old-production/
  PR31-only/PR4 review and deep Canvas/gallery behavior parity remain
  to be demonstrated; headed per-check progress in the existing Playwright
  script and actual native IME still need acceptance. Original PR31
  fix remains separate/unmerged.
- **Aura:** exact current branch candidate/browser regression checks and
  complete four-file bundle source pin need owner evidence; remains
  SECOND hands-on cross-consumer proof.
- **Home:** real pre-mount canonical composition around original Home
  native content, and app-owned source test before candidate is prepared.
- **Ledger:** native invoice/posting/inspector pre-mount candidate; PV/
  Personal review route and source behavior/regression verification.
- **Delivery:** original browser/SendModal pre-mount candidate, native
  upload/verified-copy/cleanup state and Personal profile manifest route.
- **Portal:** test-proven native SSR form assembly before hydration;
  preserve session/CSRF/ledger/accounting safety. Its runtime manifest
  requires the original Go fixture, not a fabricated static snapshot.

The coordinator already registered all six; no consumer is silently
unsupported. No optional missing runner is substituted with Aura's dirty
Core executor. User-started Codex will own the later local fixture
execution and continuity/shared-control checks, **without any automatic
merge, production deployment, security change or migration**.
