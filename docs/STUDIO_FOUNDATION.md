# Studio authoring foundation

This layer provides the local document engine used by the visual editor and MCP
adapter. It edits private, versioned JSON drafts. Rendering and transport stay in
separate adapters; the engine cannot rewrite application source, merge changes,
or publish styles. See [editor/MCP setup](STUDIO_EDITOR_MCP.md) for the runnable UI.

## Available contracts

`src/studio/registry.mjs` registers 59 catalogue components and compositions with
stable IDs, native semantics, pack parity, declared props, variants/states, token
references, slots, binding types, keyboard expectations, fixture locations and
lifecycle metadata. `listComponents()` searches the whole library independently
of application usage. The existing Style Lab remains the catalogue.

A renderer status of `document-only` means the JSON model supports authoring that
component. All 20 now have native draft previews; this does **not** mean a live
application adapter is installed.
`catalogue-only` components remain discoverable and previewable in their existing
Style Lab fixture; attempts to author them fail explicitly. Descriptors for these
components are inventory contracts, not complete editor schemas. There are no
registered private consumers in this repository.

`ROLE_OWNERS` explicitly classifies shared CSS roles as components or component
parts. Coverage tests require owners for catalogue/CSS roles, registered native
controls, valid token references and existing fixture anchors. The browser fixture
checks each registered selector against its actual catalogue fixture, including
runtime-created controls. These checks do not certify every variant, interaction,
accessibility expectation, or future composition merely because a selector exists.

The advisory schema auditor now projects its three structural contracts from this
registry. Quiet actions and native `form.ui-popout` are accepted. Fingerprints
include expected as well as observed evidence, so old exceptions need review when
a rule changes. Existing audit snapshot/result schemas and CLI exit behavior stay
at version 1. `SharedUI.auditControls`, layout capture and comparison keep their
existing production APIs; their runtime structural checks have not been migrated
in this development-only increment. Consolidating those checks requires a normal
bundled runtime release and its browser validation.

## Tokens and provenance

`src/studio/tokens.mjs` inventories all 73 existing `--ui-*` names from
`src/tokens.json` and `src/controls.css`, preserving JSON pointers or CSS line/rule
contexts. It does not move declarations or append new styles. Literal source
values project into primitive nodes; existing CSS names remain semantic or
component nodes. Component consumer lists come from the registry's declared token
references. They are not a claim about every live app's computed inheritance.

Known root rules resolve the two packs, light/dark modes, density, and pointer
contexts in source order. Alias resolution detects cycles, unknown references,
type mismatches and invalid literals. Draft colors use hexadecimal values;
lengths use non-negative `px`, `rem`, `em`, `%`, `vw`, `vh`, `dvh`, or unitless zero;
numbers have declared bounds. Arbitrary CSS, URLs and expressions cannot enter
editable token values. A `{ "ref": "--ui-primary" }` value is a typed alias.

Component-local declarations, CSS fallbacks and compound values remain available
for inspection with `requires-renderer` coverage; the service does not pretend to
compute them. Read-only font/shorthand and authored content roles cannot be edited
as design tokens. `document.tokens` resolves the draft's document and optional node
overrides, with source/document/node origins. These are document-model values,
not an assertion that a live DOM has applied them. Resetting a node override
reveals the document or source value; resetting a document override reveals its
source. No source or pack defaults change when a draft changes.

## One authoring interface

`createAuthoringService({directory, views, writable})` returns a synchronous
`dispatch({method, args})` API. `METHODS` generates discovery schemas and enforces
method arguments. `COMMANDS` generates the command union; the registry and complete
document validator enforce the context-dependent constraints. The editor
and official MCP SDK adapter call this interface, retaining its operation
IDs, errors and revision checks rather than implementing another mutation engine.

Read methods provide component/token discovery, explicit view registrations,
document listing, exact working/saved reads, scoped token resolution, comparisons,
and local change proposals. `document.prepare` returns a selected-document diff;
it makes no claims about affected repositories, live consumers or migrations.

Every mutation is a `document.command` request:

```json
{
  "method": "document.command",
  "args": {
    "documentId": "review",
    "expectedRevision": 2,
    "operationId": "make-save-blue",
    "command": {
      "type": "set-token",
      "nodeId": "save",
      "token": "--ui-primary",
      "value": "#315cbd"
    }
  }
}
```

The response identifies the app/view, document, affected scope, new revision and
latest undo operation. Operation IDs are scoped to a document and persisted with
the request digest and result. Replaying the identical request after a restart
returns the original result with `replayed: true`, even after subsequent edits.
Its revision is the original operation's revision: read again to get current
state. Reusing an ID for different arguments fails with `OPERATION_REUSED`.

Stale revisions produce `REVISION_CONFLICT` with expected/actual revisions.
`STORE_BUSY` asks a concurrent writer to retry; it never silently overwrites
another process. No-op commands also advance the revision so every accepted
operation has one durable receipt. Rejected commands leave file bytes unchanged.

