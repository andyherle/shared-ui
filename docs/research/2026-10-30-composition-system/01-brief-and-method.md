# 01. Brief, scope, and research method

## Problem statement

A shared stylesheet can make two buttons look alike while the screens around them still differ. Applications can copy control groups, reorder actions, add separate disclosure boxes, and retain old markup. A later library change then has little effect on those copies.

The target is not identical screens. It is consistent treatment of the same task. A record editor and a media inspector can keep different content while sharing section hierarchy, control grouping, action placement, responsive behavior, and change controls.

A successful system lets a person say: “Use a heading row for this kind of group everywhere,” then inspect the affected views and release the change without editing each screen by hand.

## Questions used in the study

- What is the reusable unit: a token, widget, group, pattern, whole page, or application module?
- Is an instance linked to a shared definition, or is it a copy?
- Which parts can an application override? Can an override be found and reset?
- Does a layout change preserve native controls and app-owned behavior?
- How are component types, slots, bindings, and allowed children described?
- How does a change reach several applications? What proves that it arrived?
- What happens when a consumer is old, offline, customized, or in the middle of editing?
- What can people and agents change without executing arbitrary code?
- How are accessibility, responsiveness, security, and performance tested?

## Evidence levels

**Source inspection:** selected local repository source was read. The clearest example is `src/compositions.js` at the pinned commit in note 02. This confirms specific code paths, not their behavior in every browser.

**Focused documentation review:** selected first-party technical pages were examined for a defined mechanism. The deep notes state observations, local implications, and limits separately.

**Screening:** a primary repository overview or official documentation result was checked to establish relevance. Screening does not establish full feature coverage, maintenance quality, license suitability, or integration cost.

**Proposal:** a design or test recommended for Shared UI. It is not a third-party feature claim or an existing Shared UI API.

The repository catalogue uses `D` for focused documentation work and `S` for screening. It does not assign popularity scores.

## Search and selection

The study crossed visual page builders, design tools, schema-driven forms, native web components, headless interaction libraries, token systems, inspector libraries, command registries, agent UI protocols, test tooling, and design-system governance.

Primary project documentation, official repositories, standards/community reports, and platform documentation were preferred. Search snippets were useful for screening, but they are not treated as a full source review. Vendor statements were treated as descriptions of their own products, not independent proof of quality.

The source register records useful entry points and version cautions. It stores links and original summaries, not copied documentation archives. Sources were checked during this research on 2026-10-30. Most external pages are rolling documentation, not immutable version snapshots.

## Evaluation rules

Fit is judged against this repository's actual constraints: native HTML, two packs, a small shared stylesheet, existing Studio commands, app-owned data and actions, and separate CSS and runtime release paths. A large React builder can contain useful ideas without being a suitable dependency.

No ranking is based on star counts, download estimates, or an unsupported claim that one library is “best.” A tool can be strong in its own setting and still be a poor runtime fit here.

## Known limits

No external product account was used. No paid feature was tested. No complete dependency or license audit was performed. Source-level tests, real-device trials, performance benchmarks, and consumer installation checks belong to the next phase.

A network-based bulk repository metadata collection attempt did not produce verified inventory results. No release-age, star-count, or license claims depend on that attempt.

The breadth of the study is not proof that every possible system was found. Note 21 records the remaining questions, with tests that can resolve them. This is a decision-ready research base, not a claim that further evidence cannot change the design.
