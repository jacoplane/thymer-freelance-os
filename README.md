# Freelance OS — Thymer Dashboard AppPlugin

Executive freelance dashboard running inside Thymer, inspired by Obsidian Freelance OS.

## Features

- **Executive KPI Bar**:
  - **MRR (Monthly Recurring Revenue)**: Calculated live from active `Clients` records (`monthly_chf`).
  - **Invoiced YTD**: Sum of issued invoices.
  - **Collected YTD**: Sum of paid invoices.
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
