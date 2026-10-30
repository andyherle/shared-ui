# 20. Worked scenarios for the proposed system

All examples are synthetic. The notation is conceptual and is not a new executable schema or supported API.

## Scenario A: replace isolated group toggles

**Current problem:** a page contains several isolated boxed controls that only reveal sections. Each consumer created its own arrangement.

**Target structure:** a shared control-group definition has a heading, short context, related actions, and a body. Optional content uses a heading-integrated toggle. A disclosure in a real related-action bar remains supported.

**Central edit:** change the maintained group policy, then classify whether the change is compatible styling or requires a structural migration. Affected consumers and exceptions appear before release.

**Checks:** remove all peer actions; the remaining toggle must not retain the rejected boxed-action presentation through an empty wrapper. Keep hidden body values and native focus correct. Do not remove the content merely to simplify the page.

## Scenario B: change an inspector from side-by-side to stacked

**Structure:** body and aside use the existing workspace slots. The application supplies a native form and inspector controls.

**Edit:** select the supported stacked layout. Do not rebuild the form or move values into the editor's document store.

**Checks:** unsaved input, selection, validation errors, open groups, and footer submission remain intact. A narrow embedded instance stacks even inside a large desktop page. A media canvas keeps its own geometry and output.

## Scenario C: preserve one justified exception

**Default:** all groups inherit a shared gap.

**Exception:** one densely populated inspector needs an allowed spacing override. Its private configuration records a reason.

**Edit:** change the shared gap. Every linked, unmodified instance inherits it. The exception remains visible in the impact report. Reset removes the override and reveals the new default.

**Failure to reject:** copying the current inherited value into every instance. That looks correct now but prevents future inheritance.

## Scenario D: the consumer is too old

**Candidate:** a new composition requires a slot that an installed runtime does not support.

**Expected:** the old consumer keeps its known-good view. The release report marks it as needing migration. The publisher must not say that all views updated.

**Recovery:** ship a normal compatible consumer release and verify its actual view. Do not silently drop the unknown slot or replace it with an unrelated control.

## Scenario E: two agents edit the same shared pattern

**Agent one:** proposes a layout change against revision 12.

**Agent two:** changes the same document before the first command is accepted.

**Expected:** the stale command is rejected. The first agent reads the new state and prepares a revised proposal. An uncertain response is retried with the original operation identity and exact arguments.

**Failure to reject:** last-writer-wins overwriting of another edit or treating an old replay receipt as the current state.

## Scenario F: shared action, different placements

**Application:** registers a safe action ID and its current enabled state.

**Layout:** places that action in a shared row or an approved overflow area. The implementation remains application-owned.

**Checks:** the label and accessible name remain correct when captions compact. Moving the action does not grant authority, change its arguments, or create a duplicate handler.

## Scenario G: one edit, partial fleet adoption

**Candidate:** a compatible shared layout improvement passes two pilot fixtures.

**Actual state:** two views have verified the new revision, one app is offline, and another is pinned to an older bundle.

**Report:** name the verified views and the outstanding states. Do not count the offline or pinned view as updated. The person can still use those applications with their baseline.

## Scenario H: a schema is valid but the layout is bad

**Candidate:** a structurally valid group hides the primary task under several optional sections.

**Expected:** human task review rejects it even if schema tests pass. The final UI must keep the main action and decision-critical facts easy to find.

**Lesson:** schema validity prevents certain errors. It does not replace design judgment or user testing.
