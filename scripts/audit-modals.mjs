import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    console.log('Auditing Freelance OS Modals and Interactive Dialogs...');

    const auditResults = [];

    // Helper to evaluate and wait
    const evalCode = (code) => cdp.evaluate(code);

    // 1. Audit Add Task Modal
    console.log('\n1. Auditing Add Task Modal...');
    await evalCode(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        p.showAddTaskModal(panel, { projects: [{ guid: 'p1', name: 'Project Alpha' }] }, 'p1');
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const taskModalCheck = await evalCode(`(() => {
        const modal = document.querySelector('.os-modal-card');
        const title = modal?.querySelector('h3')?.innerText;
        const project = modal?.querySelector('.input-project')?.value;
        const input = modal?.querySelector('.input-task-text');
        const submit = modal?.querySelector('.btn-submit');
        
        // Trigger submit with empty text to test validation
        submit?.click();
        
        return {
            open: !!modal,
            title,
            preselectedProject: project,
            hasInput: !!input
        };
    })()`);
    console.log('Task modal opened & validated:', taskModalCheck);

    // Check validation toaster
    await new Promise(r => setTimeout(r, 300));
    const toast1 = await evalCode(`document.querySelector('.toaster, .ui-toaster')?.innerText || 'no-toast'`);
    console.log('Empty task submit toaster:', toast1);

    // Close task modal via Cancel
    await evalCode(`document.querySelector('.btn-cancel')?.click()`);
    await new Promise(r => setTimeout(r, 300));
    const taskClosed = await evalCode(`!document.querySelector('.os-modal-card')`);
    console.log('Task modal closed cleanly:', taskClosed);
    auditResults.push({ modal: 'AddTaskModal', open: taskModalCheck.open, closed: taskClosed });

    // 2. Audit Create Project Modal
    console.log('\n2. Auditing Create Project Modal...');
    await evalCode(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        p.showCreateProjectModal(panel, { clients: [{ guid: 'c1', name: 'Acme Corp' }] }, 'c1');
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const projModalCheck = await evalCode(`(() => {
        const modal = document.querySelector('.os-modal-card');
        return {
            open: !!modal,
            title: modal?.querySelector('h3')?.innerText,
            preselectedClient: modal?.querySelector('.input-client')?.value
        };
    })()`);
    console.log('Project modal opened:', projModalCheck);

    // Close via close button ✕
    await evalCode(`document.querySelector('.os-modal-close')?.click()`);
    await new Promise(r => setTimeout(r, 300));
    const projClosed = await evalCode(`!document.querySelector('.os-modal-card')`);
    console.log('Project modal closed cleanly:', projClosed);
    auditResults.push({ modal: 'CreateProjectModal', open: projModalCheck.open, closed: projClosed });

    // 3. Audit Create Invoice Modal
    console.log('\n3. Auditing Create Invoice Modal...');
    await evalCode(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        p.showCreateInvoiceModal(panel, { clients: [{ guid: 'c1', name: 'Acme Corp' }], projects: [] }, 'c1', '');
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const invModalCheck = await evalCode(`(() => {
        const modal = document.querySelector('.os-billing-dialog, .os-modal-card');
        return {
            open: !!modal,
            title: modal?.querySelector('h3')?.innerText,
            preselectedClient: modal?.querySelector('.input-client')?.value
        };
    })()`);
    console.log('Invoice modal opened:', invModalCheck);

    // Close via Cancel
    await evalCode(`document.querySelector('.btn-cancel')?.click()`);
    await new Promise(r => setTimeout(r, 300));
    const invClosed = await evalCode(`!document.querySelector('.os-billing-dialog')`);
    console.log('Invoice modal closed cleanly:', invClosed);
    auditResults.push({ modal: 'CreateInvoiceModal', open: invModalCheck.open, closed: invClosed });

    // 4. Audit Support Session Modal
    console.log('\n4. Auditing Support Session Modal...');
    await evalCode(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        p.showCreateSupportSessionModal(panel, { clients: [{ guid: 'c1', name: 'Acme Corp' }], projects: [] }, 'c1', '');
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const ssModalCheck = await evalCode(`(() => {
        const modal = document.querySelector('.os-modal-card');
        return {
            open: !!modal,
            title: modal?.querySelector('h3')?.innerText,
            preselectedClient: modal?.querySelector('.input-client')?.value
        };
    })()`);
    console.log('Support session modal opened:', ssModalCheck);

    // Close via close button
    await evalCode(`document.querySelector('.os-modal-close')?.click()`);
    await new Promise(r => setTimeout(r, 300));
    const ssClosed = await evalCode(`!document.querySelector('.os-modal-card')`);
    console.log('Support session modal closed cleanly:', ssClosed);
    auditResults.push({ modal: 'CreateSupportSessionModal', open: ssModalCheck.open, closed: ssClosed });

    // 5. Audit Billing State (Record Payment) Modal
    console.log('\n5. Auditing Billing State (Record Payment) Modal...');
    await evalCode(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        p.showBillingStateModal({
            guid: 'inv-test',
            invoiceId: 'FAC-TEST-001',
            clientName: 'Acme Corp',
            amount: 500,
            currency: 'CHF',
            status: 'unpaid',
            stage: 'sent'
        }, 'paid', panel);
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const payModalCheck = await evalCode(`(() => {
        const modal = document.querySelector('.os-billing-dialog');
        return {
            open: !!modal,
            title: modal?.querySelector('h3')?.innerText,
            dateInput: modal?.querySelector('#os-billing-action-date')?.value
        };
    })()`);
    console.log('Payment modal opened:', payModalCheck);

    // Close via Escape key
    await evalCode(`(() => {
        const form = document.querySelector('.os-billing-dialog');
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        form?.dispatchEvent(event);
    })()`);
    await new Promise(r => setTimeout(r, 300));
    const payClosed = await evalCode(`!document.querySelector('.os-billing-dialog')`);
    console.log('Payment modal closed via Escape:', payClosed);
    auditResults.push({ modal: 'RecordPaymentModal', open: payModalCheck.open, closed: payClosed });

    console.log('\n======================================================');
    console.log('Modal Audit Summary:\n', JSON.stringify(auditResults, null, 2));
    console.log('======================================================');

    cdp.close();
}
main().catch(console.error);
