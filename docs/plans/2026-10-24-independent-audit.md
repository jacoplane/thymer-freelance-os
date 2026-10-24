# Freelance OS independent implementation audit

Date: 24 October 2026  
Repository: `C:\dev\thymer-freelance-os`  
Base: `4ad9e29016610b3c51ed989086064a28862b9c2c`, branch `main`  
Scope: implemented phases A-E; structured task blockers remain intentionally deferred.

## Release follow-up

All five findings were addressed and the fresh-save, regression and production checks passed for 1.4.0. See [the release verification record](2026-10-24-release-1.4.0.md) for fixes, evidence and remaining limits. The findings and verdict below describe the original audited state.

## Verdict

**Pass with findings. The working tree is not ready to ship.**

The implementation substantially delivers A-E and passes all 99 unit tests. Generated output is reproducible, and the existing test deployment matches the local bundle byte-for-byte. The live workflow regression passed on a second run, after an initial Journal-save failure was investigated and its pending section recovered/removed.

There are five actionable findings: **three P1 and two P2**. Correct these, add the missing regression cases, and repeat live verification before shipping. No application fixes, deployment, commit, push, reset, restore, or revert were performed during this audit.

The only repository changes made by the auditor are this report and the user-requested `/.pi/` ignore rule in `.gitignore`. `.pi/` is untracked, unstaged and ignored. No files were staged.

## Findings

### F1 — P1: reconciliation can delete a newer next-action reference after an awaited read

**Location:** `src/workflow.js`, `applyNativeReconciliation()`, lines 823-834; related write path at 838-852.

The generation and mutation checks run once at job entry. The job then awaits record reads and writes without checking them again. For removal, it re-reads the line but only verifies that it still has the generic `project-next-v1` marker. A newer valid choice can reuse the same marker GUID, so this is insufficient validation.

**Executed reproduction:** run the source in a VM with a controllable `getLineItems()` promise. Queue removal of marker M referring to an old completed task. While the read is suspended, increment render and mutation versions and replace M's segments with a reference to a new actionable task. Resume the read.

Observed output:

```json
{
  "case": "stale-reconciliation-after-await",
  "result": true,
  "validReplacementDeleted": true,
  "generationChangedWhileReading": true,
  "mutationChangedWhileReading": true
}
```

**Impact:** a stale reconciliation can delete or replace a more recent native next-action choice. Serialization of dashboard button operations does not protect edits arriving from another client or the native editor, nor does an entry-only guard protect later asynchronous boundaries.

**Recommended action:** recheck generation/mutation immediately before every mutation after asynchronous reads; abort stale jobs. Before removing a marker, compare its current reference/content against the proposal and recompute whether removal remains valid. Revalidate the referenced task and project as necessary. Apply equivalent protection to writes/pruning. Do not claim cross-device atomicity that the SDK cannot provide.

**Required regression:** suspend a read, change the current marker and versions, then resume; the replacement marker must survive and the stale job must report rejection.

### F2 — P1: a disappearing capture option silently redirects a task to Journal

**Location:** `src/index.js`, capture form inside `render()`: options at line 1609, selected value at 1630, Save submission at 1653. Destination validation in `captureTask()` starts at 1019.

When a selected project becomes closed, disappears, or is absent from the loaded project list, its option is removed. Assigning the old project GUID to the select results in `select.value === ''`. The Save handler submits that empty value, which means Journal inbox. The stricter validation in `captureTask()` never receives the original project GUID.

**Executed reproduction:** instantiate a separate audit object using the real plugin prototype and render its actual capture form into a detached DOM container. Preserve `captureProjectGuid = 'closed-project'`, `captureDestinationSource = 'user'`, and a draft; render with no matching project option. Replace only the audit object's capture sink with an argument recorder, then activate Save.

Observed output:

```json
{
  "case": "capture-destination-disappears",
  "userSelectedProject": "closed-project",
  "selectValue": "",
  "captureCalledWith": ""
}
```

