import { connectMcp } from './thymer-mcp.mjs';
import { connectCdp } from './cdp.mjs';
import fs from 'fs';

const WS = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
const COLS = {
    clients: '1DCV1BDVHH7Q4QV1TYAR6ZZF6E',
    projects: '16Z8HBEGE5GFSCYD4WN663GFJQ',
    invoices: '1F7GZ294EPP3QNHS96BDGAVC1E',
    support: '1EVR59WXRPZ7R1QWBSM0JQY3SX',
    journal: '1H91FMYKBY5HNVWRGBYNEJKVZT'
};

async function testPersona4() {
    console.log('=== TEST PERSONA 4: THE FRIDAY REVIEW STRATEGIST ===\n');
    const call = await connectMcp();

    // 1. Gather Retrospective Data
    console.log('1. Gathering weekly progress metrics...');
    const projects = await call('list_records', { workspace: WS, collection: COLS.projects });
    const clients = await call('list_records', { workspace: WS, collection: COLS.clients });
    const invoices = await call('list_records', { workspace: WS, collection: COLS.invoices });
    const support = await call('list_records', { workspace: WS, collection: COLS.support });

    console.log(`Active Ecosystem: ${clients.records?.length || 0} Clients & Leads, ${projects.records?.length || 0} Projects, ${invoices.records?.length || 0} Invoices, ${support.records?.length || 0} Support Sessions`);

    // 2. Draft Strategic Weekly Review Block
    console.log('\n2. Formulating Weekly Retrospective & Strategic Priorities...');
    const weeklyReviewMarkdown = `
## 🎯 Weekly Strategic Review · Week 43 (Oct 19–25, 2026)

### 🏆 Key Accomplishments This Week
- **Orbit Coffee:** Ingested new scope for Roastery E-Commerce Redesign (8,500 CHF budget), established project archetype and milestone breakdown.
- **Cashflow Settlements:** Collected **2,700 CHF** into bank account:
  - DEMO-006 (900 CHF, Portal discovery) settled.
  - DEMO-005 (1,800 CHF, Shop launch) settled.
- **Pipeline Growth:** Qualified new inbound lead **Atelier Végétal** (6,500 CHF estimated deal size).
- **Retainer Utilization:** Delivered **6.0 / 6.0h** contracted support across active retainer accounts. Flagged Northwind Studio overage (+1.25h) and staged billing.

### ⚠️ Blockers & Waiting On
- [ ] **Waiting on Sophie Laurent (Atelier Végétal):** Brand guidelines and e-commerce catalog export.
- [ ] **Proposal Deadline:** Atelier Végétal e-commerce proposal due Wednesday Oct 28.

### 🪨 Top 3 Big Rocks for Next Week
- [ ] **Rock 1 (Pipeline):** Finalize and send Atelier Végétal proposal (6,500 CHF) by Wednesday afternoon.
- [ ] **Rock 2 (Delivery):** Scaffold Shopify architecture and component design system for Orbit Coffee.
- [ ] **Rock 3 (Cashflow):** Issue INV-2026-009 (187.50 CHF) to Northwind Studio and review November recurring retainers.
`;

    // 3. Persist into Journal via add_to_journal
    console.log('\n3. Persisting weekly review into Journal page for 2026-10-25...');
    const addRes = await call('add_to_journal', {
        workspace: WS,
        date: '2026-10-25',
        markdown: weeklyReviewMarkdown
    });
    console.log('✓ add_to_journal completed:', typeof addRes === 'object' ? JSON.stringify(addRes) : addRes);

    // 4. Verify Journal page content via get_journal_page
    console.log('\n4. Reading back journal page to verify integrity...');
    const journalContent = await call('get_journal_page', {
        workspace: WS,
        date: '2026-10-25',
        format: 'markdown'
    });
    console.log('Journal Page Content preview:\n', typeof journalContent === 'string' ? journalContent.slice(0, 400) + '...' : JSON.stringify(journalContent).slice(0, 400));

    // 5. Navigate to Journal page in Thymer UI via CDP and take screenshot
    console.log('\n5. Navigating to Journal in UI via CDP...');
    const cdp = await connectCdp();
    await new Promise(r => setTimeout(r, 1000));

    // Call navigate_to_journal tool
    await call('navigate_to_journal', {
        workspace: WS,
        date: '2026-10-25'
    });
    await new Promise(r => setTimeout(r, 1500));

    const shot = await cdp.screenshot();
    const shotPath = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\3a871dc0-e9e9-4ac5-b31e-fe33e0535c90\\persona-4-journal-live.png';
    fs.writeFileSync(shotPath, shot);
    console.log(`✓ Saved screenshot: ${shotPath}`);

    // Switch back to Freelance OS panel
    await cdp.evaluate(`(() => {
        const tabs = Array.from(document.querySelectorAll('.os-workflow-modes button, .os-tab-btn, button'));
        const today = tabs.find(b => b.innerText.trim().includes('Today'));
        if (today) today.click();
    })()`);
    await new Promise(r => setTimeout(r, 800));

    const todayShot = await cdp.screenshot();
    const todayShotPath = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\3a871dc0-e9e9-4ac5-b31e-fe33e0535c90\\persona-4-today-live.png';
    fs.writeFileSync(todayShotPath, todayShot);
    console.log(`✓ Saved Freelance OS Today screenshot: ${todayShotPath}`);

    cdp.close();

    console.log('\n=== PERSONA 4 TEST COMPLETED SUCCESSFULLY ===');
}

testPersona4().catch(err => {
    console.error('Persona 4 test failed:', err);
    process.exit(1);
});
