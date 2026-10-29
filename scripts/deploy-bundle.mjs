import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMcp } from './thymer-mcp.mjs';
import { connectCdp } from './cdp.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
    console.log('Deploying Freelance OS bundle to active workspaces...');
    const distJs = fs.readFileSync(path.join(__dirname, '../dist/plugin.js'), 'utf8');
    const distCss = fs.readFileSync(path.join(__dirname, '../dist/plugin.css'), 'utf8');
    const manifestPath = path.join(__dirname, '../dist/plugin.json');
    const manifest = fs.existsSync(manifestPath)
        ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        : JSON.parse(fs.readFileSync(path.join(__dirname, '../plugin.json'), 'utf8'));

    const call = await connectMcp();

    // 1. Discover all active workspaces accessible via MCP
    const { workspaces = [] } = await call('list_workspaces', {});
    const writableWorkspaces = workspaces.filter(w => w.mcp_access === 'readwrite');

    let updatedCount = 0;
    for (const ws of writableWorkspaces) {
        try {
            const prior = await call('get_plugin_code', { workspace: ws.guid, plugin: 'Freelance OS' });
            const pluginId = prior.guid || 'Freelance OS';
            console.log(`Updating Freelance OS in workspace: ${ws.name} (${ws.guid})...`);

            const config = {
                ...prior.config,
                version: manifest.version,
                description: manifest.description || prior.config.description,
                author: manifest.author || prior.config.author,
                repository: manifest.repository || prior.config.repository,
                __source_repo: manifest.repository || prior.config.__source_repo
            };

            await call('update_plugin_json_config', {
                workspace: ws.guid,
                plugin: pluginId,
                config: JSON.stringify(config)
            });
            await call('update_plugin_css', {
                workspace: ws.guid,
                plugin: pluginId,
                css: distCss
            });
            await new Promise(r => setTimeout(r, 200));
            await call('update_plugin_code', {
                workspace: ws.guid,
                plugin: pluginId,
                code: distJs
            });
            console.log(`  ✓ Updated v${manifest.version} in ${ws.name}`);
            updatedCount++;
        } catch {
            // Freelance OS is not installed in this workspace; skip cleanly
        }
    }

    if (updatedCount === 0) {
        console.log('No workspaces with Freelance OS installed were found.');
    } else {
        console.log(`Successfully updated ${updatedCount} workspace(s).`);
    }

    // 2. Trigger live reload if CDP debugging is running
    try {
        console.log('Checking for active CDP session to reload Thymer Desktop...');
        const cdp = await connectCdp();
        await cdp.evaluate('window.location.reload()');
        await new Promise(r => setTimeout(r, 2000));
        cdp.close();
        console.log('  ✓ Thymer Desktop reloaded.');
    } catch {
        console.log('  (CDP reload skipped — remote debugging port 9444 not active)');
    }

    console.log('Deployment completed successfully!');
}

deploy().catch(err => {
    console.error('Fatal deployment error:', err);
    process.exit(1);
});
