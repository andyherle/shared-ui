# Composition resilience — 1.20.1

This increment hardens the native system on main. It does not add a new editor,
registry, state store, distribution service, production dependency, or stylesheet.
Application data and save actions remain owned by the application.

## Defects addressed

- Workspace adoption incorrectly treated a structural frame without a slot as a
  dynamic slot. It could fail before attaching to valid existing native markup.
- A failed local or shared layout write could leave some presentation changed
  while the configuration and revision still described the old layout.
- Adoption could discard override metadata without accounting for its inline
  values. It now requires the complete existing typed declaration and reason.
- Empty edits wrote the same attributes and classes again. They now produce no
  DOM writes when both values and their inheritance markers are unchanged.
- Input validation accepted objects that were not ordinary data records. Unknown,
  inherited, hidden, symbol, and accessor properties now fail before application.
  Ordinary records from another window and null-prototype records remain valid.

## Failure and recovery contract

All affected changes are prepared before a shared update starts. Only changed
presentation attributes, layout classes, and managed CSS properties are written.
The original native fields and their values are never copied into the scope.

If a write fails, attempted writes are restored in reverse order, including the
write that threw after changing a value. Configuration and revision advance only
after the complete operation succeeds. A recoverable failure can retry against
its original revision. Native input, focus, selection, form ownership, and open
state remain outside the update.

A nested update, registration, or disposal during a write is rejected. A changed
slot parent or document is also rejected before any group is updated. Ordinary
changes to the application-owned content inside a slot remain allowed.

If restoration itself fails, the error is explicit. `getState()` and
`getConfiguration()` expose `recoveryRequired: true`. Further edits are blocked.
Dispose the handles and scope, repair/verify the native structure, and create a
new scope before adoption. Do not call an uncertain update successful or reset
application input to hide the error. Disposal remains available in this state.

This is in-memory presentation recovery. It is not a transaction over application
saves, browser crashes, remote updates, or arbitrary hostile JavaScript. A caller
that controls DOM prototypes or Proxy traps is outside a data-validation boundary.

## Existing overrides

An adopted inline override must match the supplied typed value. A declared key
cannot be omitted, repeated, unknown, silently changed, or hidden with an empty
override object. Unmarked inline managed values also need an explicit declaration.
Unsupported inline `!important` declarations must be resolved before adoption.
Adopt the verified values first. Use `setLayout` for an intentional later edit or
reset. Other application-owned styles are not cleared.

## Usability

Studio uses readable choices such as Automatic, Side by side, Stacked, and Grid.
It names the layout field and the behavior used when space is limited. Apply is
disabled when the draft already has the selected defaults. The impact text says
how many groups change and how many retain local choices. Empty drafts explain
that these defaults apply when a group is added. Permissions, pending requests,
undo, and the distinction between a draft and a live app remain unchanged.

## Reproducible checks

`npm run check` includes `test/composition-resilience.test.mjs`. The new suite
covers all 16 optional workspace-slot combinations, local and batch rollback,
failed restoration, re-entry, changed ownership, complete override declarations,
strict records, the 1,000-instance limit, and 4,000 seeded edit steps against an
independent inheritance model. Five targeted tests were first run against the
1.20.0 source and failed before the fixes. These are synthetic fault tests, not
reports that a user's production data was damaged.

`npm run composition:browser` and `UI_TEST_BROWSER=webkit npm run composition:browser`
exercise the native recovery fixture in both packs/themes at 390px and 1280px.
They also test the real Studio editor, the existing renderer, keyboard behavior,
and native Undo. The recovery fixture tests zero attribute/child mutations on an
unchanged edit, an injected write failure after a real DOM change, exact restoration,
retry, live workspace adoption, original form ownership, and 50 adoption/disposal
cycles. Browser failures now retain a JSON failure receipt and clean up test hosts.

The normal PR checks remain the merge gate. Real-device and assistive-technology
acceptance are separate. These tests do not certify private consumers or their
installed versions. Issue #16 must remain open until the affected application
views are migrated and verified.

## Research used

The dated phase-one research remains the design basis, particularly its notes on
state retention, constrained authoring, testing, and consumer adoption. Current
primary references checked on 2026-10-30:

- [HTML Standard: interactive elements](https://html.spec.whatwg.org/multipage/interactive-elements.html): preserve native details/summary behavior.
- [MDN: own property descriptors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors): inspect property descriptors before accessing values.
- [Playwright: assertions](https://playwright.dev/docs/test-assertions): wait for observed UI state rather than add fixed sleep delays.

No claim of complete accessibility, security, performance, or consumer coverage
follows from a passing synthetic suite. The CI run and exact source revision are
recorded in the implementation pull request.
