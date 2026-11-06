# Next interface prototype

Unapproved, opt-in design exploration. This source is served only by Portal's local flow lab. It is not part of the v1 build or its automatic update channel.

Use `data-ui="personal" data-ui-generation="next"` and `data-theme="light|dark"`. The same native elements, tokens and component definitions are used in the catalogue and prototype. Action captions stay visible at every width; only an explicit `data-ui-label="hidden"` hides a label. There is no automatic density scaling or label compaction.

- Actions: native button or anchor with `.ui-action`, shared SVG `.ui-icon`, and `.ui-label`. Primary and quiet are semantic variants. Each control has a 44px minimum target.
- Writing: `form.ui-composer` with a native textarea and footer. This is one editable surface, not a box inside another box. The app owns submission and drafts.
- Fields: `label.ui-field` around the native input/select and optional inline caption.
- Navigation: `nav.ui-nav` with actual links and `aria-current="page"`; `.ui-tabs` for actual record subpage links.
- Reading: `.ui-card.ui-pad`, `.ui-stack`, `.ui-item`, `.ui-prose` and native `details.ui-disclosure`. No nested interactive wrappers.
- Collapsible cards: native `details.ui-card` with a direct `summary` (headline and optional compact context) and `.ui-card-body`. Use `open` for the initial expanded state. The whole heading toggles; no button nested inside the summary. Inputs stay mounted when collapsed. Apps may retain the open state by stable card ID.
- Feedback: `.ui-status` with a polite live region and pending/success/error states; status text never replaces an action's accessible name.

Portal's local lab exposes `/catalogue` to inspect these components with the same stylesheet, icons and theme. Domain placement belongs in Portal's `@layer app`. Packaging and consumer adoption follow design approval.

## Visual rules under review

The palette under review uses white surfaces with blue accents in light mode, and navy/blue surfaces in dark mode. Text is always pure black or white, including metadata, hints, placeholders and disabled captions. Layout, weight and surfaces carry the hierarchy.

- Palette: white and navy surfaces, blue for focus, the main action and selected navigation. Text is strictly black or white, including metadata, hints, placeholders and disabled labels. Filled actions use whichever of black/white contrasts with their blue fill. Status uses clear words, not colored text. No shadows or gradients.
- Surfaces: one page background and one editable surface. Queue cards are flat rows divided by one quiet rule. Do not nest decorative panels.
- Spacing: 8 / 16 / 24 / 32 / 48 / 64 px; use the shared semantic spacing tokens. Identical roles use identical gaps and padding.
- Type: 28 px page heading, 18 px section heading, 16 px card heading, 15 px body, 13 px metadata. Weight is 400 or 600. No decorative all-caps captions.
- Actions: one filled action per screen. Secondary actions are neutral outlined or quiet. Minimum target is 44 px; labels stay visible.
- Disclosure: a card's heading toggles it; action cards start collapsed, with a concrete action headline and one-line context. Collapsing preserves draft text. Supporting evidence stays behind Details.
- Reflow: a 12-column desktop grid, 6 tablet and 4 mobile. Home follows one continuous reading column: capture, then agent queue. Record detail may use an 8/4 split for content and connections. The sidebar becomes a shared bottom navigation on phones.

References: [Less Is More UI](https://github.com/Mendiak/less-is-more-ui), [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines). Principles are implemented in this shared source, not a parallel app stylesheet.

### Collapsed list and expanded responses

The collapsed attention rows are the approved direction: native `details.ui-card[data-ui-variant="list"]`, small unboxed `.ui-card-symbol`, a `.ui-card-heading` with question and optional context underneath, and a native disclosure indicator. Preserve this header when refining the expansion.

Opening a list row gives the entire native `details.ui-card` one surface and boundary, including its summary, content and action footer. The body never becomes a second inset card or a separate narrow box. The collapsed header remains unchanged. Expanded headings and content use the shared insets; at phone width the response uses the full available content width.

`.ui-actions.ui-card-actions` forms the full-width attached footer with equal native action cells and quiet dividing rules. Keep buttons/links and the native Reply disclosure. Reply expands a text field and send action inside this same row. Preview text stays ordinary readable content; date/select controls keep their complete values. The native `::details-content` wrapper participates in the footer layout so the reply field fills the row in both WebKit and Chromium.

For two or three short poll options, use `fieldset.ui-options[data-ui-variant="segmented"]` with a native legend and `label.ui-choice` containing a native `input.ui-sr-only[type=radio]` and caption. Every label has a 44px target. Arrow keys select within the group; the focused option has an inset ring and selection has a visible underline. Longer option sets use the ordinary native choices or a select. Never truncate meaningful choices.

Reply always addresses the agent. A prepared outbound draft offers Copy draft, not a send action. Reply opens its native form below the same action row. Direct decisions use native form associations, and invalid unanswered choices disable their submit action only after enhancement; native validation remains the fallback. Status stays with the form. Collapse/reopen preserves input and focusable elements.

The catalogue and Portal Card types scenario demonstrate these same controls. Packaging and production integration remain subject to design approval.


## Personal scope and reusable behavior

This visual exploration applies only within `data-ui="personal" data-ui-generation="next"`. It does not repaint Postvisual. `src/card-interactions.mjs` is pack-independent: `createCardInteractions(root,{cards,toggle,menu,onMenu})` attaches to native details, an optional native button, and an authored native popover. It preserves heading placement, toggles all cards, supports right-click, Shift+F10/ContextMenu, and touch hold (movement cancels). Menu keys use arrows/Home/End/Escape; ordinary fields retain their native context menu. Call `dispose` on removal. Apps own menu actions, responses, and saved open states.

Use `.ui-section-toggle` on a native heading button; retain the label and count. Closed/open card summaries have exactly the same insets, border footprint, and margin. The shared helper also compensates browser viewport scroll anchoring on individual toggles.

Use `.ui-card-content` inside the same card body for a document or diff. `.ui-document-preview` hosts the shared optional `openPDF` renderer. Apps authorize exact editions, load lazily, and dispose when hidden. `.ui-diff` uses semantic addition/removal signs plus surface differences; text remains black/white. Use `.ui-table-region` with an accessible region name and keyboard scrolling around a native `.ui-table`; sortable headers are real links with `aria-sort` on the active header. Do not hide data on phones.