Commands support creation, naming, pack/theme/density, typed props/tokens, explicit
registered bindings, token reset, insertion, subtree removal,
compatible swaps, slot moves, declared responsive layouts, named snapshots,
version renaming/archive/unarchive/restore, and latest-change undo/redo. A
`duplicate` command creates a **new** document from a saved snapshot and requires
the source document's current revision as well as destination revision zero.
Opening or comparing snapshots never changes another editor's working content.
Saved contents cannot be edited in place. Undo is itself revision-checked and
only targets the latest change; undoing that undo redoes it. Use saved versions
for older recovery points. Creation/duplication has no undo-delete operation.

A node has an immutable ID, component ID, declared props, token overrides,
registered binding references, named slots and optional declared layout. Moves
specify an index **after** removal from the old slot. Insertions can include a
`descendants` map of new nodes so required slots are satisfied in one transaction. Every node must be reachable
exactly once from the root; cycles, duplicate parents, orphans, unknown slots and
incompatible child families are rejected. Swaps retain bindings, tokens, slots
and the ID. Incompatible bindings fail for review; they are never silently dropped.
There are no HTML, JavaScript, inline-style, arbitrary attribute or current form
value fields. Labels are inert text; future renderers must insert them as text.

Document kinds distinguish compositions, component variations and token drafts.
Token drafts have `root: null` and no nodes. Documents remain scoped to their
registered app/view; ordinary commands cannot retarget them. A registration's
`document` adapter authorizes JSON drafts only. `audit-only` registrations cannot
create or mutate documents. Live app behavior remains in the owning application.

## Private local storage

Supply an absolute directory outside all Git working trees. The service stores
`studio.json` there and never accepts a file path in a command. Keep registrations,
working content, comparisons and audit reports private. Only synthetic fixtures
belong in this repository.

Writes require explicit `writable: true`. A cross-process directory lock protects
revision checks through commit. Each update is validated, written to an exclusive
0600 temporary file, fsynced, renamed atomically, then the directory is fsynced.
Reads see either complete revision. The registered directory identity is checked;
symlink roots/state files, hardlinked state files and changed roots are rejected.
This is a local, same-user store, not a security boundary against a hostile process
with access to its parent directory. Keep it on a local filesystem.

A crashed process can leave `.studio-lock`. The service reports `STORE_BUSY` and
never steals it. Before removing a persistent lock, stop every writer using that
store, back up `studio.json`, and verify the owning process has exited. There is
no automatic recovery command that could race an active writer.

Limits are 500 nodes per document, 100 saved versions per document, 1,000 documents
per store, 10,000 successful operation receipts per document, 64 levels of JSON
nesting, 4 MiB per command/document-state clone and 32 MiB per store. Limits fail
explicitly; receipts are never evicted in a way that could replay an old mutation.
There is no history compaction or network filesystem support yet.

## Try the synthetic document

Use Node 22 or newer. The CLI reads one JSON request on stdin, writes one JSON
result on stdout and exits. It opens no listener and is not an MCP server.
Errors are structured JSON on stderr with exit 2; success exits 0.

```sh
# Machine-readable discovery requires no store.
node scripts/studio.mjs --describe

# Create the synthetic document in a private local store.
node --input-type=module <<'JS' | node scripts/studio.mjs --store "$HOME/Library/Application Support/Shared UI Studio/drafts" --demo --write
import fs from 'node:fs';
const document = JSON.parse(fs.readFileSync('test/fixtures/studio-document.json', 'utf8'));
console.log(JSON.stringify({method: 'document.command', args: {
  documentId: 'review', expectedRevision: 0, operationId: 'create-review',
  command: {type: 'create', document}
}}));
JS

# A read needs no write permission.
node scripts/studio.mjs --store "$HOME/Library/Application Support/Shared UI Studio/drafts" --demo <<'JSON'
{"method":"document.read","args":{"documentId":"review"}}
JSON
```

`--demo` registers only `studio-demo/review` with synthetic binding IDs. For your
own explicitly integrated document views, replace it with `--views` and the path
to a private JSON array of `{appId, viewId, adapter, bindings}` registrations.
Binding values are `action`, `navigation`, `value`, or `boolean`; their keys are
opaque IDs, never functions, URLs or application data. Registrations provide no
repository/source access. The caller controls the read/write permission when
constructing the service; a request cannot grant itself write access.

## Validation and remaining integration

```sh
npm run check
npm run studio:browser
# Open the printed loopback URL in a browser. Ctrl-C stops this isolated harness.
```

The harness reuses the catalogue's local server with watching and write routes
disabled, and exposes only the synthetic test pages and their browser-safe source
modules. It does not mount the document service, change the managed macOS host,
or alter network routes. `STUDIO_TEST_PORT` selects another loopback port.

Node tests exercise the document workflow, stale writes, duplicate commands after
restart, competing processes, restore/undo, forbidden bindings/layouts, scoped
tokens, read-only permission, failed atomic writes, corrupt data and path/symlink
boundaries. The browser fixture checks registry locations, live roles and audit
non-interference in two simultaneous catalogue views at 390px and 1280px, across
both packs and modes, then runs the structural privacy regression fixture.

The visual editor, native draft renderer and official MCP transports are now
implemented in separate modules; see [their setup and checks](STUDIO_EDITOR_MCP.md).
An authenticated remote gateway, live consumer adapters, computed-style/source
auditing, repository migrations, desktop packaging, broader touch/offline testing,
and three-consumer acceptance remain future work. No runtime, palette, stylesheet,
generated public asset or consumer bundle changes are part of these increments.
