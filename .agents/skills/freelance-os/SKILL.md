---
name: freelance-os
description: Manage Freelance OS clients, leads, invoices, and native project tasks through Thymer's built-in MCP. Use when recording prospects, updating client lifecycle or invoice states, recording confirmed payment, or capturing work from a conversation. For plugin development, use the separate freelance-os-plugin-dev development skill.
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
| `status` | One lifecycle: `prospect` (New lead), `contacted`, `discussing`, `proposal_sent`, `proposal_accepted`, `active` (Active client), `maintenance` (On maintenance), `archived` |
| `contact` | Primary contact name or existing freeform contact details |
| `email`, `phone`, `website` | Optional details supplied by the user |

The native **Status** board groups the same records by `status`. Leads includes prospect/contacted/discussing/proposal_sent; Clients includes proposal_accepted/active/maintenance. The dashboard and native views use the same Status, with no separate stage to synchronize. Existing `contact` text may include an email address: preserve it unless asked to change it. Older `lead_stage` fields may remain retired for history. Do not use historical stage values to override Status or write new progress there.

Use the page body for a short lead description or a note explicitly requested by the user. Keep any existing content. A second contact can be recorded in the page body when needed; do not invent more collections. Care-plan fields (`plan`, `monthly_chf`, `included_hours`, `billing_cycle`) are optional and should change only when requested. Potential work is not recurring revenue.

## Track a prospect

For “I emailed a new prospect; add them to lead tracking”:

1. Search or list the Clients records to find an existing match by company/name and, when supplied, email. Use `get_record_properties` to confirm matches. Ask only if multiple plausible matches would change where the data goes.
2. Reuse a match; otherwise call `create_record` in Clients with the supplied name and properties. For a new prospect use `status: contacted` when an email was already sent, or `prospect` when the user merely identifies a lead. Do not invent contact details or a date.
3. Change status with `update_record_property`. Use `discussing` for an ongoing sales discussion, `proposal_sent` for an explicitly sent proposal, and `proposal_accepted` for an explicitly accepted one. Keep an acquired client's current lifecycle status when merely recording an email or task request; a new conversation does not automatically make it a lead again.
4. Use `active` when the user says work has started, `maintenance` for an agreed maintenance relationship, and `archived` when the user closes the relationship or a prospect does not proceed. Losing an additional opportunity from an active client does not archive that client. Status changes do not create projects, tasks, or financial amounts. Change care-plan amounts only when supplied or requested.
5. Read back the affected properties and return a short confirmation naming the client and actual status.

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

## Billing register

Invoices remain records in **Invoices**. Resolve the actual schema before writing and find the existing record by `invoice_id` or title; references should be unique. Its `client` is a native Clients reference. `amount_chf` is the historical amount-field name even for other currencies: keep the explicit `currency` (configured values commonly CHF/EUR/USD) and never silently convert or add different currencies together.

- `status` is the sending stage: `draft`, `ready`, `sent`. The native Preparation board changes this field only. Marking Ready does not invent an issue date. When recording Sent, use the actual `issued` date supplied or clearly implied by the user's request, and keep payment state intact.
- `payment_status` is `unpaid`, `unconfirmed`, or `paid`. A report from a client that they sent payment can be recorded as `unconfirmed`; the user's explicit confirmation that the full payment was received permits `paid`. Save the known `paid_date` before the Paid state. Ask for a missing received date only when it cannot be inferred from what the user said.
- A new paid record needs Sent stage, an issue date, and its payment-received date. Do not invent dates, turn a draft into an issued invoice without evidence, or mark a partially paid invoice fully paid. Partial-payment accounting is outside this register.
- Before changing state, re-read the invoice's amount, currency, client, sending/payment fields, and dates. If they changed from what the user is acting on, resolve the conflict instead of overwriting. Validate target schema/choices before writes, read back the result, and inspect any unclear failure before retrying to avoid duplicate records or unverified payment claims.
- Maintenance plans are references on Clients (`plan`, `monthly_chf`, `billing_cycle`, `included_hours`), not invoices or scheduled charges. Update only supplied terms. Do not create a recurring invoice, charge, PDF, or outbound reminder merely from maintenance status.

Open Billing when the user asks to inspect the custom view; native invoice/client profiles remain the source records. Producing an official invoice document is a separate task from updating this register.

## Other native tools

`search`, `list_records`, `query_records`, `get_record`, `get_record_properties`, `create_record`, `update_record_property`, `get_line_items`, `create_line_item`, `insert_markdown`, and `set_task_status` cover these workflows. Read the connected tool's schema for its current arguments. Native profile links can be opened with `navigate_to_record` when the user asks to see a record.
