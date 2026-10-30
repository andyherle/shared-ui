# 06. Schema-driven UI: separate data, layout, and behavior

## JSON Forms

JSON Forms separates data schema from UI schema. Its layouts include vertical and horizontal arrangements, groups, and categories. Custom renderer selection uses a registry with testers and ranking. [S26–S27](23-source-register.md#s26)

**Useful idea:** describe presentation without changing the underlying data model. A field can move between groups without becoming a different domain value.

**Risk to avoid:** an implicit renderer-selection rule can make an agent unsure which control will appear. Shared UI should expose the resolved component and the reason for selection. Explicit component IDs are preferable for important control groups.

## RJSF, uniforms, and Formily

These repositories were screened for schema-driven form generation, adaptation, and extensibility. Their form abstractions are relevant reference points, not verified replacements for this system. [S28–S29](23-source-register.md#s28), [S31](23-source-register.md#s31)

A later comparison should use the same small form: a conditional section, a repeated row, a custom color field, a validation error, and a pending submit. Measure whether the schema remains readable and whether application behavior stays outside layout configuration.

Do not assume that “supports JSON Schema” means that layout, runtime events, serialization, accessibility, and server validation share the same contract.

## FormKit

FormKit describes a serializable schema for DOM and component structure, including conditional and expression features. [S30](23-source-register.md#s30)

**Useful idea:** structured descriptions can be inspected and edited by tools.

**Important limit:** a general expression language is additional execution power. Shared UI should not add arbitrary expressions just to show or hide a group. Use registered application capabilities and a small set of typed presentation states.

## Proposed separation for Shared UI

Use four distinct concerns:

1. **Domain schema:** the application defines values, validation, persistence, and permissions.
2. **Component registry:** Shared UI defines supported component types, slots, properties, semantics, and lifecycle.
3. **Composition document:** a private draft selects registered components and supported relationships.
4. **Adapter bindings:** the application resolves approved value/action references to its own implementation.

Do not copy the domain schema into a second editable UI store. Do not serialize callbacks, network endpoints, credentials, or current user values into public composition templates.

## Visual grouping is not data nesting

A group called “Appearance” may contain fields from several domain objects. Moving it must not change the save payload. Conversely, a nested domain object does not require a nested accordion.

A layout edit should preserve stable field IDs, native form ownership, labels, error associations, and action bindings. A rename of a heading must not rename a database field. A move must not silently change whether an input is submitted.

## Keep the grammar small

The first useful grammar needs named slots, a few allowed group roles, ordered child references, constrained layout variants, and typed overrides. It does not need arbitrary HTML, custom CSS text, recursive functions, or a new query language.

The existing Studio model already covers much of this ground. Any added property should have an owner, a validation rule, a rendering rule, a reset rule, and a migration rule. If those cannot be stated, do not add the property yet.

## Required negative tests

Reject unknown component IDs, unknown slots, duplicate parents, cycles, unbounded depth, incompatible bindings, and a child in a prohibited slot. Reject stale revisions before mutation. Preserve the prior document on every failure.

Test a schema update that removes a slot. The old instance must be reported for migration; it must not lose its children silently. Test two different labels with the same stable value binding, and two identical labels with different bindings. Identity must remain unambiguous.

## Recommendation

Borrow the separation of data and presentation. Do not import a form engine as the central application platform. The prototype should render the application's actual native controls inside a shared structure, then verify that the original submit and validation paths still work.
