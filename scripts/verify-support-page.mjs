import { connectCdp } from './cdp.mjs';
import fs from 'fs';

async function main() {
    const cdp = await connectCdp();
    const wsGuid = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2'; // Freelance OS
    const sessionGuid = '1M452EHDCC71G93V6V5B2ZKZ7K';

    console.log('Navigating to Support Session in Freelance OS...');
    await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getActivePanel();
        panel.navigateTo({
            type: 'edit_panel',
            rootId: '${sessionGuid}',
            subId: null,
            workspaceGuid: '${wsGuid}'
        });
    })()`);

    await new Promise(r => setTimeout(r, 1500));
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
    fs.writeFileSync('support-session-preview.png', shot);
    console.log('Saved support-session-preview.png');

    cdp.close();
}
main().catch(console.error);
