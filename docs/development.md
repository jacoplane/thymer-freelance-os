# Development and demo screenshots

## Build and deploy

```sh
npm ci
node build.mjs
node --test test/finance.test.mjs test/collection-views.test.mjs test/workflow.test.mjs test/starter.test.mjs
node deploy.mjs --workspace YOUR_WORKSPACE_GUID
```

Deployment uses Thymer Desktop’s local MCP endpoint, `http://127.0.0.1:13100/mcp`. Set `THYMER_MCP_ENDPOINT` if your instance uses another endpoint. It updates an installed dashboard by name; pass `--plugin PLUGIN_GUID` if its name has changed or is ambiguous.

Build outputs include `plugin.js`, `plugin.css`, their matching `dist/` files, the dashboard backup, and `dist/freelance-os-starter.json`. The starter is generated from `scripts/starter-schema.mjs`, contains no records or local workflow state, and uses the Plugins Manager schema version 2 backup format.
Source line endings are normalized and unchanged outputs are left untouched, so repeat builds do not churn the exported JSON files or their timestamps.

## Live verification

Inspect, change source, build, deploy, reload the saved plugin, then inspect and test again. Keep screenshots from real workspaces out of Git.

Live checks connect to Desktop’s CDP endpoint at `http://127.0.0.1:9444`. Launch Desktop with `--remote-debugging-port=9444` when running these checks. Always connect Puppeteer with `defaultViewport: null` and execute `Emulation.clearDeviceMetricsOverride`. Never call `page.setViewport()` or change the desktop window bounds. Test narrow layouts by opening native side panels.

```sh
node test/live-dashboard.mjs
node test/live-collections.mjs
node test/live-workflow.mjs
node test/live-create.mjs
```

Run these with the intended dashboard workspace active. Set `THYMER_WORKSPACE` to that explicit workspace GUID before the creation check. Set `OS_SKIP_RELOAD=1` if you have just reloaded the saved bundle yourself. `OS_ARTIFACT_DIR` selects a local screenshot directory. The workflow check creates temporary tasks and a dated review, verifies behavior, removes its fixtures and restores local workflow state. The creation check creates temporary client, project and invoice records, verifies their properties and a project status change, then moves only its own fixtures to Trash.

## Reproduce the fictional demo

Use a separate, empty workspace. Set it up first:

```sh
node scripts/setup-workspace.mjs --workspace YOUR_DEMO_WORKSPACE_GUID
node scripts/setup-workspace.mjs --workspace YOUR_DEMO_WORKSPACE_GUID --apply --install
node scripts/seed-demo.mjs --workspace YOUR_DEMO_WORKSPACE_GUID
node scripts/seed-demo.mjs --workspace YOUR_DEMO_WORKSPACE_GUID --apply
```

The seed command refuses collections that already contain records. It creates six fictional clients, six projects, seven invoices, native tasks and a service guide. Dates are relative to the seed day. Contacts use reserved `.example` domains. A local manifest is kept in the temporary directory under `freelance-os-demo`; set `OS_DEMO_STATE_DIR` to choose another location.

The seed writes native records only. In Today, select one next action per project and up to three focus tasks. Add a waiting reason/follow-up for a sample task. In Weekly review, write sample wins and priorities. Next-action choices are native references stored under each project’s **Next actions** section; focus pins, waiting notes and unsaved review drafts are local state.

Before publishing images, verify the visible workspace is the demo workspace and that every client, task, project, invoice and note belongs to the fictional dataset. Keep account settings, workspace switchers, notifications, developer tools, and personal workspace tabs out of screenshots. Publish only deliberately selected images in `docs/images/`.
