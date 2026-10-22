# Set up Freelance OS

Start in an empty workspace if you want to try the system before adapting your existing one. Installation creates no sample clients, projects or invoices unless you separately run the demo seed command.

## What is required

| Component | Purpose |
| --- | --- |
| Freelance OS | The dashboard app plugin |
| Clients, Projects, Invoices | Native collections with the starter fields |
| Library | Care plan descriptions, reference material and templates |
| Journal | Thymer’s native Journal collection, used for inbox capture and saved reviews |

No third-party runtime plugins are required. Daily Focus, Tables and Outline Installer are independent plugins. **Plugins Manager** is optional and makes installing or updating the dashboard convenient.

## Option 1: Desktop setup command

This path creates the empty collections, adds the working views, creates native Journal if it is absent, and installs the dashboard. It was exercised against an empty workspace in Thymer Desktop 1.0.20.

1. Open the target workspace in Thymer Desktop. If you created it on the web and it does not appear in Desktop, restart Desktop.
2. In that workspace, enable **read/write** MCP access under **Settings → MCP (AI Agents)**. Keep Desktop running.
3. Download this repository or clone it. Install Node.js 22 or newer. The setup commands use Node’s built-in libraries; `npm ci` is only needed for development and live browser tests.
4. Find the target workspace GUID from your MCP client’s `list_workspaces` result. Copy the GUID of the workspace you intend to configure.
5. From the repository directory, preview the plan. Replace `YOUR_WORKSPACE_GUID` in both commands:

```sh
node scripts/setup-workspace.mjs --workspace YOUR_WORKSPACE_GUID
node scripts/setup-workspace.mjs --workspace YOUR_WORKSPACE_GUID --apply --install
```

The first command makes no changes. The second creates missing collections, adds required fields and working views, and installs the committed `dist/` bundle. It keeps existing field IDs and unrelated views, refuses incompatible field types or missing required choice values, and saves local configuration backups in the operating system’s temporary directory. Run the preview again afterward: the collections should report **already configured**.

Use `--apply` without `--install` to configure collections only. These commands do not copy records from another workspace. MCP is used for setup and development; ordinary dashboard use does not require an MCP connection.

## Option 2: Plugins Manager starter import

For an **empty workspace** with [Plugins Manager](https://github.com/ahpatel/thymer-plugins-manager) already installed, the build includes a schema-only starter in its JSON backup format:

1. Download or open [`freelance-os-starter.json`](../dist/freelance-os-starter.json), use GitHub’s **Raw** view, and copy the complete JSON.
2. Open Plugins Manager’s **Restore/Import** dialog. Choose the section that accepts apps and collections together, if your version offers that choice.
3. Paste the JSON. Leave **Full Override (Delete existing)** unchecked.
4. Import the five collections and Freelance OS. This file contains configuration and plugin code only; it contains no client records, tasks or personal settings.
5. Open Freelance OS and check its Settings mappings.

The starter follows the Plugins Manager schema version 2 backup format. Its `Journal` item uses Thymer’s built-in `JournalCorePlugin`; its other collections use `CollectionPlugin`. It is a fresh-workspace template, not a migration tool for collections with existing records. For an existing workspace, use the preview-first command or configure fields using the [reference](collections.md).

## Install only the dashboard

If the collections already exist with the required fields:

1. In Plugins Manager, install from `https://github.com/jacoplane/thymer-freelance-os`.
2. Open Freelance OS from the sidebar or **Open Freelance OS Dashboard** in the command palette.
3. Open its **Settings** tab and map the five collection roles. Journal must be a native Journal collection; an ordinary collection merely named “Journal” will not work.
4. Save mappings. **Overview** remains the landing view after the plugin starts.

For manual installation, create a **Global Plugin** in Thymer’s plugin settings. Use [`plugin.json`](../plugin.json) for Configuration and [`dist/plugin.js`](../dist/plugin.js) for Custom Code, then save. The bundle embeds its styles; [`dist/plugin.css`](../dist/plugin.css) is also supplied for installations that store CSS separately.

## Make your first records

1. Create a client with `status = active`. Give it a positive `monthly_chf` value only if it has an active recurring care plan.
2. Create a project, link its `client`, and set `status = in_progress` or `in_review`.
3. Add native task lines inside the project. Open **Today → Needs attention** and choose a next action.
4. Pin up to three tasks for today.
5. In **Weekly review → Plan next week**, add a note and save it to Journal. Open Journal to confirm the saved entry.

For invoicing, use separate stage and payment fields: `status = sent` means issued; `payment_status = paid` means confirmed collected. A draft remains `status = draft`, even if it has an amount and due date.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| New web workspace is missing in Desktop | Restart Desktop, select the workspace, and check its own MCP access setting |
| Setup reports MCP access is off | Enable read/write access for the target workspace, not only the original one |
| Dashboard asks to choose collections | Finish starter setup or map existing collections in dashboard Settings |
| Project is missing from Today | It must have an explicit `in_progress` or `in_review` status; completed/backlog projects are outside the action queue |
| Native invoice queue is missing | Run starter setup, or configure the working views with `scripts/collection-views.mjs` |
| Journal capture or review saving fails | Ensure a native Journal is enabled and mapped; the starter creates one in a fresh workspace |
| Numbers are lower than expected | Check CHF currency, invoice stage, payment status, and active client status |
| Focus selections differ across devices | Focus and review drafts are stored locally; native tasks and saved Journal entries sync |

Continue with the [usage guide](usage.md).
