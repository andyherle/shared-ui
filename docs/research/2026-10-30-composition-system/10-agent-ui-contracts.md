# 10. Agent-generated UI and constrained catalogues

## Why this belongs in phase one

Agents will help build and change these interfaces. They need a small, discoverable contract. Without one, each agent can invent new markup, styles, state, and controls that look plausible but do not inherit shared improvements.

The desired interface is not “generate arbitrary HTML.” It is “select an approved component, fill named slots, choose a supported layout, and return a reviewable change.”

## A2UI

A2UI documents catalogues of supported components and rendering contracts. Its public materials include several protocol versions. Version-specific schemas must be kept separate. [S56–S57](23-source-register.md#s56)

**Borrow:** a sender describes approved UI structure; a host renders known components. The catalogue is an explicit capability boundary.

**Limit:** an allowlist does not prove complete security. Resource limits, action authorization, URL handling, data disclosure, and renderer defects remain relevant. Do not repeat absolute “no injection” claims as a guarantee.

## json-render

The json-render core and schema documentation distinguish the UI description from the catalogue of allowed components. [S58–S59](23-source-register.md#s58)

**Borrow:** produce machine-readable constraints from the same source used for validation. A model should not invent a component that the renderer cannot resolve.

**Limit:** this is a reference for constrained generation, not a reason to install another registry or rendering engine beside Studio.

## Adaptive Cards

Adaptive Cards documents a host configuration for consistent rendering of a constrained card model. [S60](23-source-register.md#s60)

**Borrow:** keep host policy separate from content. Shared defaults should not require each card producer to repeat the same layout choices.

**Limit:** a card protocol is not a complete editor, inspector, or application layout system. Capability negotiation matters when hosts differ.

## Extend the existing Studio service

The current Studio foundation already describes a single command service used by editor and MCP adapters. Preserve that model. Add capabilities there only after the registry and validation contract exist.

A future discovery response should distinguish: registered, authorable, previewable, supported by a named consumer, and installed in that consumer. A component listed in a catalogue must not be presented as available everywhere.

A future change proposal should identify the base revision, affected composition, intended scope, proposed difference, known consumer impact, and required validation. It should not contain private runtime values unless the private application explicitly authorizes that use.

## Proposed agent workflow

Read the exact shared contract and the selected consumer registration. Inspect only relevant groups and bindings. Propose a bounded change against an expected revision. Validate it before rendering. Preview with synthetic data. Review changed structure and affected consumers. Publish only through the authorized release path. Verify the resulting version and view.

Use the existing operation-ID and revision mechanisms for safe retries. An uncertain save is not permission to generate a new operation with different content. A historical receipt is not proof of the current document state.

## Prohibited shortcuts

Do not inject arbitrary JavaScript, inline event handlers, CSS text, or remote component code through a layout document. Do not infer authorization from a visible button. Do not silently replace an unknown component with a different one. Do not hide unresolved bindings and report success.

Do not make agents read the full history of every consumer for a small layout edit. Provide bounded summaries, exact IDs, revision markers, and explicit expansion paths. Record evidence in the owning repository rather than repeating private data into the shared public catalogue.

## Evaluation

Give two agents the same small redesign request. Both must select the same valid shared group types and produce compatible proposals. Invalid slot names and unsupported variants must fail with actionable errors. Test stale revisions and repeat requests. Human and agent edits should use the same command path and produce the same validation results.
