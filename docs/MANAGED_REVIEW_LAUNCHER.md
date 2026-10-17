# Managed local candidate review launcher (source-only pilot)

**Status:** Coordinator-owned, stacked on the offline index in shared-ui
PR #3, while canonical `review-workspace@1` remains fixed in PR #4 at
`3c5c7fad13fd68940d2d50ba55ddeb04799e2e7d`. This tool has **not**
started either app, audited an OS isolation broker, executed a browser or
touched production assets. No new editor, agent executor, daemon, installer,
app source or generic workflow engine is included.

## Review contract and exact owner boundary

`scripts/review-launcher.mjs` is an **interactive foreground manager**, not an
app UI renderer. It imports PR #3's existing strict
`scripts/fixture-index.mjs` and reads the *private app-owned* manifests
without publishing their content. The bounded pilot allows **one StaticRef
profile first**, then optionally a second Aura profile. It never requires
Aura to be runnable before StaticRef hands-on review:

| Owner | Exact initial fixture PR head | Real-code fixture command | Manifest |
| --- | --- | --- | --- |
| Aura | `3bd271005b0176e846cfda6f97e5bff4a50d31ca` | `node scripts/ui-fixtures.mjs --port=41888` | `fixtures/ui-manifest.json` |
| StaticRef | App-owned PR #32, repin its latest approved HEAD | `python3 tests/browser/serve_ui_review.py --port=8769` | `tests/browser/ui-fixture-manifest.json` |

The existing StaticRef Canvas heading fix belongs to **separate** PR #31,
`d0139bd231b3cb5b1bf02df6b7380d975d992f5e`; do not silently merge
or overlay it on PR #32. Aura's output-only creative renderer and StaticRef's
Canvas/world geometry remain app-owned.

The **app owners** implement the pre-mount/fixture-only integration in their
private branches. The launcher never touches their generated installed
`shared-ui` assets, production HTML or services. The owner must:

1. Only in an isolated synthetic fixture process, accept the same
   **startup-only CLI fields in both real-code servers** (app owners requested
   these, not URL-selected styles): `--ui-variant=candidate|installed`
   (`baseline` selects `installed`), `--ui-source-sha=<40hex>`,
   `--ui-bundle-dir=<absolute immutable review root>`,
   `--ui-bundle-sha256=<64hex>`, `--app-sha=<40hex>`,
   `--seed=<fixed value>`, `--review-root=<private 0700 scratch>`.
   The coordinator appends them to each app's already pinned fixture argv.
   It also provides matching scrubbed `UI_REVIEW_*` environment variables
   for app-owned test commands, but CLI flags are the **startup contract**.
   Reject an unknown/missing candidate directory and all fallback to the
   app's live installed or hosted stylesheet when a candidate was selected.
   Serve only the **whole compatible bundle** from this directory:
   `styles.css`, `runtime.js`, `icons.svg`, `manifest.json`.
   Use read-only file descriptors; never write, sync or install those assets.
2. Construct native `review-workspace@1` slots **before mounting** (or
   use a separately proven, app-owned SSR/hydration adapter). The shared
   factory rejects connected DOM nodes. Existing dialogs are outer modal
   hosts; overlay controls are not moved into inline inspectors. Preserve
   original form IDs, submit ownership, handlers, focus, IME and undo.
   Existing real app renderers/Canvas controllers remain authoritative.
3. Return read-only exact selected-bundle lock at
   **`GET /__fixture__/review-lock.json`** in **both** applications.
   This resolves Aura's proposed double-underscore path and StaticRef's
   earlier single-underscore alternative. The response is:
   ```json
   {
     "protocol": "shared-ui-review-health-v1",
     "appSha": "<full 40-hex Git SHA>",
     "uiSha": "<full 40-hex shared-ui source SHA>",
     "bundleDigest": "<full 64-hex aggregate bundle SHA256>",
     "seed": "seed-1",
     "variant": "candidate",
     "pack": "postvisual",
     "files": {
       "icons.svg": "<64hex>",
       "manifest.json": "<64hex>",
       "runtime.js": "<64hex>",
       "styles.css": "<64hex>"
     },
     "mockOnly": true,
     "productionWritesDisabled": true,
     "realAppCode": true,
     "composition": {
       "id": "review-workspace",
       "revision": "1",
       "instances": ["aura.studio.library"]
     }
   }
   ```
   Candidate and saved variants must identify at least one real
   `review-workspace@1` instance in the app's actual source. Baseline
   may omit the composition object because v1.10.2 does not ship the factory.
   The receipt records these instance identities but does not equate an
   app-declared marker with runtime/browser acceptance.
   Health **must reflect the actual asset bytes currently served**, not
   merely echo unvalidated environment variables. The launcher checks
   all identities exactly and fails startup if the endpoint is missing.
   A health response is not browser proof that CSS/runtime rendered or that
   OS/network isolation holds; these are separate gated checks.
