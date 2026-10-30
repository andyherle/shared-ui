# 19. Phase-two work packages and agent handoff

Status: proposed sequence. These are not started tasks, assignments, or deployment authority.

## WP0 — Verify the present state

**Owner role:** integration reviewer.

Read current `AGENTS.md`, composition source, registry, Studio contracts, fixture manifests, and relevant consumer integration files. Record exact revisions. Reconcile stale source-only status text with actual merged code and installed consumers.

**Deliverable:** a small evidence table of present, missing, and unverified capabilities. No private content copied into this public repo.

**Exit:** the team can name the first two real views and their rendering/release paths. The existing disclosure guidance conflict is identified precisely.

## WP1 — Define the smallest missing shared group

**Owner role:** shared-contract implementer.

Extend the existing registry and composition contract. Define semantic roles, slots, allowed children, layout variants, disclosure contexts, override rules, native form expectations, and lifecycle. Use existing controls.

**Deliverable:** one bounded contract and real synthetic catalogue fixture. Remove conflicting examples for the replaced pattern.

**Exit:** editor discovery, validation, runtime, and audit agree. No second registry or general-purpose DSL is introduced.

## WP2 — Prove native rendering and state retention

**Owner role:** runtime implementer.

Implement the smallest needed factory/renderer change. Keep application callbacks and native elements. Make supported layout changes without remounting active controls. Design the server-rendered path separately if one pilot needs it.

**Deliverable:** source tests and browser fixtures for state, forms, layout, cleanup, and failure cases.

**Exit:** no lost draft, focus, selection, native submit, or open-state regression in the supported cases. Unsupported changes fail clearly.

## WP3 — Connect authoring to the same contract

**Owner role:** Studio implementer.

Expose supported grouping/layout choices through the existing document command service. Show scope, inheritance, overrides, and reset. Add a compact affected-consumer preview from known registrations. Mark unknown coverage honestly.

**Deliverable:** the same edit through keyboard UI and MCP, with matching validation and receipts.

**Exit:** no duplicate mutation engine, silent scope escalation, or false claim that a draft changed a live app.

## WP4 — Adopt in two different consumer fixtures

**Owner roles:** one implementer per consumer.

Use actual application view constructors/templates with synthetic data adapters. Keep each application's authority and persistence. Remove superseded structure and paint from the migrated path.

**Deliverable:** consumer-owned PRs linked to the exact shared contract and fixture results.

**Exit:** one central layout change reaches both fixtures. Screens that merely copied the new markup do not count.

## WP5 — Release and adoption verification

**Owner role:** release/integration reviewer.

Classify the change as compatible CSS, supported configuration selection, or structural/runtime migration. Use the existing release path. Verify the published artifact and installed consumer revisions. Exercise failed update, offline, pinned, and older-consumer cases.

**Deliverable:** exact receipts and remaining adoption table.

**Exit:** no broad “done everywhere” claim without applicable-view coverage. No production deployment is implied by this work package alone.

## WP6 — Prevent regression and expand

**Owner role:** shared-pattern maintainer with consumer owners.

Add checks for copied structures, unsupported overrides, outdated contracts, and the rejected standalone disclosure context. Keep genuine exceptions explicit. Expand only after the two-consumer proof.

**Deliverable:** remaining migration slices, updated examples and agent guidance, and removal of replaced paths.

## Independent review questions

Does the change remove duplicated decisions? Can a person predict its scope? Can an old consumer fail safely? Are private values absent from the shared model? Are the same native controls still used? Is there a tested recovery path? Is the final UI better, not merely more abstract?

## Agent start prompt

> Work on one named work package only. Read this research index, current repository instructions, and the exact existing contracts before editing. Confirm source and consumer revisions. Reuse the current registry and command service. Keep application state and private data in the owning app. Use synthetic fixtures. Remove the replaced path when adoption is complete. Report actual commands, browser/device checks, changed views, and unresolved cases. Do not call source completion fleet acceptance. Do not merge, publish, or deploy without the required authority.

The person should approve the bounded prototype direction before implementation agents start. This document is the handoff, not a background runner.
