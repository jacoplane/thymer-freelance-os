# Clients and leads

Freelance OS keeps a small relationship register in the existing Clients collection. Projects and tasks stay in their native Thymer pages. Correspondence stays in email and WhatsApp; the register only needs contact details and the context you choose to record.

## Daily use

In Overview, open **Clients & leads**. Use the **Clients**, **Leads**, and **Archived** filters, or search by company, contact, email, phone, or lead stage. **View collection** opens the matching native table alongside the dashboard.

Use **New lead** to add a company or individual and optional contact details. One Status covers the relationship: **New lead → Contacted → Discussing → Proposal sent → Proposal accepted → Active client → On maintenance → Archived**. Choose the status that describes the relationship; records do not have to pass through every status.

Change status from the compact control at the top of a card or through **Edit details**. **Status board** opens the existing native kanban alongside the dashboard, grouped by the same Status field. Drag a card to another column to update it. The native schema uses canonical labels such as `proposal_accepted` and `maintenance`; the dashboard shows their readable names.

The **Leads** filter includes New lead through Proposal sent. **Clients** includes Proposal accepted, Active client, and On maintenance. **Archived** is kept separately. All transitions preserve the same native record and its linked work. Maintenance clients with a positive monthly amount count toward recurring revenue; status alone does not create a fee or support allowance. Use profile notes for additional work discussions with an established client rather than moving it backwards automatically.

Open the native profile for notes, renaming, or additional contacts. The primary `contact` field remains freeform for compatibility with existing information. There are no automated reminders, correspondence imports, sales forecasts, or outbound messages.

## Upgrade an existing workspace

Freelance OS extends the existing Status choices and enhances the existing Status board, preserving its view ID and existing choice IDs. It uses the contact, email, phone, and website fields already available in the starter schema. No new register or collection is required.

Preview and then apply just the Clients collection update:

```sh
node scripts/setup-workspace.mjs --workspace YOUR_WORKSPACE_GUID --collection Clients
node scripts/setup-workspace.mjs --workspace YOUR_WORKSPACE_GUID --collection Clients --apply
node scripts/migrate-client-lifecycle.mjs --workspace YOUR_WORKSPACE_GUID
node scripts/migrate-client-lifecycle.mjs --workspace YOUR_WORKSPACE_GUID --apply
```

The setup script keeps a local configuration backup and verifies saved fields and views. The separate record migration previews and then consolidates old prospect stages into Status. Active and archived clients keep their status, and existing `lead_stage` field values remain as history. Each changed record is backed up and verified. After migration, the legacy field is retired (`active: false`) so later runs cannot undo deliberate status changes. Fresh installs use the unified lifecycle directly.

## Use Thymer's built-in MCP

Connect your agent to Thymer's existing MCP service. No Freelance OS MCP server is required. The [Freelance OS skill](../.agents/skills/freelance-os/SKILL.md) teaches the agent the record model, native tool workflow, and the distinction between clients, leads, and project tasks.

Install it with the Skills CLI:

```sh
npx skills add jacoplane/thymer-freelance-os --skill freelance-os
```

Examples:

- “I emailed a new prospect, Example Studio. Alex is the contact, alex@example.com. Add it to lead tracking.”
- “Example Studio asked for a proposal. Move the lead to Discussing.”
- “The proposal is accepted. Make Example Studio a client.”
- “The client emailed asking us to update the homepage and fix the contact form. Add those tasks to the Website Refresh project.”

The skill reuses matching records, writes native client properties and task lines, and reads back changes. It asks for a project only when the destination is ambiguous. It does not read your inbox or WhatsApp, import conversations, or send messages. Tell the agent the information you want captured.

This operations skill is separate from `freelance-os-plugin-dev`, the plugin development runbook.
