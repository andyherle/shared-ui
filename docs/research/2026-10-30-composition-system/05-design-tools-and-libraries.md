# 05. Design tools and linked libraries

## Why study design tools

The difficult product question is often not how to draw a control. It is how to explain ownership. A person must know whether an edit changes one instance, a shared definition, or a library used by many projects.

The following observations come from selected first-party pages. They are not hands-on product tests.

## Figma

Figma documents component properties for text, booleans, instance swaps, and exposed nested instances. Its library workflow makes a published change available to consuming files, which then accept updates. The engineering article on instance foundations discusses resolving overrides and nested component structure. [S16–S18](23-source-register.md#s16)

**Local implication:** use stable composition and slot identities. Do not use the visible label as the binding identity. Show an override marker and a reset action. Publishing and accepting a change should be distinct states where compatibility requires review.

**Boundary:** design-file behavior does not prove that a browser form can be rearranged without losing native undo, focus, or composition input.

## Penpot

Penpot documents main components and copies with overrides, grouped variants, and shared libraries. These provide references for a visible relationship between reusable definitions and their instances. [S19–S20](23-source-register.md#s19), [S78](23-source-register.md#s78)

**Local implication:** allow supported variations without forcing a detached fork. Use a small set of meaningful layout properties rather than separate components for every combination of density, theme, width, and state.

**Boundary:** a design library is not a consumer installation registry. A screenshot of matching controls is insufficient evidence of shared implementation.

## Webflow

The component documentation separates a main definition from instance properties, slots, and variants. The Libraries documentation describes cross-site updates and review of library changes. [S14–S15](23-source-register.md#s14)

**Local implication:** a central component needs both a structural contract and an update contract. Deleting a supported slot or property is not a harmless visual edit.

**Boundary:** sharing a component in a hosted website workspace does not establish compatibility with this repository's native applications or release process.

## Framer

Framer documents sharing components between projects and pulling source changes while the instance stays linked. Its variants guidance describes shared structure with intentional differences. [S21](23-source-register.md#s21), [S79](23-source-register.md#s79)

**Local implication:** detaching should be an explicit, visible decision. It must remove that instance from claims about automatic shared updates. Prefer a documented override where possible.

## Proposed authoring terms

Use plain labels in Studio:

- **Shared pattern:** the maintained definition.
- **This instance:** one use of that definition.
- **Override:** an explicit difference that still follows other shared values.
- **Detached:** a separate definition that does not inherit future structural changes.
- **Preview:** a candidate view, not a published or installed change.
- **Applied:** a change verified at a named consumer and version.

These labels are proposals, not current UI strings. Do not introduce a detach function merely because another product has one. A detach operation can create the same drift the system is intended to remove.

## Avoid variant explosion

Theme, density, layout, interaction state, and content are different axes. Do not encode every combination as a new named component. A control group should use the same identity in light and dark mode. Pending, invalid, and read-only states should remain state, not new layout forks.

Use named variants only where they express a real contract difference, such as a bounded inspector versus a simple section. Document incompatible combinations and reject them.

## Useful authoring test

Select a nested group. The editor must show its shared definition, local differences, inherited values, supported layouts, and affected consumers. Change one layout property. Review the impact. Undo it. Close and reopen the draft. The relationship and override scope must remain clear at every step.

The test is successful only when a person can predict the scope before saving. A technically correct global update with unclear scope is still a product failure.
