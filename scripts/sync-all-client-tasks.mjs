import { connectMcp } from './thymer-mcp.mjs';

async function run() {
    const call = await connectMcp();
    console.log('Connected to Thymer MCP.');

    // ==========================================
    // 1. JACOPLANE WORKSPACE (Production)
    // ==========================================
    const wJacoplane = 'WNN1JJG50ZQ6BE9S1T3HG85S57';
    console.log('\n--- SYNCING CLIENT TASKS IN JACOPLANE ---');

    const clientConfigs = [
        {
            guid: '16VNAKPP5H5H2CY3419GD27F38',
            name: 'Black Boys Hockey Club',
            accountTasks: [
                '- [ ] Issue monthly maintenance invoice (35 CHF) on Nov 1',
                '- [ ] Confirm Q4 committee meeting date for rebrand ratification'
            ],
            projectTasks: [
                '- [[1JPD32DVFK7PS5823A62PAFFA3]] Black Boys Hockey Club Rebrand (Active rebrand hub)',
                '- [[1TKN5RKSADV01NEZZR4HBYYR6F]] Strategic Brief (In progress)',
                '- [[19GGAJ2SJRA9393AR23AFKTCQM]] Naming and Language Architecture (Awaiting committee decision)',
                '- [[1HM0G0000NKCCZ2S9596KYR89A]] Roadmap and Deliverables (49 open milestone tasks)'
            ]
        },
        {
            guid: '15WPDEDVWKGC8RWWD4630B8B7X',
            name: 'Association Genevoise de Hockey sur Gazon',
            accountTasks: [
                '- [ ] Finalize AGHGA maintenance contract terms with Gabriel Tuscher'
            ],
            projectTasks: [
                '- [[18MWY0Y8349DVR1266R8BQPJB8]] Association Genevoise de Hockey sur Gazon [Project Hub]',
                '- [[1B2MM36REQZV3RC3HZFN3FXW1E]] Field Hockey Camps Refactor (5 active development tasks)',
                '- [[1JD1DB2FHZHMQ49AN8ZRFA22XA]] Primary School Trial Sign-up (Forms & landing page)',
                '- [[1G5RHXBVFRWK2HX6G26QJT33XV]] Contrat de Maintenance — AGHGA'
            ]
        },
        {
            guid: '1P9S5HRR3PG5P255MWK726F1B3',
            name: 'Centre Equestre de Severy',
            accountTasks: [
                '- [ ] Review proposition status and follow up with Direction Sévery'
            ],
            projectTasks: [
                '- [[1EAT8QJJ78P3K174FA1P0GEY4F]] Project Analysis (Scope & cost justification)'
            ]
        },
        {
            guid: '1NP24PNVYB1BZ7784N7JAK6BGG',
            name: 'Presinge Poney Club',
            accountTasks: [
                '- [ ] Check website performance & monthly backups for Presinge Poney Club'
            ],
            projectTasks: [
                '- [[11AFYQ761WQQCTYESXEK3FD5WR]] Presinge Poney Club [Project Hub]',
                '- [[1ZBYBCPQDPZT80ZMAVK26H700Q]] Contrat de Maintenance — Presinge Poney Club'
            ]
        },
        {
            guid: '14JB1MFZSQ6D54WGQJ23DETAH7',
            name: 'BetterFLY',
            accountTasks: [
                '- [ ] Check in on potential upcoming requirements'
            ],
            projectTasks: [
                '*(No active project tasks in flight)*'
            ]
        },
        {
            guid: '1C004HR3ECHFRA8DMP5F83QRJ3',
            name: 'Asseo Sculptures',
            accountTasks: [
                '- [ ] Annual portfolio review and digital archive maintenance'
            ],
            projectTasks: [
                '*(No active project tasks in flight)*'
            ]
        },
        {
            guid: '17013H2CW5997009M3SY2MK6JQ',
            name: 'Puplinge Solidaire',
            accountTasks: [
                '- [ ] Relationship check-in and annual support review'
            ],
            projectTasks: [
                '*(No active project tasks in flight)*'
            ]
        }
    ];

    for (const c of clientConfigs) {
        const rec = await call('get_record', { workspace: wJacoplane, record: c.guid, format: 'structured' });
        
        // Find existing Open Tasks heading if present
        const h = rec.items.find(i => i.type === 'heading' && i.text?.includes('Open Tasks'));
        if (h) {
            const toTrash = [];
            const directChildren = rec.items.filter(i => i.parent_guid === h.guid);
            for (const dc of directChildren) {
                const nested = rec.items.filter(i => i.parent_guid === dc.guid);
                for (const n of nested) toTrash.push(n.guid);
                toTrash.push(dc.guid);
            }
            toTrash.push(h.guid);

            for (const guid of toTrash) {
                await call('trash_line_item', { workspace: wJacoplane, line_item: guid });
            }
            console.log(`✓ Removed old placeholder Open Tasks section for ${c.name}`);
        }

        const md = `## 📋 Open Tasks & Actions

### Account & Relationship Tasks
${c.accountTasks.join('\n')}

### Active Project Tasks
${c.projectTasks.join('\n')}`;

        await call('insert_markdown', { workspace: wJacoplane, record: c.guid, markdown: md });
        console.log(`✓ Installed combined Open Tasks & Actions for ${c.name}`);
    }

    // ==========================================
    // 2. FREELANCE OS WORKSPACE (Demo)
    // ==========================================
    const wFreelance = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
    console.log('\n--- SYNCING CLIENT TASKS IN FREELANCE OS (Demo) ---');

    const demoClientTasks = [
        {
            guid: '1GBP4B4SHYFB05EMQ55T66KV0B',
            name: 'Cedarworks Co.',
            account: '- [ ] Send Q4 invoice on Nov 15',
            project: '- [[1JBKK81XQ25BSXDJQ8FD193WN4]] Member portal (In progress)'
        },
        {
            guid: '17QF4SDV5WTNCP92CTWG1K1DA3',
            name: 'Harbor Collective',
            account: '- [ ] Follow up on Q1 design support capacity',
            project: '*(No active projects in flight)*'
        },
        {
            guid: '1SVD751Y866ZG6JRBQS0PFW6M3',
            name: 'Maple & Moss',
            account: '- [ ] Request remaining high-res product photos from Chloe',
            project: '- [[1N3T8H748NH89HR7YHBAXZ7Y3T]] Online shop launch (In review)'
        },
        {
            guid: '15GKSBT24JEH6AWVZG557F57NG',
            name: 'Paper Lantern Books',
            account: '- [ ] Send brand workshop prep agenda',
            project: '- [[14N3ZEBF85D0KKAA885HQB157M]] Brand workshop (Backlog)'
        },
        {
            guid: '1C7QTTAJWBNE79PYCTE78ASYSF',
            name: 'Orbit Coffee',
            account: '- [ ] Monthly care plan report delivery on Mon Oct 26',
            project: '- [[164J9X4K9C1FDKZP4P47D5ZXFZ]] Care plan · Q4 (Active)'
        }
    ];

    for (const c of demoClientTasks) {
        const rec = await call('get_record', { workspace: wFreelance, record: c.guid, format: 'structured' });
        const hasOpenTasks = rec.items.some(i => i.type === 'heading' && i.text?.includes('Open Tasks'));
        if (!hasOpenTasks) {
            const md = `## 📋 Open Tasks & Actions

### Account & Relationship Tasks
${c.account}

### Active Project Tasks
${c.project}`;
            await call('insert_markdown', { workspace: wFreelance, record: c.guid, markdown: md });
            console.log(`✓ Installed combined Open Tasks for demo client ${c.name}`);
        }
    }

    console.log('\nTask embedding synchronization complete!');
}

run().catch(console.error);
