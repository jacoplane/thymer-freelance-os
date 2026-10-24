import { connectMcp } from './thymer-mcp.mjs';

/**
 * Idempotent backfill script for Support Session Archetypes:
 * 1. Session Log & Delivered Work (with [+ Log time])
 * 2. Client Follow-Up (with [+ Add follow-up task])
 */
async function backfillSupportArchetypes() {
    const call = await connectMcp();
    console.log('Connected to Thymer MCP.');

    const workspaces = [
        { guid: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2', name: 'Freelance OS' },
        { guid: 'WNN1JJG50ZQ6BE9S1T3HG85S57', name: 'jacoplane' }
    ];

    for (const ws of workspaces) {
        console.log(`\n======================================================`);
        console.log(`Auditing & Upgrading Support Sessions in: ${ws.name} (${ws.guid})`);
        console.log(`======================================================`);

        const cols = await call('list_collections', { workspace: ws.guid });
        const ssCol = cols.collections.find(c => c.name.toLowerCase().includes('support') || c.name.toLowerCase().includes('session'));
        if (!ssCol) {
            console.log('No Support Sessions collection found in', ws.name);
            continue;
        }

        const records = await call('list_records', { workspace: ws.guid, collection: ssCol.guid });
        console.log(`Found ${records.records?.length || 0} support sessions.`);

        for (const session of records.records || []) {
            let rec = await call('get_record', { workspace: ws.guid, record: session.guid, format: 'structured' });
            const title = rec.name || session.name || session.guid;
            let items = rec.items || [];
            let updated = false;

            // 1. Session Log & Delivered Work
            const sessionHeading = items.find(i => i.type === 'heading' && (
                i.text?.toLowerCase().includes('session') ||
                i.text?.toLowerCase().includes('delivered')
            ));

            if (sessionHeading) {
                const hasLogTimeBtn = items.some(i => i.type === 'linkbtn' && i.text?.includes('Log time'));
                if (!hasLogTimeBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: session.guid,
                        parent: sessionHeading.guid,
                        type: 'linkbtn',
                        content: '+ Log time'
                    });
                    console.log(`  ✓ Inserted [+ Log time] into [${title}]`);
                    updated = true;
                }
            }

            // Refresh items if updated
            if (updated) {
                rec = await call('get_record', { workspace: ws.guid, record: session.guid, format: 'structured' });
                items = rec.items || [];
                updated = false;
            }

            // 2. Client Follow-Up
            const followUpHeading = items.find(i => i.type === 'heading' && (
                i.text?.toLowerCase().includes('follow-up') ||
                i.text?.toLowerCase().includes('next steps')
            ));

            if (followUpHeading) {
                const hasFollowUpBtn = items.some(i => i.type === 'linkbtn' && (
                    i.text?.includes('follow-up task') ||
                    i.text?.includes('Add follow-up')
                ));
                if (!hasFollowUpBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: session.guid,
                        parent: followUpHeading.guid,
                        type: 'linkbtn',
                        content: '+ Add follow-up task'
                    });
                    console.log(`  ✓ Inserted [+ Add follow-up task] into [${title}]`);
                }
            }
        }
    }

    console.log('\nSupport Session Archetype Backfill Completed Successfully!');
}

backfillSupportArchetypes().catch(err => {
    console.error('Fatal backfill error:', err);
    process.exit(1);
});
