# 09. Inspector systems and command registries

## Why these systems matter

A parameter inspector is closer to this project's control panels than a marketing-page builder. It must handle many small controls, frequent value changes, conditional groups, and compact layouts. It also exposes a danger: a convenient binding system can become a second owner of application state.

## Tweakpane

Tweakpane documents folders and tabs for organizing controls. Its state export/import and event APIs show how a panel can preserve its own configuration. The documentation also notes that external parameter changes require an explicit refresh in the ordinary binding path. [S51–S52](23-source-register.md#s51)

**Borrow:** groups should be first-class objects with clear lifecycle and state boundaries. Distinguish a continuous edit from the end of an edit when an application needs to commit history.

**Do not assume:** panel-state export is a safe domain save format, or that every external value change is automatically reflected. The application still needs an explicit binding contract.

## Leva and lil-gui

Leva was screened as a React-oriented control-panel reference. lil-gui documents controller folders and save/load behavior. [S53–S54](23-source-register.md#s53)

**Borrow:** related controls should be easy to declare and find. A group should be manageable as a unit without forcing its values into a new application data store.

**Limit:** these tools do not establish the desired cross-application composition release system. Their default panel styling is not the target design.

## VS Code contribution points

VS Code documents named contribution points for commands, menus, views, and other host features. Visibility conditions and command enablement have different purposes. [S55](23-source-register.md#s55)

**Borrow:** use stable action identity independently of its placement. A command can appear in a toolbar, menu, or context action without duplicating its implementation. The host decides where an approved action belongs.

**Boundary:** visibility is not authorization. A hidden or disabled control must never be the only protection for an operation.

## Proposed control-group contract

A group should describe its purpose, heading, optional context, child controls, optional related actions, disclosure policy, and allowed layouts. The registry should define valid child families and accessibility expectations.

Applications should supply existing controls or approved value/action bindings. Shared UI should not infer domain meaning from label text. Two controls named “Size” can have different owners and units. A change to the visible heading must not change their identity.

For large inspectors, search should find both the group and a control's path. Opening a search result should reveal its ancestors without discarding the previous user's open state. Do not flatten every result into an unlabelled list of controls.

## Tree view is not automatically an ARIA tree

A visual hierarchy can use native section headings and disclosures. An actual ARIA tree has a specific focus and keyboard model. Controls inside a tree introduce additional questions about editing versus navigation.

Choose the simplest semantic structure that supports the task. Do not add a tree role only because rows are indented. Define and test how Tab, arrows, Enter, Escape, and text editing behave before shipping a custom inspector navigation mode.

## Relevance to the disclosure defect

A section heading can expand its own body. A compact disclosure can also belong to a genuine action bar. Neither requires a separate boxed button floating between unrelated sections.

The shared group contract should make the accepted context explicit. A generic disclosure primitive cannot enforce that context by itself. Rejecting a standalone boxed group toggle should be a composition check, supported by real rendered fixtures.

## Prototype tests

Use an inspector with long names, nested groups, a selected control, an invalid field, and an open text editor. Switch supported layouts and change group density. Preserve values, focus, selection, history hooks, and open state. Search for a nested control and return. Confirm that no unrelated application setting or renderer geometry changes.
