# Shared UI Studio

Status: product direction and first audit foundation, not a shipped editor.

## Outcome

Make shared-ui the place to browse, adjust, compare and maintain the interface
language used by multiple applications. A person and an MCP agent must work on
the same identified document, through the same validated commands. The editor
must not become another independent button implementation.

The normal workflow is: choose an app/view or a reusable component, open its
working version, save a named variation, change it, compare it, review affected
consumers, and prepare a change. Saving is not publishing. Nothing in a preview
may silently update every running app.

## What exists

The repository already has a native DOM runtime, two packs, a working Style Lab,
a local macOS host, integrity-addressed CSS releases, bundle inventory in
`scripts/audit-consumers.mjs`, and browser layout/control checks in
`src/diagnostics.js`. Preserve these investments and their lifecycle behavior.

Palette and typography values live in `src/tokens.json`; geometry, density and
component aliases also live in `src/controls.css`. A token editor must account
for both rather than pretending the JSON file contains every editable token.
The existing CSS-only use of plain native buttons remains valid.

## Experience

Use a searchable component library, a central preview, and one contextual
inspector. An app/view switcher and saved-version comparison are always easy to
reach. Audit results open as a review surface, not a wall of permanent warnings.

The library must list every registered component and composition, with previews,
variants, supported states, keyboard behavior and usage locations. Both packs
share the same component definitions. Filter by component family, app, pack,
status or text; never hide components merely because the current app does not
use them. Unregistered app controls appear separately as discovery candidates.
Show unavailable previews as unavailable, not missing components.

Selecting a component exposes human-readable controls for its declared props,
semantic tokens, dimensions and allowed layout choices. Every value shows whether
it is inherited or overridden, its scope, and a reset action. Selecting a global
token shows its consumers before any publish operation. Do not expose arbitrary
CSS as the default editing experience.

Saved versions support rename, duplicate, compare, archive, restore and undo.
Keep a clear distinction between a component variation, a screen composition,
and a pack/token change. A variation is not another pack or a copied stylesheet.
The default editing scope is the selected working document, not global defaults.

Compose screens with declared slots and responsive row, column, grid, stack and
split layouts. Support drag-and-drop and keyboard move commands. A reorder
changes a layout document, not a runtime DOM index. Free x/y positioning is only
available in a component's expressly supported canvas region. Do not let routine
panels become absolute-positioned posters that break at another width.

Swaps must preserve a stable node identity and declared action/data bindings.
Compatible slots can swap components. An incompatible binding requires review
or rejection; the editor must not discard handlers or pretend arbitrary source
can be rewritten safely. Legacy views without an adapter are inspect/audit-only
until explicitly integrated.

## One contract and command model

Extend the initial structural descriptors into a complete, versioned registry.
Each component needs a stable ID, native semantics, typed props, variants/states,
semantic token references, allowed slots/children, renderer adapter, fixtures,
accessibility expectations, audit rules and migration/deprecation metadata.
Do not maintain separate hand-written lists for the UI, MCP, documentation and
auditor. Generate those projections from the registry. Catalogue coverage tests
must catch missing registrations; CSS selector discovery is a candidate inventory,
not proof that a class is a component or that registration is complete.

Keep three distinct layers: primitive values, semantic meanings, and component
tokens. Preserve the two packs and existing CSS names during migration. Resolve
aliases, validate types and units, detect cycles and unknown references, and show
where an override originated. Move declarations incrementally with before/after
rendering checks; do not introduce a second palette or stack new overrides over
superseded paint.

A saved composition is versioned JSON containing stable nodes, component IDs,
props, token references, layout/slots and binding references. It must not contain
executable JavaScript, private application data, or generated HTML as its source
of truth. Resolve application behavior through adapters in the owning app.

A small shared authoring service owns reads and commands. The visual editor and
MCP use it equally. Mutations take an expected document revision and operation
ID, validate the complete result, write atomically, and return the new revision
and undo information. Repeating an operation must not duplicate a node. A stale
human/agent edit produces a visible conflict rather than last-write-wins loss.
Undo is itself revision-checked. Opening or comparing a saved version does not
redirect another editor's working state.

## Modules and reuse

