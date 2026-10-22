import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { connectMcp } from './thymer-mcp.mjs';
import { STARTER_ROLES, starterConfig } from './starter-schema.mjs';

const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
const workspace = args.includes('--workspace') ? value('--workspace') : process.env.THYMER_WORKSPACE;
if (!workspace || !/^W[0-9A-Z]{25}$/.test(workspace)) throw new Error('Pass an explicit workspace GUID: node scripts/setup-workspace.mjs --workspace W… [--apply] [--install]');
const apply = args.includes('--apply');
const call = await connectMcp(process.env.THYMER_MCP_ENDPOINT);
const inventory = await call('list_workspaces', {});
const target = inventory.workspaces.find(item => item.guid === workspace);
if (!target || target.mcp_access !== 'readwrite') throw new Error('Target workspace needs read/write MCP access in Thymer Settings → MCP (AI Agents).');
console.log(`Target: ${target.name} (${workspace}); ${apply ? 'apply' : 'preview only'}`);
let collections = (await call('list_collections', {workspace})).collections;
const links = {};
const plans = [];
// Validate every existing collection before making changes.
for (const role of STARTER_ROLES) {
    const matches = collections.filter(item => item.name === role);
    if (matches.length > 1) throw new Error(`More than one collection is named ${role}; rename the duplicate first.`);
    const existing = matches[0];
    if (existing) links[role] = existing.guid;
    const previous = existing ? await call('get_collection_config_json', {workspace,collection:existing.guid}) : null;
    if (role === 'Journal' && existing) {
        const journal = await call('get_plugin_code',{workspace,plugin:existing.guid});
        if (!journal.code?.includes('JournalCorePlugin')) throw new Error('An ordinary collection is named Journal. Use Thymer’s native Journal before running starter setup.');
    }
    const config = starterConfig(role, previous?.config, links);
    plans.push({role,existing,previous,config});
    console.log(`${role}: ${!existing ? 'create' : isDeepStrictEqual(previous.config,config) ? 'already configured' : 'add starter fields and working views'}`);
}
if (!apply) { console.log('No changes made. Add --apply to create/configure collections. Add --install to install the built dashboard too.'); process.exit(0); }
const directory = path.join(os.tmpdir(), 'freelance-os-setup-backups', `${workspace}-${Date.now()}`);
await fs.mkdir(directory,{recursive:true});
for (const plan of plans) {
    if (plan.previous) await fs.writeFile(path.join(directory,`${plan.role}.json`),JSON.stringify(plan.previous,null,2));
    if (!plan.existing) {
        const created = await call('create_collection',{workspace,name:plan.role,type:'collection',icon:plan.config.icon});
        collections = (await call('list_collections',{workspace})).collections;
        links[plan.role] = collections.find(item=>item.name===plan.role)?.guid;
        if (!links[plan.role]) throw new Error(`${plan.role} creation could not be verified: ${JSON.stringify(created)}`);
    }
}
for (const plan of plans) {
    const latest = await call('get_collection_config_json',{workspace,collection:links[plan.role]});
    if (plan.previous && !isDeepStrictEqual(latest.config,plan.previous.config)) throw new Error(`${plan.role} changed during setup; run the preview again.`);
    const config = starterConfig(plan.role,latest.config,links);
    if (!isDeepStrictEqual(config,latest.config)) await call('update_collection_config_json',{workspace,collection:links[plan.role],config:JSON.stringify(config)});
    const saved = await call('get_collection_config_json',{workspace,collection:links[plan.role]});
    if (!isDeepStrictEqual(saved.config.fields,config.fields) || !isDeepStrictEqual(saved.config.views,config.views)) throw new Error(`${plan.role} verification failed.`);
    console.log(`${plan.role}: saved and verified`);
    if (plan.role === 'Journal' && !plan.existing) await call('update_plugin_code',{workspace,plugin:links.Journal,code:'class Plugin extends JournalCorePlugin {}'});
}
if (args.includes('--install')) {
    const plugins = await call('list_plugins',{workspace});
    let plugin = plugins.global_plugins.find(item=>item.name==='Freelance OS');
    if (!plugin) {
        await call('create_collection',{workspace,name:'Freelance OS',type:'global_plugin',icon:'ti-layout-grid'});
        plugin = (await call('list_plugins',{workspace})).global_plugins.find(item=>item.name==='Freelance OS');
    }
    if (!plugin) throw new Error('Freelance OS plugin creation could not be verified.');
    const prior = await call('get_plugin_code',{workspace,plugin:plugin.guid});
    await fs.writeFile(path.join(directory,'Freelance-OS.json'),JSON.stringify(prior,null,2));
    const config = JSON.parse(await fs.readFile(new URL('../plugin.json',import.meta.url),'utf8'));
    await call('update_plugin_json_config',{workspace,plugin:plugin.guid,config:JSON.stringify({...prior.config,...config})});
    await call('update_plugin_code',{workspace,plugin:plugin.guid,code:await fs.readFile(new URL('../dist/plugin.js',import.meta.url),'utf8')});
    await call('update_plugin_css',{workspace,plugin:plugin.guid,css:await fs.readFile(new URL('../dist/plugin.css',import.meta.url),'utf8')});
    console.log('Freelance OS installed. Open it from the sidebar or command palette.');
}
console.log('Journal uses Thymer’s built-in JournalCorePlugin. No sample records were created.');
console.log(`Local backups: ${directory}`);
