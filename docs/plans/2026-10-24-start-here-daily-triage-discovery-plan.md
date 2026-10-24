# Start Here daily triage — discovery plan

Status: prototype deployed and UI-checked in the dedicated test workspace; human scenario replay pending.

## Recommendation

Prototype a project-aware **Start Here** panel in Today. It should suggest up to three existing actionable tasks, explain the signals behind each suggestion, and let the user add a chosen task to the existing daily Focus pins. Validate the ranking and interaction before building a scoring system or changing the task model.

## Desired outcome and measure

**User outcome:** start a work session with a useful first task chosen quickly and confidently.

**Primary measure:** median seconds from opening Today to selecting the first suitable focus task. Collect a baseline first; a provisional usability target is 30 seconds or less.

**Decision threshold for the prototype:** in five scenario replays, the user selects one of the suggested tasks in at least four scenarios, understands why it was suggested in at least four, and can reject or replace a suggestion without losing their place. These are directional usability gates, not statistical evidence of demand.

## Evidence and limits

- The test workspace showed one task due today, four overdue, four due within seven days, and two inbox tasks. Project cards also show project priority. Treat these as scenario data, not real usage frequency or customer evidence.
- `actionModel()` currently orders tasks by overdue/today status, task importance, date, and title. It does not use project priority. See [workflow.js](../../src/workflow.js#L246).
- Today already supports selecting a project next action and pinning up to three Focus tasks. Start Here should reuse those actions instead of creating another task or focus system.
- The URL uses the `jacoplane.thymer.com` organization host, but the active `last_workspace_guid` is the test workspace `W8JXPTMKY8DEDMGB3JZ6ARRHJ2`. The earlier interpretation of that URL as the regular workspace was incorrect.

## Opportunity Solution Tree

**Outcome:** reduce the time it takes a freelancer to choose a useful first task at the start of a work session.

1. **Opportunity:** “I cannot tell which task deserves attention first when urgent work spans several active projects.”
   - **Solution A (preferred to test):** show up to three existing tasks with a short reason on each (for example, due today, overdue, Important, or belongs to a high-priority project).
     - Test: compare the shortlist with the user’s first choice in scenario replay; check time and reason comprehension.
   - **Solution B:** show one recommended first task and two alternatives.
     - Test: compare whether a single lead choice feels faster or too restrictive in the same scenarios.

2. **Opportunity:** “I cannot tell how project importance should affect the order of tasks.”
   - **Solution A:** let project priority influence ranking after immediate task urgency.
     - Test: replay cases where an overdue medium-priority task competes with a soon-due high-priority project task.
   - **Solution B:** show the ranking reason and allow simple reordering.
     - Test: check whether reasons alone are enough control before adding manual ranking controls.

3. **Opportunity:** “Some active projects have no selected next task, or have no task ready to start.”
   - **Solution A:** show a project’s existing actionable task when it has no selected next action.
     - Test: check whether users can select a useful task without opening the project.
   - **Solution B:** provide an Add task action only when the project has no actionable task.
     - Test: check whether in-place capture reduces interruption and whether the project context is clear.

The tree is a working hypothesis. The test workspace supports scenario validation; it does not establish that these pains recur in real work.

## Assumptions to test first

The installed assumption mapper ranked these by risk × (1 − certainty):

| Rank | Assumption | Score | Validation |
| --- | --- | ---: | --- |
| 1 | Users want a ranked first-task suggestion instead of choosing from the existing queue. | 0.54 | Scenario replay / problem interview |
| 2 | A concise explanation makes recommendations trustworthy. | 0.52 | Moderated usability test |
| 3 | Accepting a suggestion into Focus is faster than pinning manually. | 0.455 | Moderated usability test |
| 4 | Due date, task importance, and project priority provide enough signal for useful suggestions. | 0.28 | Scenario replay, then a technical prototype |

Risk and certainty values are initial judgments, not measured probabilities.

## Experiment plan

### 1. Scenario replay in the test workspace

Use five cases covering overdue work, due-today work, a high-priority project, a task already selected as the project’s next action, and a project with no actionable task. First have the user choose through the current Today workflow. Then show a paper or clickable Start Here concept with reasons.

Record manually:

- seconds to select the first task;
- whether the selected task was in the suggested three;
- whether the reason matched the user’s own reasoning;
- any override and why.

Pass the usability gate if four of five choices are accepted, four of five explanations are understood, and no suggestion is done, canceled, waiting, or owned by an inactive project. Do not claim statistical significance from five scenarios or one participant.

### 2. Ranking-precedence test

Create paired synthetic cases in which task urgency and project priority disagree. Ask the user to choose first, then compare the choice with two transparent variants: urgency-first and project-priority-first. This decides whether project priority belongs in the first ranking rule or only as an explanation/tie-breaker.

Do not change the saved project priorities or task statuses as part of the test. Keep the cases in a separate prototype or fixture and remove any temporary UI/data after the session.

## MVP boundary if the concept passes

- Suggest one to three existing actionable tasks in Today.
- Explain each suggestion with visible, existing signals: task due date, Important status, project priority, project deadline, and selected next action.
- Reuse the current Focus action and its three-task limit.
- Keep waiting, completed, canceled, and inactive-project tasks out of suggestions.
- Leave ranking inputs and thresholds explainable and deterministic.
- Make no task, status, date, or next-action changes until the user explicitly chooses an existing action.
- Preserve honest incomplete-data states; do not call a partial list “the best tasks.”
- Add no telemetry, external calls, or new collection fields for the prototype.

## Product decision after discovery

- **Proceed:** the shortlist is repeatedly accepted, its reasons are understood, and it is measurably faster than the current path. Then refine and validate persistence/keyboard use in the test workspace.
- **Adjust:** users like the explanation but disagree with ranking precedence. Change the rule and replay the conflicting cases.
- **Stop:** users prefer the existing task list or do not trust the signals. Improve existing queue clarity instead of adding a recommendation surface.

## Prototype implementation and checks

- Added **Start here** above Today’s Focus. It suggests up to three existing unpinned actionable tasks and gives the visible reasons for each.
- Ranking is deterministic: overdue, due today, earlier future date, then undated; task importance and high project priority break ties. Project priority does not outrank nearer due work.
- **Add to Focus** reuses the existing pin action. It is disabled when the three-item Focus list is full. The suggestion surface does not write native task, status, date, or next-action fields.
- The bundle was built and deployed explicitly to test workspace `W8JXPTMKY8DEDMGB3JZ6ARRHJ2`, plugin `1Y01APTHH8RZN3BRYVHQT0YXQP`. A read-back confirmed the deployed code includes the new surface.
- `node --test test/workflow.test.mjs`: 79 passed, 0 failed. `node build.mjs` and `git diff --check` succeeded.
- Five synthetic ranking replays covered overdue-versus-priority, due-today-versus-priority, nearer-date-versus-undated-Important, equal-date project-priority tie-breaking, and already-focused/empty suggestions. These validate selector logic only.
- Refined the suggestion rows to keep one clear action per row. Keyboard activation adds a suggestion to Focus and moves focus to its Unpin control; unpinning returns focus to that suggestion’s Add to Focus control. When Focus is full (3/3), remaining add buttons are disabled with an explanation.
- Opened Today in the test workspace and visually verified three suggestion rows above the existing Focus list, with no horizontal overflow. Added and removed suggestions by keyboard, verified the 3/3 disabled state, then restored the original Focus selection (1/3: “Finish mobile navigation”). The live workspace was left with its original single full-width panel.
- Still required: five human scenario replays recording first-choice acceptance, reason comprehension, overrides, and time. The UI smoke test and synthetic ranking cases do not establish user preference or demand.

## Skill workflow used

- `product-skills` router: routed this goal to `product-discovery`.
- `product-discovery`: built a three-opportunity tree and ordered assumptions by risk and certainty.
- `experiment-designer`: specified a primary measure, guardrails, comparison cases, and stopping criteria. A statistical A/B sample-size calculation is not appropriate for a one-person qualitative prototype check.
- The Opportunity Solution Tree passed `ost_linter.py`: 3 opportunities, 0 structural violations.
