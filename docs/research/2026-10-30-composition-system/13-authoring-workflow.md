# 13. Authoring workflow for people and agents

## Product goal

Make central control visible without making the person manage a design-system bureaucracy. The system should answer three questions immediately: what is selected, who owns it, and what will change if it is edited?

The workflow below is proposed. Extend the existing Studio interface and command service rather than creating a second editor.

## Select a real target

Start from a component in the catalogue or a privately registered application view. Show the composition name and version. Identify whether it is a live consumer, a synthetic preview, or a document-only draft.

A preview must not look like proof that a live application has changed. Keep the status explicit but compact.

## Choose change scope

Provide clear scope choices where supported: this instance, shared pattern, or pack values. Show affected views before a broad change. Do not default an instance edit to a global edit.

Display inherited values and local overrides together. Reset should reveal the inherited value. A person should not need to know CSS specificity to understand why an edit did not apply.

## Edit through constrained controls

Use direct manipulation only when it improves the task. Keyboard move-before/move-after actions must remain available. Property fields should expose valid options, not arbitrary CSS or a large generic JSON editor.

Keep the preview usable while editing. A draft change should appear progressively when safe. Do not wait for a large collection of edits and then replace the entire preview. Preserve focused fields and warn before a structural change that cannot preserve them.

## Review the effect

Show a small change summary: changed layout property, scope, affected definitions, known consumers, overrides that remain, and consumers that cannot accept the change yet.

Use a bounded set of representative previews, not a wall of every screen. Choose narrow and wide views, a form with unsaved input, an error state, and a heavily populated control group. Private application previews stay private.

A structured diff can show added/removed slots, changed variants, and new override keys. Do not require a before/after image gallery as a deliverable. Test the final UI directly.

## Validate and release

Validation checks the exact draft revision and shared source base. If either changes, the old validation receipt cannot authorize a new candidate. Use the existing revision and operation-ID controls.

Separate Save draft from Publish. Separate Publish from Apply to a consumer. Explain when a normal application release is required. Do not hide an incompatible consumer behind a generic success message.

## Recovery

Retain the exact submitted command during an uncertain response. Retry that command, not a newly generated equivalent. After a replayed historical receipt, read current state before presenting the editor as current.

A failed validation leaves the working draft intact. A rejected structural update leaves the installed app intact. An offline view retains its usable baseline and reports its actual state when it reconnects.

## Agent interaction

Agents use the same validated commands. Discovery should return only relevant component definitions and expansion paths. A command should name its target, expected revision, operation identity, and scope.

Agents can propose a group replacement, but cannot silently turn a local override into a global policy. They should report verified effects, not narrate a claim that a release “should now be everywhere.”

## Human acceptance exercise

Ask a reviewer to remove an unwanted group style across two registered test views. They should be able to predict the scope, preview the result, preserve one justified exception, publish through the allowed path, and see which views have actually adopted it.

Record where they hesitate or need explanation. Completion time alone is not enough. The central risk is a wrong-scope change that appears easy to make.

## Reference basis

Linked definitions and explicit overrides are informed by the Figma, Penpot, Webflow, and Framer studies in note 05. The command and persistence boundaries come from the existing Studio documents in note 02. This workflow combines those ideas; it is not a copied product interface.
