# Freelance OS source analysis and implementation handover

Date: 24 October 2026  
Repository: `C:\dev\thymer-freelance-os`  
Analysed application version: 1.3.4  
Analysed Git revision: `4ad9e29016610b3c51ed989086064a28862b9c2c` (`main`)  
Status: phases A through E implemented on 24 October 2026; ready for audit. The working tree is uncommitted. The structured dependency extension remains a separate, unimplemented product decision.

Audit entry point: `docs/plans/2026-10-24-implementation-status-handoff.md` records changed files, runtime targets, tests, live evidence, and residual limitations. Phase completion records are at the end of this document.

## 1. Start here

This is a self-contained handover for an implementation model. Read it before changing application code. The user requested actual source-code investigation before recommendations and subsequently clarified that planning artifacts may be saved. Saving this document does not authorize starting implementation, building, deploying, committing, or pushing.

The recommendation is to build a trustworthy, explainable queue first, then weekly-review continuity. Extend existing workflows rather than importing another plugin's feature set.

### Scope and boundaries

- Use existing Thymer collections, native tasks, native Journal, and current Freelance OS structures.
- Do not add time tracking, billing features, new collections, or required third-party plugin dependencies.
- Existing support-time and finance functionality is outside the change scope; preserve it.
- Treat the reference plugins as design references. Do not copy code without checking its license and retaining required notices.
- No application implementation, build, deployment, mutation-capable desktop test, commit, or push was performed during the investigation or artifact creation.
- Source findings are not evidence that the installed desktop has been tested. Runtime uncertainties below remain verification tasks.

### Preserve the existing working tree

The initial and final source-investigation Git status was:

```text
## main
 M dist/plugin.css
 M plugin.css
```

Both modified CSS files had this SHA-256 during the investigation and at its end:

```text
01F8C371C434EB8F591354DFA896C821D692A9B5842030DCDB4AB9A01D949A94
```

They are pre-existing changes. Do not reset, restore, overwrite, stage, or commit them incidentally. The build writes both files, so understand their differences before any later authorized build. This planning document is an additional, intentional change after that baseline.

### Recommended sequence

| Phase | Deliverable | Relative size | Depends on |
| --- | --- | --- | --- |
| A | Persistence, task-coverage and ownership correctness, safe refresh/reconciliation | Medium | Runtime API verification |
| B | Synced waiting explanations and fixed queue presets | Medium | A |
| C | Discoverable saved reviews, prior-week comparison, explicit carry-forward | Large; split C1 and C2 | A; B improves waiting presentation |
| D | Explicit capture command from a native project context | Small to medium | A ownership and capture validation |
| E | Optional relationship-based project suggestions | Medium | A; evaluate need after B-D |
| Deferred | Full task dependency graph, general similarity engine, arbitrary query builder | Large | A separate product decision |

Implement A and B first when implementation is authorized. Make each phase independently reviewable. Do not start later phases merely because their implementation notes appear here.

## 2. Investigation method and evidence

The analysis read Freelance OS source, configuration, build code, documentation, unit tests, and live-test implementations. It also read JavaScript implementations and configuration for all five named references, available license declarations, and the upstream SDK declarations and search reference. README descriptions were not treated as implementation evidence.

No external plugin source was copied into this repository. Source was retrieved for inspection without checking out or installing the reference projects.

### Reference revisions

| Project | Inspected revision | Main implementation |
| --- | --- | --- |
| Property Auto-Initiator | `649134f6dd35aa4714d3c610017554a2037cbb71` | `plugin.js`, configuration and LICENSE |
| Thymer SDK / Kanban Dependencies | `6f25f1470ff1d7bd833a0494bc561c1c9152b93d` | Example JS/JSON, `types.d.ts`, LICENSE, search reference |
| Query Builder | `68783cb96afa75ea67c04741e8725befc3e00490` | Readable bundled `plugin.js`, configuration and LICENSE; version 1.3.5 |
| Weekly Journal | `f79f0fef0f53f4419c6286e0ec5e7a17d71c8b1b` | `plugin.js`, configuration, README license declaration |
| Related Notes | `5da8d06076c4d526e8a4985598f50ea5bbfbffb8` | `plugin.js`, configuration, README license declaration |

The inspected implementation blob SHAs were respectively `f8bbe4baa2e2b09b569a9868bd0201b5f6afe0bd`, `d148a261fd4160484187f00ad4632f8c3950df78`, `a320e1a1e5253c068fac1739f2f9476507f46cee`, `2965bf0a8d9f8c73327b8889f5bd6869e4257d64`, and `23845478734bb4efe36b48feea22cddc616c4cad`. Upstream SDK typings blob: `8c17d484e4527977495eed0f7a1b1268c6c0f67b`.

## 3. Current Freelance OS implementation

Line numbers below refer to the analysed revision and will drift. Find the named function before editing. Paths in this document are relative to the repository unless stated otherwise.

### Source and build map

| File | Responsibility |
| --- | --- |
| `src/index.js` | Plugin lifecycle, dashboard rendering, collection records, capture, creation forms, navigation and project templates |
| `src/workflow.js` | Task/project model, local workflow state, next-action reconciliation, waiting, focus, weekly review and queue UI |
| `src/styles.css` | Source CSS; theme variables, container queries and dashboard components |
| `src/support-time.js` | Existing support-time summarization; outside this feature scope |
| `types.d.ts` | Checked-in SDK declaration reference |
| `build.mjs` | Concatenates support-time, workflow and index source; assigns `Workflow` to `Plugin.prototype`; embeds CSS and generates root/dist artifacts |
| `plugin.json`, `package.json` | Current version 1.3.4 and plugin/development configuration |
| `scripts/starter-schema.mjs` | Existing collection schema; no changes are needed for the proposed metadata-based features |
| `test/workflow.test.mjs` | VM-based pure/workflow tests loading source directly |
| `test/projects.test.mjs` | Project templates and relationship validation |
| `test/live-workflow.mjs`, `test/live-create.mjs` | Desktop tests that mutate fixtures, may reload the plugin, and restore state |

Do not edit generated `plugin.js`, `plugin.css`, or `dist/*` as source. Do not introduce module imports without accounting for the concatenating build and VM-based tests.

### Existing workflows and real gaps

