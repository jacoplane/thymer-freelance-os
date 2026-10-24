import { connectMcp } from './thymer-mcp.mjs';

async function scanWorkspace(call, workspace, name) {
    console.log(`\n========================================`);
    console.log(`SCANNING WORKSPACE: ${name} (${workspace})`);
    console.log(`========================================`);
    const collections = await call('list_collections', { workspace });
    for (const col of collections.collections || []) {
        console.log(`\nChecking collection: ${col.name} (${col.guid})`);
        const records = await call('list_records', { workspace, collection: col.guid });
        for (const r of records.records || []) {
            const rec = await call('get_record', { workspace, record: r.guid, format: 'structured' });
            const title = rec.name || r.title || r.name || r.guid;
            const items = rec.items || [];
            const hits = [];
            for (const item of items) {
                const t = (item.text || '').toLowerCase();
                if (t.includes('no active project') || 
                    t.includes('no active') || 
                    t.includes('link briefs') || 
                    t.includes('log work') ||
                    t.includes('fictional demo project') ||
                    t.includes('initial client kickoff') ||
                    t.includes('describe the outcome') ||
                    t.includes('client feedback checkpoint') ||
                    t.includes('deliverables and working files')) {
                    hits.push({ guid: item.guid, type: item.type, text: item.text });
                }
            }
            if (hits.length > 0) {
                console.log(`  Record [${title}] (${r.guid}):`);
                hits.forEach(h => console.log(`    - ${h.type} (${h.guid}): ${h.text}`));
            }
        }
    }
}

async function main() {
    const call = await connectMcp();
    await scanWorkspace(call, 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2', 'Freelance OS');
    await scanWorkspace(call, 'WNN1JJG50ZQ6BE9S1T3HG85S57', 'jacoplane');
}

main().catch(console.error);
