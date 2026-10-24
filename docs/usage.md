# Use Freelance OS

## Overview: check the business

Overview is the default landing tab. The four metrics show recurring revenue from active clients, issued invoices, confirmed collected payments, and active client count. Financial totals are all time and in CHF.

The cashflow row separates outstanding, overdue and unconfirmed payments. Drafts are counted as work to send, without inflating issued revenue. A due date strictly before today makes a sent, unpaid invoice overdue. Clicking a cashflow action opens the matching native invoice queue beside the dashboard.

Use **Projects / Clients / Invoices** to change the main card list. Project cards open the real project page; client cards show linked project counts and confirmed payments; invoice filters narrow the displayed cards. **View collection** opens the corresponding native working view.

## Capture work quickly

Use the capture field at the top of any tab. Choose **Journal inbox** or an active project, optionally mark the task **Important**, type the task, and press **Enter**. `/` focuses capture when you are not already typing into another field. Capture creates an ordinary Thymer task you can edit from its native page.

The Overview agenda’s **Inbox** skips unfinished tasks on records whose `type` is **template**. Keep reusable checklists marked as templates in Library; after copying their tasks into a real client or project page, those tasks appear as normal work.

### Capture into the project in front of you

With a native project page focused, run **Capture Freelance OS task for this project** from the command palette. Freelance OS reads the project before navigating, accepts only a real project page in the configured Projects collection, resolves nested pages to their root, and preselects only an explicitly active (`in_progress` or `in_review`) project. The capture bar shows the project and linked client as context. A nonempty draft is kept. If you previously chose a destination yourself—including Journal inbox—that choice is kept and the project context is not applied. The preselection applies once for that command invocation; changing panels later does not keep changing it.

The destination is checked again when you save. A project that was moved out of the configured collection, marked as a template, deleted, or closed produces an error and keeps your text. Backlog projects remain available as an explicit destination from the capture selector, but they are never preselected automatically.

### Link an unassociated inbox task

An inbox task on a client page, or one that references a client record, can show **Link project** when it has no project relationship yet. Freelance OS lists that client’s active projects with the evidence for each suggestion. Nothing changes until you choose **Link project**; **Open project** only navigates. Before writing, the task is re-read and reclassified. If it now belongs to a project, references several projects or clients, or its project context is unresolved, Freelance OS explains that instead of appending another reference. A successful link appends a native project reference and preserves the task’s text, date and other references. The project’s Client property is never changed. Suggestions dismissed with **Not now** stay dismissed for this session.

Create a new client, project or invoice using the Overview action rail. **Billing** adds a dedicated invoice register with draft/ready/sent entry, filters, dated sending and full-payment actions, and maintenance-plan references. Sending stage and payment state remain separate. The optional native Preparation board changes sending stage only. See the [Billing guide](billing.md).

## Start and connect projects

**New project** creates and opens a native Thymer page with four editable sections: **Project brief**, **Next actions**, **Deliverables & references**, and **Decisions & updates**. Add an optional brief and first action in the form; the first action becomes an ordinary Thymer task. If you leave it blank, the page has an empty task ready for you to fill in.

Choose a client in the form to set the project's native **client** property. The client name on a project card opens that client profile. From a client card, click its project count to see only that client's projects; **Show all projects** clears this filter. Counts use actual record links, so similarly named clients and projects are never joined by a title guess. Native client profiles also expose these property references in Thymer's backlinks.

For a project created from the collection itself, open the page and run **Apply Freelance OS project template** from the command palette. The command only fills empty pages or the exact imported migration placeholder. Existing briefs, tasks and notes are preserved. Applying it to an imported hub also adds native references to its existing sub-pages. Template content is ordinary Thymer data and remains editable without Freelance OS.

The starter schema restricts project and invoice Client pickers to the Clients collection. After changing collection mappings, check this picker restriction in your native collection settings as well. Unlinked internal projects are valid; the dashboard shows **Internal / no client linked**. Template records belong in Library rather than the Clients or Projects registers.

Log support work from Overview with **Log support time**. Choose a client, optionally link one of that client’s projects, then enter the date, decimal hours and a short description. The month total counts sessions by their date and compares them with active clients’ `included_hours` values. Set that field to the monthly allowance for each care plan; the dashboard never guesses historical hours.

![An editable project brief and first action in the fictional demo workspace](images/project-template.png)

New project pages also include **Client review checkpoints**: a blank native task and a short reminder to name the deliverable and set the feedback due date. Add one task for each review; mark it complete when the client replies. Existing Freelance OS project templates gain this section when you choose **Apply Freelance OS project template** on that project page.

## Today: move projects forward

Today only includes tasks associated with explicitly active projects (`in_progress` or `in_review`). Tasks on nested project pages are included. A task elsewhere in the workspace can be included when it references exactly one project unambiguously.

