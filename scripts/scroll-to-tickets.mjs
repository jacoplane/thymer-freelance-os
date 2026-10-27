import { connectCdp } from './cdp.mjs';
import fs from 'fs';

const WS = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
const PROJECT_GUID = '194EHK5HGEB70YXFPESGZHFE6M';

async function main() {
    const cdp = await connectCdp();

    console.log(`Navigating panel 0 to project ${PROJECT_GUID} with workspaceId ${WS}...`);
    await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panel = p.ui.getPanels()[0];
        panel.navigateTo({
            type: 'edit_panel',
            rootId: '${PROJECT_GUID}',
            workspaceId: '${WS}'
        });
    })()`);

    await new Promise(r => setTimeout(r, 1200));

    // Verify DOM contains the tickets
    const domCheck = await cdp.evaluate(`(() => {
        const bodyText = document.body.innerText || '';
        return {
            hasSprint: bodyText.includes('Sprint 1: Core Catalog & Architecture'),
            hasShopifyCli: bodyText.includes('Scaffold Shopify CLI theme repository'),
            hasCheckpoints: bodyText.includes('Client review checkpoints'),
            hasScopeCreepSentinel: bodyText.includes('Scope Creep Sentinel Audit'),
            hasReleaseDigest: bodyText.includes('Milestone 1 Release Digest')
        };
    })()`);
    console.log('DOM Check inside Project Record:', domCheck);

    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync('C:/dev/thymer-freelance-os/project-doc-full.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved project-doc-full.png');

    cdp.close();
}

main().catch(console.error);
