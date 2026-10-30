# Native composition validation — 2026-10-30

## Implemented

The existing registry now owns the native runtime contracts for `review-workspace@1` and `control-group@1`. The build projects those contracts into the runtime. The Studio document service, native preview renderer, editor, catalogue and structural auditor use the same definitions.

A composition scope applies presentation defaults to its registered instances. Local layout choices remain explicit and can reset to inheritance. `adoptComposition` attaches to compatible existing native markup without moving its live nodes. Control groups use native heading disclosures, not standalone boxed section buttons.

Studio exposes shared layout editing **within the selected private draft**. Its existing command service handles revision checks, exact-request replay, save, reset and undo. This is not a live cross-application publishing control. Source defaults reach consumers through normal versioned runtime installation; automatic CSS refresh does not distribute JavaScript or structural changes.

## Executed evidence

[Isolated build and browser run](https://github.com/andyherle/shared-ui/actions/runs/41115715036), tested generated source commit `3223a1af2ee8bb07b50ee874d1049bdb3fa9d456`:

- `npm run check`: 382 tests passed; none failed, skipped or cancelled. The generated build passed.
- `npm run studio:mcp:check`: all five official-SDK transport/service tests passed.
- Chromium 141.0.7390.37 and WebKit 26.0: both browser runs passed.
- Each engine tested the composition policy fixture, the existing native-renderer fixture, and actual catalogue keyboard interaction at 390px and 1280px.
- Each engine also exercised the actual HTTP Studio editor and private command service: apply shared layout, preserve typed preview input, reset to source defaults, persist state, and undo.
- The native-renderer fixture reports 22 renderers across eight pack/theme/width contexts and two views.

The browser fixtures verify inheritance, local pin/reset, stale/invalid update rejection, native heading activation, existing-markup adoption, native form ownership, field values, focus, selection, native Undo, and no child-node moves during layout updates. Test sources are under `test/composition-policy*`; browser engines are optional test-only dependencies under `tools/browser`.

Shared CSS remains **35,788 bytes raw and 8,184 bytes gzip**, unchanged from the baseline. Its digest remains `caf3c08ede8b8ff4b6cf2bfd200706302d00ca69eb442cb85065350aea0bdded`. The generated runtime is 303,252 bytes. This change adds no production dependency or CSS rule.

The PR workflow now repeats source, SDK and both browser checks. It retains exact source and test receipts. Temporary source-transfer and assembly files were removed from the final tree.

## Not established

These are real browser tests using synthetic data, not real-device acceptance. No iPhone or assistive-technology acceptance is claimed. No timing or memory benchmark is claimed.

The two fixture views are not two migrated application consumers. No consumer-owned form, backend, save path, installed application bundle or deployment was changed in this increment. Fleet adoption remains a separate gate: migrate two different real application-template fixtures, remove their replaced structures, run each app's own checks, and verify the exact installed version.

Issue #16 remains open until affected application views use the approved structure. The existing Studio CSS publisher and consumer-release boundaries remain unchanged.

See [API and integration guidance](COMPOSITION_POLICIES.md) and [the composition contract](COMPOSITIONS.md).
