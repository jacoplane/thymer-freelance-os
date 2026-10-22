import fs from 'node:fs/promises';
import { connectMcp } from './scripts/thymer-mcp.mjs';

const args = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : '';
const workspace = value('--workspace') || process.env.THYMER_WORKSPACE;
const plugin = value('--plugin') || process.env.THYMER_PLUGIN || 'Freelance OS';
if (!workspace) throw new Error('Pass --workspace W… or set THYMER_WORKSPACE. Deployment never guesses the target workspace.');
const call = await connectMcp(process.env.THYMER_MCP_ENDPOINT);
const prior = await call('get_plugin_code', {workspace,plugin});
const manifest = JSON.parse(await fs.readFile(new URL('./plugin.json',import.meta.url),'utf8'));
const config = {...prior.config, version:manifest.version, description:manifest.description, author:manifest.author, repository:manifest.repository};
await call('update_plugin_json_config',{workspace,plugin,config:JSON.stringify(config)});
await call('update_plugin_code',{workspace,plugin,code:await fs.readFile(new URL('./dist/plugin.js',import.meta.url),'utf8')});
await call('update_plugin_css',{workspace,plugin,css:await fs.readFile(new URL('./dist/plugin.css',import.meta.url),'utf8')});
console.log(`Freelance OS ${manifest.version}: configuration, code and CSS deployed to the explicit target workspace.`);
