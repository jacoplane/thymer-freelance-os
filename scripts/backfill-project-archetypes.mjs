import { connectMcp } from './thymer-mcp.mjs';

function getProp(obj, key) {
    const val = obj?.properties?.[key];
    if (Array.isArray(val)) return val[1];
    return val;
}

/**
 * Idempotent backport script for Project Archetype:
 * 1. Project brief & scope
 * 2. Next actions (with [+ Add task])
 * 3. Deliverables & references (with Key Links & Repositories)
 * 4. Activity & time log (with [+ Log time])
 * 5. Billing & Invoices (with [+ Create invoice])
 * 6. Client review checkpoints (with [+ Add review checkpoint])
 * 7. Decisions & updates
 *
 * Strictly preserves all user tasks, notes, deliverables, and custom headings.
 */
async function backfillProjectArchetypes() {
    const call = await connectMcp();
    console.log('Connected to Thymer MCP.');

    const workspaces = [
        { guid: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2', name: 'Freelance OS' },
        { guid: 'WNN1JJG50ZQ6BE9S1T3HG85S57', name: 'jacoplane' }
    ];

    const timePrompt = '*(Click above to log a work session, use + Time in the header, or tell your agent: "Logged 2h on this project".)*';
    const plainTimePrompt = '(Click above to log a work session, use + Time in the header, or tell your agent: "Logged 2h on this project".)';

    for (const ws of workspaces) {
        console.log(`\n======================================================`);
        console.log(`Auditing & Upgrading Projects in: ${ws.name} (${ws.guid})`);
        console.log(`======================================================`);
        
        const cols = await call('list_collections', { workspace: ws.guid });
        const pCol = cols.collections.find(c => c.name === 'Projects');
        if (!pCol) {
            console.log('No Projects collection found in', ws.name);
            continue;
        }

        const records = await call('list_records', { workspace: ws.guid, collection: pCol.guid });
        
        for (const project of records.records || []) {
            let rec = await call('get_record', { workspace: ws.guid, record: project.guid, format: 'structured' });
            const title = rec.name || project.name || project.guid;
            let updated = false;

            // 1. Upgrade passive time log text if present
            for (const item of rec.items || []) {
                const text = item.text || '';
                if (text.includes('Log work sessions with Command Palette') || text.includes('tell your agent: "Logged 1.5h')) {
                    if (text !== timePrompt && text !== plainTimePrompt) {
                        await call('update_line_item', {
                            workspace: ws.guid,
                            line_item: item.guid,
                            content: timePrompt,
                            type: 'text'
                        });
                        console.log(`  ✓ Upgraded time log prompt on [${title}]`);
                        updated = true;
                    }
                }
            }

            // 2. Refresh items
            rec = await call('get_record', { workspace: ws.guid, record: project.guid, format: 'structured' });
            let items = rec.items || [];

            // 3. Ensure [+ Add task] button exists under Next actions
            const actionsHeading = items.find(i => i.type === 'heading' && (
                i.text === 'Next actions' ||
                i.text === 'Next actions & Tasks' ||
                i.text?.includes('Next actions') ||
                i.text === '✅ Project tasks'
            ));

            if (actionsHeading) {
                const hasAddTaskBtn = items.some(i => i.type === 'linkbtn' && (i.text === '+ Add task' || i.text?.includes('Add task')));
                if (!hasAddTaskBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: project.guid,
                        parent: actionsHeading.guid,
                        type: 'linkbtn',
                        content: '+ Add task'
                    });
                    console.log(`  ✓ Inserted [+ Add task] button into [${title}]`);
                    updated = true;
                }
            }

            // 4. Ensure [+ Log time] button exists under Activity & time log
            const timeHeading = items.find(i => i.type === 'heading' && (
                i.text === 'Activity & Time Log' ||
                i.text === 'Activity & time log' ||
                i.text?.includes('Time Log') ||
                i.text?.includes('Activity & Time')
            ));

            if (timeHeading) {
                const hasLogTimeBtn = items.some(i => i.type === 'linkbtn' && (i.text === '+ Log time' || i.text?.includes('Log time')));
                if (!hasLogTimeBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: project.guid,
                        parent: timeHeading.guid,
                        type: 'linkbtn',
                        content: '+ Log time'
                    });
                    console.log(`  ✓ Inserted [+ Log time] button into [${title}]`);
                    updated = true;
                }
            }

            // 5. Ensure 💳 Billing & Invoices section exists
            const hasBillingHeading = items.some(i => i.type === 'heading' && (i.text?.includes('Billing') || i.text?.includes('Invoices')));
            let billHeadingGuid = null;

            if (!hasBillingHeading) {
                const anchor = timeHeading?.guid || actionsHeading?.guid || null;
                const billHeading = await call('create_line_item', {
                    workspace: ws.guid,
                    record: project.guid,
                    after: anchor,
                    type: 'heading',
                    heading_size: 2,
                    content: '💳 Billing & Invoices'
                });
                billHeadingGuid = billHeading.guid;

                const b1 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: project.guid,
                    parent: billHeading.guid,
                    type: 'linkbtn',
                    content: '+ Create invoice'
                });

                const b2 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: project.guid,
                    parent: billHeading.guid,
                    after: b1.guid,
                    type: 'text',
                    content: '*(Click above, use + Invoice in the header, or press Ctrl/Cmd+K → "Create Freelance OS invoice".)*'
                });

                const b3 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: project.guid,
                    parent: billHeading.guid,
                    after: b2.guid,
                    type: 'ulist',
                    content: 'Billing Schedule: Milestone deposit (50%) / Final delivery (50%)'
                });

                await call('create_line_item', {
                    workspace: ws.guid,
                    record: project.guid,
                    parent: billHeading.guid,
                    after: b3.guid,
                    type: 'ulist',
                    content: 'Payment Method: Bank Transfer / QR-bill (CHF)'
                });

                console.log(`  ✓ Added [💳 Billing & Invoices] section into [${title}]`);
                updated = true;
            } else {
                billHeadingGuid = items.find(i => i.type === 'heading' && (i.text?.includes('Billing') || i.text?.includes('Invoices')))?.guid;
                const hasInvLinkBtn = items.some(i => i.type === 'linkbtn' && i.text?.includes('Create invoice'));
                if (billHeadingGuid && !hasInvLinkBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: project.guid,
                        parent: billHeadingGuid,
                        type: 'linkbtn',
                        content: '+ Create invoice'
                    });
                    console.log(`  ✓ Inserted [+ Create invoice] button into existing Billing section on [${title}]`);
                    updated = true;
                }
            }

            // 6. Ensure [+ Add review checkpoint] button exists under Client review checkpoints
            const reviewHeading = items.find(i => i.type === 'heading' && (
                i.text === 'Client review checkpoints' ||
                i.text?.includes('review checkpoints') ||
                i.text?.includes('Review Checkpoints')
            ));

            if (reviewHeading) {
                const hasCheckpointBtn = items.some(i => i.type === 'linkbtn' && i.text?.includes('checkpoint'));
                if (!hasCheckpointBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: project.guid,
                        parent: reviewHeading.guid,
                        type: 'linkbtn',
                        content: '+ Add review checkpoint'
                    });
                    console.log(`  ✓ Inserted [+ Add review checkpoint] button into [${title}]`);
                    updated = true;
                }
            }

            // 7. Canonical Heading Reordering:
            // Ensure order: Project brief -> Next actions -> Deliverables -> Activity & time log -> Billing & Invoices -> Client review checkpoints -> Decisions & updates
            rec = await call('get_record', { workspace: ws.guid, record: project.guid, format: 'structured' });
            items = rec.items || [];

            const hBrief = items.find(i => i.type === 'heading' && (i.text === 'Project brief' || i.text?.includes('Objective')));
            const hActions = items.find(i => i.type === 'heading' && (i.text?.includes('Next actions') || i.text === '✅ Project tasks'));
            const hDeliv = items.find(i => i.type === 'heading' && (i.text?.includes('Deliverables') || i.text?.includes('references')));
            const hTime = items.find(i => i.type === 'heading' && (i.text?.includes('Time Log') || i.text?.includes('Activity & Time')));
            const hBill = items.find(i => i.type === 'heading' && (i.text?.includes('Billing') || i.text?.includes('Invoices')));
            const hCheck = items.find(i => i.type === 'heading' && (i.text?.includes('checkpoint') || i.text?.includes('Review Checkpoints')));
            const hDecisions = items.find(i => i.type === 'heading' && (i.text?.includes('Decisions') || i.text?.includes('Decision register') || i.text?.includes('updates')));

            if (hBrief && hActions && hActions.parent_guid === project.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hActions.guid, after: hBrief.guid }).catch(() => {});
            }
            if (hActions && hDeliv && hDeliv.parent_guid === project.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hDeliv.guid, after: hActions.guid }).catch(() => {});
            }
            const timeAnchor = hDeliv || hActions || hBrief;
            if (timeAnchor && hTime && hTime.parent_guid === project.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hTime.guid, after: timeAnchor.guid }).catch(() => {});
            }
            if (hTime && hBill && hBill.parent_guid === project.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hBill.guid, after: hTime.guid }).catch(() => {});
            }
            const checkAnchor = hBill || hTime;
            if (checkAnchor && hCheck && hCheck.parent_guid === project.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hCheck.guid, after: checkAnchor.guid }).catch(() => {});
            }
            const decAnchor = hCheck || hBill || hTime;
            if (decAnchor && hDecisions && hDecisions.parent_guid === project.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hDecisions.guid, after: decAnchor.guid }).catch(() => {});
            }

            if (!updated) {
                console.log(`  - [${title}] already completely up to date.`);
            }
        }
    }

    console.log('\n======================================================');
    console.log('Project backfill completed successfully.');
    console.log('======================================================');
}

backfillProjectArchetypes().catch(console.error);