No native task was created by this reproduction.

**Impact:** a user-selected or contextual project task can be saved to the wrong page, contradicting the documented closed/deleted-destination error behavior.

**Recommended action:** preserve the intended destination independently of option availability. Represent an unavailable selected destination explicitly, disable Save or submit that intended GUID to validation, and retain the draft. Only an actual user choice of Journal may change the intended destination to empty. Never infer a destination change from a select that lost its option.

**Required regression:** select a project, keep a draft, close/delete/unmap the project, rerender, then Save. Journal must not receive a task, and the draft must remain.

### F3 — P1: live regression cleanup can delete an existing review and has no target guard

**Location:** `test/live-workflow.mjs`: setup at lines 17-42; current-week Save/registration at 263-272; cleanup at 352-359.

The runner uses the currently exposed `window.__freelanceOs` without asserting workspace/plugin identity. It saves to the current week, stores whichever review reference Save returns, and later deletes that heading and all descendants. C1 deliberately discovers and updates an existing review even without a local cache. Therefore, running this test when a real current-week review exists can overwrite and then delete pre-existing data. The runner also selects work from an existing active project rather than creating its own project.

There is a second, observed cleanup gap: the reference is registered only after successful save. If saving creates a pending heading and then fails, the pending section is not in `reviews` and cleanup leaves it behind.

**Observed evidence:** the first live run timed out at line 266. The UI reported `Review summary could not be saved`. Discovery found a new pending heading `1H9TZFWRAXRKWNAPVCNSBH7CHY` after the runner's cleanup. The auditor verified that no review existed before the run, retried that exact pending section successfully, and removed its 11 generated lines. Discovery then returned `none`.

This audit ran the regression only after external identity checks and collision checks for existing reviews/task titles, and restored an additional outer baseline. Do not assume the runner itself provides these protections.

**Impact:** the advertised verification command is unsafe on production and on a test workspace containing unrelated review work. Partial failures can leak fixtures.

**Recommended action:** add an in-script workspace/plugin allowlist check before any render or mutation; create isolated test-owned project/task/review fixtures; register fixture identity immediately after creation, including pending headings; clean up only newly created GUIDs proven to belong to the run. Avoid using an existing current-week section as a disposable fixture. Do not restore native data by title guesses.

**Required regressions:** wrong identity aborts before any write; an existing review survives unchanged; a body-write failure leaves no fixture section; task/record creation failure still cleans already created fixtures.

### F4 — P2: state normalization discards carry-forward provenance

**Location:** `src/workflow.js`, `normalizeWorkflowState()`, lines 113-118. Related consumers: `carryPreviousPriority()` at 1446 and `renderPreviousPriorities()` at 1949.

Persisted priority items retain only `id`, `text`, `taskGuid`, `recordGuid` and `projectGuid`. `carriedFrom` is dropped when local state is loaded.

**Executed reproduction:** use the real source's storage methods with a string-backed test adapter. Persist a plain carried priority, clear the in-memory state, reload it, and attempt to carry the same source identity again.

Observed output:

```json
{
  "case": "carry-reload",
  "beforeOrigin": {"week":"2026-10-12","priorityId":"origin"},
  "afterReloadOrigin": null,
  "entriesAfterCarryAgain": 2
}
```

**Impact:** the Already carried cue and source identity disappear after reload. Plain priorities can be duplicated. Linked tasks retain the separate task-GUID duplicate protection, but their provenance is still lost and a later save can omit it from the snapshot.

**Recommended action:** validate and preserve `carriedFrom.week` and `carriedFrom.priorityId` during normalization. Keep valid unrelated fields when a malformed carry field is rejected.

**Required regression:** carry -> persist -> actual state reload -> carry again must leave one entry and the original provenance. Include both plain and task-linked priorities.

### F5 — P2: a failed waiting-note save discards typed editor values

**Location:** `src/workflow.js`, `renderActionRow()` at 1521-1522 and 1547-1550; `workflowAction()` catch/render at 1478.

