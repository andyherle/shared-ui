# Shared UI

One repository, two packs: Postvisual and Personal. There are no runtime or build dependencies outside Node's standard library. Keep the shared CSS below 32 KB uncompressed; report gzip size when changing it. This includes common selection, playhead, composed-field and scaled-action roles replacing duplicated app CSS. Delete superseded app paint and shared rules rather than adding compatibility overrides; mark only the bundled UI sheet for replacement.

Edit src, then run npm run check. The build validates inputs before replacing working assets and writes the update manifest last. public is generated deployment output, including synthetic catalogue media. Never copy private application source, client media, credentials, or data into this public repository.

Shared control paint, focus, density and prose belong in src/controls.css. The two palettes belong in src/tokens.json. Catalogue CSS uses @layer app and semantic tokens for layout. Never invent a third page palette or independent button implementation. Output-only creative rendering is outside this system.

Keep native HTML behavior. Optional JS must support keyboard use, release listeners and timers, stop background work in hidden views, and avoid app state. CSS refresh must preserve inputs, focus, open overlays and media state. Runtime behavior changes are bundled releases; the automatic channel carries CSS only.

For UI behavior changes, verify the actual browser, including mobile, both packs, keyboard controls and more than one open view. Keep the managed host a one-way deployment from the dev source. Do not touch unrelated LaunchAgents or Tailscale Serve routes.
