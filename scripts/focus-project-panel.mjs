import { connectMcp } from "./thymer-mcp.mjs";
import { connectCdp } from "./cdp.mjs";
import fs from "node:fs/promises";

const WS = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
const PROJECT_GUID = '194EHK5HGEB70YXFPESGZHFE6M';

async function main() {
    const call = await connectMcp();
    
    // Close secondary panel if open
    try {
        await call('close_panel', { index: 1 });
    } catch {}

    // Navigate panel 0 to the project
    await call('navigate_to_record', { workspace: WS, record: PROJECT_GUID });
    await new Promise(r => setTimeout(r, 800));

    // Capture screenshot
    const cdp = await connectCdp();
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile("persona-project-fullview.png", Buffer.from(screenshot.data, "base64"));
    console.log("Saved screenshot to persona-project-fullview.png");

    cdp.close();
}

main().catch(console.error);
