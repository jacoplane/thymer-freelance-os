# Changelog

## 1.9.0 — 2026-10-25

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

## 1.8.0 — 2026-10-24

- Add a dedicated Billing page with a compact summary, searchable invoice table, invoice filters, and maintenance-plan references.
- Add explicit Ready to send, Mark sent, and Record full payment actions with date entry, schema validation, stale-record checks, and verified native writes.
- Keep sending stage and payment state separate; native Preparation kanban moves sending stage only and excludes paid invoices.
- Support draft, ready, and sent invoice entry with configured currencies and duplicate-reference prevention.
- Keep CHF totals separate from other currencies while counting invoices across all currencies.

## 1.7.0 — 2026-10-24

- Use one client lifecycle Status from New lead through Proposal accepted, Active client, On maintenance, and Archived.
- Enhance the existing native Status board with the complete lifecycle and add a direct dashboard link.
- Replace the large card dropdown row with a compact status control beside the card heading; simplify Edit details to one Status field.
- Count maintenance clients correctly in recurring revenue, care plans, and included support hours.
- Add a preview-first migration for legacy prospect stages, preserving acquired client statuses, record IDs, and the old field values.

## 1.6.1 — 2026-10-24

- Make stage editable on existing clients as well as leads, from cards, Edit details, and native client tables.
- Keep relationship status and linked work intact when a stage changes; a new client starts with no stage unless one is chosen.
- Update the native MCP operations skill to track new work for active clients without downgrading or archiving their client relationship.

## 1.6.0 — 2026-10-24

- Manage clients and leads in the existing Clients collection, with primary contact, email, phone, and simple lead stages.
- Add searchable Clients, Leads, and Archived filters, quick lead-stage updates, and an accessible create/edit form.
- Preserve the same native client record when a lead becomes a client; keep linked projects, tasks, notes, and invoices intact.
- Add the Freelance OS skill for Thymer's built-in MCP: capture client work as native project tasks and maintain the lead register from natural-language requests.
- Add a preview-first Clients-only schema upgrade that preserves existing field and view identifiers.

## 1.5.0 — 2026-10-24

- Add the Start Here daily triage shortlist with explainable task ranking and one-step Focus pinning.
- Preserve keyboard focus when adding or removing suggestions and explain when the Focus list is full.
- Keep suggestions limited to existing actionable tasks; no new task fields or external data collection.

## 1.4.0 — 2026-10-24

- Add synced waiting explanations, explicit migration of older local notes, and native previous-status resume.
- Add simple action/waiting presets with scoped counts and honest partial-data states.
- Discover saved weekly reviews across Journal dates; compare prior priorities and explicitly carry existing tasks forward.
- Add contextual capture from native project pages and evidence-backed, explicitly accepted project suggestions.
- Harden persistence, task ownership, template exclusion and event-driven refresh behavior.
- Protect newer next-action choices from stale asynchronous reconciliation.
- Keep unavailable capture destinations explicit and preserve waiting-editor text after failed saves.
- Preserve carry-forward provenance through reloads.
- Isolate live regression fixtures, reject production test targets, and clean up interrupted review saves.

No new collections or third-party runtime plugins are required. Structured prerequisite-task dependencies remain deferred.
