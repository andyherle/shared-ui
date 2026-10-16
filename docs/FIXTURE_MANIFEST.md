# Fleet UI fixture manifest and offline index — schema v1

This is a coordination contract for **real application UI fixtures**, not a
replacement mock application. An app owner keeps their private source, synthetic
data, templates, handlers, state adapter and manifest in **their own repository**.
The public shared-ui repository owns only this format, a generic Style Lab
example, and `scripts/fixture-index.mjs`.

## Required manifest (per owner)

Create a private `fixtures/ui-manifest.json` (or equivalently named file):

```json
{
  "schemaVersion": 1,
  "fixtures": [
    {
      "id": "review-edit-conflict",
      "app": "example-app",
      "repository": "example/example-app",
      "ref": "0123456789abcdef0123456789abcdef01234567",
      "command": "npm run fixture:ui",
      "baseUrl": "http://127.0.0.1:43111",
      "route": "/?view=review&fixture=conflict",
      "state": "conflict",
      "expectedInteraction": "Open an actual review form, edit, save and receive a deterministic stale-revision conflict.",
      "backendAdapter": "deterministic in-memory read/write mock; reset per scenario",
      "reset": "npm run fixture:reset",
      "sourceKind": "real-app",
      "mockOnly": true,
      "productionWritesDisabled": true,
      "status": "prepared",
      "evidence": {"result": "unrun"}
    }
  ]
}
```

Required fields per fixture are `id`, `app`, `repository`, `ref`,
`command`, `baseUrl`, `route`, `state`, `expectedInteraction`,
`backendAdapter`, `reset`, `sourceKind`, `mockOnly`,
`productionWritesDisabled`, `status` and `evidence`. Stable IDs use
lowercase hyphenated ASCII; `repository` is owner/repo. Each launch profile should have one deterministic command and reset shared by
all its routes. One app can expose more than one launch profile for separate
style packs or fixture servers. Local-only base URLs must use an explicit port and `http` or `https`
on `localhost`, `127.0.0.1` or `[::1]`. Direct routes begin with
`/` and may include query and fragment. External origins, credentialed URLs,
path traversal and unrecognized keys are rejected by the index generator.
`sourceKind` is `real-app` for consumer fixtures or
`shared-ui-catalogue` for the generic sample. Apps with genuinely separate
Postvisual and Personal fixture servers may declare multiple launch profiles;
the index groups by `app + baseUrl + command` and requires a consistent
reset and adapter **within** each profile.

`productionWritesDisabled: true` and `mockOnly: true` are required. Those
declarations **do not enforce isolation** on a running application: the owner
must enforce it in the server/request adapter, prevent transport escapes, refuse
live record updates, and add regression tests proving production state cannot
change. Do not include credentials, live project data, unredacted logs or
private code in the public manifest example or coordination hub.

## Compatibility with the fleet's initial CONTRACT v1

Existing app agents began fixture work before this offline generator was
implemented. For their **prepared-only** manifests the generator recognizes
four existing wrappers without copying their private data to shared-ui:
`{schemaVersion:1,fixtures:[...]}` (Home), `{schemaVersion:1,fixtureStates:[...]}`
(Ledger), `{schema:"shared-ui-fixture-manifest-v1",fixtureOnly:true,entries:[...]}`
(Delivery), and a bare JSON array of fixture entries (Portal's test-only
`/fixture/manifest.json` endpoint). For these manifests it also accepts:
- A human-readable app label (for example `Example Home`), not only a slug.
- Existing `status: "prepared-unrun"`, normalized to **prepared**, never
  called verified.
- Legacy `evidence` text, displayed as an **unrun** human description.
- An optional top-level `description` and optional same-loopback-origin
  `launchUrl` for fixtures with a test-only login gate.
- Missing new `sourceKind`, `mockOnly`, `productionWritesDisabled`
  assertions: they are marked **legacy, isolation not explicitly attested**
  and **cannot** be labelled verified until the owner supplies the flags and
  exact passed runtime receipt. An explicit false is never accepted.

Compatibility does **not** relax loopback URL restrictions, encoded route
traversal checks, output locality, HTML escaping or the prohibition on
claiming browser verification without evidence. No private app manifest is
checked into this public repository. Owners should add explicit attestations
in their next private PR without rewriting the existing 18/43+ deep links.

