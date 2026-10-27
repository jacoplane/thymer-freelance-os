import fs from 'node:fs/promises';
import { connectCdp } from "./cdp.mjs";

async function main() {
    const cdp = await connectCdp();
    
    // Open AI Agents tab
    await cdp.evaluate(`
        (() => {
            const aiBtn = Array.from(document.querySelectorAll("button, .os-tab")).find(b => b.textContent && b.textContent.includes("AI Agents"));
            if (aiBtn) aiBtn.click();
        })()
    `);
    await new Promise(r => setTimeout(r, 600));

    // Reset filters to All Packs
    await cdp.evaluate(`
        (() => {
            const allBtn = Array.from(document.querySelectorAll(".os-ai-filter-btn")).find(b => b.textContent.includes("All Packs"));
            if (allBtn) allBtn.click();
        })()
    `);
    
    await new Promise(r => setTimeout(r, 400));
    const img = await cdp.screenshot();
    await fs.writeFile('C:/dev/thymer-freelance-os/ai-packs-preview.png', img);
    console.log('Saved screenshot to C:/dev/thymer-freelance-os/ai-packs-preview.png');
    cdp.close();
}

main().catch(console.error);
