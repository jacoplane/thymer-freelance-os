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

Client records follow a consistent four-section layout:

```markdown
## Relationship & Context
Background, commercial terms, and communication preferences.

## Active Projects & Engagements
[+ Create project]
• [[Active Project 1]] (in progress)
• [[Active Project 2]] (in progress)

## 📋 Open Tasks & Actions
### Account & Relationship Tasks
[ ] Initial kickoff / account follow-up

### Active Project Tasks
*(Tasks added to linked projects automatically roll up here.)*

## 📝 Communication & Decisions Log
• 2026-10-24: Client profile created.
```

### Archetype Consistency Rules:
1. **Always-On Action:** The `[+ Create project]` in-document button is ALWAYS present under `Active Projects & Engagements` on every client, regardless of whether they have 0 or 10 active projects.
2. **Predictable Placement:** The action button is placed immediately under the section heading so users never need to scroll past long project lists to initiate work.
3. **Dual Entry Points:** Every client page provides two seamless ways to add work:
   - **Document level:** The in-document `[+ Create project]` button.
   - **Window level:** The persistent header menubar pill `[📁 + Project]`.
4. **Context Pre-fill:** Any creation modal launched from a client page automatically pre-selects and locks in that client.
