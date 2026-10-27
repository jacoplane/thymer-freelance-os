import { connectCdp } from "./cdp.mjs";
import fs from "node:fs/promises";

async function main() {
    const cdp = await connectCdp();

    // 1. Click AI Agents tab first
    await cdp.evaluate(`
        (() => {
            const aiBtn = Array.from(document.querySelectorAll("button, .os-tab")).find(b => b.textContent && b.textContent.includes("AI Agents"));
            if (aiBtn) aiBtn.click();
        })()
    `);
    await new Promise(r => setTimeout(r, 500));

    // 2. Select Claude Code tab
    await cdp.evaluate(`
        (() => {
            const claudeTab = document.querySelector('.os-ai-tool-tab[data-tool-id="claude-code"]');
            if (claudeTab) claudeTab.click();
        })()
    `);

    await new Promise(r => setTimeout(r, 400));

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile("ai-claude-preview.png", Buffer.from(screenshot.data, "base64"));
    console.log("Saved Claude Code screenshot to ai-claude-preview.png");

    cdp.close();
}

main().catch(console.error);
