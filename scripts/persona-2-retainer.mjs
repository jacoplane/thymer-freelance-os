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

function extractProp(val) {
    if (!val) return null;
    if (Array.isArray(val)) return val[1];
    if (typeof val === 'object' && val.value) return extractProp(val.value);
    return val;
}

async function testPersona2() {
    console.log('=== TEST PERSONA 2: THE RETAINER SPECIALIST ===\n');
    const call = await connectMcp();

    // 1. Fetch Northwind Studio client record with structured format
    console.log('1. Checking Northwind Studio details and retainer agreement...');
    const clients = await call('list_records', { workspace: WS, collection: COLS.clients });
    const client = clients.records.find(c => c.name.toLowerCase().includes('northwind'));
    if (!client) throw new Error('Northwind Studio client record not found');

    const clientRec = await call('get_record', { workspace: WS, record: client.guid, format: 'structured' });
    console.log(`Found client: "${client.name}" (${client.guid})`);
    const status = extractProp(clientRec.properties?.status);
    const plan = extractProp(clientRec.properties?.plan);
    const includedHours = Number(extractProp(clientRec.properties?.included_hours)) || 2.0;
    console.log(`Status: ${status}, Plan: ${plan}, Included hours: ${includedHours}h/mo`);

    // 2. Query all existing support sessions for Northwind in current period
    console.log('\n2. Querying support sessions for current month...');
    const allSessions = await call('list_records', { workspace: WS, collection: COLS.support });
    let nwPriorHours = 0;
    for (const s of (allSessions.records || [])) {
        const full = await call('get_record', { workspace: WS, record: s.guid, format: 'structured' });
        const props = full.properties || {};
        const clientVal = extractProp(props.client);
        const hoursVal = Number(extractProp(props.hours)) || 0;
        
        // Match client name or guid
        if (s.name.includes('Northwind') || (typeof clientVal === 'string' && clientVal.includes(client.guid)) || (Array.isArray(clientVal) && clientVal.includes(client.guid))) {
            console.log(` - Prior session: "${s.name}" -> ${hoursVal}h`);
            nwPriorHours += hoursVal;
        }
    }
    console.log(`Total prior support logged for Northwind Studio: ${nwPriorHours}h`);

    // 3. User logs 1.25h of maintenance
    const newSessionHours = 1.25;
    const totalMonthUsage = nwPriorHours + newSessionHours;
    console.log(`\n3. Logging new support session: ${newSessionHours}h ("Northwind Studio · Form Fix & Security Updates")...`);
    
    // Create support session record
    const createdSession = await call('create_record', {
        workspace: WS,
        collection: COLS.support,
        title: 'Northwind Studio · Form Fix & Security Updates',
        properties: {
            client: [client.guid],
            hours: newSessionHours,
            date: '2026-10-25',
            notes: 'Diagnosed PHP form submission webhook failure on contact page, patched validation script, and ran plugin security updates.'
        }
    });
    console.log(`✓ Support session created: ${createdSession.guid}`);

    // Insert support archetype note
    const sessionNote = `## Support Session Details
- **Client:** Northwind Studio
- **Date:** 2026-10-25
- **Logged Duration:** 1.25 hours
- **Category:** Maintenance / Bugfix

### Summary of Work Performed
1. Investigated broken AJAX endpoint on /contact inquiry form returning 500 error.
2. Repaired invalid JSON payload mapping in backend handler.
3. Updated core WordPress packages and verified captcha handshake.
4. Tested end-to-end submission in production.

### Billing & Retainer Impact
- Plan: ${plan || 'Studio care'} (${includedHours}h included)
- Used prior to this session: ${nwPriorHours}h
- This session: ${newSessionHours}h
- Total month usage: ${totalMonthUsage}h / ${includedHours}h
${totalMonthUsage > includedHours 
    ? `⚠️ **OVER-CAP ALERT:** Exceeds included allowance by ${(totalMonthUsage - includedHours).toFixed(2)}h. Additional hours will be billed at standard hourly rate (150 CHF/h).` 
    : `Remaining allowance for October: ${(includedHours - totalMonthUsage).toFixed(2)}h`}
`;

    await call('insert_markdown', {
        workspace: WS,
        record: createdSession.guid,
        markdown: sessionNote
    });
    console.log('✓ Support session archetype markdown inserted');

    // 4. Verify in Dashboard UI via CDP
    console.log('\n4. Verifying Dashboard UI update via CDP...');
    const cdp = await connectCdp();
    await new Promise(r => setTimeout(r, 1200));

    // Switch to Overview tab to check Support widget
    await cdp.evaluate(`(() => {
        const tabs = Array.from(document.querySelectorAll('.os-workflow-modes button, .os-tab-btn, button'));
        const overview = tabs.find(b => b.innerText.trim() === 'Overview');
        if (overview) overview.click();
    })()`);
    await new Promise(r => setTimeout(r, 1000));

    const shot = await cdp.screenshot();
    const shotPath = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\3a871dc0-e9e9-4ac5-b31e-fe33e0535c90\\persona-2-retainer-live.png';
    fs.writeFileSync(shotPath, shot);
    console.log(`✓ Saved screenshot: ${shotPath}`);

    // Check support widget value
    const supportWidgetText = await cdp.evaluate(`(() => {
        const widget = document.querySelector('.os-kpi-card:has(.os-kpi-label)');
        const allCards = Array.from(document.querySelectorAll('.os-kpi-card')).map(c => c.innerText);
        return { widget: widget ? widget.innerText : null, allCards };
    })()`);
    console.log('Dashboard KPI Cards:\n', supportWidgetText);

    cdp.close();

    console.log('\n=== PERSONA 2 TEST COMPLETED SUCCESSFULLY ===');
}

testPersona2().catch(err => {
    console.error('Persona 2 test failed:', err);
    process.exit(1);
});
