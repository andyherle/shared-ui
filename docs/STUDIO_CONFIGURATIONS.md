# Configuration workspace

Launch `./studio` and open the printed link. **Configurations** manages the two
public pack identities, Postvisual and Personal. **Documents** still edits private
view compositions: components, bindings, layout and local overrides. A document
is not a pack and saving it never publishes CSS.

Personal is a linked mirror of Postvisual. Its `src/tokens.json` definition names
`postvisual` and stores only explicit overrides by `defaults`, `light` and `dark`
scope. The pack resolver feeds the build and token inventory. Both packs retain
identical controls, DOM, behavior and appearance until an intentional override is
added. Radius defaults now live with the other pack values instead of competing
CSS. Existing saved light/dark preferences remain intact.

## Work locally

Select a scope and value, then submit **Apply value**. For a mirror, **Reset value**
removes the override and resumes inheritance. Postvisual draft changes appear in
Personal immediately. Editing a draft never changes source or public CSS. Private
state extends the atomic Studio store; old document stores need no manual migration.

**Duplicate** freezes current resolved values into an independent named draft.
Choose Postvisual or Personal as its eventual release target; there is no third
runtime pack. **Configuration settings** renames, links, detaches, or resets a
draft to source. Cycles and invalid token contracts fail without partial saves.

The native preview retains inputs, focus and disclosures while its CSS changes.
Use both themes, densities and phone/available widths. **Before / after** compares
working values with current source or an immutable snapshot. Restoring a snapshot
restores exact resolved values as an independent configuration; link it explicitly
to resume following a mirror source. Changes lists exact value differences; the
release panel separately names every affected pack, including inherited changes.

Visible editors poll every four seconds. Agent edits refresh idle editors; dirty
forms and focused forms block automatic replacement. Hidden views stop polling;
closing releases requests and shared observers. Uncertain writes retain exact
arguments in tab session storage. Use **Retry same request**. Historical receipts
can describe older revisions, so read current content after replay.

## Validate and publish

**Validate** compiles the candidate, enforces typed values and the 36 KiB raw / 8 KiB gzip budget,
then runs `npm run check` in an isolated source copy. Its private receipt binds
the revision, resolved mirror values, candidate hash, whole source fingerprint,
Git parent, CSS integrity and byte sizes. This checks shared tests and build;
it does not certify downstream behavior or replace browser review.

Publishing needs a separate local launch permission:

```sh
./studio --publish
# Explicit registrations:
./studio --store /absolute/private/drafts --views /absolute/private/views.json --write --publish
```

The shortcut keeps the standard private store and demo registration and enables
both browser and MCP publishing. Otherwise the button is disabled and the publish
tool is absent from MCP discovery. Requests cannot grant permission. Portal's
existing endpoint and token-file registration continue working after restart;
discover the live toolset again.

Commit the implementation/source checkout first. Publishing requires the validated
fingerprint and exact Git parent, a clean tracked checkout, and no untracked source
files. `.DS_Store` and generated immutable CSS files are ignored by that gate.
Configured `origin` main must still match the validated parent. Requests cannot
choose a path, remote, branch, command or file.

**Publish validated revision** tests/builds again in a separate Git checkout,
commits only `src/tokens.json` and generated `public/`, then pushes the exact commit
to `origin/main`. A mirror candidate includes its source draft; the panel names
both packs when appropriate. The local checkout is fast-forwarded if still clean;
the receipt reports whether that succeeded. Update it before another release if
it could not be fast-forwarded.

The result is **pushed**, not **deployed**. The existing GitHub Pages workflow must
finish before apps receive CSS. Its link appears with the receipt. Runtime, markup,
icons and baseline changes still use consumer-owned releases. No private app source
is changed by this publisher.

Retry interrupted publication with identical arguments. Durable receipts and
deterministic commits recover uncertain pushes. A pending publication blocks a
different publication until recovered. Revision/source conflicts need a fresh
read and validation. Roll back appearance by restoring values and publishing a
new forward release.

## Shared editor / CLI / Portal MCP contract

| Service method | MCP tool | Purpose |
| --- | --- | --- |
| `configurations.list` | `studio_configurations_list` | Built-ins and private drafts |
| `configuration.read` | `studio_configuration_read` | Values, inheritance, revision, snapshots, receipts |
| `configuration.command` | `studio_configuration_command` | Duplicate, set/reset, rename, mirror/detach, snapshot/restore, reset source |
| `configuration.compare` | `studio_configuration_compare` | Source/snapshot differences |
| `configuration.preview` | `studio_configuration_preview` | Private before/after CSS and affected packs |
| `configuration.validate` | `studio_configuration_validate` | Full isolated checks and receipt |
| `configuration.publish` | `studio_configuration_publish` | Exact validated release, when enabled |

Commands require `configurationId`, `expectedRevision`, `operationId` and `command`.
Validation requires the first three fields. Publishing also requires the returned
`validationId`. Generated schemas are authoritative: `npm run studio -- --describe`.
In Portal discover with `portal_mcp_services`, inspect using `portal_mcp_tools`,
then call through `portal_mcp_request`. No separate Portal engine is needed.

```json
{"method":"configuration.command","args":{"configurationId":"postvisual","expectedRevision":0,"operationId":"accent-edit","command":{"type":"set-value","scope":"dark","token":"accent","value":"#7aa8ff"}}}
```

Drafts, snapshots, validation output and receipts remain outside Git. Public
output contains only the existing catalogue and generated shared assets.
