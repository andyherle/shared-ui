# 15. Security, privacy, and performance boundaries

## Design documents are untrusted input

A constrained schema reduces the allowed surface. It does not make every valid document safe. Validate document size, depth, component count, child relationships, token types, binding IDs, and compatibility before rendering.

Do not accept raw HTML, inline JavaScript, arbitrary attributes, free-form CSS, or executable expressions from layout documents. Keep labels inert. Treat URLs as a separate typed capability with application validation rather than a generic string inserted into any attribute.

OWASP recommends context-appropriate handling of untrusted data and treats Content Security Policy as an additional defense, not a replacement for safe rendering. [S76–S77](23-source-register.md#s76)

## Authority remains in the application

A layout may request an approved action binding. It cannot grant that action permission. The application checks authorization at execution, even when the control is visible and enabled.

A hidden component is not a security control. A public component catalogue must not disclose private action arguments or credentials. An agent's ability to edit a draft does not imply authority to publish or operate an application.

## Private versus public data

Public: synthetic component examples, generic schemas, source code intended for the shared library, and general research notes.

Private: actual view registrations where sensitive, draft documents, runtime values, business labels, screenshots of real records, override reasons containing context, and application audit details.

Store consumer diagnostics in the owning private environment. Public coverage can state that a contract was tested without copying the source or test data. Avoid logging complete DOM, form contents, URLs, or arbitrary error payloads.

## Release supply chain

Keep the current same-origin bundled behavior path and validated CSS update rules. Do not expand the style channel into remote script execution. Bind a candidate to its source revision and content digest. Check the actual published artifact rather than trusting a successful build message.

A compatibility failure should retain the working baseline. A failed update must not leave two competing shared stylesheets active indefinitely. Structural changes require their own migration and recovery plan.

## Performance risks to test

A small schema can still create excessive DOM, nested layout work, or repeated observers. Bound composition depth and instance count. Batch changes to a known affected group. Avoid a new global mutation observer or a polling loop that scans every application view.

Stop preview and observation work when a view is hidden. Dispose listeners, observers, timers, and subscriptions when it closes. A preview gallery must not keep all large fixtures running at full cost in the background.

Do not make the UI wait for a remote adoption report before ordinary control editing. Diagnostic collection should be bounded and separate from the user's action.

## Measurement plan

Retain the existing shared CSS limits: 36 KiB raw and 8 KiB gzip. Measure generated output, not only source file length. Record runtime bundle size, node counts, layout-change duration, input responsiveness, memory after repeated mount/dispose, and background activity.

Compare the same fixture, device, browser, and content before and after a candidate. Include a small section, a large inspector, and two open views. Record distributions and worst observed cases rather than only one fast run.

No performance result is claimed in this research. A proposed budget must be identified as a target until measured.

## Failure cases

Test a malicious label, unsupported URL, unknown binding, very deep tree, excessive children, stale revision, conflicting writer, failed stylesheet load, missing asset, offline startup, and a consumer with an older contract. Each must fail without changing private data, dropping unsaved input, or reporting a false successful update.
