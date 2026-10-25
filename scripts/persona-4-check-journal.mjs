import { connectMcp } from './thymer-mcp.mjs';

const WS = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
const COLS = {
    journal: '1H91FMYKBY5HNVWRGBYNEJKVZT'
};

async function checkJournal() {
    const call = await connectMcp();
    const jRes = await call('list_records', { workspace: WS, collection: COLS.journal });
    console.log(`Journal records (${jRes.records?.length || 0}):`);
    for (const j of (jRes.records || [])) {
        console.log(`- ${j.name} (${j.guid})`);
    }
}

checkJournal().catch(console.error);
