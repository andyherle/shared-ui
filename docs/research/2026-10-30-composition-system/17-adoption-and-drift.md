# 17. Consumer adoption and drift control

## The failure to prevent

A component can be implemented, documented, and published while the application still uses an older copy. More documentation will not correct that state. The system needs evidence about the real integration points.

## Inventory first

For each applicable view, record the owner, native rendering path, current shared bundle, composition identity, supported contract, local overrides, fixture, and release mechanism. Keep unknown fields unknown.

Classify each view as using the canonical composition, using a documented exception, pending migration, pinned, or not applicable. Output-only creative rendering and genuine application geometry need not become shared control layouts.

Do not infer adoption from the presence of `runtime.js`, a CSS link, or a shared button class. Those prove only part of the dependency chain.

## What counts as drift

Useful categories include copied composition markup, duplicate control paint, unsupported slot hierarchy, an undeclared layout override, an old composition contract, a detached instance presented as linked, and a fixture that does not use the real template.

Not every difference is a defect. A timeline canvas and a record form have different domain needs. Record the reason and boundary of a genuine exception rather than forcing a universal page layout.

## One source of rules

The registry should drive authoring constraints and structural audit expectations where possible. Runtime implementation and documentation must name the same slots and variants. Add a test that fails when those declarations diverge.

Do not add a second registry only for the auditor. Do not let each consumer copy the canonical slot list into another permanent file without a generation or validation relationship.

## Enforcement progression

Start with a readable report. Correct false positives and classify genuine exceptions. Then make new drift fail the owning fixture's CI. Existing warnings need an owner and migration plan; they should not be ignored indefinitely.

Do not make production UI unavailable because an advisory audit finds a mismatch. The remedy is a safe migration, not a new user-facing blocker.

## Prevent the old pattern from returning

Update the shared component, catalogue examples, authoring defaults, templates, and agent guidance together. Remove superseded code in the migrated paths. A new “preferred” component beside the old default invites agents to keep using the old one.

For the standalone disclosure defect, check context rather than just class names. A disclosure in a real multi-action row can be correct. A boxed group toggle inside a one-child wrapper is still the rejected pattern.

## Governance references

GOV.UK's contribution criteria emphasize evidence and reuse across services. Carbon distinguishes patterns from individual components and provides contribution guidance. [S62–S63](23-source-register.md#s62)

**Local recommendation:** promote a pattern after it solves a demonstrated repeated need. Require two different consumers before broad generalization. Keep ownership and the test contract clear.

## Migration sequence

Choose one bounded group. Inventory the old code. Add or refine the shared contract. Adopt it in the first real-template fixture. Remove the replaced markup/styles there. Adopt it in a second distinct fixture. Verify one central change in both. Then document the remaining applicable views and proceed in small consumer-owned changes.

A shared PR is not fleet completion. Each consumer needs its own verified change or a justified exception.

## Progress reporting

Report useful outcomes: which views now inherit the shared layout, which duplicate structures were removed, which state tests passed, and what remains blocked. Do not use lines of code, registry size, or number of generated components as the main progress measure.
