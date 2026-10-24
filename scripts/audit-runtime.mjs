import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    const consoleLogs = [];
    const exceptions = [];

    // Attach listener via evaluate
    await cdp.evaluate(`(() => {
        window.__auditLogs = [];
        window.__auditErrors = [];
        const origErr = console.error;
        const origWarn = console.warn;
        console.error = function(...args) {
            window.__auditErrors.push({ type: 'error', text: args.map(String).join(' ') });
            origErr.apply(console, args);
        };
        console.warn = function(...args) {
            window.__auditLogs.push({ type: 'warn', text: args.map(String).join(' ') });
            origWarn.apply(console, args);
        };
        window.addEventListener('error', function(e) {
            window.__auditErrors.push({ type: 'uncaught', message: e.message, filename: e.filename, lineno: e.lineno });
        });
        window.addEventListener('unhandledrejection', function(e) {
            window.__auditErrors.push({ type: 'unhandledrejection', reason: String(e.reason) });
        });
    })()`);

    // Exercise functions
    console.log('Exercising Freelance OS methods to probe for runtime exceptions...');
    const exerciseRes = await cdp.evaluate(`(async () => {
        const p = window.__freelanceOs;
        const results = {};
        
        // 1. loadData
        try {
            const data = await p.loadData();
            results.loadData = { ok: true, clientCount: data.clients?.length, projectCount: data.projects?.length, invoiceCount: data.invoices?.length };
        } catch (e) {
            results.loadData = { ok: false, error: e.message };
        }

        // 2. updatePanelHeaderActions
        try {
            await p.updatePanelHeaderActions();
            results.updatePanelHeaderActions = { ok: true };
        } catch (e) {
            results.updatePanelHeaderActions = { ok: false, error: e.message };
        }

        // 3. resolveRecordContext on each panel
        try {
            const panels = p.ui.getPanels();
            const panelRes = [];
            for (const pan of panels) {
                const rec = pan.getActiveRecord?.();
                const ctx = await p.resolveRecordContext(pan, rec?.guid);
                panelRes.push({ rec: rec?.guid, ctx });
            }
            results.resolveRecordContext = { ok: true, panelRes };
        } catch (e) {
            results.resolveRecordContext = { ok: false, error: e.message };
        }

        return results;
    })()`);
    console.log('Exercise results:\n', JSON.stringify(exerciseRes, null, 2));

    await new Promise(r => setTimeout(r, 1000));

    const errors = await cdp.evaluate(`(() => {
        return {
            errors: window.__auditErrors,
            warnings: window.__auditLogs
        };
    })()`);
    console.log('Captured runtime logs:\n', JSON.stringify(errors, null, 2));

    cdp.close();
}
main().catch(console.error);