4. Keep the owner's real templates, UI interactions, app synthetic backend,
   mock permissions and CSRF checks in its own repository. Deny nonfixture
   HTTP routes and outbound service fallback. Use a stable deterministic seed
   and the app manifest's 390px/narrow/desktop/full deep links. No private app
   code/content or actual credentials belong in the public shared-ui repo.

## Pinning baseline, candidate and saved variations

Private JSON plan schema v1 has one `reviewId`, private `receiptDir`,
`isolation` broker and **one or two `apps`**. StaticRef-first plans should contain just the
StaticRef profile; Aura is added only for later cross-consumer verification.
UI `bundles` contain
mandatory `baseline` and `candidate`, and optional
`saved:<immutable-version>` selections. Every bundle is a separately
staged, immutable **read-only** directory outside both app/source checkouts.
A saved version must have a distinct `savedVersion` provenance. Each pins
the exact shared-ui checkout SHA and these four file SHA256 digests:

`styles.css`, `runtime.js`, `icons.svg`, `manifest.json`.

 `bundleDigest` is SHA256 of **UTF-8 canonical compact JSON** with sorted
file keys and no whitespace:
`{"files":{"icons.svg":"<sha256>","manifest.json":"<sha256>","runtime.js":"<sha256>","styles.css":"<sha256>"}}`.
This matches the StaticRef owner's cross-language proposal. Node uses
`JSON.stringify({files:Object.fromEntries(Object.entries(digests).sort())})`;
Python uses `json.dumps({"files": digest_map}, sort_keys=True,
separators=(",",":"))`. No trailing newline. The actual expected values
are cryptographic hashes, not the bracketed placeholders shown here. Call
the coordinator's `bundleFingerprint(digests)` to compute and check it.
The launcher recomputes each file SHA256 and the aggregate, verifies
`manifest.json` CSS revision/filename/SHA384 integrity, checks the
associated shared-ui source checkout's **exact clean Git HEAD**, and
requires the staging directory plus files to be non-symlinked/read-only.
It also pins each app's clean Git HEAD, private manifest routes and the
absolute Node/Python executable SHA256. Dirty checkouts are **refused**.
Source SHA and bundle digest both appear in immutable private receipts.
The previously measured PR #4 CSS SHA256 was
`11bea36b6fac53a2f85b6c1dee199365b888722eb65971a4b489caf4835acaae`;
this value by itself is **not a complete bundle pin**.

A private plan has this shape (digest/path placeholders are deliberate; this
sample is **not executable** until populated from an approved clean checkout):

