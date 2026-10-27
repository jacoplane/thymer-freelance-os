# Changelog

## 0.5.0 — 2026-10-27

- **Autonomous Operations Bench**: 11 dedicated AI specialist personas embedded with full operational directives and domain tools (`.agents/skills/`):
  - `lead-gen-offer-architect`, `outbound-strategist`, `discovery-coach`, `proposal-strategist`, `pricing-analyst`, `contract-clause-guardian`, `client-onboarding-shepherd`, `project-manager-senior`, `reality-checker`, `meeting-notes-specialist`, `receivables-diplomat`.
- **11 Modular Trade Packs (`packs/`)**: Craft-specific project templates, milestones, and 33 operational trade skills covering:
  - Software Engineering & DevOps, UI/UX Design & Creative Direction, Writing & Content Editorial, Growth Marketing & Paid Acquisition, Strategy & Management Consulting, Fractional CFO & Accounting, Executive Assistance & Operations, Audio/Video Production & Motion, Recruiting & Talent Acquisition, Event & Conference Production, Interior & Spatial Design.
- **AI Operations Cockpit (`src/ai.js`)**:
  - Dedicated AI tab in the dashboard displaying real-time MCP bridge status (`localhost:13100`), quick-copy setup commands for 6 coding harnesses (Antigravity, Claude Code, Cursor, OpenCode, Codex, OMP), Persona directory, and 1-click Trade Pack catalog.
  - Direct `+ New [ProjectType]` creation button on active Trade Pack cards preloading archetypes and milestones.
  - Dynamic base currency (`baseCurrency`) integration and discovery hints in the project creation modal.
- **AI Safeguard Watchdogs**:
  - Live warning banner on Overview dashboard detecting overdue invoices ($\ge 7$d), budget burn ($\ge 90\%$), and stale proposals ($\ge 5$d) with direct 1-click inspection navigation.
- **Onboarding Experience**:
  - Lightweight, non-intrusive "Welcome to Freelance OS" checklist card on Overview with real-time collection health check badge, MCP connection status, Trade Pack counter, and 1-click first client creation.
  - Persistent dismissal and Settings reset toggle ("Show Getting Started guide on Overview").
- **Quality & Verification**:
  - 161 unit tests passing cleanly across all modules and skills.
  - Live CDP verification across all personas, trade packs, and onboarding flows.

## 0.4.2 — 2026-10-25

- Fix: strip ES module `export` statements in `src/updater.js` and harden `build.mjs` to guarantee runtime compatibility with Thymer's dynamic plugin loader (`new Function`).
- Feature: ensure uncategorized projects (with missing or unset `status`) are never silently dropped; index their tasks and flag them explicitly under Needs Attention with a `⚠️ Project status not set` badge.
- Styling: add `.os-badge.status-none` badge styling in `src/styles.css`.
- Dev & Diagnostics: add `npm run debug` launcher and CDP target resolver for automated Electron remote debugging.
- Quality Assurance: complete end-to-end multi-persona verification suite across all 4 workflows (Lead ingestion, Retainer over-cap guardrails, Cashflow settlement, and Weekly Review journal persistence).
- Documentation: update `freelance-os` and `freelance-os-plugin-dev` skills with typed property tuple unpacking (`val[1]`), `format: 'structured'` API contract, waiting task 3-step sequence, and native Journal MCP tools (`add_to_journal`, `get_journal_page`, `navigate_to_journal`).

## 0.4.1 — 2026-10-25

- Add in-plugin update checker (`src/updater.js`) with background GitHub polling (every 4 hours).
- Add non-intrusive 1-click update prompt (`[Update now]`, `[Later]`) so users are never forced into unannounced updates.
- Add opt-in silent background auto-updates toggle in Settings and via Command Palette (`Freelance OS: Toggle automatic updates`).
- Add on-demand update check via Settings and Command Palette (`Freelance OS: Check for updates`).
- Add `__source_repo` metadata for full tracking compatibility with Thymer's native Plugins Manager.
- Add automated release pipeline (`npm run release`) supporting automated version bumping, building, tagging, and GitHub Release publishing via `gh` CLI.
- Harden agent execution workflows against UI meter desync, native waiting task status routing, and atomic invoice settlement.

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
