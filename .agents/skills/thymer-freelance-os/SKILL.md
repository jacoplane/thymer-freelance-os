---
name: thymer-freelance-os
description: >-
  Autonomous iterative development runbook for the Thymer Freelance OS plugin.
  Use whenever developing, inspecting, styling, debugging, building, deploying,
  or testing the Freelance OS dashboard plugin in Thymer Desktop.
---

# Thymer Freelance OS Iterative Development Runbook

This skill defines the battle-tested, zero-disruption iterative workflow for developing, testing, and refining the **Freelance OS** executive dashboard plugin for Thymer Desktop.

---

## 1. Environment & Targets Reference

| Property | Value | Notes |
| :--- | :--- | :--- |
| **Codebase Root** | `C:\dev\thymer-freelance-os` | Primary repository |
| **Git Remote** | `https://github.com/jacoplane/thymer-freelance-os.git` | Branch: `main` |
| **Active Workspace GUID** | `WNN1JJG50ZQ6BE9S1T3HG85S57` | `jacoplane` |
| **Freelance OS Plugin GUID** | `198WZ858D9JC12CY5SWW9GSZFJ` | Global AppPlugin |
| **Thymer MCP Server** | `http://127.0.0.1:13100/` | JSON-RPC MCP Tools |
| **Thymer Chrome CDP Port** | `http://127.0.0.1:9444` | Live browser automation |

### Collection GUIDs
- **Projects**: `1B0J3X9Y8QS96C75M3QMT23DNW`
- **Clients**: `1FD58J39X6KJ4JK5F06T7P4TSR`
- **Invoices**: `1YT6YD3EYV6F06TZY5GKGVJMNR`
- **Library (Care Plans)**: `16YBSRJPHPAFJCRTZDWJJEF5QG`
- **Journal**: `16S1WSXAWSHVHJZ72G6J3JRTCP`

---

## 2. The 6-Step Iterative Loop

Always follow this cycle when developing features or fixing bugs in Freelance OS:

```text
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Inspect DOM & Visuals via Puppeteer (CDP :9444)          │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 2. Modify Source Files (src/index.js & src/styles.css)       │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 3. Build Plugin Bundle (node build.mjs)                     │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 4. Deploy Live via MCP (node deploy.mjs -> Port 13100)      │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 5. Commit & Push Changes to Git (origin main)               │
  └──────────────────────────────┬──────────────────────────────┘
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 6. Trigger Live Refresh & Verify Layout/State               │
  └─────────────────────────────────────────────────────────────┘
```

---

## 3. Strict Rules & Guardrails

### A. Window Resolution Protection (CRITICAL)
- **Problem**: Connecting Puppeteer without explicit options overrides the Electron renderer with a mobile/fixed 800x600 viewport, shrinking the user's application window.
- **Rules**:
  1. ALWAYS connect Puppeteer with `defaultViewport: null`:
     ```javascript
     const browser = await puppeteer.connect({
         browserURL: 'http://127.0.0.1:9444',
         defaultViewport: null
     });
     ```
  2. ALWAYS send `Emulation.clearDeviceMetricsOverride` immediately after connecting:
     ```javascript
     const p = (await browser.pages())[0];
     const client = await p.createCDPSession();
     await client.send('Emulation.clearDeviceMetricsOverride');
     ```
  3. **NEVER** call `page.setViewport()` with synthetic numbers.

### B. Thymer Navigation Protocol
- **Individual Records**: Must use `{ type: 'edit_panel', rootId: recordGuid, workspaceGuid }`.
- **Collections / Overviews**: Must use `{ type: 'overview', rootId: collectionGuid, workspaceGuid }`.
  - *Warning*: Calling `edit_panel` on a collection GUID causes Thymer to crash the panel with `"Failed to load panel"`.
- **Side Panels**: Always create side-by-side panels so the dashboard remains visible:
  ```javascript
  const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
  sidePanel.navigateTo({ type: 'overview', rootId: colGuid, workspaceGuid });
  ```

### C. Multi-Panel Responsive Design
- Do not use viewport-based `@media (max-width: ...)` queries for panel layout; monitor width does not change when side panels open.
- Use **CSS Container Queries** on `.os-app`:
  ```css
  .os-app {
    container-type: inline-size;
    container-name: osApp;
  }
  @container osApp (max-width: 1120px) { /* Split view layout */ }
  @container osApp (max-width: 720px)  { /* Narrow/mobile layout */ }
  ```
- **DO NOT** apply `width: 100% !important` to `.panel`. Apply breakout width exclusively to inner elements (`.panel-content`, `.editor`, `.panel-body`).

---

## 4. Helper Commands Reference

All commands run inside `C:\dev\thymer-freelance-os`:

```powershell
# 1. Build plugin
node build.mjs

# 2. Deploy to Thymer Desktop via MCP
node deploy.mjs

# 3. Commit & push
git add src/ dist/ plugin.js plugin.css
git commit -m "feat: description"
git push origin main
```
