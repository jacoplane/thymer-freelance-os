# Freelance OS Design System & Style Guide

This style guide establishes the visual rules, typography, button hierarchy, and interaction patterns for the Freelance OS plugin within Thymer Desktop.

---

## 1. Visual Hierarchy & Design Principles

Freelance OS is designed to feel like an inseparable, organic extension of Thymer. Rather than injecting saturated web-app elements, all components inherit Thymer's dark workspace aesthetic, monospace Cascadia Code typography, and subtle contrast boundaries.

### Core Color & Surface Tokens

| Token | CSS Variable / Fallback | Purpose |
|---|---|---|
| **Text Primary** | `var(--os-text, #e0e0e0)` | Main titles, table values, input text |
| **Text Muted** | `var(--os-muted, #8b949e)` | Captions, secondary labels, metadata, inactive links |
| **Surface Dark** | `var(--os-surface, #161b22)` | Cards, dialog backgrounds, input wells |
| **Surface Hover** | `var(--os-surface-hover, #21262d)` | Hovered cards, hovered rows, hovered buttons |
| **Border Default** | `var(--os-border, #30363d)` | Card borders, section dividers, table grids |
| **Border Subtle** | `rgba(255, 255, 255, 0.08)` | Menubar pill borders, badge borders |
| **Accent Primary** | `var(--os-accent, #38bdf8)` | Sky blue: focus rings, primary action, project tags |
| **Accent Emerald** | `#34d399` | Invoices, paid statuses, positive revenue |
| **Accent Amber** | `#fb923c` / `#d29922` | Overdue invoices, high-priority tasks, warnings |

---

## 2. Button Hierarchy & Action Tokens

Buttons follow a strict 3-tier hierarchy:

### Tier 1: Primary Action (Hero)
- **Classes:** `.os-button.os-primary`
- **Used For:** Single highest-frequency action on a screen (e.g., Quick Capture submit, main modal "Create" button).
- **Background:** `#38bdf8` (sky-blue)
- **Text Color:** `#0f172a` (deep slate contrast)
- **Border:** 1px solid `#38bdf8`
- **Border Radius:** `6px`
- **Hover:** `#0ea5e9`

### Tier 2: Surface Action Buttons & Menubar Pills (Standard)
- **Classes:** `.os-button`, `.os-header-action-btn`, `.os-card-action-btn`
- **Used For:** Dashboard rail actions (`+ New project`, `+ New client`, `+ New invoice`), project card actions (`+ Invoice`, `+ Time`), and panel menubar header pills (`+ Project`, `+ Invoice`).
- **Geometry:**
  - Header Pills: `height: 28px`, `padding: 0 11px`, `border-radius: 40px` (pill)
  - Card Buttons: `height: 24px`, `padding: 2px 7px`, `border-radius: 4px`
  - Rail Buttons: `min-height: 32px`, `padding: 7px 12px`, `border-radius: 6px`
- **Background:** `rgba(255, 255, 255, 0.05)` / `var(--os-surface)`
- **Border:** 1px solid `rgba(255, 255, 255, 0.08)` / `var(--os-border)`
- **Color:** `var(--text-color, #cbd0d2)`
- **Icons:** Native Tabler icons tinted with their category accent (`#60a5fa` for projects, `#34d399` for invoices).
- **Hover:** Background `rgba(255, 255, 255, 0.1)`, border `rgba(255, 255, 255, 0.2)`, text `#ffffff`, `translateY(-0.5px)`.

### Tier 3: In-Document Action Pills (`linkbtn`)
- **Classes:** `.listitem-linkbtn > .line-div`
- **Used For:** Action buttons rendered directly inside Thymer editor documents (e.g. Archetypes).
- **Geometry:** `padding: 4px 13px`, `border-radius: 20px` (pill), `font-size: 12px`, `font-weight: 500`.
- **Resting Appearance:**
  - Background: `rgba(255, 255, 255, 0.04)` (blends cleanly with editor document canvas)
  - Border: 1px solid `rgba(255, 255, 255, 0.1)`
  - Color: `var(--text-color, #cbd0d2)`
  - Margin: `8px 0 12px 0`
