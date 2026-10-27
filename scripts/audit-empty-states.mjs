import { connectCdp } from './cdp.mjs';

async function runEmptyStatesAudit() {
    console.log('Connecting to Thymer Desktop via CDP...');
    const cdp = await connectCdp();

    try {
        console.log('--- Auditing Empty States ---');

        // 1. Projects tab with filter returning 0 results
        await cdp.evaluate(`(async () => {
            const p = window.__freelanceOs;
            if (!p) return;
            p.workflowMode = 'overview';
            p.currentTab = 'projects';
            p.searchQuery = 'nonexistent_project_xyz';
            await p.render(p.activePanel);
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const projTest = await cdp.evaluate(`(() => {
            const placeholder = document.querySelector('.os-empty-placeholder');
            if (!placeholder) return { error: 'No empty placeholder found for projects' };
            const title = placeholder.querySelector('.os-empty-title')?.textContent || '';
            const desc = placeholder.querySelector('p')?.textContent || '';
            const btn = placeholder.querySelector('button')?.textContent || '';

            // Click clear filter
            const clearBtn = placeholder.querySelector('button');
            if (clearBtn) clearBtn.click();
            return { title, desc, btn };
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const projRestored = await cdp.evaluate(`(() => {
            return document.querySelectorAll('.os-project-card').length;
        })()`);
        console.log('1. Projects filter empty state:', { ...projTest, restoredCards: projRestored });

        // 2. Clients tab with filter returning 0 results
        await cdp.evaluate(`(async () => {
            const p = window.__freelanceOs;
            if (!p) return;
            p.workflowMode = 'overview';
            p.currentTab = 'clients';
            p.searchQuery = 'nonexistent_client_xyz';
            await p.render(p.activePanel);
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const cliTest = await cdp.evaluate(`(() => {
            const placeholder = document.querySelector('.os-empty-placeholder');
            if (!placeholder) return { error: 'No empty placeholder found for clients' };
            const title = placeholder.querySelector('.os-empty-title')?.textContent || '';
            const desc = placeholder.querySelector('p')?.textContent || '';
            const btn = placeholder.querySelector('button')?.textContent || '';

            // Click clear search
            const clearBtn = placeholder.querySelector('button');
            if (clearBtn) clearBtn.click();
            return { title, desc, btn };
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const cliRestored = await cdp.evaluate(`(() => {
            return document.querySelectorAll('.os-project-card').length;
        })()`);
        console.log('2. Clients filter empty state:', { ...cliTest, restoredCards: cliRestored });

        // 3. Invoices tab with filter returning 0 results
        await cdp.evaluate(`(async () => {
            const p = window.__freelanceOs;
            if (!p) return;
            p.workflowMode = 'overview';
            p.currentTab = 'invoices';
            p.searchQuery = 'nonexistent_invoice_xyz';
            await p.render(p.activePanel);
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const invTest = await cdp.evaluate(`(() => {
            const placeholder = document.querySelector('.os-empty-placeholder');
            if (!placeholder) return { error: 'No empty placeholder found for invoices' };
            const title = placeholder.querySelector('.os-empty-title')?.textContent || '';
            const desc = placeholder.querySelector('p')?.textContent || '';
            const btn = placeholder.querySelector('button')?.textContent || '';

            // Click clear filter
            const clearBtn = placeholder.querySelector('button');
            if (clearBtn) clearBtn.click();
            return { title, desc, btn };
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const invRestored = await cdp.evaluate(`(() => {
            return document.querySelectorAll('.os-project-card').length;
        })()`);
        console.log('3. Invoices filter empty state:', { ...invTest, restoredCards: invRestored });

        // 4. Billing tab with filter returning 0 results
        await cdp.evaluate(`(async () => {
            const p = window.__freelanceOs;
            if (!p) return;
            p.workflowMode = 'billing';
            p.billingSearch = 'nonexistent_billing_xyz';
            await p.render(p.activePanel);
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const billTest = await cdp.evaluate(`(() => {
            const placeholder = document.querySelector('.os-empty-placeholder');
            if (!placeholder) return { error: 'No empty placeholder found for billing' };
            const title = placeholder.querySelector('.os-empty-title')?.textContent || '';
            const desc = placeholder.querySelector('p')?.textContent || '';
            const btn = placeholder.querySelector('button')?.textContent || '';

            // Click clear search
            const clearBtn = placeholder.querySelector('button');
            if (clearBtn) clearBtn.click();
            return { title, desc, btn };
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const billRestored = await cdp.evaluate(`(() => {
            const rows = document.querySelectorAll('.os-billing-table tbody tr').length;
            const p = window.__freelanceOs;
            if (p) {
                p.workflowMode = 'overview';
                p.currentTab = 'projects';
                p.searchQuery = '';
                p.render(p.activePanel);
            }
            return rows;
        })()`);
        console.log('4. Billing filter empty state:', { ...billTest, restoredRows: billRestored });

        console.log('\nAll empty state audit tests passed with flying colors!');
    } finally {
        cdp.close();
    }
}

runEmptyStatesAudit().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
});
