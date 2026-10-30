# 16. Validation: prove shared behavior in real templates

## Evidence ladder

Use separate claims for schema validation, source tests, synthetic rendering, real-template integration, actual device checks, and installed-consumer verification. Passing an earlier step does not imply a later one.

A catalogue demo can prove a component works in isolation. It cannot prove an application stopped using its old markup.

## Reference tools

Storybook documents interaction tests and reuse of stories in other tests. Playwright documents accessibility testing, accessibility-tree snapshots, and visual comparisons. axe-core supplies automated accessibility checks. [S64–S69](23-source-register.md#s64)

These are references for a test strategy, not required new production dependencies. Reuse the repository's current harness first. Any optional test tooling must remain outside consumer bundles.

## Required fixture design

Each selected consumer supplies its real template or view constructor. Replace only data and side-effect boundaries with deterministic synthetic adapters. Do not build a second, hand-maintained imitation of the application screen.

A fixture manifest should identify the owning repo, view, composition/runtime contract, scenario, launch command, viewport/container size, and expected interaction. Keep private paths and contents in the owning repository. The shared catalogue contains only safe generic examples.

## Test matrix

| Area | Cases | Proof required |
| --- | --- | --- |
| Structure | Required/optional slots; invalid child; nested composition | Registry and rendered structure agree |
| Layout | Stack, split, narrow embed, long content | No clipping, hidden required actions, or nested width shrink |
| Working state | Dirty field, selection, IME, undo, open details | Layout change preserves the task |
| Forms | Native submit, invalid value, external footer submit | One form owner and one submission |
| Interaction | Keyboard, pointer, touch, overlay return | Correct focus and available actions |
| Updates | CSS candidate, old runtime, offline, failed asset | Honest state and usable baseline |
| Overrides | Inherit, override, reset, changed default | Correct origin and continued inheritance |
| Cleanup | Mount/dispose cycles; hidden views | No retained listeners or unnecessary background work |
| Privacy | Audit and error output | No private text, values, or credentials |

Test both packs and supported themes/densities. Include two simultaneous views. Test a narrow embedded panel within a wide page; viewport-only tests miss that case.

## Specific regression for issue #16

Render a section disclosure without peer actions. It must use the approved integrated section pattern, not an isolated boxed action. Render a genuine related-action bar with a disclosure. That valid case must remain usable.

Then remove all peer actions dynamically. The remaining control must follow an explicit supported fallback. Do not create an empty toolbar wrapper merely to pass a class-name check.

Verify the actual computed appearance and semantics. A DOM audit alone cannot prove that old application CSS did not restore the rejected style.

## Structural audit versus visual proof

The existing schema audit is valuable for identity, slots, and declared variants. It cannot by itself certify computed styles, reading order, touch behavior, or state retention. Conversely, a screenshot cannot prove shared ownership or correct actions.

Combine structure, interaction, and final rendered evidence. Visual regression tests may support CI, but the work does not require a public before/after gallery. Keep private screenshots private.

## Suggested receipt

Record exact source and consumer revisions, test command, environment, scenarios run, failures, skipped cases, and artifact location. Separate automated WebKit results from a real iOS Safari check. Report an unavailable device as untested, not passed.

## Completion gate

Two distinct real-template consumers must use the same maintained composition and show one central change. The old duplicated structure/styles must be removed from those paths. Only then expand to further consumers.

No tests listed here were executed as part of this documentation-only phase.
