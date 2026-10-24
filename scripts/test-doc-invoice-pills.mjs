import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    const invGuid = '1HDNG62PFWJHN1N9C32MWJ8NZD'; // FAC-2026-002 (unpaid)
    console.log('Navigating to unpaid invoice FAC-2026-002...');
    await cdp.evaluate(`(async () => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        await panel.navigateTo({
            type: 'edit_panel',
            rootId: '${invGuid}',
            subId: null,
            workspaceGuid: p.getWorkspaceGuid()
        });
        await new Promise(r => setTimeout(r, 1000));
        await p.updatePanelHeaderActions();
    })()`);

    await new Promise(r => setTimeout(r, 2000));

    const checkDom = await cdp.evaluate(`(async () => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        const panelEl = panel.getElement()?.closest('.panel') || panel.getElement();
        const scrollables = Array.from(panelEl.querySelectorAll('*')).filter(el => el.scrollHeight > el.clientHeight + 10).map(el => ({
            tag: el.tagName,
            className: el.className,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight
        }));
        return {
            scrollables
        };
    })()`);
    console.log('Scrollables check:', JSON.stringify(checkDom, null, 2));

    console.log('Testing in-document [+ Copy payment details] pill click...');
    const copyRes = await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        const panelEl = panel.getElement()?.closest('.panel') || panel.getElement();
        const btns = Array.from(panelEl.querySelectorAll('.listitem-linkbtn, [data-doc-action]'));
        const copyBtn = btns.find(b => b.innerText.includes('Copy payment') || b.innerText.includes('copy payment'));
        if (!copyBtn) return { ok: false, error: 'Copy button not found' };
        copyBtn.click();
        return { ok: true };
    })()`);
    console.log('Copy button click result:', copyRes);

    await new Promise(r => setTimeout(r, 600));

    const toaster = await cdp.evaluate(`(() => {
        const t = document.querySelector('.toaster, .ui-toaster, [role="alert"]');
        return t ? t.innerText : 'No toaster detected';
    })()`);
    console.log('Toaster notification:', toaster);

    console.log('Testing in-document [+ Record payment] pill click...');
    const payRes = await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        const panelEl = panel.getElement()?.closest('.panel') || panel.getElement();
        const btns = Array.from(panelEl.querySelectorAll('.listitem-linkbtn, [data-doc-action]'));
        const payBtn = btns.find(b => b.innerText.includes('Record payment') || b.innerText.includes('+ Record payment'));
        if (!payBtn) return { ok: false, error: 'Payment button not found' };
        payBtn.click();
        return { ok: true };
    })()`);
    console.log('Payment button click result:', payRes);

    await new Promise(r => setTimeout(r, 600));

    const modal = await cdp.evaluate(`(() => {
        const card = document.querySelector('.os-billing-dialog');
        return {
            open: !!card,
            title: card?.querySelector('h3')?.innerText
        };
    })()`);
    console.log('In-document pill triggered modal:', modal);

    // Close modal
    await cdp.evaluate(`(() => {
        const closeBtn = document.querySelector('.os-modal-close, .btn-cancel');
        if (closeBtn) closeBtn.click();
    })()`);

    cdp.close();
}
main().catch(console.error);
