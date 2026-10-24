import { connectCdp } from './cdp.mjs';
import fs from 'fs';

async function main() {
    const cdp = await connectCdp();
    const invGuid = '1HDNG62PFWJHN1N9C32MWJ8NZD'; // FAC-2026-002 (unpaid)
    console.log('Navigating to unpaid invoice FAC-2026-002...');
    await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getActivePanel();
        panel.navigateTo({
            type: 'edit_panel',
            rootId: '${invGuid}',
            subId: null,
            workspaceGuid: p.getWorkspaceGuid()
        });
    })()`);

    await new Promise(r => setTimeout(r, 1200));
    await cdp.evaluate('window.__freelanceOs.updatePanelHeaderActions()');
    await new Promise(r => setTimeout(r, 600));

    console.log('Clicking [+ Record payment] in header...');
    const clickRes = await cdp.evaluate(`(() => {
        const btn = document.querySelector('.os-header-btn-paid');
        if (!btn) return { ok: false, error: 'Button not found' };
        btn.click();
        return { ok: true };
    })()`);
    console.log('Click result:', clickRes);

    await new Promise(r => setTimeout(r, 600));

    const modalCheck = await cdp.evaluate(`(() => {
        const modal = document.querySelector('.os-billing-dialog, .os-modal-card');
        return {
            open: !!modal,
            title: modal?.querySelector('h3')?.innerText,
            inputs: Array.from(modal?.querySelectorAll('input, select') || []).map(i => ({ id: i.id, val: i.value }))
        };
    })()`);
    console.log('Modal check:', JSON.stringify(modalCheck, null, 2));

    const shot = await cdp.screenshot();
    fs.writeFileSync('record-payment-modal.png', shot);
    console.log('Saved record-payment-modal.png');

    // Close modal safely with Escape
    await cdp.evaluate(`(() => {
        const closeBtn = document.querySelector('.os-modal-close, .btn-cancel');
        if (closeBtn) closeBtn.click();
    })()`);

    cdp.close();
}
main().catch(console.error);
