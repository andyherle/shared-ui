# 07. Native and headless component approaches

## The choice is about boundaries

A component library can share appearance, interaction, structure, or all three. Those are not interchangeable. This repository already uses native elements and a small optional JavaScript layer. Any new approach must justify the cost of changing that boundary.

## Lit and web components

Lit documents shadow DOM, slots, and styling contracts. Shadow encapsulation means a document stylesheet cannot simply reach all internal elements; inherited properties and explicit styling interfaces matter. [S32–S33](23-source-register.md#s32)

**Borrow:** stable public properties and explicit extension points.

**Do not assume:** wrapping a control in a custom element automatically makes the current CSS update channel work. Form association, label behavior, focus, testing, and styling need deliberate integration.

**Proposed decision:** retain light-DOM native compositions first. Evaluate a custom element only for a concrete integration need that the existing factory cannot meet.

## FAST, Lion, Vaadin, and Web Awesome

These projects were screened as native/web-component references. FAST offers a component-system foundation. Lion focuses on reusable white-label components. Vaadin supplies an extensive component set. Web Awesome's migration guidance demonstrates that moving from Shoelace is more than a cosmetic rename. [S34–S37](23-source-register.md#s34)

They are useful for lifecycle, theming, form, and platform integration questions. They are not interchangeable dependencies. Inspect the exact component, package, license, version, and required bundle before adoption. Do not use old FAST 1.x material as proof of a current API, or assume Shoelace and Web Awesome are the same supported release.

## Radix and React Aria

Radix documents composition through `asChild`, with requirements for forwarding behavior to the actual element. React Aria documents customization and component composition. [S38–S39](23-source-register.md#s38)

**Borrow:** preserve the semantic target and behavior contract while changing presentation. A wrapper must not swallow native props, focus behavior, or events.

**Limit:** headless primitives still leave application teams to choose grouping, hierarchy, and placement. They do not by themselves prevent six consumers from building six different sections.

## Base UI, Ariakit, Zag, and Ark

Base UI and Ariakit were screened as accessible/headless component references. Zag documents state-machine-based behavior; Ark describes its use of that foundation. [S40–S43](23-source-register.md#s40)

**Borrow:** separate interaction state from paint. Define transitions and disabled behavior rather than scattering event logic across templates.

**Limit:** a state machine is not a layout release system. Do not add a framework dependency to solve a problem already handled by a native element.

## shadcn/ui and code ownership

shadcn/ui describes itself as a code distribution platform for building a component library. [S61](23-source-register.md#s61)

**Local inference:** code ownership is useful, but independent copied code does not guarantee later central updates. It can meet this project's goal only with an additional maintained shared package or another verified synchronization contract. The distribution model and the desired inheritance model must be chosen deliberately.

## Proposed responsibility split

Shared UI owns common semantics, layout policy, tokens, generic interactions, and their tests. Applications own domain content, action execution, validation, persistence, renderer geometry, and authorization.

A composition should wrap or accept app-owned native elements at creation. It should not duplicate their state or silently replace them during a style update. Server-rendered views require their own compatible initial-render contract; a factory that only accepts detached nodes is not an automatic hydration solution.

## Decision test

Before adding any library, answer: which verified missing behavior does it supply, what existing code can be removed, and how will its updates reach consumers? Reject an adoption that adds a second button system, a second form state store, or a second editor registry while leaving the actual layout drift unchanged.
