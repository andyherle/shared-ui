# 04. Visual builders: mechanisms worth borrowing

These are selected documentation studies, not installation reviews. Source IDs resolve in the [source register](23-source-register.md). The recommendations below are for Shared UI, not claims about the products.

## GrapesJS: a model, linked symbols, and project storage

The Symbols guide describes a main symbol with linked instances and property-level overrides. It labels this API as beta and notes that symbol-management UI is not supplied by that guide's core feature. The Storage guide treats project data as the editable model; exported HTML is not an equivalent authoring store. [S01–S02](23-source-register.md#s01)

**Borrow:** a reusable definition must remain identifiable after save/reload. An override should be recorded as an exception to that definition, not as a detached copy.

**Do not borrow by default:** a general HTML page-editor runtime. Shared UI needs a constrained control composition editor, not unrestricted websites inside every app.

**Experiment:** edit a shared group, override only one instance's spacing, reload, then change the default again. The unmodified properties must still inherit.

## Puck: code-owned components and constrained slots

Puck documents component configuration and nested slot fields. Slots can restrict which component types are accepted. Its permissions API separates allowed editing operations from component rendering. [S03–S04](23-source-register.md#s03)

**Borrow:** declare slot constraints in the same registry that the editor and agent inspect. Reject invalid child types before rendering.

**Limit:** its React-oriented integration does not match the current native, dependency-free consumer contract. Editor permissions also do not authorize backend actions.

**Experiment:** try to place an action-only component in a value slot. Both the visual editor and the agent command must return the same useful validation error.

## Craft.js: component nodes and editing rules

Craft.js describes user components with editor connectors, node rules, and settings. It is a framework for constructing an editor around application components. [S05](23-source-register.md#s05)

**Borrow:** separate the editable node model from the property panel. A selected node should expose only valid settings and moves.

**Limit:** building a full editor still leaves product work. The existence of a node tree does not solve inheritance, cross-app release, or application-state preservation.

## Plasmic: explicit interfaces between design and code

Plasmic documents registered code components and a code-generation path that separates generated presentation from application integration. [S06–S07](23-source-register.md#s06)

**Borrow:** make the boundary explicit. A layout can receive named content and approved bindings without owning their business implementation.

**Question for a later spike:** can a native composition descriptor provide a similarly clear boundary for both server-rendered templates and imperative DOM applications?

## Builder.io: symbols differ from static reuse

Builder documents registered custom components and reusable Symbols. Its reusable-block guidance distinguishes linked content from static templates. [S08–S09](23-source-register.md#s08)

**Borrow:** show whether an item is linked or copied. A copied pattern must not appear in the “inherits this shared change” list.

**Limit:** the platform's content delivery and SDK model is not automatically appropriate for local, app-owned control panels.

## Webstudio: reusable styling is not the same as structure

Webstudio calls a reusable collection of styles a Token. Its Slot documentation describes another reuse mechanism for content. Those meanings must not be merged with a DTCG scalar/composite design token or with a Shared UI named slot. [S10–S11](23-source-register.md#s10)

**Borrow:** make style-source provenance visible. Let the editor explain why an element has a value and which change would affect its peers.

**Limit:** sharing a style source alone cannot guarantee shared control order, accessible semantics, or form ownership.

## WordPress/Gutenberg: central settings and controlled variation

WordPress documents layered global settings/styles through `theme.json`. Synced-pattern overrides allow controlled local content differences while keeping the shared pattern relationship. [S12–S13](23-source-register.md#s12)

**Borrow:** distinguish structural rules from permitted instance content. Publish only supported customization points.

**Limit:** the WordPress document and block ecosystem should not become a second application model here.

## Internal-tool builders

Retool's referenced module pages are for **classic apps**. Appsmith packages and ToolJet modules describe reusable UI plus interfaces to data or logic. These are useful examples of declared module inputs and outputs. Their product scopes and feature tiers need separate verification before any adoption. [S22–S24](23-source-register.md#s22)

**Borrow:** a composition should have a small, documented interface. **Do not import their scope:** Shared UI must not become the owner of database queries, credentials, authorization, or workflow execution. Budibase was screened as a broader builder reference, not deeply evaluated. [S25](23-source-register.md#s25)

## Common conclusion

The useful idea is not drag-and-drop itself. It is a constrained, saved model with shared definitions, stable identity, clear customization points, and a controlled route into running applications. Keep the editor optional. The same contract must work through code, a keyboard, and an agent tool.