- **Hover Appearance:**
  - Background: `rgba(56, 189, 248, 0.08)`
  - Border: `1px solid rgba(56, 189, 248, 0.4)`
  - Color: `#38bdf8`
  - Transform: `translateY(-0.5px)`
  - Shadow: `0 2px 8px rgba(0, 0, 0, 0.2)`
- **Interaction Rule:** Clicks are captured in capture phase (`addEventListener('click', handler, true)`) so the button acts immediately as an interactive trigger without trapping the text caret.

---

## 3. Archetype Structure & Conventions

Every primary entity in Freelance OS maintains a standardized markdown archetype designed for readability, friction-free editing, and automated bidirectional agent sync.

### 3.1 Client Archetypes

#### A. Acquired Client Archetype
```markdown
## Relationship & Context
Organization background, commercial agreements, and communication preferences.
### 🔗 Key Links & Deliverables
• Website: https://...
• Shared Drive / Assets: [Folder link ↗]
• Design & Mockups: [Figma / Design link ↗]
### 👥 Stakeholders & Roles
• Primary Contact: Contact Name (email@...) — Decision maker
• Billing Contact: factures@... (Net 30)

## Active Projects & Engagements
[+ Create project]
• [[Active Project 1]] (in progress)
• [[Active Project 2]] (in progress)

## 💳 Invoices & Billing
[+ Create invoice]
*(No invoices issued yet. Click above, use + Invoice in the top header, or press Ctrl/Cmd+K → "Create Freelance OS invoice".)*
• Billing Terms: Monthly (1er du mois) / Net 30
• Payment Method: Bank Transfer / QR-bill (CHF)

## ⏱️ Support & Care Plan
[+ Log support time]
• Active Plan: Growth Plan (35 CHF / month)
• Monthly Support Allowance: 2h / month included
• Support Window: Mon–Fri, 09:00–18:00 CET

## 📋 Open Tasks & Actions
### Account & Relationship Tasks
[ ] Initial client kickoff / follow-up

### Active Project Tasks
*(Tasks added to linked projects automatically roll up here.)*

## 📝 Communication & Decisions Log
• 2026-10-24: Client profile created.
```

#### B. Pipeline Lead Archetype (`prospect`, `contacted`, `discussing`, `proposal_sent`)
```markdown
## Relationship & Context
Prospect background, initial inquiry, and commercial context.
### 🔗 Key Links & References
• Website: https://...
• Pitch Deck / Scope Brief: [Shared link ↗]
### 👥 Stakeholders & Roles
• Primary Contact: Lead Contact (email@...) — Prospect
• Decision Maker: Commercial sponsor

## 🎯 Deal Qualification & Next Steps
[+ Add task]
[ ] Discovery call: understand project goals and scope
[ ] Validate budget range and decision timeline
[ ] Prepare and deliver proposal / estimate

## 📄 Commercial Estimate & Proposals
[+ Create project]
[+ Create invoice]
• Estimated Pipeline Value: 12,000 CHF
• Current Stage: Proposal sent
*(Once the proposal is accepted, click "+ Create project" above to launch delivery or "+ Create invoice" to bill deposit)*

## 📝 Communication & Meeting Debrief
• 2026-10-24: Lead record created.
```

---

### 3.2 Project Archetype

