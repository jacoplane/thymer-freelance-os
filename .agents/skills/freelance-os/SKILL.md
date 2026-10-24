---
name: freelance-os
description: Manage Freelance OS clients, leads, and native project tasks through Thymer's built-in MCP. Use when recording a prospect, updating client contact details or lead stages, or capturing work described in an email or conversation. For plugin development, use the separate thymer-freelance-os development skill.
---

# Freelance OS

Use Thymer's existing MCP tools to maintain a small client and lead register and capture native tasks. No custom MCP service or external CRM is needed. Email and WhatsApp remain the correspondence archive; save only the short context or tasks the user asks to record.

## Find the destination

- Discover the available Thymer MCP tools. Their prefix depends on the client; the tool names below refer to Thymer's native tool names.
- Use `list_workspaces` and honor the user's named workspace or established session target. Otherwise use its focused workspace. Include the explicit workspace GUID in each subsequent call. An organization URL does not identify the selected workspace, and a workspace named Freelance OS may be a test workspace.
- Use `list_collections` and `get_collection_schema` to locate Clients and Projects and read their actual fields. Resolve choice labels from that workspace's schema; do not copy field or choice IDs from another workspace.
- If Thymer MCP is unavailable, report that it needs to be connected. Do not create a replacement service. Missing CRM fields should be reported as a setup gap; ordinary record requests do not authorize schema or plugin changes.

## Client and lead model

Both are native records in **Clients**. Reuse the same record as the relationship develops.

| Field | Meaning |
| --- | --- |
| Record title | Client, company, or individual name |
| `status` | `prospect` for a lead; `active` for a client; `archived` for a closed relationship or a lead that did not proceed |
| `contact` | Primary contact name or existing freeform contact details |
| `email`, `phone`, `website` | Optional details supplied by the user |
| `lead_stage` | `new`, `contacted`, `discussing`, or `proposal_sent`; relevant while status is `prospect` |

The native **Leads** view filters `status = prospect`. The dashboard reads these same properties; there is no second register to synchronize. Missing lead stage means unset, not evidence of an interaction. Existing `contact` text may include an email address: preserve it unless asked to change it.

Use the page body for a short lead description or a note explicitly requested by the user. Keep any existing content. A second contact can be recorded in the page body when needed; do not invent more collections. Care-plan fields (`plan`, `monthly_chf`, `included_hours`, `billing_cycle`) are optional and should change only when requested. Potential work is not recurring revenue.

## Track a prospect

For “I emailed a new prospect; add them to lead tracking”:

1. Search or list the Clients records to find an existing match by company/name and, when supplied, email. Use `get_record_properties` to confirm matches. Ask only if multiple plausible matches would change where the data goes.
2. Reuse a match; otherwise call `create_record` in Clients with the supplied name and properties. Use `status: prospect`, `lead_stage: contacted` for an email already sent. Use `new` when the user merely identifies a prospect. Do not invent contact details or a date.
3. Set or change fields with `update_record_property`. Preserve all unrelated data. An existing active client stays active when the user mentions more potential work; keep a brief opportunity note on that profile unless they ask for another structure.
4. When the user reports an accepted engagement, change the existing record to `active`. If they say it did not proceed, use `archived`. Keep the last lead stage as historical context. Neither action creates a project or tasks automatically.
5. Read back the affected properties and return a short confirmation naming the client and actual stage.

If a write fails or its result is unclear, read the target before retrying. Reuse any created record GUID and repair only the incomplete fields rather than creating another record.

## Capture work from a conversation

For “This client emailed asking for these tasks”:

- Find the client and the relevant existing Projects record using its native `client` reference and the user's project context. When several projects fit and the destination is unclear, ask which project. Do not create a project merely to store a task.
- Read the target with `get_record` or `get_line_items` to find the appropriate section and avoid duplicating an already captured request.
- Use `create_line_item` with `type: task` on the project page, or `insert_markdown` with `- [ ]` items under the existing section. These are ordinary Thymer tasks, not CRM reminders or records in a Tasks collection.
- Add dates, priority, or waiting state only when the user supplies or requests them. For structured task dates, use a `datetime` segment supported by `create_line_item`; record links use `ref` segments with the discovered GUID.
- If the user explicitly wants inbox capture before a project is chosen, use the native Journal tools and include a reference to the client. Preserve the existing capture workflow.
- Save a short source/context note only when useful to the requested task. Do not import an email thread or WhatsApp history, send correspondence, or create an automatic follow-up sequence.
- Read back the created tasks and confirm their project and any specified dates. After an unclear write, inspect for the newly created line before retrying it.

## Other native tools

`search`, `list_records`, `query_records`, `get_record`, `get_record_properties`, `create_record`, `update_record_property`, `get_line_items`, `create_line_item`, `insert_markdown`, and `set_task_status` cover these workflows. Read the connected tool's schema for its current arguments. Native profile links can be opened with `navigate_to_record` when the user asks to see a record.
