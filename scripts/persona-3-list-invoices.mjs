import { connectMcp } from './thymer-mcp.mjs';

const WS = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
const COLS = {
    clients: '1DCV1BDVHH7Q4QV1TYAR6ZZF6E',
    projects: '16Z8HBEGE5GFSCYD4WN663GFJQ',
    invoices: '1F7GZ294EPP3QNHS96BDGAVC1E'
};

function extractProp(val) {
    if (!val) return null;
    if (Array.isArray(val)) return val[1];
    if (typeof val === 'object' && val.value) return extractProp(val.value);
    return val;
}

async function listInvoices() {
    const call = await connectMcp();
    const invRes = await call('list_records', { workspace: WS, collection: COLS.invoices });
    console.log(`Found ${invRes.records?.length || 0} invoices:`);
    for (const inv of (invRes.records || [])) {
        const full = await call('get_record', { workspace: WS, record: inv.guid, format: 'structured' });
        const props = full.properties || {};
        console.log(`- ${inv.name} (${inv.guid}): amount=${extractProp(props.amount_chf)}, payment_status=${extractProp(props.payment_status)}, status=${extractProp(props.status)}, due=${extractProp(props.due)}, paid_date=${extractProp(props.paid_date)}`);
    }
}

listInvoices().catch(console.error);
