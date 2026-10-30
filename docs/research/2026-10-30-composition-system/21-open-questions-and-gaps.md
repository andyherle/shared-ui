# 21. Open questions and research gaps

The research supports a direction. It does not settle every implementation choice. Resolve the following with bounded evidence rather than speculative framework work.

| Question | Current evidence | Next test or decision |
| --- | --- | --- |
| Which live views already use the composition factory? | Source exists; universal adoption is not established. | Inspect exact consumer templates and installed revisions. |
| Can server-rendered views share structure without copied templates? | Current factory rejects connected nodes. | Compare initial server rendering, generated contract validation, and a narrow adopt-in-place design. |
| Which group types are genuinely shared? | Workspace and native group patterns exist. | Find two different real uses before registering a new type. |
| Which layout changes are safe through CSS alone? | Existing CSS channel is deliberately limited. | Test working-state and logical-order invariants for each proposed policy. |
| Is a data-driven layout distribution channel needed? | It could reduce coordinated releases, but adds a new interpreter/update boundary. | First measure the cost of the existing release path. Design a channel only if justified. |
| How should a shared slot be removed or renamed? | Stable identity is required; migration details remain open. | Build a synthetic old document with overrides and bindings; test explicit migration and rollback. |
| How should consumer coverage be collected? | Existing fixtures and diagnostics are available in principle. | Prefer source manifests and receipts; assess whether runtime reporting adds value. |
| How should detached instances be handled? | Detachment weakens central control. | Determine whether a documented exception is sufficient before adding detach. |
| What should happen when a peer action disappears? | A one-button wrapper must not preserve the rejected pattern. | Test dynamic action availability and choose an explicit fallback. |
| How do layout edits interact with native undo and IME? | Node retention is a design aid, not proof. | Real browser and device tests with active input. |
| How should large inspectors be searched and navigated? | Inspector libraries offer useful references. | Test a real hierarchical control panel with keyboard editing and long labels. |
| What performance cost is acceptable? | CSS budgets are documented; new runtime costs are unmeasured. | Establish a reference device/fixture baseline and measure candidate changes. |
| Which dependency, if any, is worth adding? | No missing capability has yet justified a new production dependency. | Exact package/license/version review plus a removal-benefit prototype. |

## Areas screened but not deeply examined

The study did not perform full implementation comparisons of every schema form library, native component collection, or internal-tool builder. Budibase, Formily, uniforms, RJSF, Base UI, Ariakit, Leva, Vaadin, Lion, FAST, and axe-core include screening-level entries in the catalogue. Read their current source and relevant tests before deriving an implementation from them.

The study also does not cover every desktop toolkit, game-engine inspector, mobile-native UI framework, or collaborative editor algorithm. These are possible later references if a concrete unresolved requirement points to them. They are not needed to justify a second system now.

## Product testing still needed

No representative person performed the proposed authoring workflow in this phase. Test whether scope, inheritance, reset, and partial adoption are understandable without reading a technical guide. An interface that exposes every schema option may be complete but still hard to use.

## External claims still needing verification

Current documentation can describe features not available in all product editions or packages. No pricing, procurement, license compatibility, support commitment, or maintenance ranking is asserted here. No external repository was fully security-audited or benchmarked.

## Completion meaning

Phase one is complete when the research notes, evidence links, proposed design, and bounded implementation handoff are recorded and reviewable. That does not mean the product is implemented or that every research question is closed.

The next useful result is a two-consumer proof, not another broad literature sweep with no working acceptance test.