```json
{
  "schemaVersion": 1,
  "reviewId": "review-20261016",
  "receiptDir": "/absolute/private/review-receipts",
  "isolation": {
    "binary": "/absolute/trusted/review-os-isolator",
    "binarySha256": "<64hex>",
    "policy": "/absolute/private/allowlisted-policy.json",
    "policySha256": "<64hex>"
  },
  "bundles": [
    {
      "variant": "baseline",
      "root": "/absolute/immutable/baseline",
      "sourceRoot": "/absolute/clean/shared-ui-baseline",
      "uiSha": "<40hex>",
      "pack": "postvisual",
      "digests": {
        "styles.css": "<64hex>",
        "runtime.js": "<64hex>",
        "icons.svg": "<64hex>",
        "manifest.json": "<64hex>"
      },
      "bundleDigest": "<64hex>"
    },
    {
      "variant": "candidate",
      "root": "/absolute/immutable/candidate",
      "sourceRoot": "/absolute/clean/shared-ui-pr4",
      "uiSha": "3c5c7fad13fd68940d2d50ba55ddeb04799e2e7d",
      "pack": "postvisual",
      "digests": {
        "styles.css": "<64hex>",
        "runtime.js": "<64hex>",
        "icons.svg": "<64hex>",
        "manifest.json": "<64hex>"
      },
      "bundleDigest": "<64hex>"
    }
  ],
  "apps": [
    {
      "id": "aura",
      "repository": "andyherle/aura",
      "root": "/absolute/clean/aura-pr36",
      "sha": "3bd271005b0176e846cfda6f97e5bff4a50d31ca",
      "port": 41888,
      "manifest": "/absolute/clean/aura-pr36/fixtures/ui-manifest.json",
      "healthPath": "/__fixture__/review-lock.json",
      "reviewRoute": "/studio?state=default",
      "start": {
        "binary": "/absolute/pinned/node",
        "binarySha256": "<64hex>",
        "args": ["scripts/ui-fixtures.mjs", "--port=41888"],
        "sourceFiles": ["scripts/ui-fixtures.mjs"]
      },
      "tests": {
        "http": {
          "binary": "/absolute/pinned/node",
          "binarySha256": "<64hex>",
          "args": ["--test", "tests/ui-fixtures.test.mjs"],
          "sourceFiles": ["tests/ui-fixtures.test.mjs"]
        },
        "browser": {
          "binary": "/absolute/pinned/node",
          "binarySha256": "<64hex>",
          "args": ["--test", "tests/ui-fixtures.browser.test.mjs"],
          "sourceFiles": ["tests/ui-fixtures.browser.test.mjs"]
        }
      }
    },
    {
      "id": "staticref",
      "repository": "andyherle/StaticRef",
      "root": "/absolute/clean/staticref-pr32",
      "sha": "5b693554c59f2451c33b3909cb1722c684bd7745",
      "port": 8769,
      "manifest": "/absolute/clean/staticref-pr32/tests/browser/ui-fixture-manifest.json",
      "healthPath": "/__fixture__/review-lock.json",
      "reviewRoute": "/reference/c/editorial/?fixture=normal",
      "sourceProof": {
        "fixtureSha": "<exact-clean-PR32-Git-SHA>",
        "fixSha": "d0139bd231b3cb5b1bf02df6b7380d975d992f5e"
      },
      "start": {
        "binary": "/absolute/pinned/python3",
        "binarySha256": "<64hex>",
        "args": ["tests/browser/serve_ui_review.py", "--port=8769"],
        "sourceFiles": ["tests/browser/serve_ui_review.py"]
      },
      "tests": {
        "http": {
          "binary": "/absolute/pinned/node",
          "binarySha256": "<64hex>",
          "args": ["--test", "tests/ui-fixture.test.mjs"],
          "sourceFiles": ["tests/ui-fixture.test.mjs"]
        }
      }
    }
  ]
}
```

This is an **interface example**, not a production runner profile.
The private plan must be a regular 0600 file, `receiptDir` a dedicated
0700 directory outside source/bundle roots. Only absolute, digest-pinned
OS executables and bounded argv are permitted. There is no shell expansion,
unverified third app, cloned tree, login item or installed update.

## StaticRef first: approved clean source lineage and reviewer route

A `staticref` **candidate** is no longer admitted merely because its review
server claims a `review-workspace@1`. It must supply private coordinator plan
`apps[].sourceProof` with the **actual reviewed fixture PR #32 SHA**
(`fixtureSha`) and the exact separately owned PR #31 heading fix SHA
(`fixSha=d0139bd231b3cb5b1bf02df6b7380d975d992f5e`). The launcher
performs **read-only Git source verification** on the pinned clean app HEAD:
the fixture commit must be an ancestor, **exactly four** files may differ,
and all four committed Git blobs must match both the PR #31 source and
the following immutable intended values:

| Intended PR #31 changed file | Required Git blob SHA-1 |
| --- | --- |
| `staticref/web/canvas.js` | `dda63a89ef5a36573bfc9caa2de2ea2b9ff20b6e` |
| `staticref/web/canvas.css` | `8c3736db9476f74d718ebf46a97a14e26d573673` |
| `tests/canvas-client.test.mjs` | `83337e0d10233b9d786a0592aa5a37915e3a417f` |
| `docs/CANVAS.md` | `d99842c18066fb3f27ab94fb52391b0ff0ccd33d` |

A plain PR #32 checkout has **older Canvas** and therefore cannot be the
fix-inclusive candidate. A dirty worktree overlay also fails. The
future *synthetic combined review commit* must be created **only in an
approved disposable checkout**, with exactly those four changes staged,
without merging either PR or touching the user's active StaticRef tree.
The independently computed `combinedAppSha` is then the plan's `app.sha`.
The separate private start/test/stop receipt records
`sourceProof:{fixturePr32Sha,headingFixPr31Sha,combinedAppSha,gitBlobs}`
in addition to the unchanged app-owned `/__fixture__/review-lock.json`
fields. PR #31's intended differences (heading focus/IME/pointer capture
and zoom grip) remain **separately reviewable** rather than silently
attributed to shared-ui PR #4.

