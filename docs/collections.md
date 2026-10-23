# Collection field reference

Freelance OS resolves collections by name or by the mappings in its Settings tab. It reads properties using the field labels below. Keep these labels and choice values exactly as shown; field IDs may differ between workspaces.

The starter command creates these fields and views. A collection name mapping does not translate arbitrary field names or status values. Native working view queries use the canonical collection names; if you rename collections, update their saved queries as well as the dashboard mappings.

## Clients

| Field label | Type | Values or meaning |
| --- | --- | --- |
| `status` | Choice | `prospect`, `active`, `archived` |
| `plan` | Text | Care plan or service description |
| `monthly_chf` | Number | Monthly recurring value; positive values on active clients contribute to MRR |
| `billing_cycle` | Choice | `Monthly`, `Annual`, `Project` |
| `included_hours` | Number | Care plan reference |
| `contact` | Text | Contact details |
| `website` | URL | Client website |

MRR reads `monthly_chf` directly; an annual billing cycle does not automatically divide a yearly amount by twelve. Store the normalized monthly value in that field.

## Projects

| Field label / ID | Type | Values or meaning |
| --- | --- | --- |
| `status` | Choice | `backlog`, `in_progress`, `in_review`, `completed`, `archived`, `cancelled` |
| `priority` | Choice | `high`, `medium`, `low` |
| `deadline` | Date/time | Project deadline |
| `completed_date` | Date/time | Optional reference |
| `client` | Record link | A Clients record |
| `parent_page` | Native parent field | Links a deliverable or nested page to its parent project/page |

`parent_page` is the field ID; Thymer normally displays its label as **Sub-page of**. Top-level records are the projects. Native tasks live in the page body; there is no separate Tasks collection to maintain.

## Invoices

| Field label | Type | Values or meaning |
| --- | --- | --- |
| `invoice_id` | Text | Invoice reference |
| `client` | Record link | A Clients record |
| `amount_chf` | Number | Invoice amount |
| `currency` | Choice | Starter values: `CHF`, `EUR`, `USD` |
| `issued` | Date/time | Issue date |
| `due` | Date/time | Payment due date |
| `paid_date` | Date/time | Confirmed payment date |
| `status` | Choice | `draft`, `ready`, `sent` |
| `payment_status` | Choice | `unpaid`, `unconfirmed`, `paid` |
| `pdf` | File | Optional invoice PDF attachment |

The stage and payment state serve different purposes. A sent/unpaid invoice contributes to issued and outstanding amounts. A sent/unconfirmed invoice remains outstanding and appears in **To confirm**. A paid invoice contributes to collected amounts. Drafts and ready invoices appear in **To send**. An invoice already marked paid is treated as issued even if its stage was not updated; keep the stage accurate in normal use.

CHF totals exclude other currencies and do not convert them. The amount field is currently named `amount_chf`; multi-currency financial reporting is outside the current scope.

## Library and Journal

Library contains service descriptions and reference material. The starter adds `type` (`note`, `care-plan`, `template`), `status` (text), and `source` (URL). Recurring revenue comes from Clients, not from Library note text.

Journal must use Thymer’s native `JournalCorePlugin`, not a plain collection named Journal. The starter creates it when absent. No custom Journal fields are required. Daily capture and saved weekly reviews use native Journal pages.

## Support Sessions

This optional register records support work by date. The overview totals only sessions dated in the current month and compares them with the sum of `included_hours` on active clients. Existing records are not backfilled, and the dashboard does not infer hours from notes or invoices.

| Field label | Type | Values or meaning |
| --- | --- | --- |
| `client` | Record link | Required client |
| `project` | Record link | Optional project; the form filters projects by the selected client |
| `date` | Date/time | Session date used for monthly totals |
| `hours` | Number | Positive time amount; decimal hours are supported |
| `description` | Text | Short description of work |

## Existing collections

The setup script adds missing fields and keeps existing IDs. It stops when a required label has an incompatible type, or a choice field lacks a required value. It does not replace such fields automatically. Export a backup before changing an existing schema, resolve the mismatch, and rerun the preview.

If only native views need updating, set `THYMER_WORKSPACE` to the target GUID and run:

```sh
node scripts/collection-views.mjs
node scripts/collection-views.mjs --apply
```

Use `--collection Projects`, `--collection Clients`, or `--collection Invoices` to limit the change. This preserves unrelated views and field definitions and keeps a local configuration backup.
