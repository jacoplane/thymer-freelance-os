import { connectCdp } from "./cdp.mjs";
import { connectMcp } from "./thymer-mcp.mjs";
import fs from "node:fs/promises";

const WS = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
const COLS = {
    projects: '16Z8HBEGE5GFSCYD4WN663GFJQ'
};

async function main() {
    const call = await connectMcp();

    // 1. Find the project guid for Atelier Végétal
    const projectsRes = await call('list_records', { workspace: WS, collection: COLS.projects });
    const project = (projectsRes.records || []).find(p => p.name.includes('Atelier'));
    if (!project) throw new Error('Atelier project not found');
    console.log(`Found project: ${project.name} (${project.guid})`);

    // 2. Fetch record details
    const record = await call('get_record', { workspace: WS, record: project.guid });
    console.log(`Record properties:`, record?.properties);

    // 3. Navigate directly to the project record in Thymer Desktop UI!
    console.log('Navigating to project in Thymer UI...');
    await call('navigate_to_record', { workspace: WS, record: project.guid });
    await new Promise(r => setTimeout(r, 800));

    // 4. Capture screenshot via CDP
    const cdp = await connectCdp();
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile("persona-project-details-preview.png", Buffer.from(screenshot.data, "base64"));
    console.log('Saved screenshot to persona-project-details-preview.png');

    // Also scroll down the page and capture the bottom section (Change Order & Release Notes)
    await cdp.evaluate(`
        (() => {
            const panels = document.querySelectorAll('.panel, .os-main, [class*="panel"], body, html');
            panels.forEach(p => { p.scrollTop = 800; });
            window.scrollBy(0, 800);
        })()
    `);
    await new Promise(r => setTimeout(r, 600));

    const screenshot2 = await cdp.send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile("persona-project-scrolled-preview.png", Buffer.from(screenshot2.data, "base64"));
    console.log('Saved scrolled screenshot to persona-project-scrolled-preview.png');

    cdp.close();
}

main().catch(console.error);