For baseline **old-production behavior**, use the clean PR #32 fixture SHA
with **no** `sourceProof` and the separately staged pinned baseline
v1.10.2 bundle; this is allowed only for `variant=baseline`. For
**fix-only baseline**, use the clean combined app SHA **with** the proof
but still select `baseline` UI. For candidate shared UI, reuse that
**same combined app SHA and seed**, with the full PR #4 candidate. These
three lanes isolate old Canvas, the intended PR #31 delta, and the
PR #4 UI delta. One owned StaticRef server on port 8769 runs **sequentially**
with explicit stop and fresh browser contexts, never an unauthorized
second StaticRef port. Each lane's `reviewRoute` must name an actual
same-origin app manifest route; the launcher records and links that route
instead of fabricating `/`. The exact `GET /__fixture__/review-lock.json`
request validates the app-selected UI SHA, bundle, seed and real composition
instance. This does not prove Canvas/gallery parity, native IME, persistence
or user acceptance—those are release-blocking downstream browser gates.

The [source-complete StaticRef/Codex handoff](STATICREF_SOURCE_COMPLETION.md)
specifies the exact clean combined recipe and production-behavior parity
checklist. It is for the user's later approved execution session, not an
instruction for this authoring task to start one.

## Required OS isolation broker (not supplied, therefore fail closed)

A real OS-isolating, separately audited launcher binary **must exist and
match the pinned `binarySha256`**. The shared-ui coordinator does **not**
ship one here or call `sandbox-exec`/Docker with guessed permissions.
The broker must implement two explicitly reviewed, fixed protocols:

```text
<binary> verify --protocol shared-ui-review-os-isolation-v1
                --policy <absolute private file> --challenge <UUID>
                --app-root <clean checkout> --bundle-root <read-only assets>
                --scratch <private 0700 dir> --port <reserved loopback port>

<binary> run --protocol shared-ui-review-os-isolation-v1
             --policy <absolute private file>
             --app-root <clean checkout> --bundle-root <read-only assets>
             --scratch <private 0700 dir> --port <reserved loopback port>
             -- <pinned Node/Python absolute executable> <fixed argv>
```

The verifier emits bounded JSON including:
`protocol,challenge,profileSha256,executableSha256,
verification:"os-probes-passed"`,
`enforcement.network:"kernel-egress-deny-except-fixture"`,
`filesystem:"readonly-allowlist-plus-scratch"`,
`process:"supervised-owned-foreground"`,
`productionMounts:"absent"`, `environment:"scrubbed"`.
Inside the **actual OS sandbox/policy** it must attempt five negative
probes and report each as `{result:"denied-by-os",error:"EPERM"}`
(or `EACCES`, `ENETUNREACH`, `EHOSTUNREACH`): external network,
foreign loopback services, production filesystem, source write and
service-worker-originated egress. The trusted, pinned broker must attest
these observations; a JSON flag in an app manifest **does not** replace
the operating-system evidence.

The exact broker binary/policy and effective kernel rules must be
independently audited before adoption. It must protect the review from
user credentials, NAS mounts, production config and writes, including
service-worker and WebSocket egress. It must allow only explicitly
listed local fixture server/browser traffic. Every browser test must also
use **fresh, empty isolated storage/context**, service-worker registration
blocked, and origin filtering; browser interceptors are *additional*
defense, not the OS boundary. The manager deliberately has **no
insecure fallback** if the verifier is absent or reports incomplete
denial probes. Simply choosing localhost or `mockOnly:true` fails the
isolation gate.

A preflight uses the exact same policy as a future `run`. The audited
broker owns containment of the child process tree and signal forwarding;
the manager retains **only the direct child handle it spawned**, never
kills an unrelated PID or process discovered by port scanning. The
broker must not daemonize or outlive its manager unexpectedly.

## Explicit foreground lifecycle / manual shutdown

When a separately authorized isolated environment and pinned clean
inputs are ready, the **operator** invokes:

```sh
node scripts/review-launcher.mjs --config /absolute/private/review-plan.json
```

Only an interactive TTY is accepted. Use `help`, `status`,
`start staticref candidate seed-1` FIRST, `test staticref <named-test>`,
`status`, `index`; leave the fixture running for the user's local
hands-on review, then `stop staticref` and `exit` **only by explicit
human action**. Aura's later cross-consumer proof uses the same protocol
and the existing `start aura candidate seed-1`, `test aura <named-test>`
and `stop aura` controls, never a second manager. The index command uses
PR #3's offline HTML writer within private receipts; it **does not**
start a fixture server. The manager restricts itself to **two** owned
app children, reuses identical app/UI/seed configurations, refuses a
different revision on an occupied app or foreign port, and runs at most
one named test child at once. A user must explicitly stop every child
before exiting. No idle timer, auto-restart or automatic promotion.
A deliberate stop requests **SIGTERM only for that manager-owned child**
and waits for confirmed exit; an uncertain stop remains visible and
blocks orderly exit. No port-wide kills, SIGKILL, stale-PID recovery
or automatic shutdown of an external Studio/Core process. Owned scratch
directories are removed only after confirmed stop, never by scanning
other applications. An unexpected terminal/OS crash requires human
reconciliation, not speculative PID or port cleanup.

