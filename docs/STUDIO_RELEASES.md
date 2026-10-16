# Public code, private authoring, controlled downstream releases

Keep the reusable Shared UI and Studio source public. Backend source is not a
credential: access comes from authentication and permissions on the running
service. Keep drafts, registrations, app roots, audit output, credentials and
application-specific integrations local or in their owning private repository.
Making source private would not authenticate a public deployment.

GitHub Pages continues to receive only the generated `public/` catalogue and v1
style assets. The build has no path from `src/studio`, `tools/studio-mcp`, a private
store, or a consumer inventory into that output. Studio's editing listeners run
locally with authentication. The public PR does not deploy those listeners.

## Two update paths

| Change | Delivery | Consumer responsibility |
| --- | --- | --- |
| Compatible shared CSS | Existing immutable stylesheet + integrity manifest on the v1 channel | Existing runtime applies CSS in place; frozen apps retain their bundled revision |
| Runtime behavior, markup contract, icons, baseline | Validated generated bundle in each owning app's change/PR | Review the diff, run app tests and browser checks, then release normally |
| Studio/MCP tooling | Reviewed source checkout plus optional locked SDK install | Restart local tools; retain the private store and registrations |
| Application-specific adapter | Owning private repository | Test bindings and migrations in that app; never copy its source into Shared UI |

A Studio draft edit changes **none** of these channels. Preparing a document diff
is not publishing. Source changes still require review and the normal shared
release before any downstream bundle refresh.

## Private consumer inventory and executable update workflow

Store this file outside the public checkout, for example in your private tooling
configuration. Only generated asset destinations are needed:

```json
{
  "schemaVersion": 1,
  "consumers": [
    {"id": "example-web", "root": "/absolute/private/example-web", "assets": "public/shared-ui"},
    {"id": "example-desktop", "root": "/absolute/private/example-desktop", "assets": "resources/shared-ui"}
  ]
}
```

Use a reviewed Shared UI checkout pinned to a commit. The source build and tests
must pass first. These commands never fetch or execute remote app code:

```sh
npm run check
# Read-only plan; reports version/revision and stale generated files.
node scripts/update-consumers.mjs --config /absolute/private/consumers.json

# Copy the exact version and full revision hash from that reviewed plan.
node scripts/update-consumers.mjs --config /absolute/private/consumers.json \
  --apply --version <version> --revision <full-revision-hash>

# Nonzero exit when any bundle differs. Optional --app <id> limits the selection.
node scripts/update-consumers.mjs --config /absolute/private/consumers.json --check
```

The updater validates every destination before writing the first app. It rejects
escaping paths, symlink directories/files, hardlinked assets and duplicate
outputs. It invokes the existing installer for exactly `styles.css`, `runtime.js`,
`icons.svg`, `manifest.json` and `bundle.json`, then verifies each installed bundle.
It never edits application source, commits, pushes, opens PRs or deploys an app.
Keep its inventory and reports private: they contain local filesystem paths.

Within each app, review those five generated files and any separately authored
markup migration; run that app's tests plus narrow/desktop and both-pack browser
checks as applicable. Commit on an update branch, open the app's own PR, and deploy
through its existing process. Multiple apps are not one atomic release: a later
filesystem failure can leave earlier copies complete, so rerun `--check` and
resume deliberately. Roll back through each app's prior commit and bundle.

For CI, run this workflow **inside the private consumer repository**: check out a
reviewed Shared UI commit into a temporary tools directory, run its `npm run check`,
run its installer with the app's declared asset directory, verify with `--check`,
then run the app's tests. The resulting PR belongs to that consumer. A public
Shared UI workflow should not receive credentials that can read or push private
application repositories. A manually dispatched private update workflow or a
repository-scoped GitHub App can automate the consumer-owned step later.

## If some tooling must become private

Keep the public shared-ui repository and asset URL as the stable distribution
boundary. Put proprietary integrations, orchestration and deployment code in a
private `shared-ui-tools` repository that pins a reviewed public Shared UI commit.
It can use the same installer and private inventory above. Do not clone private
applications into the public checkout or push their reports with a shared release.

If even shared source must be private, publish an allowlisted asset-only artifact
from private CI into a separate public distribution repository, preserving the
manifest/integrity contract. The public publisher consumes only that artifact;
it never gets a private source checkout. Private consumers can instead vendor the
same validated bundle and disable automatic CSS updates. Changing the current
repository's visibility is unnecessary for the implementation in this PR and
would require checking the existing Pages distribution first.

References: [GitHub repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility),
[MCP transport security](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
[local Studio setup](STUDIO_EDITOR_MCP.md).
