import { connectMcp } from './thymer-mcp.mjs';

/**
 * Idempotent backport script for Client archetype action buttons.
 * - Ensures EVERY client has an interactive [+ Create project] button under its Projects section.
 * - Upgrades any overly wordy '+ Create project for this client' to '+ Create project'.
 * - Preserves all notes, commercial terms, pipeline opportunities, and existing links.
 */
async function backfillClientArchetypes() {
    const call = await connectMcp();
    console.log('Connected to Thymer MCP.');

    const workspaces = [
        { guid: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2', name: 'Freelance OS', clientsCol: '1DCV1BDVHH7Q4QV1TYAR6ZZF6E' },
        { guid: 'WNN1JJG50ZQ6BE9S1T3HG85S57', name: 'jacoplane', clientsCol: '1FD58J39X6KJ4JK5F06T7P4TSR' }
    ];

    const projectPrompt = '*(No active projects in flight. Click above, use + Project in the top header, or press Ctrl/Cmd+K → "Create Freelance OS project for active client".)*';
    const taskRollup = '*(No active project tasks. Tasks added to linked projects will automatically roll up here.)*';

    for (const ws of workspaces) {
        console.log(`\n--- Auditing & Upgrading Workspace: ${ws.name} (${ws.guid}) ---`);
        const records = await call('list_records', { workspace: ws.guid, collection: ws.clientsCol });
        
        for (const client of records.records || []) {
            let rec = await call('get_record', { workspace: ws.guid, record: client.guid, format: 'structured' });
            const title = rec.name || client.name || client.guid;
            let updated = false;

            for (const item of rec.items || []) {
                const text = item.text || '';
                // 1. Upgrade passive project empty states
                if (
                    text.includes('No active projects currently in flight') ||
                    text.includes('No active projects linked yet') ||
                    text.includes('No active projects in flight') ||
                    text === '(No active projects)'
                ) {
                    if (text !== projectPrompt) {
                        await call('update_line_item', {
                            workspace: ws.guid,
                            line_item: item.guid,
                            content: projectPrompt,
                            type: 'text'
                        });
                        console.log(`  ✓ Upgraded active projects empty state on [${title}]`);
                        updated = true;
                    }
                }

                // 2. Upgrade passive task empty states
                if (
                    text.includes('No active project tasks in flight') ||
                    text === '(No active project tasks)' ||
                    text === '(No active project tasks in flight)'
                ) {
                    if (text !== taskRollup) {
                        await call('update_line_item', {
                            workspace: ws.guid,
                            line_item: item.guid,
                            content: taskRollup,
                            type: 'text'
                        });
                        console.log(`  ✓ Upgraded project tasks empty state on [${title}]`);
                        updated = true;
                    }
                }

                // 3. Compact button text if previously wordy
                if (item.type === 'linkbtn' && item.text === '+ Create project for this client') {
                    await call('update_line_item', {
                        workspace: ws.guid,
                        line_item: item.guid,
                        content: '+ Create project',
                        type: 'linkbtn'
                    });
                    console.log(`  ✓ Compacted linkbtn text to "+ Create project" on [${title}]`);
                    updated = true;
                }
            }

            // 4. Ensure in-document action button exists for ALL clients
            rec = await call('get_record', { workspace: ws.guid, record: client.guid, format: 'structured' });
            const projectsHeading = (rec.items || []).find(i => i.type === 'heading' && (i.text?.includes('Active Projects') || i.text?.includes('Projects')));
            const hasLinkBtn = (rec.items || []).some(i => i.type === 'linkbtn');

            if (projectsHeading && !hasLinkBtn) {
                // Find insertion position: after any project list items under this heading
                await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: projectsHeading.guid,
                    type: 'linkbtn',
                    content: '+ Create project'
                });
                console.log(`  ✓ Inserted interactive linkbtn [+ Create project] into [${title}]`);
                updated = true;
            }

            if (!updated) {
                console.log(`  - [${title}] already up to date.`);
            }
        }
    }

    console.log('\nBackfill completed successfully across all workspaces.');
}

backfillClientArchetypes().catch(console.error);
