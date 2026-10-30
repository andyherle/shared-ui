# 03. Repository landscape

This catalogue contains **47 repository references** across several approaches. It is not a claim that 47 codebases were fully audited.

`D` means selected official documentation was studied for the mechanism named below. `S` means primary-source screening only. Neither means installed, benchmarked, security-audited, or approved as a dependency. External source code was not comprehensively reviewed. See [method](01-brief-and-method.md), [source register](23-source-register.md), and [dependency gates](24-dependency-and-research-maintenance.md).

## Visual builders, design tools, and app builders

| # | Repository | Depth | Relevant mechanism | Implication for Shared UI |
| --- | --- | --- | --- | --- |
| 1 | [GrapesJS/grapesjs](https://github.com/GrapesJS/grapesjs) | D, S01–02 | Linked symbols and project model | Study inheritance and saved identity, not unrestricted HTML editing. |
| 2 | [puckeditor/puck](https://github.com/puckeditor/puck) | D, S03–04 | Configured components, slots, editor permissions | Good reference for constrained placement. React integration is not a native-runtime fit by default. |
| 3 | [prevwong/craft.js](https://github.com/prevwong/craft.js) | D, S05 | User components, node rules, settings | Study node editing and selection. It is an editor foundation, not a finished cross-app system. |
| 4 | [plasmicapp/plasmic](https://github.com/plasmicapp/plasmic) | D, S06–07 | Code component registration and generated presentation | Study the design/code boundary and named interfaces. |
| 5 | [BuilderIO/builder](https://github.com/BuilderIO/builder) | D, S08–09 | Registered components and reusable Symbols | Distinguish linked reuse from static templates. |
| 6 | [webstudio-is/webstudio](https://github.com/webstudio-is/webstudio) | D, S10–11 | Shared style sources and slots | Keep style reuse distinct from structural reuse. |
| 7 | [WordPress/gutenberg](https://github.com/WordPress/gutenberg) | D, S12–13 | Global settings and synced-pattern overrides | Study supported local content differences within shared structure. |
| 8 | [penpot/penpot](https://github.com/penpot/penpot) | D, S19–20, S78 | Components, variants, libraries | Useful authoring and inheritance model; not runtime adoption proof. |
| 9 | [appsmithorg/appsmith](https://github.com/appsmithorg/appsmith) | D, S23 | Packages and reusable UI modules | Study explicit inputs/outputs. Do not import application-query ownership. |
| 10 | [ToolJet/ToolJet](https://github.com/ToolJet/ToolJet) | D, S24 | Modules of UI and logic | Useful module boundary; much broader platform scope. |
| 11 | [Budibase/budibase](https://github.com/Budibase/budibase) | S, S25 | Broader app-builder platform | Keep as a follow-up comparison; no detailed reuse or edition claim made here. |

## Schema-driven forms and UI

| # | Repository | Depth | Relevant mechanism | Implication for Shared UI |
| --- | --- | --- | --- | --- |
| 12 | [eclipsesource/jsonforms](https://github.com/eclipsesource/jsonforms) | D, S26–27 | Separate UI schema and renderer registry | Strong reference for separating data from layout. |
| 13 | [rjsf-team/react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form) | S, S28 | Schema-driven React forms | Evaluate with a real conditional form before considering deeper reuse. |
| 14 | [vazco/uniforms](https://github.com/vazco/uniforms) | S, S29 | Form abstractions and schema adaptation | A comparison point for adapter boundaries, not a selected engine. |
| 15 | [formkit/formkit](https://github.com/formkit/formkit) | D, S30 | Serializable UI schema | Study structured authoring; do not copy a broad expression surface without need. |
| 16 | [alibaba/formily](https://github.com/alibaba/formily) | S, S31 | Schema-driven form system | Further study needed for state and layout separation. |

## Native and headless component systems

| # | Repository | Depth | Relevant mechanism | Implication for Shared UI |
| --- | --- | --- | --- | --- |
| 17 | [lit/lit](https://github.com/lit/lit) | D, S32–33 | Web-component rendering and shadow DOM | Explicit styling and form contracts would be required. |
| 18 | [microsoft/fast](https://github.com/microsoft/fast) | S, S34 | Web-component foundation | Check current APIs; do not mix legacy 1.x guidance with current packages. |
| 19 | [ing-bank/lion](https://github.com/ing-bank/lion) | S, S35 | White-label web components | Reference for component behavior beneath product styling. |
| 20 | [vaadin/web-components](https://github.com/vaadin/web-components) | S, S36 | Web-component collection | Useful enterprise-control comparison; inspect individual package requirements. |
| 21 | [shoelace-style/shoelace](https://github.com/shoelace-style/shoelace) | S, S37 | Predecessor/migration context | Do not treat it as interchangeable with Web Awesome. |
| 22 | [shoelace-style/webawesome](https://github.com/shoelace-style/webawesome) | D, S37 | Native component library and migration | Study migration boundaries; verify edition and licensing separately. |
| 23 | [radix-ui/primitives](https://github.com/radix-ui/primitives) | D, S38 | Headless composition | Shared interaction does not by itself supply shared screen layout. |
| 24 | [adobe/react-spectrum](https://github.com/adobe/react-spectrum) | D, S39 | React Aria composition/customization | Study accessible behavior boundaries and component interfaces. |
| 25 | [mui/base-ui](https://github.com/mui/base-ui) | S, S40 | Headless component foundation | Compare behavior, not visual similarity alone. |
| 26 | [ariakit/ariakit](https://github.com/ariakit/ariakit) | S, S41 | Accessible headless components | A reference for interactions; no adoption conclusion. |
| 27 | [chakra-ui/zag](https://github.com/chakra-ui/zag) | D, S42 | State-machine interaction logic | Study explicit transitions and adapter boundaries. |
| 28 | [chakra-ui/ark](https://github.com/chakra-ui/ark) | D, S43 | Components built on behavior primitives | Shows a separation of behavior and component presentation. |

## Tokens, recipes, and design data

| # | Repository | Depth | Relevant mechanism | Implication for Shared UI |
| --- | --- | --- | --- | --- |
| 29 | [chakra-ui/panda](https://github.com/chakra-ui/panda) | D, S47 | Multi-part slot recipes | One variant can coordinate several component parts. |
| 30 | [vanilla-extract-css/vanilla-extract](https://github.com/vanilla-extract-css/vanilla-extract) | S, S48 | Typed build-time styles | A tooling reference, not a reason to replace the current build. |
| 31 | [design-tokens/community-group](https://github.com/design-tokens/community-group) | D, S44–45 | Token interchange and context resolution | Use stable reports; tokens are not layout documents. |
| 32 | [style-dictionary/style-dictionary](https://github.com/style-dictionary/style-dictionary) | D, S46 | Token transforms and outputs | Study deterministic source-to-output provenance. |
| 33 | [adobe/spectrum-design-data](https://github.com/adobe/spectrum-design-data) | D, S49 | Structured design-token data | Reference for named design roles and data validation. |

## Inspectors, host contributions, and agent UI

| # | Repository | Depth | Relevant mechanism | Implication for Shared UI |
| --- | --- | --- | --- | --- |
| 34 | [cocopon/tweakpane](https://github.com/cocopon/tweakpane) | D, S51–52 | Folders, tabs, events, state export | Strong inspector reference; keep domain save state separate. |
| 35 | [pmndrs/leva](https://github.com/pmndrs/leva) | S, S53 | React control panels | Useful comparison, not a native consumer dependency choice. |
| 36 | [georgealways/lil-gui](https://github.com/georgealways/lil-gui) | D, S54 | Controllers, folders, save/load | Study grouping and lifecycle, not its default appearance. |
| 37 | [microsoft/vscode](https://github.com/microsoft/vscode) | D, S55 | Named contribution points | Separate stable action identity from where it is displayed. |
| 38 | [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui) | D, S56–57 | Constrained catalogues and host rendering | Pin protocol versions; an allowlist is not complete security. |
| 39 | [vercel-labs/json-render](https://github.com/vercel-labs/json-render) | D, S58–59 | Schema/catalogue-driven generated UI | Reuse the constrained-generation idea, not a second Studio engine. |
| 40 | [microsoft/AdaptiveCards](https://github.com/microsoft/AdaptiveCards) | D, S60 | Host configuration for card rendering | Useful host-policy boundary; narrower than a full app UI. |
| 41 | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | D, S61 | Code distribution and local ownership | Copied components need an added shared-maintenance path for central updates. |

## Governance and verification

| # | Repository | Depth | Relevant mechanism | Implication for Shared UI |
| --- | --- | --- | --- | --- |
| 42 | [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) | D, S63 | Components and task patterns | Promote shared task patterns, not only individual controls. |
| 43 | [alphagov/govuk-frontend](https://github.com/alphagov/govuk-frontend) | D, S62 | Evidence-led reusable components/patterns | Require real reuse and user evidence before generalization. |
| 44 | [storybookjs/storybook](https://github.com/storybookjs/storybook) | D, S64–65 | Interaction tests and reusable stories | Reuse fixtures, but do not substitute catalogue tests for app integration. |
| 45 | [microsoft/playwright](https://github.com/microsoft/playwright) | D, S66–68 | Browser, accessibility-tree, and visual tests | Combine interaction and rendering evidence. |
| 46 | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | S, S69 | Automated accessibility checks | Useful test signal, not a complete accessibility verdict. |
| 47 | [changesets/changesets](https://github.com/changesets/changesets) | D, S70–71 | Release intent and dependency versioning | Versioning is not the same as downstream installation. |

## Programs without an assumed open-source implementation

Figma, Webflow, Framer, and Retool were studied through selected official documentation. Their product interfaces provide useful comparisons for scope, inheritance, variants, and modules. They are not counted as open-source repositories above. No account, paid tier, or end-to-end export workflow was tested. See [design tools](05-design-tools-and-libraries.md) and [builders](04-visual-builders.md).

Every Layout, WAI-ARIA APG, MDN, and OWASP supply additional layout, accessibility, and safety references. They are not counted as candidate runtime packages.

## Shortlist for the next evidence step

For inheritance and authoring: compare GrapesJS, Puck, Webflow, and Figma mechanisms against the existing Studio model. For schema separation: JSON Forms. For grouped styles: Panda slot recipes. For inspector behavior: Tweakpane and lil-gui. For host/action contracts: VS Code. For verification: real consumer fixtures with the existing harness, informed by Playwright and Storybook.

This is a shortlist of concepts to test. It is not a list of dependencies to install.
