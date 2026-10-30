# Shared UI composition system: phase-one research

Date: 2026-10-30. Status: research and proposed design only.

## The goal

Group controls into maintained, shared structures. Change a structure or its layout once. Let every compatible application inherit that change without losing its own data, actions, or working state.

This is broader than matching button colors. It is also broader than removing one unwanted disclosure style. The desired unit of reuse is a **composition**: related controls, named content areas, layout rules, and interaction rules that stay connected to one definition.

## Main conclusion

Extend the existing native Shared UI composition and Studio foundation. Do not start a second component registry, editor, document store, or application framework.

The repository already contains `review-workspace@1`, a native composition factory, a Studio component registry, typed token editing, and revision-checked document commands. Source inspection confirms the factory exists. The documentation does not establish that all live consumers use it. The next implementation must prove adoption, not merely add more shared source. See [the current-system audit](02-existing-system-audit.md).

The recommended direction has three parts:

1. Shared, named compositions with constrained layouts and explicit local overrides.
2. One authoring workflow that shows whether a change affects one instance, a shared pattern, or a pack.
3. A measured release and consumer-adoption path. A saved draft, published asset, installed bundle, and verified live interface are different states.

This is a research recommendation. It is not a claim that the proposed interfaces already exist.

## Read first

| Need | Start here |
| --- | --- |
| Understand the request and evidence limits | [01: Brief and method](01-brief-and-method.md) |
| Avoid rebuilding work already present | [02: Existing-system audit](02-existing-system-audit.md) |
| Find external repositories | [03: Repository landscape](03-repository-landscape.md) |
| Compare possible approaches | [22: Evaluation scorecard](22-evaluation-scorecard.md) |
| Understand the proposed system | [12: Proposed architecture](12-proposed-architecture.md) |
| Assign later implementation work | [19: Work packages](19-implementation-work-packages.md) |
| Find original evidence | [23: Source register](23-source-register.md) |

## Research notes

- [04: Visual builders and reusable modules](04-visual-builders.md)
- [05: Design tools, libraries, and instance inheritance](05-design-tools-and-libraries.md)
- [06: Schema-driven forms and layouts](06-schema-driven-ui.md)
- [07: Native and headless components](07-native-and-headless.md)
- [08: Tokens, recipes, and intrinsic layout](08-tokens-recipes-and-layout.md)
- [09: Inspectors and command registries](09-inspectors-and-command-registries.md)
- [10: Agent-generated UI contracts](10-agent-ui-contracts.md)
- [11: Cross-application update model](11-cross-app-update-model.md)
- [13: Human and agent authoring workflow](13-authoring-workflow.md)
- [14: Accessibility, state, and responsive layout](14-accessibility-state-and-layout.md)
- [15: Security, privacy, and performance](15-security-privacy-and-performance.md)
- [16: Validation and real-consumer fixtures](16-validation-and-fixtures.md)
- [17: Adoption and drift control](17-adoption-and-drift.md)
- [18: Proposed decision records](18-decision-records.md)
- [20: Worked scenarios](20-worked-scenarios.md)
- [21: Open questions and research gaps](21-open-questions-and-gaps.md)
- [24: Dependency, licensing, and research maintenance](24-dependency-and-research-maintenance.md)

## What this phase does not do

No runtime, CSS, generated asset, application adapter, dependency, or deployment change is included. No third-party builder was installed or benchmarked. No live application was migrated. No browser or device acceptance is claimed.

The external study covers selected primary documentation and repository material. It does not claim a complete code audit of every project. The catalogue marks the difference between focused documentation review and initial screening. Research gaps remain explicit.

The public notes use generic examples. They do not include private application source, customer records, operational screenshots, credentials, or local Studio drafts.

## Start condition for phase two

Approve a bounded prototype that uses the existing registry and one shared composition in two different, real application-template fixtures. The prototype must show one central layout change reaching both fixtures while preserving working state. Do not begin with a general-purpose website builder or a fleet-wide rewrite.

Related design defect: [shared-ui issue #16](https://github.com/andyherle/shared-ui/issues/16). This research does not close that issue.
