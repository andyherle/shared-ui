# 24. Dependency gates and research maintenance

## Research is not dependency approval

A public repository is a source of evidence. It is not automatically a suitable package, a stable product contract, or permission to copy every file into this codebase.

This phase adds no third-party source code or runtime dependency. Notes are original analysis with links to primary material. No paid documentation, full article archive, private application source, or external design asset is included.

## Gate before adoption

For each proposed dependency, record the exact package and revision, the missing capability it supplies, the existing code it lets us remove, the runtime/build/test boundary, bundle cost, browser requirements, and maintenance owner.

Read the license files for that exact revision and the relevant subpackages. Check assets, fonts, examples, and optional paid extensions separately. This research does not issue a legal compatibility opinion or assign license labels from memory.

Review current release notes and issue history for the actual feature being used. Do not use stars or total commit count as a substitute for maintenance evidence. A project can be active while the needed package is deprecated or a feature remains experimental.

## Version traps found during this study

- DTCG has stable 2025.10 reports and newer draft material. Use the exact report intended for implementation.
- GrapesJS Symbols documentation carries a beta qualification. Do not silently convert that into a stable-product guarantee.
- Puck package names and APIs have evolved. Recheck current integration instructions instead of mixing old examples with current documentation.
- Panda current slot-recipe documentation differs from older versioned pages. Keep examples within one documented version.
- FAST 1.x guides remain searchable. They are historical material, not proof of a current package API.
- Shoelace and Web Awesome need an explicit migration review, not a name substitution.
- Retool module pages consulted here are marked for classic apps. Do not assume the same API in the newer editor.
- A2UI documentation exposes several protocol versions. Do not combine their schemas into one invented contract.
- Vendor packages/modules can have edition-specific availability. Verify the required edition before a procurement decision.

See the [source register](23-source-register.md) for the pages behind these cautions.

## Keep the research useful

Preserve this dated folder as a decision snapshot. When implementation begins, add a small follow-up note with changed assumptions and exact tested versions rather than silently rewriting history.

Keep short conclusions near the evidence. Mark a recommendation as superseded when a prototype disproves it. Link the implementation PR and test receipt that resolved each important open question.

Do not turn this folder into another application state store. Consumer adoption belongs in maintained manifests, owning repositories, and verified receipts. These research notes explain decisions; they should not become a manually updated duplicate of live status.

## Suggested lightweight checks

Check Markdown links and headings, verify referenced repository paths, and flag broken primary sources. Recheck rolling documentation when using it for implementation. Pin external source links to commits for any code-derived design that becomes important.

A failed link is a research-maintenance issue, not evidence that a feature does not exist. A source page that changed is a reason to reassess the claim, not to preserve a stale quote.

## Handoff rule

Implementation agents should read only the relevant research notes plus current contracts, then expand to original sources where necessary. They should not load all notes into every task or treat this study as higher authority than a later reviewed decision.
