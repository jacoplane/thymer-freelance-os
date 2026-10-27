import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMcp } from './thymer-mcp.mjs';
import { connectCdp } from './cdp.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
    console.log('Deploying Freelance OS bundle to workspaces...');
    const distJs = fs.readFileSync(path.join(__dirname, '../dist/plugin.js'), 'utf8');
    const distCss = fs.readFileSync(path.join(__dirname, '../dist/plugin.css'), 'utf8');

    const call = await connectMcp();
    const plugins = [
        { workspace: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2', plugin: '1Y01APTHH8RZN3BRYVHQT0YXQP', name: 'Freelance OS Sandbox' }
    ];

    for (const p of plugins) {
        console.log(`Updating plugin in ${p.name}...`);
        await call('update_plugin_code', {
            workspace: p.workspace,
            plugin: p.plugin,
            code: distJs
        });
        await call('update_plugin_css', {
            workspace: p.workspace,
            plugin: p.plugin,
            css: distCss
        });
        console.log(`  ✓ Updated code & css in ${p.name}`);
    }

    console.log('Reloading Thymer Desktop page...');
    const cdp = await connectCdp();
    await cdp.evaluate('window.location.reload()');
    await new Promise(r => setTimeout(r, 2500));
    cdp.close();

    console.log('Deployment completed successfully!');
}

deploy().catch(err => {
    console.error('Fatal deployment error:', err);
    process.exit(1);
});
