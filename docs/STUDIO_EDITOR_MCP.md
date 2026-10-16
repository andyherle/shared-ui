# Local Studio editor and MCP

Studio edits private JSON drafts through one authoring service. The browser editor,
JSON CLI, and MCP clients share revision checks, operation receipts and the same
store. They can run simultaneously. This is a document editor with native previews;
application source and running application behavior still belong to their owners.

## Start temporarily on your Mac

Use Node 22 or newer. The foreground launcher starts the editor and authenticated
HTTP MCP together. It installs no background service or login item:

```sh
npm ci --prefix tools/studio-mcp --ignore-scripts
npm run check
./studio
```

Open the launch link printed in Terminal. **Ctrl-C** stops both listeners. Drafts
remain in `~/Library/Application Support/Shared UI Studio/drafts` so the next
launch can resume them. `connection.json` beside those drafts contains the current
browser launch link, HTTP bearer credential and an absolute-path stdio client
configuration. Keep this file private. The HTTP/browser credentials rotate at
launch; a stopped session's links stop working. Stdio starts its own process and
uses the same draft store.

The default launcher uses the synthetic demo registration and grants draft editing.
For explicit registrations or read-only use, pass the full options, for example:

```sh
./studio --store /absolute/private/drafts --views /absolute/private/views.json
```

The MCP port is 41914; `--port` changes only the editor port. A busy port fails
without replacing an existing process. No Portal registration is performed.

## Start only the editor

Use Node 22 or newer, from this checkout:

```sh
npm run check
npm run studio:editor -- --store "$HOME/Library/Application Support/Shared UI Studio/drafts" --demo --write
```

Open the printed launch link. Its random credential is in the URL fragment, which
the browser removes immediately and retains only for that tab's session. The
server binds to `127.0.0.1:41913`. `--port` chooses another local port. Ctrl-C stops
it. This does not install a background service or change Style Lab/Tailscale routes.

`--demo` registers a synthetic review view; it does not import any real app. Create
a document, inspect a component in the library, choose a compatible slot, and add
it. Use `--views /absolute/private/views.json` instead for your own registrations:

```json
[
  {
    "appId": "example-app",
    "viewId": "review",
    "adapter": "document",
    "bindings": {"approve": "action", "title": "value"}
  }
]
```

These are opaque binding references, not executable functions or source paths.
Preview controls stay inert. An owning app must explicitly implement its adapter
before a Studio document can drive that app. Audit-only registrations remain
read-only and cannot host authoring documents.

Omit `--write` for a read-only connection to an existing store. Store directories
must be outside **all Git working trees**, including other checkouts. The existing
atomic store also rejects symlink roots and symlink/hardlinked state files. It is
local same-user storage, not protection from another process running as you.

## Visual review

The preview is the main workspace. **Live changes** shows one draft;
**Before / after** shows two panes; **Drag to compare** overlays equal-width
previews with a draggable line. The line also supports Left/Right, Shift for
larger steps, and Home/End. Preview scrolling is synchronized in comparison modes.
Choose a saved snapshot as Before, or **Use current as before** to freeze the
current draft. Agent changes update only the After side. Changing comparison
mode or baseline does not change the saved document. **Keep a snapshot** saves
an automatically named version without opening the advanced editor.

**What this affects** traces a selected style value through related values,
components in this draft, and shared component types. This is a declaration-based
potential impact tree, including scoped overrides, not a live inventory of running
apps or proof of a pixel change. The `studio_document_impact` MCP tool returns the
same evidence and coverage. App adapters remain future work.

Technical controls are in **Advanced editing**, closed by default. **Edit this
value** opens the matching document value directly; clicking a preview component
or impact-tree item opens its inspector. Agents can handle structure and bindings
through the same revision-checked commands.

## Editing workflow

- Search all 59 registered components. Twenty have native document renderers;
  other entries explain their availability and link to the existing catalogue.
- Select through the preview or Structure list. Edit declared props, typed token
  values/aliases, layout, and registered binding references in the inspector.
  A token draft shows a synthetic specimen without adding nodes to its JSON.
- Move nodes to declared slots, drag a structure row before another row, or use
  Option + Up/Down on a focused row to reorder siblings. Required slot counts,
  cycles and incompatible families are checked before commit.
- Compatible swaps retain the node ID, bindings, tokens and children. Invalid swaps
  fail with an explanation. Binding changes require the separate explicit form.
- Save named snapshots; compare them visually with current content; rename,
  archive/unarchive, duplicate to an independent document, restore, and undo/redo
  the latest change. A comparison never redirects the working document.
