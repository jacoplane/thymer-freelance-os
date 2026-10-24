# Changelog

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
