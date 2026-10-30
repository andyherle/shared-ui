# 02. Existing Shared UI: reuse before replacement

## Snapshot and scope

Repository: `andyherle/shared-ui`. Read snapshot: `4b1724c4703ba3e6f1215b519f68fd74620bc15c`. Tree: `994b538724c83acfe6ce69a56696c51edabe7a98`.

The following files were read: `AGENTS.md`, `docs/COMPOSITIONS.md`, `docs/STUDIO_FOUNDATION.md`, `docs/STUDIO_CONFIGURATIONS.md`, and `src/compositions.js`. Selected integration, disclosure, layout, and update sections of the large `README.md` were also read. This is not a whole-repository audit.

All links in this note use the pinned snapshot. Current main can differ.

## What exists

| Area | Evidence | Meaning |
| --- | --- | --- |
| Native control language | [AGENTS.md](https://github.com/andyherle/shared-ui/blob/4b1724c4703ba3e6f1215b519f68fd74620bc15c/AGENTS.md) | Native forms, actions, groups, disclosures, and popouts already have shared roles. |
| Canonical composition | [Factory source](https://github.com/andyherle/shared-ui/blob/4b1724c4703ba3e6f1215b519f68fd74620bc15c/src/compositions.js) | `review-workspace@1` is implemented, not only described. |
| Composition contract | [COMPOSITIONS.md](https://github.com/andyherle/shared-ui/blob/4b1724c4703ba3e6f1215b519f68fd74620bc15c/docs/COMPOSITIONS.md) | Named slots, layout variants, constrained overrides, and consumer acceptance are described. |
| Authoring engine | [STUDIO_FOUNDATION.md](https://github.com/andyherle/shared-ui/blob/4b1724c4703ba3e6f1215b519f68fd74620bc15c/docs/STUDIO_FOUNDATION.md) | A shared registry, private draft model, revision checks, and editor/MCP service already exist according to the documentation. |
| Linked pack editing | [STUDIO_CONFIGURATIONS.md](https://github.com/andyherle/shared-ui/blob/4b1724c4703ba3e6f1215b519f68fd74620bc15c/docs/STUDIO_CONFIGURATIONS.md) | Personal can inherit from Postvisual with explicit overrides and reset behavior. |
| CSS distribution | [README.md](https://github.com/andyherle/shared-ui/blob/4b1724c4703ba3e6f1215b519f68fd74620bc15c/README.md) | Compatible stylesheet updates are separate from bundled runtime changes. |

## Source-confirmed composition behavior

The factory supports one composition ID and six slots: `header`, `toolbar`, `filters`, `body`, `aside`, and `footer`. Header and body are required. It accepts unique, detached native elements from the same document. It rejects already connected nodes and overlapping slot roots.

It constructs the shell once. `setLayout()` changes supported attributes and inline layout tokens. It does not replace slot children. The source provides `standard`, `split`, and `stack` variants, and `wrap`, `scroll`, and `priority` crowding settings.

Only `gap` and `aside` overrides are allowed. They have type/range checks and require a reason. The returned configuration distinguishes canonical and instance settings. The factory adds no timer, network request, observer, or application state. These are source observations, not a browser-test result.

## Important gaps and conflicts

**Source presence is not adoption.** The composition document calls itself source-only and explicitly withholds installed-consumer and fleet-acceptance claims. Because the file is now on main, its old PR-status language may be stale. Treat code existence as confirmed and live adoption as unknown. Do not infer either universal installation or universal absence.

**The authoring system is not a live app editor by default.** The Studio foundation distinguishes document previews from installed application adapters. A renderer can preview a draft without changing the application that inspired it.

**Shared types do not prove shared layout ownership.** App-owned templates can still use the same buttons while copying group structure. The missing evidence is an inventory of real view templates and their composition versions.

**Disclosure guidance needs reconciliation.** The main guidance prefers heading-based `ui-section` content. Selected README examples also permit a standalone full-width `ui-disclosure` in some review contexts. The newer rule in issue #16 rejects isolated boxed section toggles. Future work must resolve the specific exception and examples, not add another competing rule.

**Counts are not coverage.** The Studio document reports component and token inventories. They were not independently recounted here. Registry presence does not prove that every variation is accessible or installed.

## Constraints to carry forward

Keep the native runtime and build dependency boundary. Keep the shared CSS budgets of 36 KiB raw and 8 KiB gzip. Keep generated `public/` output generated. Preserve private drafts outside Git. Keep the existing distinction between a CSS update and a behavior/markup release.

## Next evidence to collect

Read the current registry, fixture manifests, generated bundle contracts, and each chosen consumer's exact integration point. Run the documented checks in an isolated checkout. Then demonstrate one central composition change in two real-template fixtures. This is a better first proof than expanding the editor catalogue.