```markdown
## Project brief
Describe the outcome this project should achieve.
Scope and success criteria: add what is included and how you will know it is done.

## Next actions
[+ Add task]
[ ] Immediate next action
*(Tasks added here automatically sync to the Freelance OS Today queue and Client dashboard rollup)*

## Deliverables & references
• [[Deliverable Sub-page 1]]
• [[Deliverable Sub-page 2]]
### 🔗 Key Links & Repositories
• Repository / Code: [GitHub / GitLab repo ↗]
• Design & Figma: [Figma / Design link ↗]
• Live / Staging: [Preview site ↗]
• Shared Drive / Assets: [Folder link ↗]

## Activity & time log
[+ Log time]
*(Click above to log a work session, use + Time in the header, or tell your agent: "Logged 2h on this project".)*

## 💳 Billing & Invoices
[+ Create invoice]
*(Click above, use + Invoice in the header, or press Ctrl/Cmd+K → "Create Freelance OS invoice".)*
• Billing Schedule: Milestone deposit (50%) / Final delivery (50%)
• Payment Method: Bank Transfer / QR-bill (CHF)

## Client review checkpoints
[+ Add review checkpoint]
Add one task per review. Name the deliverable, set the feedback due date, and mark it complete when the client replies.
[ ] Client review checkpoint

## Decisions & updates
• 2026-10-24: Project initialized.
*(Tip: record client feedback, scope modifications, and architectural decisions below)*
```

---

### 3.3 Invoice Archetype

```markdown
## Invoice Summary & Scope
[+ Add deliverable]
Scope of work, deliverables, and services covered under this invoice for [Client Name].

## Commercial & Payment Details
[+ Copy payment details]
• QR-IBAN: CH44 0076 2011 6238 5295 8
• Client: [[Client Name]]
• Project: [[Project Name]]
• Amount & Currency: 3,500 CHF
• Payment Terms: Net due YYYY-MM-DD
• Payment Method: Swiss QR-bill / Bank Wire Transfer (Vermeulen Solutions)

## Delivery & Settlement Log
[+ Record payment]
• YYYY-MM-DD: Invoice sent to client.
• YYYY-MM-DD: Payment confirmed received and settled.
```

---

### 3.4 Support Session Archetype

```markdown
## Session Log & Delivered Work
[+ Log time]
• Date & Duration: YYYY-MM-DD (2.5 h)
• Client & Project: [[Client Name]] / [[Project Name]]
• Summary: Detailed summary of support delivered, bugs diagnosed, or features shipped.

## Client Follow-Up
[+ Add follow-up task]
[ ] Send session summary or updates to client

## Billing & Plan Allocation
[+ Create invoice]
• Care Plan: Growth Plan (2h included / month)
• Overrun / Billed Status: Covered under monthly retainer / Invoiced separately
```

---

## 4. Panel Menubar Header Actions

Thymer edit panels feature context-sensitive action buttons injected into the menubar (`.panel-menubar-buttons > .os-client-header-actions`):

| Active Panel Type | Rendered Header Controls | Context Action |
|---|---|---|
| **Client** | `[+ Project]` `[+ Invoice]` `[+ Time]` | Launches project, invoice, or support dialog with client pre-selected. |
| **Project** | `[+ Task]` `[+ Invoice]` `[+ Time]` | Launches task capture modal for this project, or invoice/support with client+project pre-selected. |
| **Invoice (Draft / Ready)** | `[+ Mark sent]` `[+ Record payment]` `[Copy details]` | Opens state transition modal with issue date pre-filled; copies Swiss QR-bill data. |
| **Invoice (Sent)** | `[+ Record payment]` `[Copy details]` | Opens full settlement modal with received date; copies payment details. |
| **Invoice (Paid)** | `[✓ Settled]` `[Copy details]` | Visual confirmation badge of settlement; copies archival payment details. |
| **Support Session** | `[+ Time]` `[+ Task]` `[+ Invoice]` | Logs follow-up time or converts session into task/invoice. |

### Archetype Consistency Rules:
1. **Always-On Action:** In-document action buttons (`+ Create project`, `+ Add task`, etc.) are ALWAYS present under their respective section headings on every record, regardless of whether children exist.
2. **Predictable Placement:** Action buttons are placed immediately under the section heading so users never need to scroll past long lists to initiate work.
3. **Dual Entry Points:** Every record provides two seamless ways to add work:
   - **Document level:** The in-document action pill (`.listitem-linkbtn`).
   - **Window level:** The persistent header menubar pill (`.os-header-action-btn`).
4. **Context Pre-fill:** Any creation modal launched from an active page automatically pre-selects and locks in that client and project.
5. **Non-Destructive Backfills:** Upgrades to existing records preserve all existing user notes, attachments, and customized task descriptions.
