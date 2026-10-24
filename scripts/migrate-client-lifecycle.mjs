import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { connectMcp } from './thymer-mcp.mjs';
import { choiceLabel, planClientLifecycleMigration } from './client-lifecycle-plan.mjs';

const args = process.argv.slice(2);
const workspace = args.includes('--workspace') ? args[args.indexOf('--workspace') + 1] : '';
if (!/^W[0-9A-Z]{25}$/.test(workspace)) throw new Error('Pass an explicit --workspace W… [--apply].');
const apply = args.includes('--apply');
const call = await connectMcp();
const config = (await call('get_collection_config_json', { workspace, collection: 'Clients' })).config;
const legacy = config.fields.find(field => field.label === 'lead_stage');
if (!legacy || legacy.active === false) { console.log('Client lifecycle migration is already complete; no legacy field is active.'); process.exit(0); }
const inventory = await call('list_records', { workspace, collection: 'Clients', limit: 1000 });
if (inventory.total > inventory.returned) throw new Error('The Clients scan is incomplete. No records were changed.');
const records = [];
for (const record of inventory.records) {
    const current = await call('get_record_properties', { workspace, record: record.guid });
    records.push({ ...record, properties: { status: current.properties.status?.value, lead_stage: current.properties.lead_stage?.value } });
}
const changes = planClientLifecycleMigration(records, config);
console.log(`Workspace ${workspace}: ${changes.length} legacy lead statuses to consolidate; ${apply ? 'apply' : 'preview only'}. Active and archived clients keep their status.`);
if (!apply) process.exit(0);
for (const change of changes) if (!config.fields.find(field => field.label === 'status').choices.some(choice => choice.label === change.to && choice.active !== false)) throw new Error('Run setup-workspace.mjs --collection Clients --apply before migrating records.');
const folder = path.join(os.tmpdir(), 'freelance-os-lifecycle-backups', `${workspace}-${Date.now()}`);
await fs.mkdir(folder, { recursive: true });
await fs.writeFile(path.join(folder, 'plan.json'), JSON.stringify({ workspace, changes, config }, null, 2));
for (const change of changes) {
    const current = await call('get_record_properties', { workspace, record: change.guid });
    if (choiceLabel(config, 'status', current.properties.status?.value) !== change.from || choiceLabel(config, 'lead_stage', current.properties.lead_stage?.value) !== change.stage) throw new Error('A client changed after planning. Stop and preview again; previously verified changes remain saved.');
    await fs.writeFile(path.join(folder, `${change.guid}.json`), JSON.stringify(current, null, 2));
    await call('update_record_property', { workspace, record: change.guid, property: 'status', value: change.to });
    const saved = await call('get_record_properties', { workspace, record: change.guid });
    if (choiceLabel(config, 'status', saved.properties.status?.value) !== change.to) throw new Error('A migrated status could not be verified. Stop before retrying.');
}
const latest = (await call('get_collection_config_json', { workspace, collection: 'Clients' })).config;
const retiring = latest.fields.find(field => field.id === legacy.id);
if (!isDeepStrictEqual(retiring, legacy) || !isDeepStrictEqual(latest.fields.find(field => field.label === 'status'), config.fields.find(field => field.label === 'status'))) throw new Error('The lifecycle schema changed during migration. Saved statuses remain verified; inspect the schema before retrying.');
retiring.active = false;
await call('update_collection_config_json', { workspace, collection: 'Clients', config: JSON.stringify(latest) });
const verified = (await call('get_collection_config_json', { workspace, collection: 'Clients' })).config;
if (verified.fields.find(field => field.id === legacy.id)?.active !== false) throw new Error('Legacy field retirement could not be verified. Inspect the schema before retrying.');
console.log(`Saved and verified ${changes.length} statuses. Legacy lead_stage values were kept in the retired field. Backup: ${folder}`);
