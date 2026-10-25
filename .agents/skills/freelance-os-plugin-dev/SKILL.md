---
name: freelance-os-plugin-dev
description: >-
  Autonomous iterative development runbook for the Thymer Freelance OS plugin.
  Use whenever developing, inspecting, styling, debugging, building, deploying,
  or testing the Freelance OS dashboard plugin in Thymer Desktop.
---

# Thymer Freelance OS Iterative Development Runbook

This skill defines the battle-tested, zero-disruption iterative workflow for developing, testing, and refining the **Freelance OS** executive dashboard plugin for Thymer Desktop.

---

## 1. Environment & Targets Reference

| Property | Production (`jacoplane`) | Test Workspace (`Freelance OS`) | Notes |
| :--- | :--- | :--- | :--- |
| **Workspace GUID** | `WNN1JJG50ZQ6BE9S1T3HG85S57` | `W8JXPTMKY8DEDMGB3JZ6ARRHJ2` | Never run destructive tests on prod |
| **Plugin GUID** | `198WZ858D9JC12CY5SWW9GSZFJ` | `1Y01APTHH8RZN3BRYVHQT0YXQP` | Global AppPlugin |
| **Projects Collection** | `1B0J3X9Y8QS96C75M3QMT23DNW` | `16Z8HBEGE5GFSCYD4WN663GFJQ` | Project deliverables & tasks |
| **Clients Collection** | `1FD58J39X6KJ4JK5F06T7P4TSR` | `1DCV1BDVHH7Q4QV1TYAR6ZZF6E` | Leads & active clients |
| **Invoices Collection** | `1YT6YD3EYV6F06TZY5GKGVJMNR` | `1F7GZ294EPP3QNHS96BDGAVC1E` | Invoices & cashflow |
| **Support Sessions** | (dynamic query) | `1EVR59WXRPZ7R1QWBSM0JQY3SX` | Retainer & care plan hours |
| **Library (Care Plans)** | `16YBSRJPHPAFJCRTZDWJJEF5QG` | `1V5S8ETK2VEYAVV9FWFKKBPNPW` | Retainer tiers & offerings |
| **Journal** | `16S1WSXAWSHVHJZ72G6J3JRTCP` | `1H91FMYKBY5HNVWRGBYNEJKVZT` | Daily & weekly standup logs |
| **MCP Server Port** | `http://127.0.0.1:13100/mcp` | `http://127.0.0.1:13100/mcp` | Built-in JSON-RPC tools |
| **Chrome CDP Port** | `http://127.0.0.1:9444` | `http://127.0.0.1:9444` | Remote debugging endpoint |

---

## 2. Running Thymer Desktop in Electron Debug Mode

Thymer Desktop is an Electron application. For live DOM inspection, screenshot verification, and automated testing, it must run with remote debugging enabled.

### A. The Single-Instance Lock Trap
Electron applications enforce a single-instance lock (`app.requestSingleInstanceLock()`). If Thymer is already running in the background or system tray without the debugging flag, launching `Thymer.exe --remote-debugging-port=9444` will simply focus the existing instance and exit immediately without opening port 9444.

**Always terminate existing instances before starting in debug mode:**
```powershell
taskkill /F /IM Thymer.exe /T 2>$null
```

### B. Launch Command
Launch the executable located at `C:\Users\Jaap\AppData\Local\Programs\thymer\Thymer.exe`:
```powershell
# Preferred via npm script in c:\dev\thymer-freelance-os:
node scripts/launch-debug.mjs

# Or directly in PowerShell:
cmd.exe /c "start /wait C:\Users\Jaap\AppData\Local\Programs\thymer\Thymer.exe --remote-debugging-port=9444"
```

### C. Account Picker Automation (`accounts.html`)
On a fresh start, Thymer opens a modal "Choose Account" screen (`accounts.html`). This blocks the renderer and MCP until the account is clicked.
Run `scripts/launch-debug.mjs` (or `scripts/click-account.mjs`) to automatically click `jacoplane` via CDP and enter the workspace.

### D. Verifying Health
```powershell
# 1. Check CDP is active and list pages:
curl.exe -s http://127.0.0.1:9444/json

# 2. Check MCP is ready:
node -e "fetch('http://127.0.0.1:13100/mcp', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_current_user',arguments:{}}})}).then(r=>r.json()).then(console.log)"
```

---

## 3. The 6-Step Iterative Development Loop

```text
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Inspect DOM & Visuals via Puppeteer / CDP (:9444)        │
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

## 4. Strict Rules & Guardrails

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

### B. Plugin Bundle Runtime Compatibility (NO `export` KEYWORDS)
- **Problem**: Thymer loads and executes plugin code inside the renderer via `new Function(...)`. In JavaScript, `export` statements inside `new Function(...)` throw a fatal `SyntaxError: Unexpected token 'export'`, which crashes the plugin loader and stalls the MCP backend bridge.
- **Rule**: `dist/plugin.js` must be a plain self-contained script. All helper objects (`Workflow`, `Billing`, `Updater`) must be declared with `const` and merged via `Object.assign(Plugin.prototype, ...)`. Never use ES module `export` or `import` in the bundle.

### C. Thymer Navigation Protocol
- **Individual Records**: Must use `{ type: 'edit_panel', rootId: recordGuid, workspaceGuid }`.
- **Collections / Overviews**: Must use `{ type: 'overview', rootId: collectionGuid, workspaceGuid }`.
  - *Warning*: Calling `edit_panel` on a collection GUID causes Thymer to crash the panel with `"Failed to load panel"`.
- **Side Panels**: Always create side-by-side panels so the dashboard remains visible:
  ```javascript
  const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
  sidePanel.navigateTo({ type: 'overview', rootId: colGuid, workspaceGuid });
  ```

### D. Multi-Panel Responsive Design
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

## 5. Helper Commands Reference

All commands run inside `C:\dev\thymer-freelance-os`:

```powershell
# 1. Start Thymer Desktop with Electron CDP debugging on port 9444:
node scripts/launch-debug.mjs

# 2. Build plugin bundle (cleans exports and validates bundle size):
node build.mjs

# 3. Deploy to Test Workspace:
node deploy.mjs --workspace W8JXPTMKY8DEDMGB3JZ6ARRHJ2 --plugin 1Y01APTHH8RZN3BRYVHQT0YXQP

# 4. Deploy to Production Workspace:
node deploy.mjs --workspace WNN1JJG50ZQ6BE9S1T3HG85S57 --plugin 198WZ858D9JC12CY5SWW9GSZFJ

# 5. Capture live screenshot without altering resolution:
node scripts/take-screenshot.mjs

# 6. Publish a new release (automated bump, build, commit, tag, push & GitHub release):
npm run release # defaults to patch bump, or pass minor/major
```

---

## 6. In-Plugin Update Architecture

Freelance OS includes a built-in release checker (`src/updater.js`):
- **Background Checks:** Runs every 4 hours against `raw.githubusercontent.com/jacoplane/thymer-freelance-os/main/dist/plugin.json`.
- **Default User Experience:** Non-intrusive toaster notification with `[Update now]` and `[Later]` buttons. Users are never forced into unconsented updates.
- **Opt-in Silent Updates:** Setting toggle in **Settings -> Plugin Updates** or via Command Palette (`Freelance OS: Toggle automatic updates`). When enabled, downloads and hot-reloads updates silently.
- **Plugins Manager Compatibility:** Emits `__source_repo` in plugin metadata so Thymer's native Plugins Manager also detects updates.
