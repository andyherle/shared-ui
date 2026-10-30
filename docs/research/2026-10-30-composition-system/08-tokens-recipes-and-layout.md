# 08. Tokens, recipes, and layout policy

## Three different problems

A **token** names a value or a typed collection of values. A **recipe** applies coordinated styles to the parts of a component. A **composition** defines the relationship between controls, content, and actions. A token system alone cannot supply the other two.

For example, a spacing token can reduce gaps. It cannot decide whether a history control belongs beside a heading, whether Reply is the main task, or whether a section toggle should look like a separate action button.

## DTCG format and resolver

The Design Tokens Community Group published stable 2025.10 format and resolver reports. The format covers typed token data and references. The resolver covers context-dependent selection, such as themes. These are Community Group reports, not W3C Standards. A newer draft resolver also surfaced during research; it must not be confused with the pinned stable report. [S44–S45](23-source-register.md#s44)

**Recommendation:** use the stable reports as an interchange reference if export/import is needed. Do not migrate the existing token store solely to use a standard-looking file. A token format is not a composition document schema.

## Style Dictionary and Spectrum design data

Style Dictionary documents DTCG support and transformations between token sources and outputs. Spectrum design data provides a reference for structured design-token data. [S46](23-source-register.md#s46), [S49](23-source-register.md#s49)

**Recommendation:** preserve a clear chain from source token to generated CSS and component use. Keep transformations deterministic. Never treat a successful token build as proof that a live app inherited the intended value.

No new build dependency is selected here. The current standard-library build remains the baseline.

## Panda slot recipes

Panda's current slot-recipe documentation groups the styles of several component parts under one variant interface. It distinguishes a local slot recipe from a reusable recipe definition shared across apps or presets. [S47](23-source-register.md#s47)

**Recommendation:** use the concept, not necessarily the package. A shared section should define heading, context, actions, and body together. A variant should update those parts consistently instead of exposing unrelated per-element CSS knobs.

## vanilla-extract

The repository was screened as a typed, build-time styling reference. [S48](23-source-register.md#s48) It may inform validation and generated-style ownership. It is not evidence that replacing the present CSS pipeline would improve this project.

## Intrinsic layout

Every Layout provides useful public references for reusable layout relationships such as stacks, clusters, sidebars, and switchers. [S50](23-source-register.md#s50)

**Recommendation:** choose layout from the available container and content requirements, not a page-specific list of device names. A narrow inspector inside a wide desktop window must behave like a narrow inspector.

Use a small set of meaningful policies: wrap related actions, stack a body and aside below a supported width, keep primary content visible, and let long content grow. Do not expose arbitrary x/y coordinates for ordinary application controls.

## Proposed resolution order

This is a proposed extension, not a current API:

1. Shared component/composition defaults.
2. Selected pack values and explicit pack overrides.
3. Supported view-level layout selection.
4. Supported instance overrides with a reason.
5. Transient application state, which must not be serialized as a design override.

The existing Studio source/document/node model must remain authoritative. Confirm how this proposal maps onto it before adding fields. Do not create a parallel inheritance resolver.

Show the winning value and its origin. Reset removes the local difference; it must not copy today's inherited value into a new permanent override.

## Override controls

Allow only typed properties that have a real use. Existing composition gap and aside-width overrides are a starting point. Reject arbitrary selectors, CSS text, network URLs, and undeclared style keys. A broad `style` object would make drift hard to detect and could cross security boundaries.

Record the scope and reason privately. Shared audit output can expose override keys and counts without exposing private prose. If the same exception appears repeatedly, review whether the shared pattern is wrong instead of making more exceptions.

## Acceptance test

Change a shared layout setting. Both packs and two consumers should inherit it. Give one instance an allowed override, change the shared default again, then reset the override. The origin display and rendered result must agree. No layout edit may change the application's saved values or submit behavior.
