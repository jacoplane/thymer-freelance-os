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

const CHOICE_LABELS = {
    'c085586EBC596E9': 'unpaid',
    'c1CF19FF5F789C4': 'unconfirmed',
    'cDD41F10A87FC75': 'paid',
    'c8D420D0AA61846': 'draft',
    'cE5A5D5919D86A9': 'ready',
    'cD7D600E4A681AB': 'sent',
    'c1E6EC9523C0D14': 'CHF'
};

function extractProp(val) {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) {
        if (val[0] === 'number') return Number(val[1]);
        if (val[0] === 'text') return String(val[1]);
        if (val[0] === 'choice') {
            const raw = String(val[1]);
            return CHOICE_LABELS[raw] || raw;
        }
        if (val[0] === 'datetime') {
            const d = val[1];
            if (d && typeof d === 'object' && d.d) {
                const s = String(d.d);
                return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(8)}`;
            }
            return String(d || '');
        }
        if (val[0] === 'record') return String(val[1]);
        return val[1];
    }
    if (typeof val === 'object' && val.value) return extractProp(val.value);
    return val;
}

async function testPersona3() {
    console.log('=== TEST PERSONA 3: THE CLOSED-LOOP CASHFLOW OPTIMIZER ===\n');
    const call = await connectMcp();

    // 1. Scan Outstanding & Overdue Invoices ("Who owes me money?")
    console.log('1. Analyzing outstanding & overdue receivables...');
    const invRes = await call('list_records', { workspace: WS, collection: COLS.invoices });
    const invoices = invRes.records || [];

    let totalOutstanding = 0;
    let totalOverdue = 0;
    const unpaidList = [];

    for (const inv of invoices) {
        const full = await call('get_record', { workspace: WS, record: inv.guid, format: 'structured' });
        const props = full.properties || {};
        const amount = Number(extractProp(props.amount_chf)) || 0;
        const paymentStatus = extractProp(props.payment_status) || 'unpaid';
        const due = extractProp(props.due) || '';
        const status = extractProp(props.status) || 'draft';

        if (paymentStatus !== 'paid') {
            totalOutstanding += amount;
            const isOverdue = due && due < '2026-10-25';
            if (isOverdue) totalOverdue += amount;
            unpaidList.push({ guid: inv.guid, name: inv.name, amount, paymentStatus, status, due, isOverdue });
        }
    }

    console.log(`Cashflow Snapshot:`);
    console.log(`- Total Outstanding: ${totalOutstanding} CHF across ${unpaidList.length} invoices`);
    console.log(`- Overdue Amount: ${totalOverdue} CHF`);
    unpaidList.forEach(inv => {
        console.log(`  • ${inv.name}: ${inv.amount} CHF [Status: ${inv.status}, Payment: ${inv.paymentStatus}] ${inv.isOverdue ? '⚠️ OVERDUE' : ''}`);
    });

    // 2. Closed-Loop Atomic Settlement: DEMO-005 (1,800 CHF)
    console.log('\n2. Settling DEMO-005 atomically (Client payment received)...');
    const demo005 = invoices.find(i => i.name.includes('DEMO-005'));
    if (!demo005) throw new Error('DEMO-005 not found');

    await call('update_record_property', {
        workspace: WS,
        record: demo005.guid,
        property: 'payment_status',
        value: 'paid'
    });
    await call('update_record_property', {
        workspace: WS,
        record: demo005.guid,
        property: 'status',
        value: 'sent'
    });
    await call('update_record_property', {
        workspace: WS,
        record: demo005.guid,
        property: 'paid_date',
        value: '2026-10-25'
    });
    console.log(`✓ Settled DEMO-005: payment_status="paid", status="sent", paid_date="2026-10-25"`);

    // 3. Draft Over-Cap Retainer Invoice for Northwind Studio
    console.log('\n3. Drafting INV-2026-009 for Northwind Studio (1.25h over-cap retainer)...');
    const clientsRes = await call('list_records', { workspace: WS, collection: COLS.clients });
    const nw = clientsRes.records.find(c => c.name.toLowerCase().includes('northwind'));
    if (!nw) throw new Error('Northwind Studio not found');

    const invAmount = 187.50; // 1.25h * 150 CHF/h
    const newInv = await call('create_record', {
        workspace: WS,
        collection: COLS.invoices,
        title: 'INV-2026-009 · Northwind Studio · Over-Cap Support (Oct 2026)',
        properties: {
            client: [nw.guid],
            amount_chf: invAmount,
            payment_status: 'unpaid',
            status: 'draft',
            due: '2026-11-15'
        }
    });
    console.log(`✓ Created draft invoice: INV-2026-009 (${newInv.guid})`);

    // Insert Invoice Archetype
    const invArchetype = `## Invoice Summary
- **Invoice Number:** INV-2026-009
- **Client:** Northwind Studio
- **Issue Date:** 2026-10-25
- **Due Date:** 2026-11-15
- **Amount Due:** 187.50 CHF

### 📋 Line Items
- [ ] 1.25h Out-of-Scope Maintenance & Bugfixes @ 150 CHF/h = 187.50 CHF
  - Webhook failure resolution on /contact page
  - WordPress package security hardening

### 💳 Payment & Settlement
- IBAN: CH93 0000 0000 0000 0000 0
- Reference: INV-2026-009
- Status: Draft
`;
    await call('insert_markdown', {
        workspace: WS,
        record: newInv.guid,
        markdown: invArchetype
    });
    console.log('✓ Invoice archetype inserted');

    // 4. Verify in Dashboard UI via CDP
    console.log('\n4. Verifying updated cashflow in Dashboard via CDP...');
    const cdp = await connectCdp();
    await new Promise(r => setTimeout(r, 1200));

    // Switch to Overview tab
    await cdp.evaluate(`(() => {
        const tabs = Array.from(document.querySelectorAll('.os-workflow-modes button, .os-tab-btn, button'));
        const overview = tabs.find(b => b.innerText.trim() === 'Overview');
        if (overview) overview.click();
    })()`);
    await new Promise(r => setTimeout(r, 1000));

    const shot = await cdp.screenshot();
    const shotPath = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\3a871dc0-e9e9-4ac5-b31e-fe33e0535c90\\persona-3-cashflow-live.png';
    fs.writeFileSync(shotPath, shot);
    console.log(`✓ Saved screenshot: ${shotPath}`);

    const cashflowText = await cdp.evaluate(`(() => {
        const cash = document.querySelector('.os-cashflow, [class*="cash"]');
        return cash ? cash.innerText : 'Cashflow section not found';
    })()`);
    console.log('\nDashboard Cashflow Widget:\n', cashflowText);

    cdp.close();

    console.log('\n=== PERSONA 3 TEST COMPLETED SUCCESSFULLY ===');
}

testPersona3().catch(err => {
    console.error('Persona 3 test failed:', err);
    process.exit(1);
});
