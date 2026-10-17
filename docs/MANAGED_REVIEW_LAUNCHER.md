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
without publishing their content. For this bounded pilot only two app
profiles are permitted:

| Owner | Exact initial fixture PR head | Real-code fixture command | Manifest |
| --- | --- | --- | --- |
| Aura | `3bd271005b0176e846cfda6f97e5bff4a50d31ca` | `node scripts/ui-fixtures.mjs --port=41888` | `fixtures/ui-manifest.json` |
| StaticRef | `5b693554c59f2451c33b3909cb1722c684bd7745` | `python3 tests/browser/serve_ui_fixture.py --port 8769` | `tests/browser/ui-fixture-manifest.json` |

The existing StaticRef Canvas heading fix belongs to **separate** PR #31,
`d0139bd231b3cb5b1bf02df6b7380d975d992f5e`; do not silently merge
or overlay it on PR #32. Aura's output-only creative renderer and StaticRef's
Canvas/world geometry remain app-owned.

The **app owners** implement the pre-mount/fixture-only integration in their
private branches. The launcher never touches their generated installed
`shared-ui` assets, production HTML or services. The owner must:

1. Only in an isolated synthetic fixture process, accept
   `UI_REVIEW_FIXTURE=1`, `UI_REVIEW_ASSET_ROOT` (immutable directory),
   `UI_REVIEW_BUNDLE_DIGEST` (64-char aggregate SHA256),
   `UI_REVIEW_SOURCE_SHA`, `UI_REVIEW_APP_SHA`,
   `UI_REVIEW_VARIANT`, `UI_REVIEW_SEED` and `UI_REVIEW_PORT`.
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
3. Return read-only exact health at **`GET /__fixture__/health`**:
   ```json
   {
     "protocol": "shared-ui-review-health-v1",
     "appSha": "<full 40-hex Git SHA>",
     "uiSha": "<full 40-hex shared-ui source SHA>",
     "bundleDigest": "<full 64-hex aggregate bundle SHA256>",
     "seed": "seed-1",
     "mockOnly": true,
     "productionWritesDisabled": true,
     "realAppCode": true
   }
   ```
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
`isolation` broker and exactly two `apps`. UI `bundles` contain
mandatory `baseline` and `candidate`, and optional
`saved:<immutable-version>` selections. Every bundle is a separately
staged, immutable **read-only** directory outside both app/source checkouts.
A saved version must have a distinct `savedVersion` provenance. Each pins
the exact shared-ui checkout SHA and these four file SHA256 digests:

`styles.css`, `runtime.js`, `icons.svg`, `manifest.json`.

`bundleDigest` is SHA256 of four newline-separated entries in that
exact order, each formatted `filename:64hexsha256` without a trailing
newline. Call the exported `bundleFingerprint(digests)` to compute it.
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
      "healthPath": "/__fixture__/health",
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
      "healthPath": "/__fixture__/health",
      "start": {
        "binary": "/absolute/pinned/python3",
        "binarySha256": "<64hex>",
        "args": ["tests/browser/serve_ui_fixture.py", "--port", "8769"],
        "sourceFiles": ["tests/browser/serve_ui_fixture.py"]
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
`start aura candidate seed-1`, `start staticref baseline seed-1`,
`test aura http`, `test aura browser`, `stop aura`,
`stop staticref`, `index`, then `exit`. The index command uses
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
