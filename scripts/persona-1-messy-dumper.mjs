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

async function testPersona1() {
    console.log('=== TEST PERSONA 1: THE MESSY NOTE-DUMPER ===\n');
    const call = await connectMcp();

    // 1. Search existing clients to avoid duplicates
    console.log('1. Checking for existing client "Atelier Végétal"...');
    const existingClients = await call('list_records', { workspace: WS, collection: COLS.clients });
    let client = (existingClients.records || []).find(c => c.name.toLowerCase().includes('atelier'));

    if (client) {
        console.log(`Found existing client record: ${client.guid}`);
    } else {
        console.log('Creating new Lead in Clients collection...');
        const newClient = await call('create_record', {
            workspace: WS,
            collection: COLS.clients,
            title: 'Atelier Végétal',
            properties: {
                contact: 'Sophie Laurent',
                email: 'sophie@ateliervegetal.ch',
                phone: '079 412 88 19',
                status: 'discussing',
                estimated_value_chf: 6500,
                source: 'inbound'
            }
        });
        client = { guid: newClient.guid, name: 'Atelier Végétal' };
        console.log(`✓ Created client/lead: "${client.name}" (${client.guid})`);
    }

    // 2. Apply Pipeline Lead Archetype to client note
    console.log('2. Inserting Lead Page Archetype (in English)...');
    const leadBody = `## Relationship & Context
Boutique botanical design and plant studio. Existing WordPress site is slow and unresponsive on mobile. Client wants a modern, high-converting e-commerce storefront by end of November 2026.

### 🔗 Key Links & References
- Current site: https://ateliervegetal.ch
- Scope brief: E-Commerce Redesign (Shopify migration)

### 👥 Stakeholders & Roles
- Primary Contact: Sophie Laurent (sophie@ateliervegetal.ch / 079 412 88 19) — Founder & Decision Maker

## 🎯 Deal Qualification & Next Steps
[+ Add task]
- [ ] Prepare and deliver formal proposal with 2 options (starter vs full e-commerce) by Wednesday
- [ ] Sophie Laurent: Send brand assets and product catalog

## 📄 Commercial Estimate & Proposals
[+ Create project]
[+ Create invoice]
- Estimated Pipeline Value: 6,500 CHF
- Target Launch Deadline: 2026-11-30
- Current Stage: Discussing

## 📝 Communication & Meeting Debrief
- **2026-10-25**: Initial discovery call with Sophie Laurent. Identified mobile performance issues and agreed proposal timeline.
`;

    await call('insert_markdown', {
        workspace: WS,
        record: client.guid,
        markdown: leadBody
    });
    console.log('✓ Lead archetype markdown inserted');

    // 3. Mark the waiting task as 'waiting'
    console.log('3. Resolving line items to flag waiting task...');
    const lines = await call('get_line_items', { workspace: WS, record: client.guid });
    const waitingTask = (lines.items || []).find(i => i.text && i.text.includes('Sophie Laurent: Send brand assets'));

    if (waitingTask) {
        console.log(`Setting task ${waitingTask.guid} to waiting...`);
        const waitRes = await call('set_task_status', {
            workspace: WS,
            line_item: waitingTask.guid,
            status: 'waiting'
        });
        console.log(`✓ Set task status to waiting:`, waitRes.status);
    } else {
        console.warn('⚠️ Could not find waiting task in document line items');
    }

    // 4. Verify in UI via CDP
    console.log('\n4. Verifying UI reflection via CDP...');
    const cdp = await connectCdp();
    await new Promise(r => setTimeout(r, 1500));

    // Capture screenshot
    const buf = await cdp.screenshot();
    const shotPath = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\3a871dc0-e9e9-4ac5-b31e-fe33e0535c90\\persona-1-lead-live.png';
    fs.writeFileSync(shotPath, buf);
    console.log(`✓ Saved screenshot: ${shotPath}`);

    cdp.close();

    console.log('\n=== PERSONA 1 TEST COMPLETED SUCCESSFULLY ===');
}

testPersona1().catch(err => {
    console.error('Persona 1 test failed:', err);
    process.exit(1);
});