Waiting reason/date values exist only in the rendered inputs until saving succeeds. If native metadata persistence fails, `workflowAction()` rerenders from the old stored details. The typed reason and follow-up disappear even though failure messaging invites retry.

**Executed reproduction:** render the real action-row component on a separate audit object in the browser, type a reason/date, make that object's metadata setter return false, and use the actual Save handler and catch/rerender path.

Observed output:

```json
{
  "waitingFailure": {
    "error":"The waiting note could not be saved. The task status was not changed.",
    "newReason":"",
    "newFollowup":""
  }
}
```

This reproduction used mocked task setters and did not change workspace data.

**Impact:** the user must retype waiting details after an API failure; retry is not meaningfully recoverable. Other changes can similarly rerender an unsaved waiting editor.

**Recommended action:** retain per-task editor drafts until successful save/cancel, or preserve failed form values without rebuilding the editor. Keep local-only draft preservation separate from publishing native metadata.

**Required regression:** metadata failure retains both inputs, native task state remains unchanged, and a subsequent successful retry saves the retained values once.

## Verification actually performed

### Source and documentation

- Read implementation-status handoff and source-analysis handover, repository runbook, README and usage guide.
- Inspected the working-tree changes against `4ad9e29`, including workflow, capture/suggestions, styles, generated assets and tests.
- No new source runtime telemetry/network call was found in the inspected `src/` code. No new collections or structured dependency graph were added.
- Documentation generally reflects implemented behavior, but the capture-destination and stable-carry promises are not fully met because of F2/F4.
- Optional Impeccable pixel/contrast detector was not independently rerun. No claim is made that the earlier detector result remains verified by this audit.

### Commands and outcomes

```powershell
git status --short --branch
git diff --stat 4ad9e29
git diff -- test/live-workflow.mjs
node --test test/workflow.test.mjs test/projects.test.mjs test/starter.test.mjs test/finance.test.mjs test/collection-views.test.mjs
node build.mjs
```

Results:

- Unit suite: **99 tests, 99 pass, 0 fail, 0 skipped**. The logged `search unavailable` warning comes from a deliberate error-case test.
- Build: successful. A hash comparison before/after the build found **no changed source/generated files**. Root/dist code matches and source/dist CSS matches after the build's normal line-ending normalization.
- MCP initialize and read-only `get_plugin_code` calls succeeded for both explicit targets.
- Test deployment code/CSS matched local `dist/plugin.js` / `dist/plugin.css` byte-for-byte. No redeployment was needed or performed.
- CDP connection worked with `defaultViewport: null` and cleared device metrics. No viewport/window resizing occurred.

The live command was run twice through guarded wrappers that set the environment for the child process:

```powershell
$env:OS_SKIP_RELOAD = '1'
node test/live-workflow.mjs
```

- First run: exit 1, timeout at line 266, `Review summary could not be saved`; pending-section cleanup required auditor intervention.
- Direct retry of that same pending section: successful; no duplicate heading was created.
- Second full run: exit 0. Native next-action creation/rehydration/rename/cleanup, focus limit/reload, waiting/rescheduling, review task links, Journal save/update and completion checks passed.
- Live overflow arrays were empty at dashboard widths **1141, 569 and 379 pixels** using native side panels. Project check-in maximum row height was approximately 143 pixels.

Additional executions used PowerShell here-strings piped to `node --input-type=module`: source VM reproductions for F1/F4, detached actual browser components for F2/F5, and explicit test-workspace MCP/SDK scenarios described below. These did not modify application source.

### Live C2/D/E scenarios

All mutations used workspace `W8JXPTMKY8DEDMGB3JZ6ARRHJ2`, plugin `1Y01APTHH8RZN3BRYVHQT0YXQP`, after verifying both IDs.

