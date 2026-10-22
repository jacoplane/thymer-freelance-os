# Freelance OS — Thymer Dashboard AppPlugin

Executive freelance dashboard running inside Thymer, inspired by Obsidian Freelance OS.

## Features

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
```

The live collection check compares every saved view against the workspace query results, verifies dashboard-to-queue navigation, captures local screenshots, and closes its verification panels. Set `OS_ARTIFACT_DIR` to choose the screenshot directory. Screenshots and configuration backups contain workspace data and should stay out of Git.
