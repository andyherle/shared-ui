# 18. Proposed decision records

All decisions below are proposed for review. This research does not change the existing runtime contract.

## ADR-01: Extend the existing system

**Decision:** use the current registry, Studio service, native controls, and composition factory as the starting point.

**Reason:** a second editor or registry would add another place for drift. Existing source already implements the first composition. [Audit](02-existing-system-audit.md)

**Consequence:** phase two begins with gap verification and two consumer fixtures, not a new framework scaffold.

**Revisit when:** a measured prototype shows a required behavior cannot be expressed without unacceptable complexity.

## ADR-02: Reuse structures, not only styles

**Decision:** make named control groups and compositions maintained reuse units.

**Reason:** copied layout markup can diverge while individual controls still share CSS.

**Consequence:** definitions include slots, semantics, layout variants, and lifecycle expectations. Applications keep their content and behavior.

**Revisit when:** a candidate group has no genuine second consumer; keep that structure app-owned instead.

## ADR-03: Keep native elements and app state

**Decision:** retain native form ownership and app-owned values/actions.

**Reason:** replacing state to gain layout consistency risks lost drafts, changed validation, and duplicated save paths.

**Consequence:** no universal form store or behavior engine. Server-rendered integration needs explicit design.

**Revisit when:** a narrow control genuinely requires custom behavior and has browser evidence.

## ADR-04: Constrain overrides

**Decision:** allow typed, reasoned, resettable overrides rather than arbitrary styles.

**Reason:** unrestricted instance CSS defeats central control. Explicit differences preserve inheritance and make impact review possible.

**Consequence:** unsupported customization fails clearly. Repeated exceptions trigger a shared-pattern review.

**Revisit when:** real fixtures establish an additional common override that can be validated safely.

## ADR-05: Separate release classes

**Decision:** keep compatible CSS updates separate from structural/runtime releases.

**Reason:** a stylesheet cannot safely implement every DOM or interaction change. The existing distribution contract already makes this distinction.

**Consequence:** one central edit can require coordinated consumer releases. A later data-driven layout channel needs its own review.

**Revisit when:** there is a proven need and a tested, constrained interpreter contract. Never use this as permission for remote arbitrary JavaScript.

## ADR-06: One command surface for humans and agents

**Decision:** use the existing revision-checked Studio commands for both editor and MCP operations.

**Reason:** separate mutation paths can disagree about validity, scope, and recovery.

**Consequence:** proposals name exact targets and scope. Publishing remains separately authorized.

## ADR-07: Prove adoption through real templates

**Decision:** require two different consumer-owned real-template fixtures before broad rollout.

**Reason:** a catalogue and an installed bundle do not prove that the actual view uses the shared structure.

**Consequence:** implementation work includes deletion of replaced copies and explicit remaining coverage.

## ADR-08: Treat disclosure context as a composition rule

**Decision:** section toggles use the approved integrated heading pattern. Boxed disclosures remain limited to genuine related-action bars.

**Reason:** a global button style cannot decide where a control belongs. Issue #16 is a recurring structural defect.

**Consequence:** examples, defaults, audits, and tests must cover both accepted and rejected contexts. No empty-toolbar workaround.

## ADR-09: Borrow mechanisms before dependencies

**Decision:** use external systems as design references first.

**Reason:** most studied builders bring rendering, state, hosting, or package assumptions outside this repo's current boundary.

**Consequence:** no dependency is approved by this research. Each proposed addition needs an exact missing capability, removal benefit, license review, and measured integration test.