Keep the existing small runtime and its CSS budget independent of development
tooling. The runtime must not acquire an editor, MCP server, GitHub client or
browser-testing dependencies. Suggested boundaries are contracts, authoring
service, editor adapter, audit adapters, and repository/release adapters.

Evaluate the open-source GrapesJS core as an optional editor-only dependency for
native HTML composition. Its component and block APIs fit a constrained DOM
adapter better than forcing existing consumers into React. The spike must prove
native semantics, canonical CSS, keyboard reordering, responsive layouts and
lossless conversion to the shared composition model. Disable unconstrained
inline paint and arbitrary script/HTML import. Do not adopt generated CSS as a
second design system. Do not assume the commercial Studio SDK is the open-source
core or that its license is interchangeable.

Storybook is useful for isolated component development/testing, but the existing
Style Lab already fills part of that role. Do not introduce a second catalogue
without a concrete benefit. Puck is React-oriented and is an option for a future
React adapter, not a reason to rewrite native consumers. Reuse mature tooling
where it removes work; reject a tool that requires an app-wide rewrite.

Reference documentation:
- GrapesJS core components: https://grapesjs.com/docs/modules/Components.html
- GrapesJS blocks: https://grapesjs.com/docs/modules/Blocks.html
- Storybook: https://storybook.js.org/docs/api
- Puck: https://puckeditor.com/docs

## macOS and MCP

Start with the existing local macOS service model, using an isolated development
instance. Keep the dev source authoritative and deployment one-way. Do not alter
unrelated LaunchAgents or network routes. A Tauri desktop wrapper can provide an
app icon, native file selection and local permissions once the editor is useful;
it is packaging, not a second authoring engine. Test on actual macOS Safari/WKWebView,
not just Chromium. Docker must not be required.

Use the official MCP SDK as an authoring-service adapter, with stdio for local
process clients and authenticated Streamable HTTP for remote clients. A loopback
server is not reachable by a cloud client by itself. Remote access requires an
explicitly configured authenticated gateway/bridge; do not expose an anonymous
local editing service. Validate Origin/Host, restrict paths to registered roots,
reject symlink escapes, and never offer an arbitrary shell/eval/write-file tool.
Read-only discovery/auditing and mutations have distinct permissions.

The MCP surface should cover component/token discovery, app/view registration,
reading the exact working/saved version, creating and comparing variations,
validated node/layout/token edits, preview requests, audits, change preparation,
and explicit release operations. These are semantic commands, not mouse macros.
A tool response includes the target app/view, revision and affected scope.
Publishing is separate from editing; write permissions never imply permission
to merge or deploy across every consumer.

SDK references: https://ts.sdk.modelcontextprotocol.io/
Authorization: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/authorization
Tauri concepts: https://v2.tauri.app/concept/

## Auditing without breaking applications

Compose four kinds of evidence, retaining their origin and coverage:

1. Bundle identity/integrity and staleness from the existing consumer auditor.
2. Source-level candidate discovery and override analysis through language-aware
   adapters. Use parsers, not regex-only compliance claims. Hard-coded creative
   output colors and user data are not UI-token violations.
3. Runtime structural and computed-style checks, with the existing layout/state
   diagnostics retained. Compare the effective pack, mode, density, pointer and
   state; allow documented app layout and role-specific geometry. An unregistered
   control is a review candidate, not automatic proof of a defect.
4. Opt-in interaction, accessibility and visual regression checks on synthetic
   or explicitly approved fixtures. A screenshot alone cannot prove token use,
   source provenance or accessibility.

A finding identifies app/view/component, an exact rule, expected and observed
facts, evidence class, location, severity and a proposed resolution. Prefer stable
adapter/source IDs; DOM positional locators are a fallback that can move when a
view changes. Distinguish new drift from accepted legacy issues. Exceptions are
narrow, reasoned, expiring and visible. Changed evidence requires fresh review.

Ordinary drift is advisory. Applications continue running and normal audit
commands succeed with a warning report. A CI gate is explicit and per consumer;
operational failures remain failures and incomplete coverage is never a clean
bill of health. Do not turn an entire existing backlog into a sudden release gate.

The first review actions should be: inspect, compare with canonical, accept an
exception, prepare a migration, or propose a reusable variation. Autofixes are
previewed and applied on a branch, never blind cross-repository replacements.

## Multi-repository adoption and privacy

