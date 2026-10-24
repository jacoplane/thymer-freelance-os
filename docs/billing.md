# Billing workspace

Open **Billing** in the dashboard navigation. The page combines a compact summary, an invoice register, and maintenance-plan references. The native Preparation kanban is available alongside the page; it is one optional working view.

## Invoice register

The table shows the invoice reference, client, amount and currency, due date, sending stage, and payment state. Search by reference or client and use **To send**, **Outstanding**, **Overdue**, **To confirm**, or **Paid**. Open an invoice to edit its native fields or attach its PDF and supporting notes.

Amounts in the summary use CHF invoices. Counts cover all currencies, and the table keeps each invoice's original currency. No currency conversion is performed.

Sending stage and payment state are separate:

- **Ready to send** changes a draft to Ready without recording an issue date or payment.
- **Mark sent** asks for the issue date and records Sent. It does not send email or mark the invoice paid.
- **Record payment / Confirm payment** asks you to verify the full amount and enter its received date. The register changes to Paid only after the date saves. Partial payments are outside this simple register; do not mark an invoice fully paid for a partial receipt.

Stale forms stop if the invoice amount, currency, client, dates, or state changed elsewhere. Failed saves retain the form entries and report whether details may already have saved.

**Add invoice** records a draft, ready, or sent invoice in the existing Invoices collection. It supports currencies configured there. A sent invoice needs an issue date; a paid entry also needs its received date. Existing invoice references cannot be duplicated through the form. Invoice PDFs remain ordinary native attachments; this page does not generate or send them.

## Native Preparation board

Use **Preparation board** in the header to open the native board beside Billing. It groups unpaid invoices by **draft → ready → sent** and excludes paid invoices. Dragging changes only the sending stage, leaving payment status and dates intact. A sent invoice with no issue date offers **Add issue date** in the table so you can record the actual date separately. The native register link opens the table for the current invoice filter.

Existing workspaces can add the view without changing records:

```sh
node scripts/setup-workspace.mjs --workspace YOUR_WORKSPACE_GUID --collection Invoices
node scripts/setup-workspace.mjs --workspace YOUR_WORKSPACE_GUID --collection Invoices --apply
```

## Maintenance plans

The Maintenance plans tab shows clients explicitly On maintenance and active clients with a positive care-plan amount. It reads service, normalized monthly CHF amount, billing cycle, and included monthly support hours from Clients. Open the native client profile to update those references. Missing cycles remain unset; no future invoice dates, automatic charges, or new invoices are inferred.

## Native MCP workflow

The [Freelance OS skill](../.agents/skills/freelance-os/SKILL.md) covers invoice capture and updates using Thymer's built-in MCP. It keeps sending, reported payment, and confirmed receipt distinct and reuses native records rather than introducing another billing system.
