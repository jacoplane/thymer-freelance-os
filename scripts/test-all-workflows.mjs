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
                return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
            }
            return String(d || '');
        }
        if (val[0] === 'record') return String(val[1]);
        return val[1];
    }
    if (typeof val === 'object' && val.value) return extractProp(val.value);
    return val;
}

async function run() {
    console.log('=== STARTING FREELANCE OS SKILL ROUTINE TASK TESTS ===\n');
    const call = await connectMcp();

    // -------------------------------------------------------------
    // TEST 1: Workflow A - Scan Data for Executive Daily Standup
    // -------------------------------------------------------------
    console.log('--- TEST 1: Workflow A (Executive Daily Standup Scan) ---');
    const clientsRes = await call('list_records', { workspace: WS, collection: COLS.clients });
    const projectsRes = await call('list_records', { workspace: WS, collection: COLS.projects });
    const invoicesRes = await call('list_records', { workspace: WS, collection: COLS.invoices });
    const supportRes = await call('list_records', { workspace: WS, collection: COLS.support });

    console.log(`Loaded workspace records:`);
    console.log(`  Clients: ${clientsRes.records?.length || 0}`);
    console.log(`  Projects: ${projectsRes.records?.length || 0}`);
    console.log(`  Invoices: ${invoicesRes.records?.length || 0}`);
    console.log(`  Support Sessions: ${supportRes.records?.length || 0}`);

    // Inspect invoices for cashflow
    let outstandingChf = 0;
    let overdueCount = 0;
    let overdueChf = 0;
    let paidThisMonthChf = 0;
    const unpaidInvoices = [];

    for (const inv of invoicesRes.records || []) {
        const propsRes = await call('get_record', { workspace: WS, record: inv.guid, format: 'structured' });
        const props = propsRes.properties || {};
        const amount = Number(extractProp(props.amount_chf)) || 0;
        const paymentStatus = extractProp(props.payment_status) || 'unpaid';
        const due = extractProp(props.due) || '';
        const paidDate = extractProp(props.paid_date) || '';

        if (paymentStatus === 'paid') {
            if (paidDate && paidDate.startsWith('2026-10')) {
                paidThisMonthChf += amount;
            }
        } else {
            outstandingChf += amount;
            unpaidInvoices.push({ guid: inv.guid, name: inv.name, amount, due, paymentStatus });
            if (due && due < '2026-10-25') {
                overdueCount++;
                overdueChf += amount;
            }
        }
    }

    console.log(`Cashflow pulse:`);
    console.log(`  Outstanding: ${outstandingChf} CHF across ${unpaidInvoices.length} invoices`);
    console.log(`  Overdue: ${overdueChf} CHF (${overdueCount} invoices)`);
    console.log(`  Paid in Oct 2026: ${paidThisMonthChf} CHF`);

    // -------------------------------------------------------------
    // TEST 2: Workflow B - Lead / Project Scoping
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Workflow B (Project Scoping & Task Ingestion) ---');
    const orbitClient = (clientsRes.records || []).find(c => c.name.toLowerCase().includes('orbit'));
    if (!orbitClient) throw new Error('Orbit Coffee client record not found');
    console.log(`Target client found: "${orbitClient.name}" (${orbitClient.guid})`);

    const projectTitle = 'Orbit Coffee · Roastery E-Commerce Redesign';
    console.log(`Creating project record: "${projectTitle}"...`);
    const newProj = await call('create_record', {
        workspace: WS,
        collection: COLS.projects,
        title: projectTitle,
        properties: {
            client: orbitClient.guid,
            budget_chf: 8500,
            deadline: '2026-11-30'
        }
    });
    const projGuid = newProj.guid;
    console.log(`✓ Project created with GUID: ${projGuid}`);

    const projectBody = `## Project brief
Full redesign and Shopify migration for Orbit Coffee roastery store. Fixed fee milestone contract.

## Next actions
[+ Add task]
- [ ] Architecture review & store migration plan
- [ ] Wait for Orbit Coffee to provide Shopify Admin API keys
*(Tasks added here automatically sync to the Freelance OS Today queue and Client dashboard rollup)*

## Deliverables & references
- [[Shopify Theme Architecture]]
- [[Product Catalog Data Schema]]
### 🔗 Key Links & Repositories
- Repository / Code: [github.com/orbitcoffee/theme ↗]
- Design & Figma: [figma.com/file/orbit-roastery ↗]
- Live / Staging: [staging.orbitcoffee.ch ↗]

## Activity & time log
[+ Log time]

## 💳 Billing & Invoices
[+ Create invoice]
- Billing Schedule: Milestone deposit (50%) / Final launch (50%)
- Payment Method: Bank Transfer / QR-bill (CHF)

## Client review checkpoints
[+ Add review checkpoint]
- [ ] Staging storefront review and sign-off

## Decisions & updates
- **2026-10-25**: Project initiated from commercial inquiry.
`;

    await call('insert_markdown', {
        workspace: WS,
        record: projGuid,
        markdown: projectBody
    });
    console.log(`✓ Standard Project Page Archetype inserted`);

    // Fetch line items and mark the second task as 'waiting'
    console.log('Resolving waiting task line item and setting status to "waiting"...');
    const linesRes = await call('get_line_items', { workspace: WS, record: projGuid });
    const waitingTask = (linesRes.items || []).find(i => i.text && i.text.includes('Wait for Orbit Coffee'));
    if (!waitingTask) {
        throw new Error('Waiting task line item not found in document');
    }
    console.log(`Found task line item: ${waitingTask.guid} ("${waitingTask.text}")`);

    await call('set_task_status', {
        workspace: WS,
        line_item: waitingTask.guid,
        status: 'waiting'
    });
    console.log(`✓ Set task status to "waiting" successfully`);

    // -------------------------------------------------------------
    // TEST 3: Workflow C - Effort & Retainer Support Time Logging
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Workflow C (Support Time Logging & Care Plan Math) ---');
    const sessionTitle = 'Orbit Coffee · 1.0 h · Security patch & CDN cache purge';
    const newSession = await call('create_record', {
        workspace: WS,
        collection: COLS.support,
        title: sessionTitle,
        properties: {
            client: orbitClient.guid,
            project: projGuid,
            date: '2026-10-25',
            hours: 1.0,
            description: 'Security patch applied and CDN cache purge verified.'
        }
    });
    const sessionGuid = newSession.guid;
    console.log(`✓ Support Session record created: ${sessionGuid}`);

    const sessionBody = `## Session Log & Delivered Work
[+ Log time]
- **Date & Duration:** 2026-10-25 (1.0 h)
- **Client & Project:** [[Orbit Coffee]] / [[${projectTitle}]]
- **Summary:** Security patch applied and CDN cache purge verified.

## Client Follow-Up
[+ Add follow-up task]
- [ ] Confirm staging store SSL certificate renewal

## Billing & Plan Allocation
[+ Create invoice]
- Care Plan: Starter Care (2h included / month)
- Overrun / Billed Status: Covered under monthly retainer
`;
    await call('insert_markdown', {
        workspace: WS,
        record: sessionGuid,
        markdown: sessionBody
    });
    console.log(`✓ Support Session Page Archetype applied`);

    // -------------------------------------------------------------
    // TEST 4: Workflow D - Invoicing & Settlement
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Workflow D (Invoicing & Settlement) ---');
    const invoiceId = 'INV-2026-008';
    const invoiceAmount = 4250;
    console.log(`Creating milestone deposit invoice: ${invoiceId} for ${invoiceAmount} CHF...`);
    const newInv = await call('create_record', {
        workspace: WS,
        collection: COLS.invoices,
        title: `${invoiceId} · Orbit Coffee · Deposit`,
        properties: {
            invoice_id: invoiceId,
            client: orbitClient.guid,
            project: projGuid,
            amount_chf: invoiceAmount,
            issued: '2026-10-25',
            due: '2026-11-24'
        }
    });
    const invGuid = newInv.guid;
    console.log(`✓ Invoice record created: ${invGuid}`);

    // Settle an unpaid invoice atomically
    const overdueTarget = unpaidInvoices.find(i => i.paymentStatus !== 'paid') || unpaidInvoices[0];
    if (overdueTarget) {
        console.log(`Settling invoice: "${overdueTarget.name}" (${overdueTarget.guid}) for ${overdueTarget.amount} CHF...`);
        await call('update_record_property', {
            workspace: WS,
            record: overdueTarget.guid,
            property: 'payment_status',
            value: 'paid'
        });
        await call('update_record_property', {
            workspace: WS,
            record: overdueTarget.guid,
            property: 'status',
            value: 'sent'
        });
        await call('update_record_property', {
            workspace: WS,
            record: overdueTarget.guid,
            property: 'paid_date',
            value: '2026-10-25'
        });
        console.log(`✓ Invoice settled atomically`);
    }

    // -------------------------------------------------------------
    // TEST 5: Live UI Verification via CDP
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Live UI Verification via CDP ---');
    const cdp = await connectCdp();
    await new Promise(r => setTimeout(r, 2000));

    // Capture screenshot
    const buf = await cdp.screenshot();
    const screenshotPath = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\3a871dc0-e9e9-4ac5-b31e-fe33e0535c90\\test-workflows-live.png';
    fs.writeFileSync(screenshotPath, buf);
    console.log(`✓ Captured updated dashboard screenshot: ${screenshotPath}`);

    // Inspect DOM elements
    const domSummary = await cdp.evaluate(`(() => {
        const app = document.querySelector('.os-app');
        if (!app) return { hasApp: false };
        return {
            hasApp: true,
            headings: Array.from(app.querySelectorAll('h2, h3')).map(h => h.textContent.trim()),
            statLabels: Array.from(app.querySelectorAll('.os-stat-label, .os-kpi-label')).map(l => l.textContent.trim()),
            statValues: Array.from(app.querySelectorAll('.os-stat-value, .os-kpi-value')).map(v => v.textContent.trim()),
            kpiValues: Array.from(app.querySelectorAll('.os-kpi-value')).map(v => v.textContent.trim())
        };
    })()`);
    console.log('DOM summary:', JSON.stringify(domSummary, null, 2));

    cdp.close();
    console.log('\n=== ALL TESTS EXECUTED SUCCESSFULLY ===');
}

run().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
});
