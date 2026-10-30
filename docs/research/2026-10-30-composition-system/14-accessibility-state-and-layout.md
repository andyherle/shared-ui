# 14. Accessibility, responsive layout, and working state

## A layout contract includes behavior

A layout change can preserve every value yet still break the task. Focus can move, a native undo history can disappear, an error message can lose its association, or keyboard order can stop matching the visible page.

Treat state and accessibility as acceptance conditions, not a final styling pass.

## Group, toolbar, disclosure, and accordion are different

The WAI-ARIA toolbar pattern specifies a focus model with one tab stop and arrow navigation. Its guidance recommends toolbar grouping for three or more controls and warns about conflicts with controls that need the same arrow keys. [S72](23-source-register.md#s72)

A visually grouped row does not automatically need `role="toolbar"`. A normal group of native buttons can retain ordinary Tab navigation. Do not add toolbar semantics merely to satisfy the design rule that a boxed disclosure must belong with related actions.

The disclosure and accordion patterns define expanded state and activation expectations. [S73–S74](23-source-register.md#s73) Use native elements where they meet the task. Add custom keyboard handling only when the chosen pattern requires it. Test the result rather than assuming the role attribute makes it accessible.

## Visual order and logical order

MDN's grid accessibility guidance distinguishes visual placement from document order. CSS placement alone does not reliably make reading and focus order match a newly arranged visual task. [S75](23-source-register.md#s75)

**Proposed rule:** compatible CSS layout changes may alter columns and wrapping while preserving a sensible logical sequence. A change that requires a different reading/action order needs an explicit structural migration, not CSS `order` used as a hidden substitute.

## State preservation checklist

For each supported layout change, verify the same field value, focus target, selection range, IME composition, native undo behavior, validation message, dirty flag, scroll position, open disclosure, and active overlay where applicable.

Preserving DOM node identity is useful but not sufficient. A style update can still hide the focused control, clip content, or change scroll geometry. Tests must inspect the final behavior.

Never recreate a form solely to change its layout. Keep native submit ownership and labels. A footer submit button that uses a `form` attribute must still target the exact intended form. Do not nest forms or add a second forwarding submit path.

## Responsive coverage

Test a narrow embedded panel as well as a narrow page. Include long labels, long values, translated text, right-to-left content where supported, large text, browser zoom, coarse pointers, and reduced motion.

The repo already has coarse-pointer target and field-size rules. Keep them separate from compact desktop density. A small visible icon does not require a small touch target.

Avoid duplicated “desktop” and “mobile” controls with separate state. Prefer one semantic structure that reflows. If a specialized alternative is necessary, define how identity, focus, validation, and submission remain singular.

## Overlays and bounded panels

Keep native dialog behavior and focus restoration in the overlay host. A composition inside a dialog is not a replacement for modal semantics. Avoid nested scrolling regions that hide the primary action or trap a phone user between two scroll containers.

Do not move an active overlay into another slot during a layout update. Do not let a global style refresh close a picker, reset a media control, or interrupt a live text edit.

## Acceptance exercise

Enter unsaved text, select part of it, open optional details, and create a validation error. Change the supported shared layout. Continue editing, undo once, submit through the native form, and return focus from an overlay. Repeat with keyboard and a real phone browser.

An automated accessibility scan is one signal. Manual keyboard, assistive-technology, and device checks remain necessary. See [validation](16-validation-and-fixtures.md).
