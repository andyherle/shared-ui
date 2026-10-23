# Shared tooling audit — 2026-10-23

Scope: this checkout's build, baseline and optional installers, consumer updater,
Style Lab/source preview servers, review host, and Studio/MCP entry points. The
checkout already contained ongoing UI and preview work; this pass adds tooling
hardening without changing control rendering or installing consumer releases.

## Corrected findings

| Finding | Change and regression coverage |
| --- | --- |
| Filters, debug catalogue code and the final concatenated runtime could bypass syntax validation. | Compile every emitted `.js` before publication; invalid modules and duplicate top-level bindings retain the working release. |
| Predictable installer/build temporary names could follow links and collide. Optional installers did not consistently validate all outputs before writing. | One staged writer uses exclusively created random scratch, rejects linked/non-regular destinations, stages all bytes before replacement, and cleans its own scratch on failure. Tests cover symlinks, dangling links, hard links, failed staging and untouched private files. |
| Missing `--target` values could consume `--check` as a directory name. | All four installer CLIs reject absent, option-shaped and repeated arguments before writes. |
| Timeline installation required an already-created target directory. | The shared writer creates fresh destinations; check mode remains read-only. |
| Preview request parsing, source read failures and truncated upstream bodies could raise uncaught errors. | Return bounded HTTP errors, reject malformed request targets, handle upstream failures and preserve native HEAD metadata. |
| Preview Host checks accepted arbitrary loopback ports, and fixture origins were not constrained. | Match the listening port exactly; validate origin and cross-site writes; require exact loopback HTTP upstreams before proxy creation. |
| Preview SSE subscribers were unlimited and accepted HEAD. | Cap at 64, reject HEAD and release capacity when clients disconnect. |
| A signal-terminated fixture could be reused; restart state and shutdown could leave stale proxies or children. | Recognize signal exits, use fresh fixture scratch, refuse launches after closure, clean failed starts, and close SSE before HTTP shutdown. Real synthetic children verify restart and awaited forced termination. |

## Verification

- `npm run check`: **339 tests and the build passed** after the tooling fixes.
- `node --test test/generated-files.test.mjs test/dev-previews.test.mjs`:
  **25 tests passed**, including the subsequently added real-child restart and
  shutdown regression.
- `npm run studio:mcp:check`: **5 tests passed** for official SDK stdio and HTTP transports,
  read-only enforcement, exact-origin authentication, publication gating and
  compatibility with older clients.
- Installer tests exercise all four packages in disposable directories and verify
  their results with `--check`. No application bundle was updated.
- The last passing build measured 36,037 bytes raw and 8,188 bytes gzip,
  within the 36 KiB / 8 KiB limits, with only 4 gzip bytes of existing headroom.

The server checks need permission to bind temporary loopback ports. Baseline:
315 tests passed before changes. Detailed new regressions live in
`test/generated-files.test.mjs`, `test/dev-previews.test.mjs` and
`test/server.test.mjs`.

A concurrent edit to `src/controls.css` arrived during the final full rerun. That
run failed on the newly unregistered `--ui-control-leading` token, CSS budget and
related control assertions. A subsequent read measured 36,324 bytes raw and
8,261 bytes gzip (8,192 permitted). This hardening did not edit the stylesheet or
token registry. The independent 25-test tooling check passed against that state;
the current combined checkout still needs its UI changes completed and a fresh
full check. The earlier successful run does not certify those later edits.

## Boundaries

Generated output uses atomic per-file replacement, not an all-or-nothing
multi-file filesystem transaction. Staging failures preserve working bytes;
failure during final renames can require rerunning installation and `--check`.
Use a single writer per destination. Parent directories and local source code are
trusted; this is not protection against another process replacing ancestors
concurrently.

Source previews run trusted local application fixtures under the user's account.
They do not provide OS sandboxing. The managed review adapter still requires its
separate pinned isolation broker. No brokered acceptance run, live application
fixture fleet, managed-service restart or deployment was performed in this pass.
Browser rendering was not changed. This is a source and regression audit, not a
claim of complete penetration testing or dependency-advisory coverage.
