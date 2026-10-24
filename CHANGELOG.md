# Changelog

## 0.4.0 — 2026-10-25

- Add comprehensive Page Archetypes across all core records (Clients, Projects, Invoices, Support Sessions) with clean section templates and live task rollups.
- Add interactive in-document action pills (`linkbtn`) styled according to Thymer's native visual design system:
  - Client: `+ Create project`, `+ Create invoice`, `+ Log support time`.
  - Project: `+ Add task`, `+ Log time`, `+ Create invoice`, `+ Add review checkpoint`.
  - Invoice: `+ Copy payment details`, `+ Record payment`, `+ Mark sent`, `+ Add deliverable`.
  - Support Session: `+ Add follow-up task`, `+ Create invoice`, `+ Log time`.
- Embed dynamic Menubar Header Actions directly into Thymer Desktop panels with contextual record preselection:
  - Client panel: `+ Project`, `+ Invoice`, `+ Time`.
  - Project panel: `+ Task`, `+ Invoice`, `+ Time`.
  - Invoice panel: `+ Mark sent`, `+ Record payment`, `Copy details`, and `Settled` badge.
  - Support Session panel: `+ Time`, `+ Task`, `+ Invoice`.
- Add fast, keyboard-navigable modal dialogs with client/project context resolution and validation.
- Add Swiss QR-bill and payment details clipboard copy action with fallback for restricted webview environments.
- Add non-destructive archetype backfill scripts to upgrade existing workspace records safely without clobbering user notes.
- Publish Freelance OS UI Design System & Style Guide (`docs/style-guide.md`).

## 0.3.0 — 2026-10-24

- Add a dedicated Billing page with a compact summary, searchable invoice table, invoice filters, and maintenance-plan references.
- Add explicit Ready to send, Mark sent, and Record full payment actions with date entry, schema validation, stale-record checks, and verified native writes.
- Keep sending stage and payment state separate; native Preparation kanban moves sending stage only and excludes paid invoices.
- Support draft, ready, and sent invoice entry with configured currencies and duplicate-reference prevention.
- Keep CHF totals separate from other currencies while counting invoices across all currencies.

## 0.2.0 — 2026-10-24

- Use one client lifecycle Status from New lead through Proposal accepted, Active client, On maintenance, and Archived.
- Enhance the existing native Status board with the complete lifecycle and add a direct dashboard link.
- Replace the large card dropdown row with a compact status control beside the card heading; simplify Edit details to one Status field.
- Count maintenance clients correctly in recurring revenue, care plans, and included support hours.
- Add a preview-first migration for legacy prospect stages, preserving acquired client statuses, record IDs, and the old field values.
- Manage clients and leads in the existing Clients collection, with primary contact, email, phone, and simple lead stages.
- Add searchable Clients, Leads, and Archived filters, quick lead-stage updates, and an accessible create/edit form.
- Preserve the same native client record when a lead becomes a client; keep linked projects, tasks, notes, and invoices intact.

## 0.1.0 — 2026-10-24

- Overview dashboard with active projects, daily agenda, recurring revenue, and cashflow.
- Start Here daily triage shortlist with explainable task ranking and one-step Focus pinning.
- Today action queue with project next actions, waiting dependencies, and follow-up reminders.
- Guided strategic Weekly Review that discovers saved Journal reviews and carries priorities forward.
- Project capture from native pages, client project suggestions, and template exclusions.
