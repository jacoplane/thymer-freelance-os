import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { connectMcp } from './thymer-mcp.mjs';
import { starterConfig } from './starter-schema.mjs';

const args = process.argv.slice(2);
const workspace = args.includes('--workspace') ? args[args.indexOf('--workspace') + 1] : '';
if (!/^W[0-9A-Z]{25}$/.test(workspace)) throw new Error('Pass an explicit workspace GUID: node scripts/setup-support-sessions.mjs --workspace W… [--apply]');
const apply = args.includes('--apply');
const call = await connectMcp(process.env.THYMER_MCP_ENDPOINT);
const inventory = await call('list_workspaces', {});
const target = inventory.workspaces.find(item => item.guid === workspace);
if (!target || target.mcp_access !== 'readwrite') throw new Error('Target workspace needs read/write MCP access in Thymer Settings → MCP (AI Agents).');
let collections = (await call('list_collections', {workspace})).collections;
const links = Object.fromEntries(['Clients', 'Projects'].map(role => [role, collections.find(item => item.name === role)?.guid]));
if (!links.Clients || !links.Projects) throw new Error('Clients and Projects collections must exist before adding Support Sessions.');
let existing = collections.find(item => item.name === 'Support Sessions');
if (collections.filter(item => item.name === 'Support Sessions').length > 1) throw new Error('More than one Support Sessions collection exists; rename the duplicate first.');
console.log(`Target: ${target.name} (${workspace}); ${apply ? 'apply' : 'preview only'}`);
console.log(`Support Sessions: ${existing ? 'add or verify fields and Register view' : 'create collection'}`);
if (!apply) { console.log('No changes made. Add --apply to continue.'); process.exit(0); }
if (!existing) {
    await call('create_collection', {workspace, name:'Support Sessions', type:'collection', icon:'ti-clock-hour-4'});
    collections = (await call('list_collections', {workspace})).collections;
    existing = collections.find(item => item.name === 'Support Sessions');
    if (!existing) throw new Error('Support Sessions collection creation could not be verified.');
}
const previous = await call('get_collection_config_json', {workspace, collection:existing.guid});
const config = starterConfig('Support Sessions', previous.config, links);
const directory = path.join(os.tmpdir(), 'freelance-os-setup-backups', `${workspace}-${Date.now()}`);
await fs.mkdir(directory, {recursive:true});
await fs.writeFile(path.join(directory, 'Support-Sessions.json'), JSON.stringify(previous, null, 2));
if (!isDeepStrictEqual(config, previous.config)) await call('update_collection_config_json', {workspace, collection:existing.guid, config:JSON.stringify(config)});
const saved = await call('get_collection_config_json', {workspace, collection:existing.guid});
for (const field of config.fields) {
    const actual = saved.config.fields.find(item => item.label === field.label);
    if (!actual || actual.type !== field.type || (field.filter_colguid && actual.filter_colguid !== field.filter_colguid)) throw new Error(`Support Sessions field verification failed: ${field.label}`);
}
for (const view of config.views.filter(item => item.id !== 'list')) {
    const actual = saved.config.views.find(item => item.id === view.id);
    if (!actual || actual.type !== view.type || !isDeepStrictEqual(actual.field_ids, view.field_ids)) throw new Error(`Support Sessions view verification failed: ${view.label}`);
}
console.log(`Support Sessions saved and verified (${existing.guid}). Local backup: ${directory}`);