| Workflow | Current behavior | Relevant functions | Gap worth addressing |
| --- | --- | --- | --- |
| Capture | Header captures an ordinary task in a selected project or Journal; optional Important; Enter saves; `/` focuses capture; failures preserve text | `captureTask()` at index:812; capture UI inside `render()` at index:1273 | Native-project contextual capture and stronger destination revalidation |
| Contextual capture inside dashboard | Project attention rows already set `captureProjectGuid` and focus the existing form | `renderProjectAttention()` at workflow:606 | Do not build a duplicate dashboard Add task flow |
| Project/client links | Native `client` record property; client cards filter projects; project cards open clients; validation prevents arbitrary project-as-client selection | `getClientGuid()` index:194; `createConfiguredRecord()` index:902; `showCreateProjectModal()` index:1009 | No additional relationship database needed |
| Project nesting | Native parent links resolve nested project-page tasks to their root, with cycle protection | `getParentGuid()` index:150; `projectRoot()` workflow:13 | Preserve orphan/ambiguous cases instead of guessing |
| External project tasks | A task elsewhere qualifies when its reference segments resolve to exactly one project root | Local `add()` inside `loadWorkflowData()` workflow:278 | Ambiguity is omitted without a dedicated diagnostic; template source is not consistently excluded |
| Next actions | One selected task per active project; native reference under Next actions; local cache/recovery labels | `reconcileNativeNextActions()` workflow:177; `writeNativeNextAction()` workflow:350 | Already synced; do not propose next actions as a new feature |
| Focus | At most three actionable tasks, scoped to a calendar day; local | `actionModel()` workflow:41; `renderActionRow()` workflow:555 | Preserve existing behavior |
| Waiting | Native waiting status removes tasks from actions/next/focus; reason/follow-up/previous status are local | `setActionStatus()` workflow:391; `renderActionRow()` workflow:555 | Sync the explanation, keep status and details consistent, show missing details clearly |
| Queue | Next actions, Needs attention, Waiting, All actions; search/project intersection; counts; 20-row Show more | `filterActions()` workflow:235; `renderWorkflow()` workflow:670 | Counts are global to each queue rather than scoped by current search/project; simple presets absent |
| Review | Three steps; local draft by Monday-start week; recent done tasks; project check-in; Journal summary | `reviewWeek()` workflow:7; `weeklyReviewText()` workflow:240; `saveReviewToJournal()` workflow:419 | Prior-week continuity and cross-device discovery |
| Priority-to-task bridge | Priority can link an existing actionable task or create one; stable IDs survive edits/reordering; task origin marker supports recovery | workflow:123-171; `linkReviewPriorityTask()` workflow:487; `addReviewPriorityTask()` workflow:504; `renderReviewPriorityBridge()` workflow:763 | Carry-forward must reference the same task without overwriting its single origin marker |
| References | Native client links, nested pages, Deliverables & references section, native backlinks | `projectTemplateSections()` index:321; `initializeProject()` index:839 | Generic related-note discovery has limited incremental value |
| Client reviews | Template includes native checkpoint tasks; overdue, due-soon and missing-date cues already exist | `CLIENT_REVIEW_CHECKPOINT_PROPERTY`; `actionModel()`; `renderProjectAttention()` | Do not recommend client review reminders as a new feature |

### Current loading and persistence details

`workflowDefaults()` currently returns:

```js
{
  version: 1,
  mappings: {}, next: {}, nextLabels: {}, nextRecovery: {},
  focus: {}, waiting: {}, drafts: {}, reviews: {}
}
```

`loadWorkflowState()` reads `getLocalStorage?.('workflow-v1')`; `persistWorkflow()` calls `setLocalStorage('workflow-v1', JSON.stringify(...))`. Mapping keys are collection roles. Focus keys are local dates. Draft/review keys are Monday-start weeks. Waiting keys are native task GUIDs.

Current persistence semantics:

| Data | Authority / scope |
| --- | --- |
| Records and record links | Synced native workspace data |
| Task text, date segments, native task status | Synced native workspace data |
| Selected project next action | Native project reference, with local cache and recovery state |
| Focus pins | Local workflow state |
| Collection mappings | Local workflow state |
| Waiting explanation/follow-up | Local workflow state; only waiting status syncs |
| Unsaved review draft | Local workflow state |
| Saved review body | Native Journal data |
| Saved review location cache | Local `reviews[week]` |
| Existing review-priority origin marker | Task metadata, synced |
| Active queue/search/project choice | Plugin instance memory |

Correct Settings/docs wording: selected next actions already sync through native project references. Some current text still describes them as local.

`loadWorkflowData()` reads all records in Projects, then document lines without reference expansion in batches of eight. It supplements them with `@task @todo`, capped at 1,000. A failed read/query or full query page sets `complete = false`. Incomplete scans preserve next/focus pointers and avoid invented missing-action gaps.

`loadData()` separately fetches the Overview agenda with a 150-result query, excludes template records, classifies dates and renders only 25 rows. It does not provide equivalent query-error/truncation handling. Overview is intentionally workspace-wide; Today is intentionally active-project work. Their scopes should remain different even after classification is shared.

`actionModel()` treats only explicit `in_progress` and `in_review` as active. Overview project normalization currently defaults a missing status to `in_progress`, creating inconsistent semantics. Capture UI currently includes nonterminal projects, including backlog; do not accidentally change that existing explicit selection behavior while restricting automatic/contextual preselection.

`loadWorkflowData()` is not a pure read: it can delete/write native next-action references. The later render generation check only prevents stale DOM mounting, not those earlier writes. This matters for any new event-driven behavior.

`recentDone` means done tasks updated within seven days, not an exact completion log. Preserve that distinction.

## 4. Reference implementation findings

### 4.1 Property Auto-Initiator

