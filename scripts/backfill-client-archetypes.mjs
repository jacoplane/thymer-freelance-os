import { connectMcp } from './thymer-mcp.mjs';

function getProp(obj, key) {
    const val = obj?.properties?.[key];
    if (Array.isArray(val)) return val[1];
    return val;
}

/**
 * Idempotent backport script for comprehensive Client Archetype:
 * 1. Relationship & Context (with Key Links & Stakeholders)
 * 2. Active Projects & Engagements (with [+ Create project])
 * 3. Invoices & Billing (with [+ Create invoice])
 * 4. Support & Care Plan (with [+ Log support time])
 * 5. Open Tasks & Actions (Account & Relationship Tasks + Project Tasks Rollup)
 * 6. Communication & Decisions Log
 *
 * Preserves all existing client notes, links, tasks, and historical records.
 */
async function backfillClientArchetypes() {
    const call = await connectMcp();
    console.log('Connected to Thymer MCP.');

    const workspaces = [
        { guid: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2', name: 'Freelance OS', clientsCol: '1DCV1BDVHH7Q4QV1TYAR6ZZF6E' },
        { guid: 'WNN1JJG50ZQ6BE9S1T3HG85S57', name: 'jacoplane', clientsCol: '1FD58J39X6KJ4JK5F06T7P4TSR' }
    ];

    const projectPrompt = '*(No active projects in flight. Click above, use + Project in the top header, or press Ctrl/Cmd+K → "Create Freelance OS project for active client".)*';
    const plainProjectPrompt = '(No active projects in flight. Click above, use + Project in the top header, or press Ctrl/Cmd+K → "Create Freelance OS project for active client".)';
    const taskRollup = '*(No active project tasks. Tasks added to linked projects will automatically roll up here.)*';
    const plainTaskRollup = '(No active project tasks. Tasks added to linked projects will automatically roll up here.)';

    for (const ws of workspaces) {
        console.log(`\n======================================================`);
        console.log(`Auditing & Upgrading Workspace: ${ws.name} (${ws.guid})`);
        console.log(`======================================================`);
        const records = await call('list_records', { workspace: ws.guid, collection: ws.clientsCol });
        
        for (const client of records.records || []) {
            let rec = await call('get_record', { workspace: ws.guid, record: client.guid, format: 'structured' });
            const title = rec.name || client.name || client.guid;
            let updated = false;

            // 1. Upgrade passive project & task prompts
            for (const item of rec.items || []) {
                const text = item.text || '';
                if (
                    text.includes('No active projects currently in flight') ||
                    text.includes('No active projects linked yet') ||
                    text.includes('No active projects in flight') ||
                    text === '(No active projects)'
                ) {
                    if (text !== projectPrompt && text !== plainProjectPrompt) {
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

                if (
                    text.includes('No active project tasks in flight') ||
                    text === '(No active project tasks)' ||
                    text === '(No active project tasks in flight)'
                ) {
                    if (text !== taskRollup && text !== plainTaskRollup) {
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

            // 2. Refresh items
            rec = await call('get_record', { workspace: ws.guid, record: client.guid, format: 'structured' });
            let items = rec.items || [];

            // 3. Ensure Active Projects heading exists and has [+ Create project]
            let projectsHeading = items.find(i => i.type === 'heading' && (
                i.text?.includes('Active Projects') ||
                i.text?.includes('Projects &') ||
                i.text === 'Active Projects' ||
                i.text === '📁 Active Projects & Documents' ||
                i.text === '📁 Active Projects & Engagements' ||
                i.text === '📁 Projects & Agreements'
            ));

            if (!projectsHeading) {
                const relOrTop = items.find(i => i.type === 'heading') || null;
                projectsHeading = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    after: relOrTop ? relOrTop.guid : null,
                    type: 'heading',
                    heading_size: 2,
                    content: 'Active Projects & Engagements'
                });
                await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: projectsHeading.guid,
                    type: 'linkbtn',
                    content: '+ Create project'
                });
                await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: projectsHeading.guid,
                    type: 'text',
                    content: projectPrompt
                });
                console.log(`  ✓ Created [Active Projects & Engagements] section on [${title}]`);
                updated = true;
                rec = await call('get_record', { workspace: ws.guid, record: client.guid, format: 'structured' });
                items = rec.items || [];
            } else {
                const hasProjectLinkBtn = items.some(i => i.type === 'linkbtn' && i.text?.includes('Create project'));
                if (!hasProjectLinkBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: client.guid,
                        parent: projectsHeading.guid,
                        type: 'linkbtn',
                        content: '+ Create project'
                    });
                    console.log(`  ✓ Inserted [+ Create project] into [${title}]`);
                    updated = true;
                }
            }

            // 4. Ensure Invoices & Billing section exists
            const hasInvoicesHeading = items.some(i => i.type === 'heading' && i.text?.includes('Invoices'));
            let invHeadingGuid = null;

            if (!hasInvoicesHeading) {
                const anchor = projectsHeading?.guid || null;
                const invHeading = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    after: anchor,
                    type: 'heading',
                    heading_size: 2,
                    content: '💳 Invoices & Billing'
                });
                invHeadingGuid = invHeading.guid;

                const b1 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: invHeading.guid,
                    type: 'linkbtn',
                    content: '+ Create invoice'
                });

                const b2 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: invHeading.guid,
                    after: b1.guid,
                    type: 'text',
                    content: '*(No invoices issued yet. Click above, use + Invoice in the top header, or press Ctrl/Cmd+K → "Create Freelance OS invoice".)*'
                });

                const b3 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: invHeading.guid,
                    after: b2.guid,
                    type: 'ulist',
                    content: 'Billing Terms: Monthly (1er du mois) / Net 30'
                });

                await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: invHeading.guid,
                    after: b3.guid,
                    type: 'ulist',
                    content: 'Payment Method: Bank Transfer / QR-bill (CHF)'
                });

                console.log(`  ✓ Added [💳 Invoices & Billing] section into [${title}]`);
                updated = true;
            } else {
                invHeadingGuid = items.find(i => i.type === 'heading' && i.text?.includes('Invoices'))?.guid;
                const hasInvLinkBtn = items.some(i => i.type === 'linkbtn' && i.text?.includes('Create invoice'));
                if (invHeadingGuid && !hasInvLinkBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: client.guid,
                        parent: invHeadingGuid,
                        type: 'linkbtn',
                        content: '+ Create invoice'
                    });
                    console.log(`  ✓ Inserted [+ Create invoice] button into existing Invoices section on [${title}]`);
                    updated = true;
                }
            }

            // 5. Ensure Support & Care Plan section exists
            const hasSupportHeading = items.some(i => i.type === 'heading' && (i.text?.includes('Support') || i.text?.includes('Care Plan')));
            let supHeadingGuid = null;

            const monthlyVal = getProp(rec, 'monthly_chf') ?? getProp(client, 'monthly_chf') ?? 0;
            const monthlyChf = Number(monthlyVal) || 0;
            const planName = getProp(rec, 'plan') || getProp(client, 'plan') || '';
            const incHoursVal = getProp(rec, 'included_hours') ?? getProp(client, 'included_hours');
            const incHours = Number(incHoursVal) || (monthlyChf >= 100 ? 4 : monthlyChf > 0 ? 2 : 0);
            
            const planLabel = planName || (monthlyChf > 0 ? `${monthlyChf} CHF / month care plan` : 'Standard on-demand support');
            const includedHoursStr = incHours > 0 ? `${incHours}h / month included` : (monthlyChf > 0 ? '2h / month included' : 'Billed hourly');

            if (!hasSupportHeading) {
                const anchor = invHeadingGuid || projectsHeading?.guid || null;

                const supHeading = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    after: anchor,
                    type: 'heading',
                    heading_size: 2,
                    content: '⏱️ Support & Care Plan'
                });
                supHeadingGuid = supHeading.guid;

                const s1 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: supHeading.guid,
                    type: 'linkbtn',
                    content: '+ Log support time'
                });

                const s2 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: supHeading.guid,
                    after: s1.guid,
                    type: 'ulist',
                    content: `Active Plan: ${planLabel}`
                });

                const s3 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: supHeading.guid,
                    after: s2.guid,
                    type: 'ulist',
                    content: `Monthly Support Allowance: ${includedHoursStr}`
                });

                await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: supHeading.guid,
                    after: s3.guid,
                    type: 'ulist',
                    content: 'Support Window: Mon–Fri, 09:00–18:00 CET'
                });

                console.log(`  ✓ Added [⏱️ Support & Care Plan] section into [${title}]`);
                updated = true;
            } else {
                supHeadingGuid = items.find(i => i.type === 'heading' && (i.text?.includes('Support') || i.text?.includes('Care Plan')))?.guid;
                const hasSupLinkBtn = items.some(i => i.type === 'linkbtn' && i.text?.includes('support time'));
                if (supHeadingGuid && !hasSupLinkBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: client.guid,
                        parent: supHeadingGuid,
                        type: 'linkbtn',
                        content: '+ Log support time'
                    });
                    console.log(`  ✓ Inserted [+ Log support time] button into existing Support section on [${title}]`);
                    updated = true;
                }
            }

            // 6. Ensure Key Links & Stakeholders exist under Relationship & Context
            const relHeading = items.find(i => i.type === 'heading' && (i.text === 'Relationship & Context' || i.text === '📁 Relationship & Context'));
            const hasLinks = items.some(i => i.text?.includes('Key Links') || i.text?.includes('Shared Drive') || i.text?.includes('Figma'));
            
            if (relHeading && !hasLinks) {
                const relChildren = items.filter(i => i.parent_guid === relHeading.guid);
                let anchor = relChildren.length > 0 ? relChildren[relChildren.length - 1].guid : null;

                const contactStr = getProp(rec, 'contact') || getProp(client, 'contact') || '';
                let contactName = 'Contact Name';
                let contactEmail = 'email@...';
                if (contactStr.includes('·')) {
                    const parts = contactStr.split('·').map(s => s.trim());
                    contactName = parts[0] || contactName;
                    contactEmail = parts[1] || contactEmail;
                } else if (contactStr.includes('-')) {
                    const parts = contactStr.split('-').map(s => s.trim());
                    contactName = parts[0] || contactName;
                    contactEmail = parts[1] || contactEmail;
                } else if (contactStr) {
                    contactName = contactStr;
                }

                const website = getProp(rec, 'website') || getProp(client, 'website') || 'https://...';

                const l1 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: relHeading.guid,
                    after: anchor,
                    type: 'heading',
                    heading_size: 3,
                    content: '🔗 Key Links & Deliverables'
                });

                const l2 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: relHeading.guid,
                    after: l1.guid,
                    type: 'ulist',
                    content: `Website: ${website}`
                });

                const l3 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: relHeading.guid,
                    after: l2.guid,
                    type: 'ulist',
                    content: 'Shared Drive / Assets: [Folder link ↗]'
                });

                const l4 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: relHeading.guid,
                    after: l3.guid,
                    type: 'ulist',
                    content: 'Design & Mockups: [Figma / Design link ↗]'
                });

                const l5 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: relHeading.guid,
                    after: l4.guid,
                    type: 'heading',
                    heading_size: 3,
                    content: '👥 Stakeholders & Roles'
                });

                const l6 = await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: relHeading.guid,
                    after: l5.guid,
                    type: 'ulist',
                    content: `Primary Contact: ${contactName} (${contactEmail}) — Decision maker`
                });

                await call('create_line_item', {
                    workspace: ws.guid,
                    record: client.guid,
                    parent: relHeading.guid,
                    after: l6.guid,
                    type: 'ulist',
                    content: 'Billing Contact: factures@... (Net 30)'
                });

                console.log(`  ✓ Added Key Links & Stakeholders into Relationship on [${title}]`);
                updated = true;
            }

            // 7. Canonical Heading Reordering:
            // Ensure order: Relationship & Context -> Active Projects -> Invoices & Billing -> Support & Care Plan -> Open Tasks -> Communication Log
            rec = await call('get_record', { workspace: ws.guid, record: client.guid, format: 'structured' });
            items = rec.items || [];

            const hRel = items.find(i => i.type === 'heading' && (i.text === 'Relationship & Context' || i.text === '📁 Relationship & Context'));
            const hProj = items.find(i => i.type === 'heading' && (i.text?.includes('Active Projects') || i.text?.includes('Projects &') || i.text === 'Active Projects' || i.text === '📁 Active Projects & Documents' || i.text === '📁 Active Projects & Engagements' || i.text === '📁 Projects & Agreements'));
            const hInv = items.find(i => i.type === 'heading' && i.text?.includes('Invoices'));
            const hSup = items.find(i => i.type === 'heading' && (i.text?.includes('Support') || i.text?.includes('Care Plan')));
            const hTasks = items.find(i => i.type === 'heading' && (i.text?.includes('Open Tasks') || i.text?.includes('Tasks & Actions')));
            const hComms = items.find(i => i.type === 'heading' && (i.text?.includes('Communication') || i.text?.includes('Decisions Log')));

            // Chain order: hProj after hRel, hInv after hProj, hSup after hInv, hTasks after hSup, hComms after hTasks
            if (hRel && hProj && hProj.parent_guid === client.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hProj.guid, after: hRel.guid }).catch(() => {});
            }
            if (hProj && hInv && hInv.parent_guid === client.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hInv.guid, after: hProj.guid }).catch(() => {});
            }
            if (hInv && hSup && hSup.parent_guid === client.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hSup.guid, after: hInv.guid }).catch(() => {});
            }
            if (hSup && hTasks && hTasks.parent_guid === client.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hTasks.guid, after: hSup.guid }).catch(() => {});
            }
            if (hTasks && hComms && hComms.parent_guid === client.guid) {
                await call('move_line_item', { workspace: ws.guid, line_item: hComms.guid, after: hTasks.guid }).catch(() => {});
            }

            if (!updated) {
                console.log(`  - [${title}] already completely up to date.`);
            }
        }
    }

    console.log('\n======================================================');
    console.log('Backfill completed successfully across all workspaces.');
    console.log('======================================================');
}

backfillClientArchetypes().catch(console.error);
