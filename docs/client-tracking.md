# Clients and leads

Freelance OS keeps a small relationship register in the existing Clients collection. Projects and tasks stay in their native Thymer pages. Correspondence stays in email and WhatsApp; the register only needs contact details and the context you choose to record.

## Daily use

In Overview, open **Clients & leads**. Use the **Clients**, **Leads**, and **Archived** filters, or search by company, contact, email, phone, or lead stage. **View collection** opens the matching native table alongside the dashboard.

Use **New lead** to add a company or individual and optional contact details. Stages are **New**, **Contacted**, **Discussing**, and **Proposal sent**. Change a stage directly on the lead card or use **Edit details**. A missing stage remains visibly unset until you choose one.

When a lead becomes a client, change **Relationship** to **Client** in Edit details. When it does not proceed, select **Archived**. Both actions keep the original record and any linked projects, notes, or invoices. An active client can have new work discussed in its profile notes; the basic register does not introduce a separate deal model.

Open the native profile for notes, renaming, or additional contacts. The primary `contact` field remains freeform for compatibility with existing information. There are no automated reminders, correspondence imports, sales forecasts, or outbound messages.

## Upgrade an existing workspace

Freelance OS 1.6.0 adds `email`, `phone`, and `lead_stage` to Clients. Existing contact data and field IDs are preserved; the Prospects view becomes Leads using the same view ID. The update does not change any client records.

Preview and then apply just the Clients collection update:

```sh
node scripts/setup-workspace.mjs --workspace YOUR_WORKSPACE_GUID --collection Clients
node scripts/setup-workspace.mjs --workspace YOUR_WORKSPACE_GUID --collection Clients --apply
```

The script keeps a local backup of the previous collection configuration and verifies the saved fields and views. Fresh starter installs include these fields automatically.

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

This operations skill is separate from `thymer-freelance-os`, the plugin development runbook.