[Implementation](https://github.com/parham-shafti/thymer-property-auto-initiator/blob/649134f6dd35aa4714d3c610017554a2037cbb71/plugin.js) · [Configuration](https://github.com/parham-shafti/thymer-property-auto-initiator/blob/649134f6dd35aa4714d3c610017554a2037cbb71/plugin.json) · [LICENSE](https://github.com/parham-shafti/thymer-property-auto-initiator/blob/649134f6dd35aa4714d3c610017554a2037cbb71/LICENSE)

Actual execution path:

1. `onLoad()` subscribes to `panel.navigated`, `panel.focused`, and `record.created`.
2. `_rememberFromPanel()` remembers an editor record and collection, with a 30-second age limit.
3. `_onRecordCreated()` ignores nonlocal creation, checks destination rules/blocklist, and resolves an ancestor.
4. `_applyWithRetry()` waits for records using bounded 50 ms retries, approximately one second total, then checks source/destination collections again.
5. `_withCollection()` resolves and caches collection handles.
6. `_applyWithCollections()` skips read-only/dynamic fields and populated target values. It matches fields by ID in the same collection, or by normalized label across collections, checks type compatibility, then copies typed values or links the ancestor itself.
7. `_copyValue()` handles scalar/multiple typed values and record collection filters.

State/UI: rules live in synced plugin configuration `custom.autoInit`, keyed by collection GUID, plus a blocklist. Settings use a cloned working model, collection/field selection, counts and Save. Saving configuration reloads the plugin. A migration imports old collection rules before cleaning old configuration.

Empty/ambiguous/error behavior: no rules/no ancestor means skip; populated values are preserved; unavailable records get bounded retries; collection/UI/save errors are logged or shown. Some field writes are not checked rigorously for returned failure.

Performance: collection cache and early rule checks avoid repeated work. It does not scan all record content for each creation.

Important weaknesses to avoid:

- `_resolveAncestor()` falls back to the first other editor record; despite comments, it does not prove focus.
- Ignoring non-editor navigation does not immediately clear remembered editor context.
- `_linkAllowedByCollection()` permits unknown source collection identity.
- `isLocal` does not distinguish a user creation from another plugin's local creation.
- It is record-property initialization, not native task context inheritance.

Useful patterns: recheck emptiness before writing, type/schema validation, source and destination exclusion, bounded retries. Do not adapt the broad event handler or configuration-migration machinery.

License: full MIT grant, copyright 2026 Parham Shafti. Substantial reuse requires retaining the notice and license. Independent implementation of the narrow patterns is simpler.

### 4.2 Kanban Dependencies

[Implementation](https://github.com/thymerapp/thymer-plugin-sdk/blob/6f25f1470ff1d7bd833a0494bc561c1c9152b93d/examples/collection-plugins/kanban-dependencies/kanban-dependencies-plugin.js) · [Configuration](https://github.com/thymerapp/thymer-plugin-sdk/blob/6f25f1470ff1d7bd833a0494bc561c1c9152b93d/examples/collection-plugins/kanban-dependencies/kanban-dependencies-plugin.json) · [SDK LICENSE](https://github.com/thymerapp/thymer-plugin-sdk/blob/6f25f1470ff1d7bd833a0494bc561c1c9152b93d/LICENSE)

This is a `CollectionPlugin`, not a global task dashboard. `afterRenderBoardCard()` schedules `refreshDepedencies()`. `_refreshDepedencies()` reads each card's single `depends-on` record field, looks up that record in the view context, then `_refreshDependency()` adds a DOM indicator when the blocker has `to-do` or `in-progress` status.

State: relationship/status are native synced record fields; only refresh timer state is in memory. UI: red border and textual `Depends on X`; it does not disable native work or enforce task readiness.

Missing data: absent/self/missing dependencies are skipped. The example does not handle longer cycles, unavailable blockers, or statuses beyond the two explicit unfinished values.

Performance/error limitations:

- A shared timer is cleared and replaced for each dependency, so individual refreshes can collapse to the last scheduled card.
- Clearing a dependency skips the card before old-indicator cleanup, which can leave stale UI.
- Dependency lookup is limited to the view context; a filtered-out blocker can disappear from consideration.
- There is no general dependency graph or robust failure presentation.

Useful pattern: a named explicit blocker and derived presentation. Do not import board hooks, a new record-based task model, or the timer implementation.

License: full MIT-style grant, copyright 2025 Stunf BV (Thymer Team); preserve notice for substantial reuse.

### 4.3 Query Builder

[Bundled implementation](https://github.com/akaready/thymer-query-builder/blob/68783cb96afa75ea67c04741e8725befc3e00490/plugin.js) · [Configuration](https://github.com/akaready/thymer-query-builder/blob/68783cb96afa75ea67c04741e8725befc3e00490/plugin.json) · [LICENSE](https://github.com/akaready/thymer-query-builder/blob/68783cb96afa75ea67c04741e8725befc3e00490/LICENSE)

The readable bundle includes `query.js`, rule-based `nl.js`, explanations, suggestions, `DataService`, builder UI, native target-field integration, settings and telemetry helpers. It is not an external AI query service.

Behavior:

- Builds condition trees and serializes Thymer query syntax.
- Reads collection fields/choices/users; harvests hashtag suggestions from a bounded recent-content search because no tag-list API is used.
- Shows editable chips, readable query explanation, alternative interpretations, counts and result previews.
- `readingsRow()` exposes ambiguity, but can automatically prefer an interpretation with results before the user selects one.
- `DataService` limits count requests to two concurrent operations, caches results, caps counts at 200, and formats capped results as `200+`.
- Result preview is debounced (220 ms) and sequence-guarded against stale results. Count errors remain distinct from zero matches.
- Focus/hotkey handlers expose a builder near native query fields. Query-block writes use identified block GUIDs; a surviving input and then clipboard are fallbacks.
- Explicit teardown removes listeners, commands and UI tracking.

State: query model and result caches are in memory; last query, drawer tab and dimensions use local browser storage scoped with workspace. Settings use synced configuration with a shared baseline and per-device slots, plus local cache/mirror and lifecycle flushes. A per-device settings slot in synced configuration is not device-local privacy.

Licensing: the actual license is custom non-commercial, not MIT. Personal/non-commercial use is allowed subject to notices; commercialization requires written permission. Do not copy its implementation into Freelance OS based on public source availability. Use independently written fixed presets and simple labels.

Privacy: the bundle loads GoatCounter script and emits install/daily-active telemetry unless Do Not Track or an opt-out blocks it. Query processing being local does not mean the entire plugin is network-silent. Do not import that machinery.

Useful patterns: explain active filters, show honest caps, distinguish errors/empty results, bound concurrent reads and reject stale results. Avoid its parser, large settings framework, native DOM interception, telemetry and arbitrary query authoring scope.

### 4.4 Weekly Journal

[Implementation](https://github.com/ed-nico/thymer-weekly-journal/blob/f79f0fef0f53f4419c6286e0ec5e7a17d71c8b1b/plugin.js) · [README/license declaration](https://github.com/ed-nico/thymer-weekly-journal/blob/f79f0fef0f53f4419c6286e0ec5e7a17d71c8b1b/README.md)

`onLoad()` registers a panel/sidebar/command. `renderWeeklyView()` generates seven-day or three-day columns. `getJournalsForDates()` finds a collection named exactly `Journals`, enumerates records and matches GUID date suffixes. `renderJournalContent()` builds a parent/children map and recursively renders properties and lines. Existing date headers open native records.

State: week offset and view mode are in memory. There is no weekly-review data model, priority carry-forward or persistent view preference. There are no data-event subscriptions; opening/navigating triggers rendering.

Empty/error behavior: no record gives `No entry`; an empty body gives `Empty entry`; individual content failures give `Error loading content`. Errors fetching the overall Journal list are not handled equivalently.

Weaknesses to avoid: hard-coded collection name; GUID suffix date inference; UTC conversion for local dates; `done === 8` instead of SDK task status; full collection reads; no stale-render generation guard; duplicating a general document renderer; non-button clickable date headers.

Useful pattern: put prior context beside the current decision and make absent history normal. Freelance OS needs a small prior-priorities comparison, not seven full document renderers.

License: README and source header declare MIT; no standalone LICENSE with full grant/copyright notice was present. Treat as a design reference and confirm terms/attribution before substantial copying.

### 4.5 Related Notes

[Implementation](https://github.com/ed-nico/thymer-related-notes/blob/5da8d06076c4d526e8a4985598f50ea5bbfbffb8/plugin.js) · [README/license declaration](https://github.com/ed-nico/thymer-related-notes/blob/5da8d06076c4d526e8a4985598f50ea5bbfbffb8/README.md)

`onLoad()` schedules an index after 1.5 seconds; opening the panel starts context polling (default two seconds). `_checkActiveRecord()` uses the active other panel, otherwise the first available other record. There are no incremental content-event index updates; the Rebuild action refreshes content.

`_rebuildIndex()` traverses all collections and records. `_extractContent()` reads lines and backlinks in parallel per record, then properties and title. The in-memory index contains token/reference/tag sets, TF-IDF vectors and cached norms. References are made symmetric. Raw token arrays are dropped after vector construction.

`_computeRelated()` combines content similarity (25%), title mention (30%), references (20%), tags (15%) and title similarity (10%), with threshold 0.05. It sorts and caps results. The panel displays percentages, relative bars, shared tags/refs and hover breakdowns. Clicking a result replaces another available panel or creates one.

Empty/error behavior: distinct messages exist for indexing, no source, no matches and source not indexed. Content extraction failures are silently tolerated; a top-level index traversal failure is not converted into an equally explicit error state. Missing data can therefore resemble weak similarity.

State/privacy/performance: index is memory-only; configuration sets result/poll limits; all accessible collections are processed locally. No external similarity API is used. Whole-workspace processing is unnecessary for Freelance OS. Tokenization is ASCII-oriented and stop words are English. Scores are ranking signals, not probability that a business relationship is correct.

Useful patterns: explicit reasons, no automatic linking, meaningful unavailable/empty states. Avoid global indexing, first-panel context guessing, hover-only reasons, non-button result cards, and arbitrary panel replacement.

License: README declares MIT; no standalone LICENSE was present. Confirm terms/attribution before substantial copying.

### Reuse recommendation

Implement these narrow patterns independently. MIT reuse is possible for Auto-Initiator and the SDK example with notices, but offers little benefit. Do not copy Query Builder under an assumption of permissive licensing. Do not introduce any required third-party plugin installation.

## 5. SDK feasibility and limitations

[SDK declarations](https://github.com/thymerapp/thymer-plugin-sdk/blob/6f25f1470ff1d7bd833a0494bc561c1c9152b93d/types.d.ts) · [Search reference](https://github.com/thymerapp/thymer-plugin-sdk/blob/6f25f1470ff1d7bd833a0494bc561c1c9152b93d/search-queries.md) · [SDK overview](https://github.com/thymerapp/thymer-plugin-sdk/blob/6f25f1470ff1d7bd833a0494bc561c1c9152b93d/README.md)

| Capability | Verified declaration / consequence |
| --- | --- |
| Event sources | `source.isLocal` identifies this client; it does not identify a human action or originating plugin |
| Async event ordering | SDK explicitly warns that awaited event handlers can resume after later events; capture synchronous IDs and serialize/revalidate mutations |
| Events | Line created/updated/moved/undeleted/deleted; record created/updated/moved; collection updates; panel focused/navigated/closed; handlers return IDs for `off()` |
| Move scope | Record/line move events bypass filters and carry destination scope; do not assume a scoped listener only gets changes inside its collection |
| Native task status | Single enum, including `none`, `important`, `waiting`, `done`, `canceled`; not independent boolean flags |
| Metadata | `setMetaProperty()` / `setMetaProperties()`; null deletes a key; unspecified keys are untouched; shared namespace requires namespaced keys and defensive parsing |
| Relationships | Collection record fields link records, not native task-line dependencies |
| Search | `searchByQuery(query,maxResults)`; no documented paging cursor or guaranteed total; a full result page may be truncated |
| Owned lines | `getLineItems(false)` excludes expanded reference/transclusion targets; default is expansion |
| Task lookup | There is no general `data.getLineItem(guid)` in the inspected declarations. Resolve known task sources with record + line GUID; event `getLineItem()` is asynchronous |
| Journal | `isJournalPlugin()`, `getJournalRecord(user,date)`, `getJournalDetails()`; pages materialize when first written |
| User identity | `getActiveUsers()[0]` is an existing convention, not a documented current-user lookup |
| Writes | Calls return booleans/promises; no documented multi-call transaction or cross-device compare-and-swap for this design |
| Local storage | `getLocalStorage` / `setLocalStorage` are absent from inspected `AppPlugin` typings; verify installed runtime before relying on them |
| Packaging | Plain installed code cannot retain module import/export syntax; current build handles the Plugin export and embeds source/CSS |

Do not label missing local-storage typings a proven runtime bug. Existing tests stub the setter and cannot resolve this uncertainty. First inspect capability, then verify an actual round trip/reload in an authorized test session.

Native task references already work in the current implementation. Namespaced metadata is feasible without collection-schema changes. Metadata sync, permission behavior, persistence adapters and multi-device behavior still require desktop checks.

## 6. Phase A: trustworthy foundations

### A1. Persistence adapter and state validation

Edit: `loadWorkflowState()`, `persistWorkflow()` in `src/workflow.js`. Add small adjacent helpers, not a settings framework.

Implementation steps:

1. Inspect runtime capability without calling render/load methods that may write data.
2. If current plugin storage methods exist and round-trip correctly, retain them as the existing primary storage path.
3. Otherwise use a small browser-storage adapter with a key containing workspace GUID and plugin GUID, for example `freelance-os/<workspace>/<plugin>/workflow-v1`.
4. Do not guess an undocumented legacy browser-storage key. Preserve any readable legacy state; record a migration only after the new write succeeds.
5. Validate nested maps and entry types; malformed one-field data must not discard unrelated valid fields.
6. Continue to read version-1 state. Add new optional fields with defaults. Do not wholesale replace saved state.
7. Preserve legacy data until persistence is verified. Do not put local drafts/reasons into synced plugin configuration as a fallback.
8. Show storage failure immediately and retain in-memory text. Do not claim a draft was saved.

Acceptance:

- Focus, mapping and review draft survive a real reload.
- Storage denial/quota/corrupt JSON does not crash rendering or erase good in-memory input.
- Workspace/plugin instances do not read each other's browser fallback state.
- Tests exercise the real adapter branches rather than stubbing every write as successful.

### A2. Shared task semantics and honest coverage

Edit: `src/index.js` helpers / `loadData()`; `src/workflow.js` ownership and `loadWorkflowData()` / `actionModel()`.

Add small pure helpers for terminal/waiting/actionable classification, template exclusion, project ownership, valid date extraction and search coverage. Avoid replacing the complete data layer.

Suggested ownership contract:

```js
resolveTaskProject(line, sourceRecord, projectIndex)
// => {
//   kind: 'owned' | 'referenced' | 'none' | 'ambiguous' | 'excluded',
//   projectGuid?: string,
//   candidateProjectGuids: string[]
// }
```

Rules, in order:

1. Reject a template source (including external template records with active-project refs).
2. A valid project-page ancestry determines ownership, even if the task incidentally references another project.
3. Otherwise resolve reference GUIDs through project ancestry and deduplicate distinct roots.
4. Exactly one eligible root means referenced association.
5. Several roots means ambiguous, never first-match selection.
6. Missing or cyclic ancestry is unresolved, not a guessed top-level project.
7. Journal remains a valid inbox and source of explicitly project-referenced tasks. Excluding Journal from contextual inheritance does not exclude such tasks from Today.

Coverage corrections:

- Check returned query errors as well as thrown errors.
- Treat a full query page as potentially truncated.
- Report partial counts as loaded results, not exact totals.
- Add continuation for the Overview's 25-row display cap using already loaded items; this is separate from search truncation.
- Preserve the workspace-wide Overview and active-project Today scopes.
- Normalize a missing project status as unknown rather than active. Make the user-visible state clear.
- Keep native waiting rows distinguishable in the general Overview agenda; only actionable selectors must exclude them.
- Check the Overview completion setter's returned boolean and recover the row on failure.
- Do not produce an unqualified caught-up state when a query is incomplete.

Keep the existing conservative `complete` protection for pointer pruning. Do not try to solve SDK search pagination by raising the cap indefinitely. A future finer-grained coverage model may distinguish complete owned project scans from incomplete external discovery, but that is not required to ship this phase.

Acceptance: cap/failure cannot erase pointers, fabricate gaps, report an exact global total or imply no work exists. Template tasks cannot re-enter Today through external refs. Duplicate titles are irrelevant to ownership.

### A3. Safe reconciliation, refresh and lifecycle

Edit: `loadWorkflowData()` / native reconciliation application; `Plugin.render()`, `onLoad()`, `onUnload()`, `scheduleRefresh()`; editor focus handling.

Implementation sequence:

1. Loader computes/returns the native reconciliation proposal without applying native writes.
2. A separate serialized application method runs only for a current-generation, complete snapshot.
3. Recheck generation/completeness before applying a proposal and revalidate affected tasks/projects before writing.
4. Make failures visible. Preserve last good state and allow retry.
5. Subscribe to relevant line moves/undeletes, record moves and collection configuration changes in addition to existing subscriptions.
6. Store event handler IDs; clean up explicit subscriptions/timers and new DOM listeners on unload.
7. If typing defers refresh, set a pending flag. Flush when the editor loses focus, including the waiting editor.
8. Keep refresh work coalesced. Do not cause repeated full scans from one input keystroke or metadata-write event storm.

The existing reconciliation helper mutates local state as well as producing write proposals. A stale generation must not mutate the live workflow state before the final generation check: compute against a cloned pointer-state object, or defer its state changes until the serialized apply step. Preserve unrelated live draft/focus edits rather than replacing the whole workflow object with an old snapshot.

Do not treat all native-read results as proof that a later write is safe. There is no cross-device transaction. Protect the windows this client controls and report the remaining concurrency limit honestly.

Acceptance: an older refresh cannot remove a next action selected during a newer operation. Failed native sync is visible. Unload/reload does not accumulate new handlers.

## 7. Phase B: waiting explanations and simple queue presets

### B1. Synced waiting details

User flow:

1. Open the existing task Edit controls.
2. Enter Waiting on and optional follow-up date.
3. Save; task becomes native waiting and explanation syncs.
4. The Waiting row shows reason/follow-up without opening Edit.
5. Ready to work explicitly restores the prior native status.

Persist a versioned JSON string in `line.props.freelance_os_waiting`:

```json
{
  "v": 1,
  "reason": "Client approval of homepage",
  "followup": "2026-10-28",
  "previousStatus": "important"
}
```

`followup` may be empty. Validate it with the existing date validation. Validate `previousStatus` against supported resumable SDK statuses; invalid/missing/terminal/waiting values fall back to `none`.

Suggested helper boundaries:

```js
readWaitingDetails(line, localFallback)
// => { details, source: 'native' | 'local' | 'none' | 'invalid' }

saveWaitingDetails(task, details)
// validates, writes metadata, checks success; does not silently reset status
```

Exact integrations:

- `loadWorkflowData()`: normalize waiting details on task models.
- `actionModel()`: follow-up sorting and attention read normalized details.
- `renderActionRow()`: existing editor/save/resume controls; inline reason and local-only cue.
- `renderProjectAttention()`: waiting and follow-up cues.
- `weeklyReviewText()`: summary reasons/follow-ups.
- `setActionStatus()`: retain `blocked` to SDK `waiting` translation boundary.
- Settings/docs: update persistence explanation.

Authority and migration:

1. Valid native metadata is authoritative, including an explicitly empty native reason/date.
2. Existing local notes remain fallback and show Only on this device.
3. Migrate local notes only when the user explicitly saves that waiting entry. Do not silently publish private legacy notes on load.
4. Keep legacy local data until successful native persistence; retaining it as a backup is acceptable.
5. Waiting follow-ups apply only while the task's native status is waiting.
6. Completion does not trigger metadata deletion.

Save ordering and errors:

1. Capture form values; validate.
2. Save/check metadata.
3. Save/check native waiting status.
4. Reload authoritative state and report success only if both succeeded.
5. If one succeeded, describe the partial result and offer retry. Do not overwrite a newer remote state to simulate rollback.

On resume, set/check the validated previous status. Details can remain stored but inactive because status is no longer waiting. A future waiting transition records the task's new current status as its previous status.

If metadata API is unavailable, retain the existing local-only flow with an explicit cue; do not pretend it synced. Waiting without details displays Waiting - add a reason. Malformed details do not make waiting work actionable.

Acceptance: Important -> Waiting -> Important round trip; native details on a second client; no silent legacy-note upload; native waiting remains recognized when metadata is missing or corrupt; repeated saves create no new lines.

### B2. Fixed presets with scoped counts

Edit: `filterActions()` and the Today branch of `renderWorkflow()`; CSS near `.os-queue-controls` / `.os-action-tabs`.

Keep existing queues. Add only these preset families:

| Queue | Presets |
| --- | --- |
| All actions | Any; Due/overdue; Important; No date |
| Waiting | Any; Follow-up due; No follow-up |
| Next actions | Existing list, project/search scope; no new preset family initially |
| Needs attention | Existing project checks, project/search scope |

Suggested pure selector:

```js
selectQueueItems(model, {
  queue, preset, query, projectGuid, today
})
// => { items, count, complete, unit: 'tasks' | 'projects' }
```

Calculation order:

1. Start from the appropriate model collection.
2. Apply project scope and normalized text search.
3. Apply the queue-compatible preset.
4. Compute count before the display limit.
5. Render the first `queueLimit` items and Show more using that count.

Queue-tab counts use current project/search scope. Preset counts additionally evaluate each preset against that scoped queue. Needs attention counts projects, not tasks. Its search may inspect the project's name, issues and relevant task text, including waiting cues; do not silently treat project rows as task rows.

Definitions:

- Due/overdue: valid current task date <= local today.
- Important: native `important` status on actionable tasks.
- No date: no valid task date.
- Follow-up due: native waiting plus valid follow-up <= today.
- No follow-up: native waiting without a valid follow-up.

Use the existing task-date convention. Journal scheduling is a different concept; do not use scheduling dates as task due dates.

Interaction rules:

- Keep zero-count presets visible/selectable.
- Incompatible preset resets to Any on queue switch.
- Reset the 20-row display limit on scope/preset changes.
- Preserve existing default queue selection.
- Keep filter preferences in instance memory initially, not synced config.
- Show active criteria in plain language and provide Clear filters.
- Clear filters clears search/project/preset; it need not change the selected queue.
- For incomplete data, use wording such as 12 loaded - more may exist, not an exact global count.
- No extra search API call per tab, preset or task row.

Accessibility: real buttons, `aria-pressed`, labelled search/select, visible focus and a polite result-status region. Selection must be recognizable without color.

Acceptance: all intersections produce matching counts/items; waiting never appears in actionable presets; pagination does not affect counts; zero/error/partial states are distinct.

## 8. Phase C: weekly review continuity

Split this phase into C1 discovery/persistence and C2 comparison/carry-forward. Do not try to change Journal identity, task linkage and the review UI in one untested edit.

### C1. Discover saved reviews without local cache

Problem: `workflowState.reviews[week]` is device-local. Without it, current Save starts from today's Journal record and can create a second review for the same week.

Persist a versioned snapshot on the existing review heading as a JSON string at `freelance_os_review`:

```json
{
  "v": 1,
  "week": "2026-10-19",
  "userGuid": "USER_GUID",
  "state": "saved",
  "savedAt": "ISO_TIMESTAMP",
  "notes": "Wins and observations",
  "priorityItems": [
    {
      "id": "priority-stable-id",
      "text": "Deliver proposal",
      "taskGuid": "TASK_GUID",
      "recordGuid": "TASK_SOURCE_RECORD_GUID",
      "projectGuid": "PROJECT_GUID",
      "carriedFrom": {
        "week": "2026-10-12",
        "priorityId": "ORIGIN_PRIORITY_ID"
      }
    }
  ]
}
```

Task/project/carry fields are optional. This is a saved review snapshot, not another task record or collection. Native visible summary lines and refs remain readable/editable. Treat snapshot text as the state last saved by Freelance OS, not as a guaranteed live parse of subsequent manual Journal prose edits; show its saved timestamp.

Add `findWeeklyReview(journal,user,week)` returning one of:

```js
{ kind: 'none' }
{ kind: 'one', reference, snapshot, legacy: false }
{ kind: 'multiple', candidates }
{ kind: 'incomplete', candidates, error }
```

Discovery algorithm:

1. Validate a local cached reference first: Journal, user, week, heading and expected structure must match.
2. Resolve the user's seven Journal dates for the requested week via `getJournalRecord(user, DateTime...)`.
3. Read owned lines with `getLineItems(false)`, bounded and cached per discovery.
4. Match valid namespaced review metadata for that exact week/user.
5. Match legacy sections only by exact existing heading plus expected generated review body, not a loose title substring.
6. If any necessary read failed, return incomplete rather than none.
7. Several matching sections are multiple, not an automatic winner.

Do not enumerate all Journal content or infer Journal dates from GUID suffixes.

Save behavior:

- Update a unique discovered review, even if it is on another day in the week.
- On incomplete discovery, retain the draft and retry; do not create a likely duplicate.
- On multiple matches, show dates/links and require explicit selection of the section to update; do not delete or merge sections automatically.
- Before creating, perform a final fresh check of the intended date/heading.
- New reviews use an explicit target date derived from the review operation's local `today` argument, not an unrelated `new Date()` inside a helper. This also makes tests with a controlled date meaningful.
- Keep a valid legacy cached location usable even if an older implementation/test placed the labelled review outside its nominal week; do not lose known saved content while introducing bounded week discovery.
- Mark a new heading pending before body construction. Retry locates and repairs that pending section.
- Write the final `state: saved` snapshot after all visible body writes succeed. Only then update local saved-reference/success cues.
- On failure, keep draft text and the discoverable pending/reference identity. Do not create a new heading on every retry.
- There is no cross-device atomic create-if-absent. Detect later duplicates and expose them; do not claim impossible uniqueness guarantees.

Journal ownership: single-user workspace uses its only active user. For multiple active users, require an explicit selected Journal owner and persist that preference locally. Do not assume `[0]` means current user. Validate cached references against that owner. Update existing capture/Journal-opening helpers only as needed to keep owner use consistent; do not introduce a general user-management subsystem.

Legacy read behavior:

- Recover visible priorities from the known generated section only when metadata is absent.
- Preserve native task-reference GUIDs and source-line identity when recoverable.
- Give legacy plain-text items stable provenance based on their saved source line rather than text alone.
- Missing/ambiguous section structure is an unavailable legacy review with an Open Journal action; never guess associations from matching titles.
- Upgrading metadata happens on an explicit save, not passive discovery.

### C2. Compare prior priorities and carry deliberately

Add a compact Previous priorities block to Plan next week. Reuse current review form/bridge; do not build seven Journal columns.

Source precedence:

1. Previous week's saved Journal snapshot.
2. Previous week's local draft, labelled unsaved and local.
3. Empty state; optionally inspect the last available review only through an explicit action, with its actual week shown.

Do not silently substitute a review from several weeks ago and label it last week.

Display/action rules:

| Observed state | Behavior |
| --- | --- |
| Open linked task | Carry forward, retaining the same task |
| Waiting linked task | Carry forward; remains waiting |
| Done linked task | Show completed; no default carry action |
| Canceled task | Show canceled separately from completed |
| Unresolved linked task | Show unavailable; explicit text-only carry allowed |
| Plain priority | Carry forward as text |

Carry algorithm:

1. Source identity is `(source week, source priority ID)`; do not deduplicate by text.
2. If current draft already has that `carriedFrom`, focus/show its entry and do not append again.
3. Otherwise allocate a new current-week ID and copy text plus `carriedFrom`.
4. Retain resolvable task/source/project identifiers.
5. Persist the local draft and update the existing priority bridge.
6. Do not create a task, reschedule, resume waiting, set next, or pin focus.

Critical task-marker integration:

Current `freelance_os_review_priority` is singular and represents origin/recovery. `linkReviewPriorityTask()` currently rejects a marker for another weekly priority, while `saveReviewToJournal()` writes a marker when saving linked priorities. Naively carrying a task across weeks will overwrite history or fail linking.

Required changes:

- Saved review snapshots are the authority for that week's task relationships.
- Keep the legacy task marker for origin recovery and task-creation idempotence.
- `reviewPriorityTask()` resolves an explicit task/source GUID first; if that reference is missing, return unavailable rather than matching a different task by title.
- Resolve explicitly linked historical tasks from their known source record if they are absent from the active-project model. Inactive-project work must not be mistaken for a deleted task.
- Permit the same native task in different weeks; reject accidental duplicate association within one week's current priorities.
- Stop saving a later review from overwriting a task's original origin marker.
- Keep `addReviewPriorityTask()` idempotent through the new priority's stable origin identity.
- Treat changing a link as a current-week action; do not rewrite prior saved snapshots.
- Add tests around existing `reconcileReviewPriorityItems()` behavior when wording, ordering, insertion and deletion change. Stable carry provenance must not be reassigned by a text-only deduplication shortcut.

Exact integration points:

- `reviewPriorityTask()` and `hydrateReviewPriorityLinks()`.
- `linkReviewPriorityTask()` / `addReviewPriorityTask()`.
- `getReviewRecord()` / `saveReviewToJournal()`.
- Review branch of `renderWorkflow()`.
- `renderReviewPriorityBridge()` and `weeklyReviewText()`.

Acceptance: three weeks of carrying one unfinished task yield three review associations and exactly one native task. Original task identity/origin and earlier saved reviews remain intact. Repeated carry clicks do not duplicate entries. Missing history is a calm empty state.

## 9. Phase D: explicit contextual capture

Recommendation: add Capture task for this project to the command palette. Do not implement workspace-wide auto-inheritance.

This fills the native-project-page gap while reusing dashboard capture. Native tasks have no collection-level Client field to inherit; their client context is derived through their project.

Implementation sequence:

1. Register the command in `onLoad()` using `onSelected`.
2. In its handler, snapshot the active panel and record before opening/navigating the dashboard.
3. Require an actual native record editor. Do not scan other panels for a convenient record.
4. Resolve the record through configured Projects and `projectRoot()`.
5. Exclude Journal, templates, overview/custom contexts, orphan/cyclic nesting and unknown mappings.
6. Only explicitly active projects qualify for contextual preselection.
7. Open Freelance OS and reuse its capture form.
8. Show project and linked client names as destination context; do not write redundant client refs to the task.
9. Revalidate destination collection membership/template/status inside `captureTask()` immediately before creation.

Explicit destination state:

```js
{ projectGuid: '', source: 'default' | 'context' | 'user' }
```

An empty GUID with source user means deliberately chosen Journal inbox. It must not be overwritten by contextual preselection. Preserve nonempty drafts and user-selected destinations; if applying context would replace either, keep the existing state and explain it briefly. Context should be applied once for that command invocation, not continuously while panels change.

For ordinary explicit destination selection, preserve current nonterminal-project behavior unless separately changed. A backlog project can remain a deliberate capture destination; it must not be treated as active or auto-selected by context. Revalidation should distinguish an explicitly chosen supported backlog destination from a project that became terminal/deleted.

Use a dedicated handler near `applyProjectTemplateToActiveRecord()`, and reuse `captureTask()` and existing focus/feedback UI. No `record.created` or `lineitem.created` mutation handler is needed.

Acceptance: two open projects cannot cause first-panel guessing; current nested page resolves correctly; explicit Journal choice and draft survive; project closure/deletion before Save produces an actionable error without losing text.

## 10. Phase E: optional relationship suggestions

Evaluate need after A-D. Do not build a general Related Notes panel or whole-workspace index.

Proposed flow: Choose a project on an unassociated inbox task. Candidate sources:

- Task is on a real Clients record: that client's active projects.
- Task contains an explicit Clients-record reference: that client's active projects.
- Task already has a unique project relationship: show that relationship, not another suggestion.

Every suggestion includes its evidence, for example: Website refresh - linked to the client referenced in this task. Avoid percentage confidence and title-similarity matching in the first version. Several same-client projects are options for the user, not an excuse to auto-select one.

Actions:

- Open project uses the existing side-panel navigation.
- Link project explicitly appends a native project ref while preserving all existing segments.
- Dismissal may remain session-local.

Before writing, reload/reclassify the task. If it now has one project, show it. If it has several project roots, explain ambiguity and open the native task for correction; appending another ref would worsen it. Never move the task or alter any project's Client property.

Integration: Phase A ownership resolver, `getClientGuid()`, Overview agenda row, `openItem()`, `openRecord()`. Read only needed Clients/Projects records and the selected source, not arbitrary collection bodies.

Acceptance: no mutation before explicit Link project; duplicate titles remain distinct by GUID; concurrent new association is detected before append where possible; task formatting and dates remain; missing permissions/error/no candidates have distinct states.

## 11. Deferred dependency extension

Synced waiting explanations are the immediate dependency improvement. A full task graph is not justified by the Kanban example or current workflows.

If later authorized, the smallest useful structured extension is one optional prerequisite task inside waiting metadata:

```json
{
  "blocker": {
    "recordGuid": "BLOCKER_SOURCE_RECORD",
    "taskGuid": "BLOCKER_TASK"
  }
}
```

Rules for that separate feature:

- Start with a picker over already loaded native project tasks.
- Resolve identifiers through source record + task GUID, not titles.
- Reject self-dependencies and known cycles.
- Incompletely checked/unresolved chains are unknown; never infer readiness.
- Display Waiting for Task title and an Open blocker action.
- On blocker completion, show Prerequisite complete - review and resume.
- Keep resumption explicit. No automatic native-status changes, new next-action selection, focus restoration or schedule changes.
- Canceled, missing, deleted or inaccessible blockers do not count as successfully completed.
- Do not add multiple blockers, graph editing, scheduling rules or new collections to this extension.

Do not implement this automatically as part of B. First determine whether a human waiting reason already solves the user's actual dependency workflow.

## 12. Cross-cutting quality requirements

### Privacy

- No telemetry, external similarity calls, LLM calls or copied analytics infrastructure.
- Native waiting metadata and saved review snapshots sync as workspace data; explain that other authorized users/plugins can read them.
- Legacy local waiting notes are not silently uploaded.
- Unsaved review drafts and focus stay local; per-device settings inside synced config would not satisfy that boundary.
- Keep real workspace content/screenshots out of Git. Use fictional fixtures for shareable artifacts.

### Performance and correctness

- Count from loaded arrays rather than issuing one query per preset.
- Reuse in-flight reads; bounded concurrency for document reads.
- Avoid indefinite polling and whole-workspace TF-IDF indexing.
- Invalidate caches on relevant updates/moves/deletes/configuration changes.
- Use `getLineItems(false)` when inspecting owned content.
- Protect asynchronous reads against stale generation; protect writes separately.
- Re-read before task segment changes. No SDK atomic compare-and-swap exists, so do not promise complete concurrent-edit immunity.
- An unavailable item is not deleted; an incomplete list is not empty; a canceled blocker is not completed.
- Preserve the recent-done last-modified caveat.

### Accessibility and layout

- Use real buttons for every new action; labels for inputs; visible focus.
- Filter selection uses text/shape plus `aria-pressed`, not color alone.
- Reasons are visible/expandable by keyboard, not hover-only tooltips.
- Announce saves/errors/result counts politely without interrupting typing.
- Preserve text selection, focus and open editor state during refresh.
- Extend `.os-*` source CSS and current theme variables.
- Use `.os-app` container queries; verify narrow split panels, long names and zoom.
- Do not change desktop window bounds or synthetic viewport settings.
- Existing modal focus trapping/return behavior is the pattern for any genuinely necessary dialog; avoid adding dialogs for simple presets.

### Failure handling

- Check both rejected promises and returned false values.
- Preserve entered text and selected values after failure.
- Do not silently swallow native-sync failures.
- Make partial multi-call success visible and retry idempotent.
- Malformed new metadata should disable only the affected enhancement, not the native task or whole dashboard.
- Missing mappings/owner/permissions/API capability produces a useful specific state, not an invented empty workspace.

## 13. Tests and live verification

Do not run the live scripts under a planning-only instruction. They create tasks/reviews/records, may reload the plugin and restore state. The checks below are for a later implementation session with appropriate authorization and an explicit test workspace.

### Existing test structure

Extend `test/workflow.test.mjs` for pure selector/state/model tests and workflow operations. It loads source with a VM and exposes helpers through an explicit returned object; add new helpers there rather than assuming ES module exports.

Extend `test/projects.test.mjs` for capture/project validation and template boundaries. Preserve `test/starter.test.mjs`, `test/finance.test.mjs` and `test/collection-views.test.mjs` as regression coverage. No new collection schema is expected.

### Automated acceptance matrix

| Phase | Required cases |
| --- | --- |
| A1 | Supported legacy storage; browser fallback; denied/quota storage; malformed JSON/nested maps; actual adapter branches; legacy preservation; workspace/plugin isolation |
| A2 | Template task with project ref; nested/cyclic/orphan ancestry; duplicate titles; several refs to one root; refs to several roots; owned project plus incidental ref; unknown status; query error/full cap; 25-row continuation; returned-false completion |
| A3 | Incomplete scans retain pointers; stale generation cannot mutate live pointer state/native refs; newer user draft survives reconciliation; failed native writes visible; move/undelete invalidation; unload cleanup; deferred refresh after editor blur |
| B1 | Native details beat local fallback; empty native values are authoritative; explicit migration only; invalid date/status/JSON; metadata success + status failure and reverse capability failure; Important round trip; missing details; follow-up boundaries |
| B2 | Queue/project/text/preset intersections; count before pagination; project vs task units; zero-result selection; queue-switch preset reset; Clear filters; incomplete labels; waiting excluded from actions; local calendar boundaries |
| C1 | Empty local cache discovers existing review; save on another day updates same heading; owner mismatch; pending retry; duplicate matches; one failed read; legacy section; no broad Journal scan; final snapshot after body success; explicit target date |
| C2 | Three-week carry creates no extra task; double-click carry idempotent; same wording/different IDs; edits/reorder/insertion/deletion; waiting/done/canceled/missing/inactive-project tasks; text-only fallback explicit; original marker untouched; older review remains intact |
| D | Active project/subpage; two panels; Journal/template/custom/overview exclusion; stale mapping; explicit inbox and existing draft preserved; deliberately selected backlog; project becomes terminal/deleted before Save; missing destination |
| E | Exact reason provenance; duplicate titles; no action before click; already-linked and ambiguous refs; preservation of rich segments/date; re-read before append; no candidates/read/write failures |

Use a controlled local date/clock in calendar tests. Cover Monday/year rollover and Europe/Paris DST behavior; do not substitute UTC `toISOString().slice(0,10)` for local calendar keys. The existing task rescheduler must continue preserving formatting, refs and additional date segments.

Later authorized unit command:

```powershell
node --test test/workflow.test.mjs test/projects.test.mjs test/starter.test.mjs test/finance.test.mjs test/collection-views.test.mjs
```

### Desktop checks

Extend existing live checks, not an unrelated automation framework:

1. Confirm intended workspace explicitly; use fictional or isolated fixtures.
2. Verify persistence through actual plugin reload, not just current in-memory state.
3. Verify waiting details on a second client/device; local fallback labels before migration.
4. Discover/update a review with local review cache absent. Do not erase real workflow storage to simulate this; use a test state/client.
5. Carry a waiting/open task through multiple weeks; count native tasks and review sections.
6. Edit native task/project data outside the dashboard and from another client; verify refresh/classification.
7. Keyboard-only capture/filter/wait/carry/link flows, focus restoration and status announcements.
8. Light and dark themes; one, two and three panels; long task/client/project names; zoom.
9. Empty collections, missing mappings, multiple users, denied writes and failed/capped searches.
10. Repeated clicks/retries yield no duplicate tasks or generated review sections.
11. No new telemetry or background external requests.
12. Restore only test-owned fixtures/state/panels; do not remove another user's content.

When connecting Puppeteer, use `defaultViewport: null`, immediately clear device metric overrides, and never call `setViewport()` or change window bounds. Open native side panels to test narrow layouts. Navigate records with `edit_panel` and collections with `overview`; do not send a collection GUID to a record editor.

Existing live scripts are useful patterns but not proof of safe execution in an arbitrary workspace. In particular, normal workflow loading currently reconciles/writes next actions; a purported read-only render can mutate workspace data.

## 14. Risk register and dependencies

| Risk | Mitigation / release gate |
| --- | --- |
| Local storage methods unavailable | Capability check and real persistence round trip before relying on them |
| Existing CSS overwritten by build | Preserve initial files; understand and intentionally reconcile differences before generated output writes |
| Incomplete scans invent readiness/gaps | Explicit coverage; conservative pointer cleanup; unknown states |
| Stale load mutates next actions | Separate read/proposal/apply; clone pointer state; serialize and revalidate |
| Waiting metadata/status partial save | Check each write, surface partial result and retry without overwriting newer remote state |
| Legacy private waiting notes become shared | Explicit user save migrates one entry; no background upload |
| Multi-device duplicate reviews | Discover before create; pending identity; duplicates surfaced, never auto-deleted; no atomicity claim |
| Wrong Journal user | Explicit owner in multi-user workspaces; reference/snapshot owner validation |
| Weekly marker overwritten during carry | Review snapshots own historical associations; preserve task origin marker |
| Title similarity links wrong client/project | GUID relationships and visible evidence; explicit linking only |
| License incompatibility | Independent implementation; preserve confirmed MIT notices if any code is later reused |
| Scope growth | Ship A/B first; separate C1/C2; D narrow command; E/dependency graph remain optional |
| Test contamination | Explicit isolated workspace, fixture ownership and restoration; no mutation tests in planning pass |

No new runtime package, collection or third-party plugin is required. The inspected SDK is beta and API compatibility must be verified on the installed desktop.

## 15. Implementation execution checklist

When a later instruction authorizes implementation:

1. Read this document and applicable repository/skill instructions. User scope overrides any generic skill loop suggesting automatic build/deploy/commit/push.
2. Run Git status and compare with the recorded baseline. Preserve unrelated changes.
3. Find functions by name, not only the line numbers in this document.
4. Start with the assigned phase; if the instruction is broad, begin A1 then A2/A3 before adding feature UI.
5. Make one coherent change at a time: helper + meaningful tests, integration, UI, failure states, documentation.
6. Keep source edits in the three existing source files where appropriate. Do not rewrite the dashboard or add a general framework.
7. Update `docs/usage.md` and Settings persistence wording with shipped behavior. Do not describe deferred features as implemented.
8. Run the relevant unit tests and necessary regressions. Build/live-test only when within the later authorization.
9. Verify phase acceptance criteria, including failures and actual persistence. A happy-path screenshot alone is insufficient.
10. Report changed functions/files, verification performed, unresolved assumptions and the next phase. Keep each phase independently reviewable.
11. Do not infer authorization to deploy, commit or push from this planning document.

### Phase completion records

Status after the 24 October 2026 A/B/C1 implementation session:

- [x] A1: persistence verified through the installed local-storage methods; validation, failure visibility and browser fallback covered; real reload retained a review draft.
- [x] A2: shared ownership/status/date helpers; templates excluded through source records; ambiguous roots omitted with a visible count; Overview status and partial-coverage corrections.
- [x] A3: loader returns a proposal without native writes; serialized, generation- and mutation-guarded application; pointer-only local commit; subscriptions and deferred refresh cleanup.
- [x] B1: synced waiting metadata with explicit legacy-note migration, local-only cue, partial-save messages and previous-status resume.
- [x] B2: fixed All actions/Waiting presets, scoped tab and preset counts, plain-language criteria, honest coverage and pagination.
- [x] C1: seven-day review discovery, versioned heading snapshots, pending retry, duplicate selection and explicit Journal ownership.
- [x] C2: prior-week comparison, explicit carry-forward, preserved task origin markers and three-week associations.
- [x] D: explicit native-project capture command with one-shot destination context and revalidation.
- [x] E: evidence-backed project suggestions for unassociated inbox tasks, explicit append only.
- [ ] Deferred dependency extension: separate decision; not included in B. No structured blocker field was added.

## 16. Final recommendation

Ship A and B first: reliable data/persistence and visible waiting explanations improve daily work with limited UI growth. Then implement C1/C2 to connect weekly intention with existing native tasks. D is a useful small follow-on for native project pages. Reassess E after those changes; current native relationships may already provide sufficient context.

Do not start with a full dependency graph, natural-language query builder or whole-workspace similarity index. The source investigation shows that these would add substantial machinery while duplicating existing Freelance OS capabilities or relying on ambiguous context.