- Choose either pack, light/dark theme, density, and a narrow or fluid preview.
  Draft appearance is saved with that document. Shared source tokens do not change.

Forms submit explicitly. Unsubmitted fields block navigation and unrelated edits;
Discard form changes resets them. Other sessions are checked every four seconds
while visible. A newer revision automatically refreshes the preview and impact tree when no form
has unfinished work or focus. Otherwise a notice preserves your fields. Load
current revision explicitly discards unsubmitted fields and loads that state.
A network failure retains the exact pending command: Retry same request uses its
original operation ID, so an already committed operation is not applied twice.
There is no offline write queue.

The keyed renderer preserves unchanged native controls, input values and focus
across appearance/prop updates. It inserts labels as text and never executes
bindings, HTML, JavaScript or arbitrary CSS. The document and typed-token validators
remain the authority. Scoped styling is applied only inside preview frames.

## MCP transports

The optional tooling package uses the official MCP SDK, isolated from the root
build, local editor and consumer bundle:

```sh
npm ci --prefix tools/studio-mcp --ignore-scripts
npm run studio:mcp:check
```

For a local process client, configure a **stdio** server. This generic JSON example
uses the same store and registrations as the editor; use absolute paths on your
machine and ensure the client can locate Node 22+:

```json
{
  "mcpServers": {
    "shared-ui-studio": {
      "command": "node",
      "args": [
        "/absolute/checkout/tools/studio-mcp/server.mjs",
        "--store", "/absolute/private/drafts",
        "--views", "/absolute/private/views.json"
      ]
    }
  }
}
```

Add `--write` to that server's launch arguments to grant draft editing. A tool
request cannot grant itself permission. Read-only connections omit the command
tool and reject a direct attempted call to it. Stdout contains protocol messages
only. The SDK handles discovery, initialization/version negotiation, framing,
errors and shutdown, including 2025-era clients.

For a local HTTP-capable client:

```sh
# Generate locally; keep the value in the process environment/client secret store.
export STUDIO_MCP_TOKEN="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')"
npm run studio:mcp -- --store "$HOME/Library/Application Support/Shared UI Studio/drafts" --demo --write --http
```

The endpoint is `http://127.0.0.1:41914/mcp`; pass
`Authorization: Bearer <STUDIO_MCP_TOKEN>`. Both transports expose tools generated
from the service's `METHODS`, such as `studio_components_list`,
`studio_document_read`, `studio_document_tokens`, `studio_document_impact`, `studio_document_compare`, and
`studio_document_command`. The command schema is generated from `COMMANDS`.
Results carry the same document/app/view, revision, scope and structured errors.

HTTP requires a strong bearer token, exact local Host, and absent or matching
Origin. The editor has its own independent per-process token. Both servers bound
request bodies and expose no filesystem, shell or arbitrary source-editing tool.
The MCP SDK's HTTP handler supports current per-request traffic and legacy
Streamable HTTP clients. Studio does not add a second protocol implementation.

This is **local authenticated HTTP**, not a public remote gateway. Cloud clients
cannot reach loopback directly. No OAuth/public hosting configuration or relay is
included. Do not forward these development listeners to a public endpoint. A
remote service needs a separately designed authenticated deployment and explicit
permissions; repository visibility is not that access control.

## Validation and scope

```sh
npm run check
npm run studio:mcp:check
npm run studio:browser
# Existing registry: http://127.0.0.1:41912/test/studio-browser.html
# Native renderer:   http://127.0.0.1:41912/test/studio-renderer-browser.html
```

Node coverage includes HTTP authentication/origin/path/body boundaries, read-only
permissions, revisions, atomic edits, deletion/undo, binding validation, private
storage, downstream packaging, and official SDK clients using both transports.
The renderer fixture exercises all 20 renderers in two simultaneous views, both
packs/themes, and 390px/1280px widths, preserving native focus/value/selection,
checking scoped paint, inert content/navigation and cleanup.

The full editor is additionally exercised in the macOS browser with native form
submission, keyboard reordering, saved-version operations and concurrent sessions.
There are no live consumer adapters, three-consumer acceptance, hosted OAuth,
source migrations, publishing tools, or desktop app packaging in this increment. The foreground launcher does not
install a persistent service.

References: [official MCP SDK](https://ts.sdk.modelcontextprotocol.io/v2/),
[MCP transport security](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
[foundation contract](STUDIO_FOUNDATION.md), [release workflow](STUDIO_RELEASES.md).
