import { connectMcp } from './thymer-mcp.mjs';
import fs from 'fs';

const WS = 'WNN1JJG50ZQ6BE9S1T3HG85S57'; // jacoplane production workspace
const COLS = {
    library: '16YBSRJPHPAFJCRTZDWJJEF5QG',
    projects: '1B0J3X9Y8QS96C75M3QMT23DNW',
    clients: '1FD58J39X6KJ4JK5F06T7P4TSR'
};

const PROJECT_GUID = '1X526PD9ABAH1NJEX1HNKKTWSZ';
const CLIENT_GUID = '17013H2CW5997009M3SY2MK6JQ';

async function main() {
    const call = await connectMcp();

    console.log('1. Reading guide markdown content...');
    const guidePath = 'C:\\dev\\puplinge-solidaire-emdash\\docs\\guide-changement-cms-valentina.md';
    const guideMd = fs.readFileSync(guidePath, 'utf8');

    console.log('2. Creating record in Thymer Library collection...');
    const recordTitle = 'Puplinge Solidaire · Guide CMS Emdash (Valentina)';
    const rec = await call('create_record', {
        workspace: WS,
        collection: COLS.library,
        title: recordTitle
    });
    console.log(`✓ Record created: "${recordTitle}" (${rec.guid})`);

    console.log('3. Inserting formatted guide markdown...');
    await call('insert_markdown', {
        workspace: WS,
        record: rec.guid,
        markdown: guideMd
    });
    console.log('✓ Guide content inserted into Thymer record');

    console.log('4. Linking in Project record...');
    const projectRec = await call('get_record', { workspace: WS, record: PROJECT_GUID });
    // Append link under Deliverables
    const linkLine = `- [[${recordTitle}]] (Guide d'accompagnement pour Valentina et le comité)\n`;
    await call('insert_markdown', {
        workspace: WS,
        record: PROJECT_GUID,
        markdown: `\n### 📄 Documents & Guides\n- [[${recordTitle}]] — Guide d'accompagnement non technique pour Valentina\n`
    });
    console.log('✓ Linked in Project record');

    console.log('5. Linking in Client record...');
    await call('insert_markdown', {
        workspace: WS,
        record: CLIENT_GUID,
        markdown: `\n### 📄 Documents & Guides\n- [[${recordTitle}]] — Guide d'accompagnement non technique pour Valentina\n`
    });
    console.log('✓ Linked in Client record');

    console.log('6. Navigating to the newly created document in Thymer UI...');
    await call('navigate_to_record', {
        workspace: WS,
        record: rec.guid
    });
    console.log(`✓ Navigated to ${recordTitle} (${rec.guid}) in panel`);

    console.log('Done!');
}

main().catch(console.error);