1. Open **Needs attention**. Missing next actions, near deadlines, overdue project tasks and due follow-ups appear here.
2. Choose an existing task and click **Set next**. Choose one next action for each active project, or use **Add task** to capture one into that project. The selected task is also linked under the project page’s **Next actions** section, so the choice syncs with the workspace and stays visible outside Freelance OS.
3. Use **Focus** to pin up to three tasks for today. **Unpin** removes a task from that daily shortlist. Pins belong to the selected calendar day.
4. Use the next-action, all-action and waiting tabs to work through the queue. Search and project filters combine. All actions can be narrowed to **Due/overdue**, **Important** or **No date**; Waiting can be narrowed to **Follow-up due** or **No follow-up**. Counts reflect the current search and project scope, and the result summary says when only loaded results are available.

A checkbox completes the native task. Clicking the task title opens its source page. **Edit** exposes its due date and waiting controls. Changing a due date preserves the task’s other text, links and formatting.

## Track waiting dependencies

In a task’s editor, enter a waiting reason and optional follow-up date, then save the waiting state. The native task becomes waiting, and the reason and follow-up sync with the workspace in the task’s Freelance OS metadata. Waiting tasks leave the actionable queue and daily shortlist and appear under **Waiting**, where the reason and follow-up stay visible without opening Edit.

Waiting without a reason is shown as **Waiting - add a reason**. If your Thymer build cannot save task metadata, the note remains on this device and the row says **Only on this device**. Notes created by an older Freelance OS version are not uploaded automatically; saving that waiting entry explicitly moves the note into native metadata. **Ready to work** restores the previous native status, such as Important, instead of always clearing to none. The stored note remains on the task but is inactive once the task is no longer waiting.

When the follow-up date arrives, the project gains a **Follow-up due** attention signal. Resume the task when the dependency is resolved. These are dashboard reminders; nothing is sent to a client automatically.

## Weekly review

The review is grouped by the week starting Monday. Its draft is saved on this device as you move through three steps:

1. **Clear the decks.** Complete or reschedule overdue actions, or mark dependencies waiting. Look over tasks marked done and updated within the last seven days.
2. **Check projects.** Review every active project, confirm its current next action, and check deadlines and waiting follow-ups. The selected actions carry into **Today → Next actions** and the saved Journal review.
3. **Plan next week.** Write wins and observations, then add one priority per line. For each priority that belongs to active project work, choose its project and either select an existing open task and click **Link task**, or click **Create task**. The task appears in the action queue without changing that project's chosen next action; the priority stays in your review, and the Journal entry links it to the task. Unconverted priorities remain plain text. Inspect the Journal preview and click **Save review to Journal** when ready.

The saved native Journal section includes project next actions, waiting work, overdue counts, recent done tasks, notes and priorities. Converted priorities link directly to their native project tasks. Next-action links on project pages are native workspace content; waiting details are native task metadata; focus pins and unsaved review drafts remain local to this device.

**Previous priorities** appear above the planning form. The source is, in order, last week’s saved Journal review, then last week’s unsaved local draft, then a calm empty state. Each row shows whether its linked task is open, waiting, completed, canceled or unavailable. Carrying forward keeps the same native task; waiting tasks stay waiting. Completed and canceled tasks are shown without a carry action. An unavailable task can be carried as text only. Carrying does not create a task, reschedule, resume waiting, choose a next action or pin focus. Carrying the same priority twice is prevented by its source-week/id identity, and two priorities in one week cannot link the same task.

Freelance OS checks the week’s seven Journal pages for an existing review before saving. A saved review is found even when this device has no local review cache, and saving from another day updates that same section rather than creating a second one. If several matching sections exist, the dashboard shows their dates and requires an explicit **Use this review** choice; it never merges or deletes them automatically. An interrupted save leaves a discoverable section for retry. Older review sections without saved metadata are read from their generated body and upgraded only when you save. In a workspace with several active users, choose the Journal owner in Settings first. After saving, the button becomes **Update Journal review**.

![Planning next week and updating a saved Journal review with fictional notes](images/plan-next-week.png)

The recent-done list is based on last modification time. Editing an older completed task can make it appear here; it should not be read as an exact completion log. If a task scan is incomplete, the dashboard warns you and does not invent missing-task gaps.

## Keep collection pages useful

The dashboard complements the collection pages. Use them for editing record properties and scanning full registers:

| Collection | Starter working views |
| --- | --- |
| Projects | Register, Board, Active, Due dates, Overdue |
| Clients | Directory, Active, Prospects, Care plans |
| Invoices | Register, Outstanding, Overdue, To confirm, To send, Paid |

Records and views remain native Thymer data. Opening the dashboard does not rewrite collection settings. Split panels adapt to their container width; no desktop window resizing is needed.

## What syncs

| Syncs through Thymer | Local to this device and workspace |
| --- | --- |
| Clients, projects, invoices and linked properties | Collection mappings and Journal owner preference |
| Native task text, dates, importance and completion/waiting state | Daily focus pins |
| Project next-action references, waiting reasons/follow-up dates and saved review snapshots | Unsaved review drafts |
| Saved Journal reviews | Legacy waiting notes until their waiting entry is saved again |

Freelance OS works independently of Daily Focus. Removing Daily Focus does not affect this plugin’s task capture, action queue or weekly review.