## Coverage every consumer is expected to deliver

Each consumer should deep-link directly into its own **actual** pages and
handlers, including the following distinct states and interactions:

- Empty, short/typical, long and unbroken strings; Unicode/combining marks,
  CJK, RTL and emoji; headings and multiline Markdown.
- Many-row and many-card pagination/scrolling, large lists, tables, overflow,
  native column reorder and resize if the app exposes them.
- Editing, selection, keyboard Tab/Enter/Space/Escape/arrows, IME composition,
  copy/paste, search, navigation, modal/disclosure opening, native validation.
- Loading/pending, successful response, intentional error and retry,
  stale revision/conflict, disabled and permissions-limited flows, using a
  deterministic mock backend with seed/reset.
- Both color packs as applicable, light/dark, density, touch/coarse pointer,
  390px phone, tablet/narrow panels and desktop; zoom and full-workspace views
  where applicable.
- One-time desktop page width: use semantic `--ui-page-width`, a **single**
  outer content wrapper in `@layer app`, and no recursive 70% narrowing.
  Canvas or transformed worlds must retain a full-workspace exception.

**No parallel mock-only HTML recreation:** use real app templates, components,
stylesheets, state machine and browser handlers. Replace only the external
backend boundary with deterministic, local synthetic adapters. The fixture
route must be directly launchable and not depend on hidden UI navigation.
A manifest is an *index*, not proof that a route boots or behaves as specified.

## Status and evidence

Statuses: `prepared` (code committed, not runtime-verified), `verified`
(actual fixture executed and passed) or `blocked` (known dependency). For
`verified`, supply:

```json
"status": "verified",
"evidence": {
  "result": "passed",
  "runner": "Local browser fixture + HTTP smoke suite",
  "command": "npm run fixture:check",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "observedAt": "2026-10-16T23:15:00Z",
  "detail": "390px, 768px, desktop, editing, failed save/retry tested"
}
```

An actual GitHub Actions source unit test may verify its particular assertions,
but **does not verify that a browser fixture works** unless it ran the
fixture/browser itself. A prepared route retains `evidence.result: unrun`
even if unrelated unit tests pass. Record exact test command, revision,
runner, observed results and any unrun check. App agents provide this evidence
in their private PRs and hub comments. The public generator validates receipt
completeness but cannot independently attest to a claimed run.

## Build one private, clickable local index

From the shared-ui checkout with Node 22 or newer:

```sh
node scripts/fixture-index.mjs \
  --input /private/consumer-one/fixtures/ui-manifest.json \
  --input /private/consumer-two/fixtures/ui-manifest.json \
  --output /tmp/shared-ui-fixtures.html
```

Open that **local HTML file** in your browser. It is generated offline with
native links, tables and disclosures, no JavaScript, fetch, listener, CDN or
remote resources. Each link requires that app's own fixture server to be
running. The generator **does not start applications, run tests or send network
requests**. It refuses output inside the public shared-ui checkout and
discards unknown manifest fields to prevent accidental private data leakage.
The produced index itself can reveal app names, route identifiers and
scenario descriptions: retain it locally, do not commit or distribute it.

To try the **public synthetic catalogue sample**, run `npm run dev` separately,
then generate a local index:

```sh
node scripts/fixture-index.mjs \
  --input fixtures/manifest.example.json \
  --output /tmp/shared-ui-catalogue-fixtures.html
```

Sample anchors (`/#buttons`, `/#fields`, `/#responsive`,
`/#content`) use real shared-ui Style Lab templates and local handlers,
not copies of consumer UI. Their `prepared/unrun` status is intentional.

## Ownership and review checkpoints

Coordinator owns this versioned manifest format, the offline index generator,
shared tokens, generic examples and new reusable control contracts.
Each app owner maintains their app's manifest, launch/reset adapter, real UI
fixtures, coverage and execution receipts in their **own** repository.
New shared native control requests first go to the coordination issue with
DOM semantics, interaction lifecycle, failing app surface, and a synthetic
reproducer; agents should reread coordinator comments before adopting a
changed shared contract. Do not alter generated shared CSS/runtime/icons,
and do not merge/deploy/publish through the fixture workflow.
