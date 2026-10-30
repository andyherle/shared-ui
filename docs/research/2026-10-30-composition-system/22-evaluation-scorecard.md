# 22. Qualitative comparison and build-versus-adopt decision

This scorecard is a research judgment, not a measured benchmark. It evaluates approaches against Shared UI's current constraints. No numeric precision or universal ranking is implied.

## Decision criteria

The important criteria are native integration, linked reuse, explicit overrides, shared layout control, state preservation, authoring constraints, consumer release control, private-data separation, accessibility, and maintenance cost.

A visually impressive editor can score poorly on this project's release or state requirements. A small native composition can be a better fit while offering fewer general design features.

## Approaches

| Approach | Strength | Main unresolved cost | Decision for this project |
| --- | --- | --- | --- |
| Tokens and shared CSS only | Small; already distributed centrally | Cannot own hierarchy, action placement, or app copies | Necessary foundation, insufficient final system |
| Extend current native compositions and Studio | Reuses current controls, commands, and dependency boundary | Needs real adoption proof and server-rendered integration | Recommended first prototype |
| Add a React visual builder | Rich editing and component-slot concepts | Framework adapter, state lifecycle, bundle and authoring scope | Study mechanisms; do not adopt as default runtime |
| Adopt a full low-code platform | Broad modules, data binding, deployment tools | Replaces far more than shared layout and changes data ownership | Not recommended for this request |
| Replace controls with web components | Explicit component boundary and portable APIs | Styling, form, focus, and migration contracts | Evaluate only for a specific demonstrated gap |
| Use a schema form engine everywhere | Strong form-description tools | Domain/form state can become coupled to layout | Borrow separation, not a universal state owner |
| Copy components into each app | Easy local ownership | Repeated copies can drift and miss central updates | Does not meet the central-change goal alone |
| Add constrained remote layout documents | Potentially one edit without app rebuilds | New compatibility, trust, offline, and state-preservation boundary | Later option; requires a separate approved design |

## Mechanism shortlist

| Need | Useful references | Local conclusion |
| --- | --- | --- |
| Main definition plus instance differences | GrapesJS, Figma, Penpot, Webflow, Framer | Preserve identity and show override provenance. |
| Valid nested groups | Puck, Craft.js, existing Studio registry | Share slot constraints between tools and runtime. |
| Data separate from presentation | JSON Forms, FormKit | Keep app domain schemas and UI layout documents separate. |
| Coordinated styles across component parts | Panda, Spectrum design data | Use a group-level variant instead of unrelated CSS overrides. |
| Compact parameter editing | Tweakpane, lil-gui, Leva | Keep grouping clear and domain state application-owned. |
| Commands independent of placement | VS Code | Stable action references; placement does not grant authority. |
| Agent generation within limits | A2UI, json-render, Adaptive Cards | Use approved catalogues and explicit host capabilities. |
| Evidence and release discipline | GOV.UK, Carbon, Storybook, Playwright, Changesets | Prove real reuse, then publish and verify actual adoption. |

The supporting pages are in the [source register](23-source-register.md). Detailed observations and limitations are in notes 04–10.

## Recommendation

Build only the missing composition, integration, and adoption pieces around the existing system. Do not replace the whole library because another tool has a good editor.

The first prototype should answer one hard question: can a person change a maintained group/layout definition once and see two different real application views inherit the result without losing working state?

If the answer is no, identify the specific failing boundary. A failed server-rendered integration calls for an adapter study. A missing override model calls for a registry/document change. A stale consumer calls for release/adoption work. None of those automatically justifies a new universal UI framework.

## Stop conditions

Stop and review scope when the prototype adds a second state store, requires arbitrary CSS or code in documents, duplicates a registry, creates a parallel UI version, or cannot remove the old copied structure. These indicate that the proposed abstraction may be increasing the original problem.
