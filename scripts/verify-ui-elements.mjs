import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    
    // Trigger plugin update/reload
    console.log('Triggering plugin header update in Thymer Desktop...');
    await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        if (p?.updatePanelHeaderActions) {
            p.updatePanelHeaderActions();
        }
    })()`);

    await new Promise(r => setTimeout(r, 600));

    // 1. Verify Header Action Buttons
    const headerCheck = await cdp.evaluate(`(() => {
        const container = document.querySelector('.os-client-header-actions');
        if (!container) return { found: false };
        const projectBtn = container.querySelector('.os-header-btn-project');
        const invoiceBtn = container.querySelector('.os-header-btn-invoice');
        return {
            found: true,
            projectText: projectBtn?.innerText,
            invoiceText: invoiceBtn?.innerText,
            clientGuid: container.dataset.clientGuid,
            visible: container.getBoundingClientRect().width > 0
        };
    })()`);
    console.log('1. Header actions check:', JSON.stringify(headerCheck, null, 2));

    // 2. Verify In-Document linkbtn Button
    const docCheck = await cdp.evaluate(`(() => {
        const btn = document.querySelector('.listitem-linkbtn');
        if (!btn) return { found: false };
        const line = btn.querySelector('.line-div');
        const style = line ? window.getComputedStyle(line) : null;
        return {
            found: true,
            text: btn.innerText?.trim(),
            bg: style?.backgroundImage || style?.backgroundColor,
            color: style?.color,
            borderRadius: style?.borderRadius,
            cursor: style?.cursor
        };
    })()`);
    console.log('2. In-document button check:', JSON.stringify(docCheck, null, 2));

    // 3. Click Test: In-document button
    console.log('3. Testing click on in-document linkbtn...');
    await cdp.evaluate(`(() => {
        const line = document.querySelector('.listitem-linkbtn .line-div');
        line?.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    
    const docModalCheck = await cdp.evaluate(`(() => {
        const m = document.querySelector('.os-modal-backdrop');
        const title = m?.querySelector('.os-modal-header h3')?.innerText;
        const select = m?.querySelector('select[name="client"]');
        const clientVal = select?.options[select.selectedIndex]?.text;
        // Close modal
        document.querySelector('.os-modal-close')?.click();
        document.querySelector('.os-modal-backdrop')?.remove();
        return { opened: !!m, title, clientVal };
    })()`);
    console.log('   In-document click result:', JSON.stringify(docModalCheck, null, 2));

    await new Promise(r => setTimeout(r, 400));

    // 4. Click Test: Header + Project button
    console.log('4. Testing click on header + Project button...');
    await cdp.evaluate(`(() => {
        const btn = document.querySelector('.os-header-btn-project');
        btn?.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    
    const headerProjCheck = await cdp.evaluate(`(() => {
        const m = document.querySelector('.os-modal-backdrop');
        const title = m?.querySelector('.os-modal-header h3')?.innerText;
        // Close modal
        document.querySelector('.os-modal-close')?.click();
        document.querySelector('.os-modal-backdrop')?.remove();
        return { opened: !!m, title };
    })()`);
    console.log('   Header + Project click result:', JSON.stringify(headerProjCheck, null, 2));

    await new Promise(r => setTimeout(r, 400));

    // 5. Click Test: Header + Invoice button
    console.log('5. Testing click on header + Invoice button...');
    await cdp.evaluate(`(() => {
        const btn = document.querySelector('.os-header-btn-invoice');
        btn?.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    
    const headerInvCheck = await cdp.evaluate(`(() => {
        const m = document.querySelector('.os-modal-backdrop');
        const title = m?.querySelector('.os-modal-header h3')?.innerText;
        // Close modal
        document.querySelector('.os-modal-close')?.click();
        document.querySelector('.os-modal-backdrop')?.remove();
        return { opened: !!m, title };
    })()`);
    console.log('   Header + Invoice click result:', JSON.stringify(headerInvCheck, null, 2));

    cdp.close();
}

main().catch(console.error);
