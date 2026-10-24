import { connectCdp } from './cdp.mjs';
import fs from 'fs';

async function main() {
    const cdp = await connectCdp();
    const invGuid = '1QA2197GBC5GMWKWVGN9YQA14B'; // FAC-2026-001 (paid)
    console.log('Navigating to invoice FAC-2026-001...');
    const result = await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getActivePanel();
        panel.navigateTo({
            type: 'edit_panel',
            rootId: '${invGuid}',
            subId: null,
            workspaceGuid: p.getWorkspaceGuid()
        });
        return { ok: true };
    })()`);
    console.log('Navigation result:', result);

    await new Promise(r => setTimeout(r, 1500));

    // Force updatePanelHeaderActions
    await cdp.evaluate('window.__freelanceOs.updatePanelHeaderActions()');
    await new Promise(r => setTimeout(r, 600));

    const check = await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panels = p.ui.getPanels();
        return panels.map(pan => {
            const col = pan.getActiveCollection?.();
            const rec = pan.getActiveRecord?.();
            const outer = pan.getElement?.()?.closest('.panel');
            const headerBtns = Array.from(outer?.querySelectorAll('.os-client-header-actions button, .os-client-header-actions div') || []).map(el => ({
                text: el.innerText.trim(),
                className: el.className
            }));
            const docBtns = Array.from(outer?.querySelectorAll('.listitem-linkbtn, [data-doc-action]') || []).map(el => ({
                text: el.innerText.trim(),
                className: el.className
            }));
            return {
                title: pan.getTitle?.(),
                colName: col?.getName?.(),
                recName: rec?.name,
                recGuid: rec?.guid,
                headerBtns,
                docBtns
            };
        });
    })()`);
    console.log('Panels check:', JSON.stringify(check, null, 2));

    const shot = await cdp.screenshot();
    fs.writeFileSync('invoice-fac-2026-002.png', shot);
    console.log('Saved invoice-fac-2026-002.png');

    cdp.close();
}
main().catch(console.error);
