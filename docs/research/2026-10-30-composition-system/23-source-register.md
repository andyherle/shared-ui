# 23. Primary-source register

Research date: 2026-10-30. This register has 79 numbered entries. It records the primary material used for selected mechanisms and screening. It is not a list of 79 fully audited products or complete code reviews.

Most links are rolling documentation. Version qualifications are recorded where important. The repository catalogue separately links 47 repositories and marks focused documentation work (`D`) versus screening (`S`). Relevant excerpts and sections were examined; whole manuals were not reproduced. No external package was installed or benchmarked.

For this repository's pinned source evidence, see [02: Existing-system audit](02-existing-system-audit.md). The recommendations in the other notes are original synthesis, not claims that these products implement the proposed Shared UI architecture.

## Visual builders and linked reuse

## S01

**GrapesJS: Symbols.** [Official guide](https://grapesjs.com/docs/guides/Symbols.html). Main/instance relationship and explicit overrides. The guide labels the API beta; do not infer a finished built-in symbol-management interface.

## S02

**GrapesJS: Storage.** [Official guide](https://grapesjs.com/docs/modules/Storage.html). Editable project data and persistence. Used to distinguish authoring state from exported presentation.

## S03

**Puck: Slot field.** [API documentation](https://puckeditor.com/docs/api-reference/fields/slot). Nested component slots and allowed/disallowed component types. Recheck package and API version before implementation.

## S04

**Puck: Permissions.** [API documentation](https://puckeditor.com/docs/api-reference/permissions). Editor-operation controls. These are not a substitute for backend authorization.

## S05

**Craft.js: User components.** [Concept guide](https://craft.js.org/docs/concepts/user-components). Editor nodes, connectors, rules, and settings around React components.

## S06

**Plasmic: Code components.** [Reference](https://docs.plasmic.app/learn/code-components-ref/). Registration interfaces for code-owned components and their configurable surface.

## S07

**Plasmic: Code generation.** [Guide](https://docs.plasmic.app/learn/codegen-components/). Separation between generated presentation and application integration. Not evidence of a native Shared UI adapter.

## S08

**Builder.io: Custom components.** [Setup guide](https://www.builder.io/c/docs/custom-components-setup). Code-owned component registration for a visual editor.

## S09

**Builder.io: Reusable blocks.** [Guide](https://site.builder.io/c/docs/reusing-blocks). Linked Symbols versus static reuse. Product/SDK edition details were not tested.

## S10

**Webstudio: Design tokens.** [Official guide](https://docs.webstudio.is/university/foundations/design-tokens). Reusable style-source terminology. A Webstudio Token is not automatically the same concept as a DTCG token.

## S11

**Webstudio: Slot.** [Component guide](https://docs.webstudio.is/university/core-components/slot). Reusable content/structure reference, distinct from style reuse.

## S12

**WordPress: Global settings and styles.** [Block Editor handbook](https://developer.wordpress.org/block-editor/how-to-guides/themes/global-settings-and-styles/). `theme.json` and layered settings/style ownership. No claim about the latest WordPress release is made.

## S13

**WordPress: Pattern overrides.** [Official support guide](https://wordpress.com/support/wordpress-editor/block-pattern/pattern-overrides/). Controlled local differences in synced patterns.

## Design tools and hosted builders

## S14

**Webflow: Components overview.** [Official guide](https://help.webflow.com/hc/en-us/articles/33961303934611-Components-overview). Main components, properties, slots, and variants.

## S15

**Webflow: Libraries.** [Official guide](https://help.webflow.com/hc/en-us/articles/33961343551763-Libraries). Cross-site library updates and review. Availability and commercial terms were not evaluated.

## S16

**Figma: Component properties.** [Official guide](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties). Explicit customization points and exposed nested properties.

## S17

**Figma: Libraries.** [Official guide](https://help.figma.com/hc/en-us/articles/360041051154-Guide-to-libraries-in-Figma). Main definitions, publishing, and accepting library changes.

## S18

**Figma: Component-instance foundations.** [Official engineering article](https://www.figma.com/blog/how-we-rebuilt-the-foundations-of-component-instances/). Screened engineering discussion of nested instances and override resolution. Not a browser-runtime implementation study.

## S19

**Penpot: Components.** [Official guide](https://help.penpot.dev/user-guide/design-systems/components/). Main components, copies, and overrides.

## S20

**Penpot: Variants.** [Official guide](https://help.penpot.dev/user-guide/design-systems/variants/). Related component variations presented through shared properties.

## S21

**Framer: Sharing components.** [Official guide](https://www.framer.com/help/articles/sharing-components/). Linked component sharing and pulling updates between projects.

## S22

**Retool: Reusable modules.** [Official guide](https://docs.retool.com/classic-apps/guides/layout-structure/modules). Reusable UI and query interfaces. This page is explicitly for classic apps; do not generalize it to every current Retool editor.

## S23

**Appsmith: Packages overview.** [Official documentation](https://docs.appsmith.com/packages/overview). Query, JavaScript, and UI module boundaries. Check the required edition before adoption.

## S24

**ToolJet: Modules.** [Official documentation](https://docs.tooljet.ai/docs/app-builder/modules/overview/). Reusable groups of UI, actions, and logic. This platform scope is broader than Shared UI's proposed responsibility.

## S25

**Budibase: Repository overview.** [Official repository](https://github.com/Budibase/budibase). Screening reference for a broader application-building platform. No detailed feature, license, or edition assessment was completed.

## Schema-driven UI

## S26

**JSON Forms: Layouts.** [Official documentation](https://jsonforms.io/docs/uischema/layouts/). Vertical/horizontal layouts, groups, and categories in the UI schema.

## S27

**JSON Forms: Custom renderers.** [Official tutorial](https://jsonforms.io/docs/tutorial/custom-renderers/). Renderer registry and selection. Review framework-specific details before implementation.

## S28

**React JSON Schema Form.** [Official repository](https://github.com/rjsf-team/react-jsonschema-form). Screening reference for schema-driven React forms.

## S29

**uniforms.** [Official repository](https://github.com/vazco/uniforms). Screening reference for form abstractions and schema adaptation.

## S30

**FormKit: Schema.** [Official documentation](https://formkit.com/essentials/schema). Serializable structure, conditions, and expressions. The breadth of its schema is not proposed as Shared UI's default capability.

## S31

**Formily.** [Official repository](https://github.com/alibaba/formily). Screening reference for schema-driven form design. No full runtime or state-model comparison was performed.

## Native and headless component systems

## S32

**Lit: Shadow DOM.** [Official documentation](https://lit.dev/docs/components/shadow-dom/). Encapsulation and slots.

## S33

**Lit: Styles.** [Official documentation](https://lit.dev/docs/components/styles/). Component styling boundaries. This informs the warning that a global stylesheet cannot be assumed to style all shadow internals.

## S34

**FAST.** [Official repository](https://github.com/microsoft/fast). Screening reference for a web-component foundation. Searchable 1.x guides are versioned historical material, not a current API guarantee.

## S35

**Lion.** [Official repository](https://github.com/ing-bank/lion). Screening reference for white-label web components.

## S36

**Vaadin web components.** [Official repository](https://github.com/vaadin/web-components). Screening reference for a broad component collection. Individual packages need separate integration and license review.

## S37

**Web Awesome: Migrating from Shoelace.** [Official guide](https://webawesome.com/docs/resources/migrating-from-shoelace). Migration differences. Related repositories: [Shoelace](https://github.com/shoelace-style/shoelace) and [Web Awesome](https://github.com/shoelace-style/webawesome).

## S38

**Radix: Composition.** [Official guide](https://www.radix-ui.com/primitives/docs/guides/composition). `asChild` composition and the responsibilities of the receiving element.

## S39

**React Aria: Customization.** [Official documentation](https://react-aria.adobe.com/customization). Composition and customization boundaries. It is not a native-runtime adoption assessment.

## S40

**Base UI.** [Official repository](https://github.com/mui/base-ui). Screening reference for headless components.

## S41

**Ariakit.** [Official repository](https://github.com/ariakit/ariakit). Screening reference for accessible/headless UI building blocks.

## S42

**Zag: Introduction.** [Official documentation](https://www.zagjs.com/overview/introduction). State-machine-based interaction logic and framework connections.

## S43

**Ark UI: About.** [Official documentation](https://ark-ui.com/docs/overview/about). Component layer and its relationship to behavior primitives.

## Tokens, recipes, and layout

## S44

**Design Tokens Format Module 2025.10.** [Stable report](https://www.designtokens.org/TR/2025.10/format/). Typed token interchange. A DTCG Community Group report, not a W3C Standard.

## S45

**Design Tokens Resolver Module 2025.10.** [Stable report](https://www.designtokens.org/TR/2025.10/resolver/). Context-dependent token resolution. Keep it distinct from newer draft resolver material.

## S46

**Style Dictionary: DTCG support.** [Official documentation](https://styledictionary.com/info/dtcg/). Token-format support and transformation context. Current repository reference: [style-dictionary/style-dictionary](https://github.com/style-dictionary/style-dictionary).

## S47

**Panda CSS: Slot recipes.** [Current guide](https://panda-css.com/docs/recipes/slot-recipes). Coordinated multi-part styles and named variants. The consulted page identifies the v2 documentation; do not mix it with v0 examples.

## S48

**vanilla-extract.** [Official repository](https://github.com/vanilla-extract-css/vanilla-extract). Screening reference for typed build-time styling.

## S49

**Spectrum design data.** [Official documentation](https://opensource.adobe.com/spectrum-design-data/) and [repository](https://github.com/adobe/spectrum-design-data). Structured token-data reference. No claim that its format can replace the current store without migration.

## S50

**Every Layout: Layouts.** [Public catalogue](https://every-layout.dev/layouts/). Intrinsic layout reference. Paid chapters were not accessed or copied.

## Inspectors and host contributions

## S51

**Tweakpane: UI components.** [Official documentation](https://tweakpane.github.io/docs/ui-components/). Folders, tabs, and panel organization.

## S52

**Tweakpane: Miscellaneous APIs.** [Official documentation](https://tweakpane.github.io/docs/misc/). Events, state import/export, custom containers, and explicit refresh.

## S53

**Leva.** [Official repository](https://github.com/pmndrs/leva). Screening reference for React-oriented parameter controls.

## S54

**lil-gui: Guide.** [Official source guide](https://github.com/georgealways/lil-gui/blob/main/Guide.md) and [project documentation](https://lil-gui.georgealways.com/). Controllers, folders, and save/load behavior. No current package-version claim is made.

## S55

**VS Code: Contribution points.** [Official API documentation](https://code.visualstudio.com/api/references/contribution-points). Commands, menus, views, conditions, and host-owned placement.

## Agent UI contracts and code distribution

## S56

**A2UI: Catalogues.** [Official concepts guide](https://a2ui.org/concepts/catalogs/). Supported component/function/theme descriptions and host capability boundaries.

## S57

**A2UI: Protocol source.** [Version-specific repository document](https://github.com/a2ui-project/a2ui/blob/main/specification/v1_0/docs/a2ui_protocol.md). Protocol reference only. Confirm the selected release and status before implementation; several versions are present in public materials.

## S58

**json-render: Core.** [Official package README](https://github.com/vercel-labs/json-render/blob/main/packages/core/README.md). Constrained UI description and catalogue concepts.

## S59

**json-render: Schemas.** [Official documentation source](https://github.com/vercel-labs/json-render/blob/main/apps/web/content/docs/schemas.mdx). Schema/catalogue distinction. No new dependency is proposed here.

## S60

**Adaptive Cards: Host configuration.** [Microsoft documentation](https://learn.microsoft.com/en-us/adaptive-cards/rendering-cards/host-config). Host-controlled rendering policy for cards.

## S61

**shadcn/ui: Introduction.** [Official documentation](https://ui.shadcn.com/docs). Code distribution and component ownership. The conclusion about central-update limits is this study's inference, not a product defect claim.

## Governance, tests, and releases

## S62

**GOV.UK Design System: Contribution criteria.** [Official criteria](https://design-system.service.gov.uk/community/contribution-criteria/). Evidence, reuse, and suitability across services.

## S63

**Carbon: Patterns overview.** [Official documentation](https://www.carbondesignsystem.com/building-blocks/core/patterns/overview). Task patterns as combinations of components and design considerations.

## S64

**Storybook: Interaction testing.** [Official documentation](https://storybook.js.org/docs/writing-tests/interaction-testing). Component interaction tests.

## S65

**Storybook: Stories in unit tests.** [Official documentation](https://storybook.js.org/docs/writing-tests/integrations/stories-in-unit-tests). Reuse of story fixtures in other tests.

## S66

**Playwright: Accessibility testing.** [Official documentation](https://playwright.dev/docs/accessibility-testing). Browser integration with automated accessibility checks and the need for broader assessment.

## S67

**Playwright: Accessibility snapshots.** [Official documentation](https://playwright.dev/docs/aria-snapshots). Assertions over the accessibility tree and order.

## S68

**Playwright: Visual comparisons.** [Official documentation](https://playwright.dev/docs/test-snapshots). Rendered screenshot assertions. Visual tests do not prove shared source ownership or working-state preservation.

## S69

**axe-core.** [Official repository](https://github.com/dequelabs/axe-core). Screening reference for automated accessibility checking.

## S70

**Changesets: Why.** [Official documentation](https://changesets.dev/guide/why). Recording release intent and producing version/changelog changes.

## S71

**Changesets: Configuration.** [Official source documentation](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md). Dependency and release settings. Does not establish installation into independent consumers.

## Accessibility and security

## S72

**WAI-ARIA APG: Toolbar.** [Official pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/). Grouping, focus navigation, and arrow-key conflicts. A visual action row is not automatically an ARIA toolbar.

## S73

**WAI-ARIA APG: Disclosure.** [Official pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). Expanded state and activation behavior.

## S74

**WAI-ARIA APG: Accordion.** [Official pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/). Section structure and keyboard/accessibility expectations.

## S75

**MDN: Grid layout and accessibility.** [Platform guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Accessibility). Visual placement versus logical document order.

## S76

**OWASP: Cross-site scripting prevention.** [Official cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html). Safe handling of untrusted content and rendering contexts.

## S77

**OWASP: Content Security Policy.** [Official cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html). CSP as an additional layer, not a replacement for secure rendering.

## Additional library and variant references

## S78

**Penpot: Libraries.** [Official guide](https://help.penpot.app/user-guide/design-systems/libraries/). Sharing design-system assets and applying library changes.

## S79

**Framer: Component variants.** [Official lesson](https://www.framer.com/academy/lessons/component-variants-in-framer). Shared primary structure and intentional differences.

## Reuse and refresh rules

These links are evidence and follow-up paths, not copied source assets. Recheck rolling pages before implementing an API. Pin source revisions when an external implementation becomes a design dependency. See [24: Dependency and research maintenance](24-dependency-and-research-maintenance.md).
