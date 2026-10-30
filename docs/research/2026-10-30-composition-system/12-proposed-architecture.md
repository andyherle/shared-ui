# 12. Proposed architecture: a small shared composition layer

Status: proposal for phase two. No new API in this note is implemented by this research.

## Recommended shape

```text
Shared token sources
        ↓
Native controls and generic interaction helpers
        ↓
Shared control groups and composition definitions
        ↓
One registry + existing Studio authoring/validation service
        ↓
Versioned generated assets and consumer integration contracts
        ↓
Application-owned native controls, actions, data, and fixtures
```

The arrows describe dependency and responsibility. They do not require a new service, package, or network call at each level.

## Reuse the current foundation

Extend `review-workspace@1`, the existing registry, typed token handling, private document store, and editor/MCP command service where evidence supports doing so. Keep one definition of valid component properties and slots. Generate discovery and validation views from it where practical.

Do not put layout behavior in a new JSON file that disagrees with runtime constants and Studio descriptors. A single maintained definition is useful only if all consumers of that definition actually use it.

## Smallest useful shared units

Start with a **control group** and a **related action group** inside the existing workspace composition. A control group needs a heading, optional context, controls, related actions, and a supported disclosure policy. An action group needs stable action identity, placement, priority, and crowding behavior.

Add a separate decision-form composition only when two real consumers demonstrate a common structure. Do not register every page as a universal component. A pattern should be large enough to remove repeated decisions and small enough to have a clear purpose.

## Proposed descriptor requirements

A registered composition should state:

- Stable component ID and compatibility revision.
- Named slots, required/optional status, cardinality, and accepted child families.
- Native semantic expectations and form ownership.
- Supported variants, responsive rules, and disclosure contexts.
- Allowed typed overrides and reset behavior.
- Binding capability requirements and application-owned responsibilities.
- State-preservation and disposal expectations.
- Synthetic fixture references and known consumer coverage.

These are fields to reconcile with the current registry, not a mandate to add all of them under new names.

## Bindings stay outside the design model

Applications provide approved action/value references or construct real native elements at mount. Shared UI can arrange these elements without owning the business values. The app still decides whether an action is permitted, what validation means, how saving works, and which history operation to record.

A composition cannot send an email, save a document, or modify a domain object merely because an agent inserts a button into it. The binding must be registered by the application and authorized at execution.

## Two integration paths to investigate

**Imperative native DOM:** the current factory can accept detached app-owned elements during view creation. Extend this path without remounting elements on ordinary layout changes.

**Server-rendered native HTML:** define a compatible initial-render contract or a narrowly designed adopt-in-place path. Do not unwrap and move a focused form just to use the factory. Decide how templates can share maintained structure without copying generated fragments into permanent forks.

Both paths must use the same semantic composition contract. Their lifecycle details can differ. A React adapter is not required for the first prototype.

## Layout defaults and overrides

Keep layout policy in the shared definition. Applications choose supported roles and variants, not arbitrary per-page CSS. Local differences must be typed, discoverable, and resettable. Restrict exceptions to demonstrated needs.

A global default can affect only consumers that reference it and support the required contract. The impact preview must exclude detached or pinned views and mark unsupported consumers clearly.

## Do not add these systems

No universal app state manager. No second persistence engine. No general expression evaluator. No arbitrary remote component loader. No new mandatory rendering framework. No central database of private application content. No second settings dashboard for the person to maintain.

## Success test

Two different real-template fixtures instantiate the same maintained composition. One shared edit changes their grouping or supported layout. Their labels, values, action handlers, native submission, draft text, focus, and open state remain correct. The audit identifies the same composition revision and any explicit overrides.

A change to two manually copied templates does not pass this test, even if the screenshots match.