Each successful start/stop/test writes a **new exclusive 0600 JSON
receipt** in `receiptDir`: exact `appSha,uiSha,bundleDigest`,
component bundle-file SHA256 set, `variant,pack,seed,port,ownedPid`,
isolation policy and broker fingerprints, result and time. It never
modifies an existing receipt. Initial health proof is
`health-verified/browser-unrun`, not browser acceptance.
A test returning 0 is separately recorded as executed, with full
browser/viewport/IME/network/OS evidence requiring app owner reports.

## Mac headed/watchable acceptance — explicit later requirement

The user will **start Codex separately**. This coordinator source change does
not launch Codex, an OS verifier, a fixture, a Mac browser or new executor.
Later `test staticref browser` must open a **visible headed window on the
user's Mac**, keep readable step-by-step test output on the foreground
Terminal, and leave the managed StaticRef fixture listening on its
original owned port until the human explicitly issues `stop staticref`.
The manager now forwards **test-child stdout/stderr** to that same
foreground terminal. It never auto-stops a successfully started fixture
after a test. The user should be able to watch both browser changes and
assertion/PASS/FAIL progress; a headless-only run is **not acceptance**.

At the verified current StaticRef PR #32, the existing
`tests/browser/verify_ui_review.mjs` uses
`chromium.launch({headless:true})`. That **app-owned** script must
gain and actually use a documented opt-in `headless:false` and
per-assertion progress output before the operator treats any
`test staticref browser` result as watchable. A standalone Node script
does not accept Playwright's test-runner `--headed` switch merely
because Playwright is imported. Do not claim it does, bypass the pinned
isolation policy, or mark a hidden browser as passed. Re-pin an exact
clean app SHA if the fixture test source changes.

See [StaticRef source completion / future Codex operator steps](STATICREF_SOURCE_COMPLETION.md#live-watchable-later-codex-pass--required-user-visible-acceptance)
for the **literal foreground manager commands**, separate real browser
window, fresh isolated profile, native IME/pointer checks, and the
mandatory manual-stop point after user review. Canvas AND gallery
behavior remain independent release-blocking parity requirements.
No source CI result substitutes for runtime evidence or the user's
hands-on acceptance, and no review success automatically deploys.

## Delivery boundary and remaining gates

The approved workflow is still **preview → reviewed immutable versioned
artifact → separately authorized consumer-specific pin → health/review →
reversible rollback to the prior installed bundle**. The launcher has no
promotion, install or rollback command. Runtime JS upgrades require
consumer releases, while CSS-only refresh cannot install `review-workspace@1`.

Source CI checks for this launcher are inert fakes: they exercise schema,
hashes, attestation **validation logic**, dedup, status/stop, health
identity and receipts. They **do not** execute the OS verifier, start
an app, establish sandbox isolation or verify any browser behavior.
The first unresolved runtime prerequisite is a separately approved
kernel-enforcing broker and two exact-clean app-side candidate adapters.
Only after those exist can the two real-code consumers plus the PR #4
native composition be actually accepted at 390px, ≤280px nested,
tablet, desktop and full modes, with keyboard, IME, focus, scroll,
overflow, native dialogs/forms, stale conflict/retry and Canvas input.

The active Studio MCP listener/relay repair is owned by the existing
Editor Builder and Portal Architecture agents and is **not** part of
this launcher.

### App owner integration synchronization (current fixture branches)

The original SHA table describes the **initial fixture handoff**, not an
authorization to use outdated source after the owners append candidate
adapter changes. On any actual review run, both fixture application `sha`
fields must be updated to their **latest explicitly reviewed complete
40-hex commit** and match a clean checkout. A changed owner HEAD invalidates
the prior private plan. Coordinator cannot claim new owner code was tested
because an app branch advanced.

Both owners proposed the same startup fields but initially different lock
paths and aggregate digest formats. This source contract resolves those
differences to `/__fixture__/review-lock.json` and sorted compact JSON.
Existing `/__fixture__/health` can remain a backwards-compatible fixture
health route, but it cannot replace exact candidate-lock verification.