Each participating app registers its repository/ref, local source root, bundle
location, pack, views, framework/host adapter, editable regions, fixture entry
points and excluded output-only surfaces. Keep private roots and audit output
local or in the owning private repository; never copy private app source, media,
credentials, screenshots or reports into this public repository. This repo holds
only public contracts, tools and synthetic fixtures.

GitHub discovery finds candidates; registration and runtime observation establish
actual usage. A detected manifest is not proof that every view is using it. Show
unregistered, inaccessible, stale and partially scanned consumers explicitly.
Native SwiftUI/AppKit surfaces require separate adapters; a DOM auditor cannot
inspect them. Preserve embedded/Obsidian theme scoping and iframe/shadow boundaries.

For distribution: preview locally, validate affected fixtures, prepare the shared
change, build the release, then prepare per-consumer migrations where needed.
Maintain existing compatible CSS-only updates. Changes to DOM contracts, icons or
behavior require normal application releases; drafts and layout documents never
ride the automatic CSS channel. Pin and rollback by revision. Keep cross-repo
updates bounded and reviewable rather than requiring a simultaneous migration.

## Initial implementation in this branch

`src/schema-audit.mjs` is opt-in development tooling with declarative structural
checks for adopted actions, composed fields and popout shells. It captures no
text, form values, URLs, markup or screenshots. It does not traverse unrelated
iframes/shadow roots or install observers. The snapshot/result schema is versioned,
findings preserve expected/observed evidence, and exact exceptions expire.

`scripts/audit-ui.mjs` assesses one or more locally captured snapshot files. It
keeps app/view results separate, is advisory by default, and has an explicit
`--fail-on-warning` gate. Exit 2 means invalid input or an operation failure;
exit 1 is reserved for the opted-in gate. It does not discover GitHub repositories,
launch browsers, edit source or stop applications. Reports should stay private.

```js
// Import from an explicitly enabled development adapter; this is not a new
// production runtime global or a route on the existing Style Lab server.
import { collectSchemaSnapshot, auditSchemaSnapshot } from './schema-audit.mjs';
const snapshot = collectSchemaSnapshot(document, { appId: 'demo', viewId: 'inspector' });
const report = auditSchemaSnapshot(snapshot);
```

```sh
node --test test/schema-audit.test.mjs
node scripts/audit-ui.mjs --snapshot /private/audit/inspector.json
node scripts/audit-ui.mjs --snapshot /private/audit/inspector.json --exceptions /private/audit/exceptions.json
# Explicit CI policy only:
node scripts/audit-ui.mjs --snapshot /private/audit/inspector.json --fail-on-warning
```

An exceptions file is an array of `{fingerprint, reason, expires}` records.
`expires` is an inclusive UTC calendar date in YYYY-MM-DD format. Reports retain
suppressed findings and reasons. The browser regression fixture is
`test/schema-audit-browser.html`; serve it and the source module through a local
test harness. It uses synthetic content and checks live DOM behavior, not paint.

This is not complete catalogue coverage, a source scanner, a token/paint auditor,
an accessibility certification, an editor, a deployed MCP connection, or a macOS
app bundle. Existing `src/diagnostics.js` remains unchanged. During registry/runtime
integration, migrate overlapping structural rules into the single registry-backed
implementation; do not ship two permanent competing definitions.

## Delivery sequence and acceptance

First complete registration of all existing catalogue components and tokens,
including both packs, variants/states, compositions and coverage checks. Integrate
structural and layout reporting without losing existing APIs. Then deliver the
small authoring service and usable library/token/component editor with MCP parity
and revision-safe saved versions. Add constrained composition and per-app adapters,
followed by computed-style/source auditing and reviewable repository migrations.
Package the desktop experience after macOS and permission validation.

The first complete vertical slice is successful when a person can open a
registered view, duplicate a version, adjust a token at a clearly selected scope,
swap a compatible control, move it between allowed slots, compare and undo, and
run the same operations through MCP. Then audit at least three differently hosted
consumers, explain a deliberately introduced outlier without interrupting an app,
and prepare a change affecting only the selected repositories. Test offline use,
stale writes, duplicate commands, restores, narrow viewports, both packs, both
modes, keyboard-only operation and real macOS rendering before calling it shipped.
