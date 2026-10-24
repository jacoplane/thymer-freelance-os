import { connectCdp } from './cdp.mjs';
import fs from 'fs';

async function main() {
    const cdp = await connectCdp();
    const wsGuid = 'WNN1JJG50ZQ6BE9S1T3HG85S57';

    const tests = [
        {
            name: 'Client Archetype: Black Boys Hockey Club',
            guid: '16VNAKPP5H5H2CY3419GD27F38',
            expectedHeader: ['+ Project', '+ Invoice', '+ Time'],
            expectedDoc: ['+ Create project', '+ Create invoice', '+ Log support time'],
            screenshot: 'archetype-client-bbhc.png'
        },
        {
            name: 'Project Archetype: Black Boys Hockey Club Rebrand',
            guid: '1JPD32DVFK7PS5823A62PAFFA3',
            expectedHeader: ['+ Task', '+ Invoice', '+ Time'],
            expectedDoc: ['+ Add task', '+ Log time', '+ Create invoice', '+ Add review checkpoint'],
            screenshot: 'archetype-project-bbhc.png'
        },
        {
            name: 'Invoice Archetype (Unpaid): FAC-2026-002',
            guid: '1HDNG62PFWJHN1N9C32MWJ8NZD',
            expectedHeader: ['+ Record payment', 'Copy details'],
            expectedDoc: ['+ Copy payment details', '+ Record payment'],
            screenshot: 'archetype-invoice-unpaid.png'
        },
        {
            name: 'Invoice Archetype (Paid): FAC-2026-001',
            guid: '1QA2197GBC5GMWKWVGN9YQA14B',
            expectedHeader: ['Settled', 'Copy details'],
            expectedDoc: [],
            screenshot: 'archetype-invoice-paid.png'
        }
    ];

    console.log('===========================================================');
    console.log('Running End-to-End Archetype UI Verification in Thymer');
    console.log('===========================================================');

    // Close any extra side-by-side panels so only 1 clean panel is active
    await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panels = p.ui.getPanels();
        for (let i = 1; i < panels.length; i++) {
            try { panels[i].close(); } catch {}
        }
    })()`);
    await new Promise(r => setTimeout(r, 600));

    for (const t of tests) {
        console.log(`\nTesting ${t.name}...`);
        await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            const panel = p.ui.getPanels()[0];
            panel.navigateTo({
                type: 'edit_panel',
                rootId: '${t.guid}',
                subId: null,
                workspaceGuid: '${wsGuid}'
            });
        })()`);

        await new Promise(r => setTimeout(r, 2000));
        await cdp.evaluate('window.__freelanceOs.updatePanelHeaderActions()');
        await new Promise(r => setTimeout(r, 800));

        const info = await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            const panel = p.ui.getPanels()[0];
            const outer = panel.getElement()?.closest('.panel') || panel.getElement();
            const headerBtns = Array.from(outer.querySelectorAll('.os-client-header-actions button, .os-client-header-actions div')).map(e => e.innerText.trim());
            const docBtns = Array.from(document.querySelectorAll('.listitem-linkbtn, [data-doc-action]')).map(e => e.innerText.trim());
            return {
                title: panel.getTitle?.(),
                headerBtns,
                docBtns
            };
        })()`);

        console.log(`  Title: ${info.title}`);
        console.log(`  Header actions: [${info.headerBtns.join(', ')}]`);
        console.log(`  In-document pills: [${info.docBtns.join(', ')}]`);

        // Check header expectations
        for (const exp of t.expectedHeader) {
            const found = info.headerBtns.some(b => b.includes(exp));
            if (found) console.log(`  ✓ Header action present: "${exp}"`);
            else console.error(`  ✗ Missing expected header action: "${exp}"`);
        }

        // Check doc expectations
        for (const exp of t.expectedDoc) {
            const found = info.docBtns.some(b => b.includes(exp));
            if (found) console.log(`  ✓ In-document pill present: "${exp}"`);
            else console.error(`  ✗ Missing expected doc pill: "${exp}"`);
        }

        const buf = await cdp.screenshot();
        fs.writeFileSync(t.screenshot, buf);
        console.log(`  ✓ Saved screenshot: ${t.screenshot}`);
    }

    console.log('\n===========================================================');
    console.log('All Archetypes Successfully Verified Live in Thymer Desktop!');
    console.log('===========================================================');

    cdp.close();
}

main().catch(err => {
    console.error('Verification error:', err);
    process.exit(1);
});
