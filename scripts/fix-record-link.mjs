import { connectMcp } from './thymer-mcp.mjs';

const WS = 'WNN1JJG50ZQ6BE9S1T3HG85S57';
const PROJECT_GUID = '1X526PD9ABAH1NJEX1HNKKTWSZ';
const CLIENT_GUID = '17013H2CW5997009M3SY2MK6JQ';
const GUIDE_GUID = '1XGA0X00XT61KFD862FC8KJJZ7';

async function main() {
    const call = await connectMcp();

    // 1. Check line items of Project
    console.log('1. Checking Project line items...');
    const projLines = await call('get_line_items', { workspace: WS, record: PROJECT_GUID });
    const targetItem = projLines.items.find(i => i.text && i.text.includes('Puplinge Solidaire · Guide CMS Emdash'));
    
    if (targetItem) {
        console.log(`Found target line item in project: ${targetItem.guid}`);
        console.log('Updating line item with real ref segment...');
        const res = await call('update_line_item', {
            workspace: WS,
            line_item: targetItem.guid,
            segments: [
                { type: 'ref', text: GUIDE_GUID },
                { type: 'text', text: " — Guide d'accompagnement non technique pour Valentina" }
            ]
        });
        console.log('✓ Project line item updated:', res);
    } else {
        console.log('Target line item not found in project');
    }

    // 2. Check line items of Client
    console.log('\n2. Checking Client line items...');
    const clientLines = await call('get_line_items', { workspace: WS, record: CLIENT_GUID });
    const clientTargetItem = clientLines.items.find(i => i.text && i.text.includes('Puplinge Solidaire · Guide CMS Emdash'));
    
    if (clientTargetItem) {
        console.log(`Found target line item in client: ${clientTargetItem.guid}`);
        console.log('Updating line item with real ref segment...');
        const res = await call('update_line_item', {
            workspace: WS,
            line_item: clientTargetItem.guid,
            segments: [
                { type: 'ref', text: GUIDE_GUID },
                { type: 'text', text: " — Guide d'accompagnement non technique pour Valentina" }
            ]
        });
        console.log('✓ Client line item updated:', res);
    } else {
        console.log('Target line item not found in client');
    }

    // 3. Verify the updated segments
    console.log('\n3. Verifying updated line item in Project...');
    const checkProj = await call('get_line_items', { workspace: WS, record: PROJECT_GUID });
    const updated = checkProj.items.find(i => i.guid === (targetItem ? targetItem.guid : ''));
    console.log('Updated item:', JSON.stringify(updated, null, 2));
}

main().catch(console.error);