- **C2:** saved three review associations in isolated future weeks using a test-owned native project/task. Each snapshot had one priority referring to the same task; later snapshots contained the expected `carriedFrom`. A repeated carry did not duplicate the entry. Native task count remained one. Freshly read original task marker and the first saved snapshot were unchanged. This passing path does not cover reload normalization; F4 does.
- **D:** waited for an actual native test-project panel to finish navigation, then invoked contextual capture. Project/client context applied and draft text remained. The separate scenario also retained an explicit Journal destination. No capture was submitted to production.
- **E:** a test-owned client-page task produced an evidence-backed candidate and visible reason. Explicit linking appended the chosen project GUID; formatted/date segments were preserved; freshly read project Client property was identical before/after. Repeated linking was rejected as already linked.
- Initial exploratory checks using stale SDK wrappers and insufficient navigation waits returned false booleans. These were rerun with fresh record/line reads and explicit navigation waits; only the corrected results above are treated as evidence. Stale-wrapper outputs are not product findings.

## Cleanup and production boundary

Final verified test-workspace cleanup result:

```json
{
  "leftovers": [],
  "pendingReviews": [],
  "rawStateMatchesPreAudit": true,
  "panels": 1
}
```

- Searched active Projects/Clients/Journal content for Workflow verification, renamed-action/checklist and independent-audit fixture text; no fixture content remained.
- All auditor-created review sections were deleted by GUID/subtree ownership; each reserved review week returned `none` afterward.
- Five auditor-created project/client records were moved to Trash, not permanently deleted. Empty lazily materialized Journal day records may remain; their audit sections/tasks were removed.
- Original raw `workflow-v1` storage was restored exactly, not merely normalized into an equivalent object.
- Extra panels were closed. Desktop was observed back on the original production workspace in Overview at the end.
- Production was never a live mutation-test target. Only read-only MCP inspection and workspace navigation were used there.

Production code/CSS hashes were identical before and after the audit:

```text
code SHA-256: 2dedf4c2670575c78495b0f1d8a218abcd1331d94dc5217422cdf4041cd88a80
CSS SHA-256:  01f8c371c434eb8f591354dfa896c821d692a9b5842030dcdb4ab9a01d949a94
```

Matching test-deployment hashes:

```text
code SHA-256: aacc9ce20afd7de31ce00a6bd82cb83d9258e6381625663daeaa998264607c6b
CSS SHA-256:  de02e127dc84ec525b94598e342d1d253d12c1412ad68f1d3cd2004a3d4eaa69
```

Live artifacts and the outer pre-live baseline were kept locally in:

`C:\Users\Jaap\AppData\Local\Temp\freelance-os-independent-audit-20261024`

They were not added to Git.

## Residual risks and release conditions

- The first live Journal-body creation failure was observed, but its exact root cause remains unproven. Successful pending retry and a successful second full run do not establish that the initial failure is fixed. Recheck first-save behavior on a fresh test Journal date; retain pending-fixture cleanup coverage.
- No real second physical device was used. Cross-device synchronization/concurrent-create behavior remains partly inferred from native data reads and deterministic concurrency tests.
- The SDK still provides no documented multi-call transaction or compare-and-swap. F1 concerns avoidable stale writes within this implementation, separately from unavoidable distributed race windows.
- Full pixel contrast, assistive-technology, dark/light theme and keyboard-only audits were not rerun independently. The split-layout assertions passed; that is narrower evidence.
- Current-review and previous-review caches should be reviewed for invalidation on synced Journal changes; the event handler schedules a render, while cached discovery can survive that render. This was inspected as a residual risk, not promoted to a separately reproduced finding.
- `.pi/` must remain dev-only. The new ignore rule prevents ordinary staging; no `.pi/` file is tracked or staged. The plugin bundle uses source/CSS, not that tooling directory.

**Ready to ship after findings are addressed?** Potentially, but not automatically: fix F1-F5, run the new targeted regressions and all unit tests, rerun the now-safe live runner including clean first-save behavior, verify test deployment/build equality, and confirm fixture cleanup. This audit does not authorize deploying to production or committing/pushing.
