# 11. One shared edit, several safe update paths

## The central requirement

“One edit changes every consumer” is an authoring goal. It must not become a claim that every running application can safely accept every kind of change at once.

The current repository distinguishes compatible CSS updates from bundled runtime changes. Preserve that distinction until a separately reviewed contract changes it. See [the existing-system audit](02-existing-system-audit.md).

## Change classes

| Change | Candidate path | Required evidence |
| --- | --- | --- |
| Color, spacing, or compatible style value | Existing validated CSS channel | Same contract; integrity and size checks; real-consumer rendering tests |
| Layout using the same DOM and interaction order | CSS path only when genuinely expressible and compatible | No hidden required action, lost content, order mismatch, or state reset |
| Selecting a supported runtime layout attribute | Consumer code/configuration release under its existing contract | The consumer supports the selection and applies it without remounting |
| New slot, changed hierarchy, changed native element, or event behavior | Versioned shared runtime plus consumer migration | Migration and browser evidence; explicit compatibility handling |
| Application action or persistence change | Owning application's normal release | Domain tests and authorization checks |

The labels above are proposed release classification. They are not an existing automatic policy engine.

## Do not misclassify the disclosure fix

Removing a border can be a CSS edit. Moving an unrelated Reply disclosure into the main answer flow changes structure and potentially form behavior. Hiding the old control with CSS does not complete that migration.

First migrate the affected consumers to the right shared structure. Later changes to that structure's supported presentation can be central. “One place to maintain it” does not remove the initial adoption work.

## Release states

Track these separately:

`draft → validated candidate → committed → published artifact → available to consumer → installed/loaded → view verified`

A failed stage must not be represented as a later one. A Git push does not prove a deployed page changed. A manifest fetch does not prove the layout was applied. A source import does not prove the relevant screen uses it.

## Compatibility record

A candidate release should identify its source commit, asset digest, runtime contract, composition contract, affected policies, supported consumers, and required migration. Keep document revisions separate from release versions. An edit revision orders draft changes; it is not a semantic compatibility version.

A consumer should report its supported contract and installed revision through an existing private diagnostic or fixture mechanism. Keep this metadata small and free of business content.

## Partial adoption

Use an explicit table of applicable views. Each row is verified, pending migration, blocked, pinned, or an accepted exception. Unknown is not green. The person should see “verified in two views; one older consumer still needs its release,” not “updated everywhere.”

Avoid introducing a new always-on telemetry service just for this table. Start with repository manifests, build receipts, and app-owned fixture results. Add runtime reporting only when it is needed and privacy-reviewed.

## Safe rollout

Validate one shared candidate against representative fixtures. Release to a controlled consumer first. Check it while a form contains unsaved text, a disclosure is open, and the view is narrow. Then expand the rollout. Keep the previous compatible asset available for recovery.

Rollback of appearance should be a new forward release of known values, consistent with the existing publisher. Structural rollback requires an explicit compatible migration. Do not downgrade a persisted document blindly.

## Potential later data-driven layout channel

A constrained layout document could eventually let compatible consumers apply approved layout changes without rebuilding their business code. That is a separate design decision. It needs an interpreter contract, signature/integrity policy, schema limits, local pinning, offline behavior, compatibility negotiation, and state-preservation tests.

This research does not authorize that channel or remote JavaScript. The first prototype should prove shared composition reuse with the existing release model. Add another distribution path only when measured benefit exceeds its new failure modes.

## Release tooling reference

Changesets documents release intent, versioning, changelogs, and dependency updates. It is a useful process reference. It does not install a new version into every independent application. [S70–S71](23-source-register.md#s70)
