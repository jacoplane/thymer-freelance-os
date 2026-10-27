import { connectCdp } from './cdp.mjs';

async function auditModals() {
    const cdp = await connectCdp();
    console.log('Auditing Modal Dialog Accessibility in Freelance OS...');

    // Switch to Overview tab
    await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        if (p) {
            p.workflowMode = 'overview';
            p.render(p.activePanel);
        }
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const modals = [
        { name: 'Create Project Modal', trigger: '.btn-new-project', close: '.os-modal-close' },
        { name: 'Create Client Modal', trigger: '.btn-new-client', close: '.os-modal-close' },
        { name: 'Create Lead Modal', trigger: '.btn-new-lead', close: '.os-modal-close' },
        { name: 'Create Invoice Modal', trigger: '.btn-new-invoice', close: '.os-modal-close' },
        { name: 'Log Support Time Modal', trigger: '.btn-log-support', close: '.os-modal-close' },
    ];

    for (const m of modals) {
        console.log(`\nTesting modal: ${m.name}...`);
        
        // Click trigger
        const opened = await cdp.evaluate(`(() => {
            const btn = document.querySelector('${m.trigger}');
            if (!btn) return false;
            btn.click();
            return true;
        })()`);

        if (!opened) {
            console.log(`  Failed to open trigger ${m.trigger}`);
            continue;
        }

        await new Promise(r => setTimeout(r, 400));

        // Evaluate modal dialog a11y
        const result = await cdp.evaluate(`(() => {
            const dialog = document.querySelector('.os-modal-card');
            if (!dialog) return { found: false, error: 'No .os-modal-card found' };

            const issues = [];
            const role = dialog.getAttribute('role');
            if (role !== 'dialog' && role !== 'alertdialog') {
                issues.push('Missing role="dialog" or "alertdialog"');
            }
            if (dialog.getAttribute('aria-modal') !== 'true') {
                issues.push('Missing aria-modal="true"');
            }
            const labelledby = dialog.getAttribute('aria-labelledby');
            if (!labelledby) {
                issues.push('Missing aria-labelledby attribute');
            } else {
                const titleEl = document.getElementById(labelledby);
                if (!titleEl || !titleEl.textContent.trim()) {
                    issues.push(\`aria-labelledby="\${labelledby}" does not reference a valid non-empty element\`);
                }
            }

            // Check inputs inside modal
            const inputs = dialog.querySelectorAll('input:not([type="hidden"]), select, textarea');
            inputs.forEach(inp => {
                const tag = inp.tagName.toLowerCase();
                const id = inp.id;
                const hasLabel = (inp.labels && inp.labels.length > 0) || !!inp.closest('label');
                const ariaLabel = inp.getAttribute('aria-label');
                const title = inp.getAttribute('title');
                if (!hasLabel && !ariaLabel && !title) {
                    issues.push(\`<\${tag} id="\${id}" class="\${inp.className}"> has no associated <label> or aria-label\`);
                }
            });

            // Check buttons inside modal
            const buttons = dialog.querySelectorAll('button');
            buttons.forEach(btn => {
                const text = btn.textContent.trim();
                const ariaLabel = btn.getAttribute('aria-label');
                const title = btn.getAttribute('title');
                if (!text && !ariaLabel && !title) {
                    issues.push(\`<button class="\${btn.className}"> has no text, aria-label, or title\`);
                }
            });

            return { found: true, issues };
        })()`);

        if (!result.found) {
            console.error(`  Modal error: ${result.error}`);
        } else if (result.issues.length === 0) {
            console.log(`  ✓ 0 accessibility issues! Valid ARIA dialog, label, and form controls.`);
        } else {
            console.error(`  Issues found in ${m.name}:`);
            result.issues.forEach(iss => console.error(`    - ${iss}`));
        }

        // Close modal
        await cdp.evaluate(`(() => {
            const closeBtn = document.querySelector('${m.close}');
            if (closeBtn) closeBtn.click();
            else {
                const cancelBtn = document.querySelector('.btn-cancel');
                if (cancelBtn) cancelBtn.click();
            }
        })()`);
        await new Promise(r => setTimeout(r, 300));
    }

    cdp.close();
}

auditModals().catch(console.error);
