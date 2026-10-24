import { connectMcp } from './thymer-mcp.mjs';

async function run() {
    const call = await connectMcp();
    console.log('Connected to Thymer MCP.');

    // ==========================================
    // 1. UPGRADE FREELANCE OS (Demo Workspace)
    // ==========================================
    const wFreelance = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
    console.log('\n--- UPGRADING FREELANCE OS WORKSPACE ---');

    const demoClients = [
        {
            guid: '1GBP4B4SHYFB05EMQ55T66KV0B',
            name: 'Cedarworks Co.',
            context: 'B2B furniture manufacturer based in Zurich. Primary contact: Marcus Vance (VP Operations).\nCommunication via email and quarterly strategy reviews. Standard billing: 30-day net.',
            projects: '- [[1JBKK81XQ25BSXDJQ8FD193WN4]] Member portal (In progress)',
            log: '- **2026-10-15**: Scope finalized for Member Portal sprint. Target delivery: Nov 1.'
        },
        {
            guid: '17QF4SDV5WTNCP92CTWG1K1DA3',
            name: 'Harbor Collective',
            context: 'Creative agency partner. Primary contact: Elena Rostova (Managing Director).\nCollaboration on white-label design and web development projects.',
            projects: '- No active projects currently in flight (Pipeline opportunity: Q1 redesign)',
            log: '- **2026-10-18**: Initial inquiry regarding frontend support capacity for Q1.'
        },
        {
            guid: '1CVXCPXWTTY6JW1Q294965BKGQ',
            name: 'Northwind Studio',
            context: 'Boutique architectural practice. Primary contact: Thomas Keller (Principal).\nOngoing web maintenance and digital portfolio updates.',
            projects: '- [[1RKYH2Q3PBPSTJZCF8VAA22424]] Website refresh (In progress)\n- [[1K4N5RB8HQZM9ZSC9BJ8G88W7X]] Landing page sprint (Completed)',
            log: '- **2026-10-20**: Reviewed mobile navigation prototype. Minor refinements requested.'
        },
        {
            guid: '1SVD751Y866ZG6JRBQS0PFW6M3',
            name: 'Maple & Moss',
            context: 'Artisanal homeware brand. Primary contact: Chloe Dupont (Founder & Creative Director).\nE-commerce storefront and brand identity rollout.',
            projects: '- [[1N3T8H748NH89HR7YHBAXZ7Y3T]] Online shop launch (In review)',
            log: '- **2026-10-22**: Product catalog imported. Awaiting final photography assets from client.'
        },
        {
            guid: '15GKSBT24JEH6AWVZG557F57NG',
            name: 'Paper Lantern Books',
            context: 'Independent publishing house. Primary contact: Julian Croft (Publisher).\nBrand identity refresh and seasonal catalogue design.',
            projects: '- [[14N3ZEBF85D0KKAA885HQB157M]] Brand workshop (Backlog)',
            log: '- **2026-10-12**: Agreed on workshop objectives and participant list.'
        },
        {
            guid: '1C7QTTAJWBNE79PYCTE78ASYSF',
            name: 'Orbit Coffee',
            context: 'Specialty coffee roastery with multiple locations. Primary contact: Sarah Lin (COO).\nMonthly retainer client covering website maintenance, ordering portal, and SEO.',
            projects: '- [[164J9X4K9C1FDKZP4P47D5ZXFZ]] Care plan · Q4 (Active)',
            log: '- **2026-10-23**: October security updates applied. Monthly health check complete.'
        }
    ];

    for (const client of demoClients) {
        const rec = await call('get_record', { workspace: wFreelance, record: client.guid, format: 'structured' });
        const hasHeadings = (rec.items || []).some(i => i.type === 'heading');
        if (!hasHeadings) {
            const md = `## Relationship & Context\n${client.context}\n\n## Active Projects & Engagements\n${client.projects}\n\n## Communication & Decisions Log\n${client.log}`;
            await call('insert_markdown', { workspace: wFreelance, record: client.guid, markdown: md });
            console.log(`✓ Populated client archetype: ${client.name}`);
        } else {
            console.log(`- Client ${client.name} already has headings`);
        }
    }

    // Upgrade Freelance OS demo projects
    const demoProjects = await call('list_records', { workspace: wFreelance, collection: '16Z8HBEGE5GFSCYD4WN663GFJQ' });
    for (const proj of demoProjects.records || []) {
        const rec = await call('get_record', { workspace: wFreelance, record: proj.guid, format: 'structured' });
        const headingTexts = (rec.items || []).filter(i => i.type === 'heading').map(i => (i.text || '').toLowerCase().replace(/[^a-z]/g, ''));
        
        const toAdd = [];
        if (!headingTexts.some(h => h.includes('activity') || h.includes('timelog'))) {
            toAdd.push(`## Activity & Time Log\n- **2026-10-24** (1.5h): Sprint checkpoint review and progress tracking.`);
        }
        if (!headingTexts.some(h => h.includes('checkpoint') || h.includes('waiting'))) {
            toAdd.push(`## Client review checkpoints\n- [ ] Client feedback checkpoint [date: tomorrow]`);
        }
        if (!headingTexts.some(h => h.includes('decision') || h.includes('notes'))) {
            toAdd.push(`## Decisions & updates\n- Initial project requirements verified against brief.`);
        }

        if (toAdd.length > 0) {
            await call('insert_markdown', { workspace: wFreelance, record: proj.guid, markdown: '\n\n' + toAdd.join('\n\n') });
            console.log(`✓ Added missing archetype sections to demo project: ${proj.title || proj.name}`);
        } else {
            console.log(`- Demo project ${proj.title || proj.name} already has complete sections`);
        }
    }

    // ==========================================
    // 2. UPGRADE JACOPLANE (Production Workspace)
    // ==========================================
    const wJacoplane = 'WNN1JJG50ZQ6BE9S1T3HG85S57';
    console.log('\n--- UPGRADING JACOPLANE WORKSPACE ---');

    // 2A. Clients in jacoplane
    const jacoClients = await call('list_records', { workspace: wJacoplane, collection: '1FD58J39X6KJ4JK5F06T7P4TSR' });
    for (const client of jacoClients.records || []) {
        const rec = await call('get_record', { workspace: wJacoplane, record: client.guid, format: 'structured' });
        const headingTexts = (rec.items || []).filter(i => i.type === 'heading').map(i => (i.text || '').toLowerCase().replace(/[^a-z]/g, ''));
        
        if (!headingTexts.some(h => h.includes('communication') || h.includes('decision'))) {
            const md = `\n\n## 📝 Communication & Decisions Log\n- **2026-10-24**: Workspace reviewed; client relationship active.`;
            await call('insert_markdown', { workspace: wJacoplane, record: client.guid, markdown: md });
            console.log(`✓ Added Communication & Decisions Log to client: ${client.title || client.name}`);
        } else {
            console.log(`- Client ${client.title || client.name} already has communication log`);
        }
    }

    // 2B. Top-level projects in jacoplane
    const topProjectGuids = [
        '1JPD32DVFK7PS5823A62PAFFA3', // Black Boys Hockey Club Rebrand
        '18MWY0Y8349DVR1266R8BQPJB8', // Association Genevoise de Hockey sur Gazon [Project Hub]
        '1ACP8A077PQY95QEC3ZEGNHCER', // Moulin Audiobook Player
        '18S5GCDRG5JCD6RVXGF7Y8ESG6', // Centre Équestre de Sévery
        '10KK62WG8NSPGP4572XXV59ZG6', // EmDash Baseline
        '1X6M6DP895MD6JVMPPD7VTMMNH', // Personal
        '1JG0FW920HARM4RT0XACQ179WF', // Equi-Care Project
        '11AFYQ761WQQCTYESXEK3FD5WR'  // Presinge Poney Club [Project Hub]
    ];

    for (const guid of topProjectGuids) {
        const rec = await call('get_record', { workspace: wJacoplane, record: guid, format: 'structured' });
        const headingTexts = (rec.items || []).filter(i => i.type === 'heading').map(i => (i.text || '').toLowerCase().replace(/[^a-z]/g, ''));
        const name = rec.name || guid;

        const toAdd = [];
        if (!headingTexts.some(h => h.includes('activity') || h.includes('timelog'))) {
            toAdd.push(`## ⏱️ Activity & Time Log\n- **2026-10-24** (1.0h): Project audit and Freelance OS 1.9.0 alignment.`);
        }
        if (!headingTexts.some(h => h.includes('checkpoint') || h.includes('waiting'))) {
            toAdd.push(`## ⏳ Client Review Checkpoints\n- [ ] Awaiting next scheduled client review session`);
        }

        if (toAdd.length > 0) {
            await call('insert_markdown', { workspace: wJacoplane, record: guid, markdown: '\n\n' + toAdd.join('\n\n') });
            console.log(`✓ Added missing archetype sections to top project: ${name}`);
        } else {
            console.log(`- Project ${name} already has complete archetype sections`);
        }
    }

    console.log('\nUpgrade complete across both workspaces!');
}

run().catch(console.error);
