# Freelance OS — Thymer Dashboard AppPlugin

Executive freelance dashboard running inside Thymer, inspired by Obsidian Freelance OS.

**Overview** is the default landing view. **Today** and **Weekly review** are available from the dashboard tabs. Freelance OS works independently of Daily Focus: both use native Thymer tasks, but their focus selections are separate. Daily Focus remains useful for workspace-wide planning, time blocks and recurring tasks.

## Features

- **Today and project action queue**:
  - Choose one next action per explicitly active project and pin up to three tasks for today.
  - Includes tasks inside nested project pages and unambiguous project references on tasks elsewhere in the workspace.
  - Filter by project or text; complete tasks, change due dates, and mark work as waiting with a reason and follow-up date.
  - Project attention signals use missing next actions, project deadlines, overdue tasks, and follow-ups due.
- **Weekly review**:
  - Clear overdue work, check projects and waiting items, then record wins and priorities for next week.
  - Preview the summary and save it to Journal. Updating it later in the same week reuses the same entry.
  - Recently done means tasks currently marked done whose last modification was within seven days; it does not claim an exact completion time.
- **Workspace settings**:
  - Map Projects, Clients, Invoices, Library and Journal to existing collections without changing their schemas.
  - Workflow focus selections, next-action choices, waiting notes, mappings and review drafts are stored locally per workspace on this device. Native task changes and saved Journal reviews sync through Thymer.
  - The new workflow uses native project `status` values `in_progress` / `in_review` and task `waiting` state. The financial dashboard and collection links remain under **Overview**.
- **Executive KPI Bar**:
  - **MRR (Monthly Recurring Revenue)**: Calculated live from active `Clients` records (`monthly_chf`).
  - **Invoiced, all time (CHF)**: Issued invoices, excluding drafts and other currencies.
  - **Collected, all time (CHF)**: Confirmed paid invoices.
  - **Active Clients**: Count of clients with active status.
- **Quick Task Capture**:
  - Integrated capture input with hotkey support.
  - Direct append to daily notes or project tasks.
- **3-Column Workspace Overview**:
  - **Active Projects**: Sorted by priority and deadline with status pills, sub-page count, and interactive click-to-navigate.
  - **Maintenance & Invoices**: Active retainer agreements and upcoming/overdue invoice register.
  - **Agenda / Deadlines**: Real-time aggregation of tasks with deadlines for today, overdue, and upcoming week.
- **Reactive Data Engine**:
  - Listens to workspace mutations (`record.updated`, `lineitem.created`, etc.) and automatically updates the dashboard.
- **Native collection workflows**:
  - Invoice Register, Outstanding, Overdue, To confirm, To send, and Paid tables.
  - Project Register, a board of open top-level pages, Active, Due dates, and Overdue views. Existing calendar and outline views remain available.
  - Client Directory, Active, Prospects, and Care plans tables.
  - Cashflow actions open the matching native invoice queue beside the dashboard. Invoice cards retain their inline filters; “View collection” opens the selected queue.

## Installation

### Via Plugins Manager UI (Recommended)
1. Open Thymer.
2. Open **Plugins Manager** from the sidebar or command palette (`Ctrl/Cmd + K`).
3. Click **Install Plugin**.
4. Enter this repository URL:
   ```
   https://github.com/jacoplane/thymer-freelance-os
   ```
5. Click **Install**. The **Freelance OS** icon will appear in your sidebar and command palette!

### Manual Custom Code
1. Open Thymer **Settings** $\rightarrow$ **Plugins** $\rightarrow$ **Create Global Plugin**.
2. Set Name to `Freelance OS` and Icon to `layout-grid`.
3. Paste the contents of `dist/plugin.js` into the Code tab.
4. Save and reload.

## Development

```bash
# Install dependencies
npm install

# Build the production bundle
npm run build
```

### Configure native collection views

With Thymer Desktop running and its MCP server enabled, review the proposed changes:

```bash
node scripts/collection-views.mjs
node scripts/collection-views.mjs --apply
```

Use `--collection Invoices`, `--collection Projects`, or `--collection Clients` to limit the pass. The script resolves property IDs from the current schema, reuses existing view IDs, preserves unrelated views and field definitions, and saves a local backup before each change. Backups default to the operating system's temporary directory under `freelance-os-collection-backups`; set `OS_COLLECTION_BACKUP_DIR` to keep them elsewhere. No record content is modified. View setup is explicit; loading the dashboard does not overwrite collection settings.

Queries follow [Thymer's query reference](https://github.com/thymerapp/thymer-plugin-sdk/blob/main/search-queries.md). Saved native collection filters are already scoped to records in that collection, so they omit global `@document` and collection prefixes. Overdue means a due date strictly before today; drafts and paid invoices are excluded. Active projects require an explicit in-progress or in-review status. Care plans require an active client with a positive monthly fee.

### Verification

```bash
node --test test/finance.test.mjs test/collection-views.test.mjs
node test/live-collections.mjs
node --test test/workflow.test.mjs
node test/live-workflow.mjs
```

The live collection check compares every saved view against the workspace query results, verifies dashboard-to-queue navigation, captures local screenshots, and closes its verification panels. Set `OS_ARTIFACT_DIR` to choose the screenshot directory. Screenshots and configuration backups contain workspace data and should stay out of Git.

The live workflow check creates temporary tasks and a clearly dated verification review, checks focus limits, state persistence, native task changes, review update behavior and split-panel layouts, then removes its fixtures and restores the original local workflow state.
