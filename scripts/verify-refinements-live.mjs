import { connectCdp } from "./cdp.mjs";
import fs from "node:fs";

async function main() {
    console.log("Connecting to Thymer Desktop via CDP on port 9444...");
    const cdp = await connectCdp();

    // 1. Open Freelance OS Dashboard
    console.log("Opening Freelance OS dashboard...");
    const openRes = await cdp.evaluate(`
        (async () => {
            if (window.__freelanceOs && typeof window.__freelanceOs.openDashboard === 'function') {
                await window.__freelanceOs.openDashboard();
                return { ok: true };
            }
            return { ok: false, error: 'window.__freelanceOs not found' };
        })()
    `);
    console.log("openDashboard result:", openRes);
    await new Promise(r => setTimeout(r, 1000));

    // 2. Navigate to AI tab
    console.log("Navigating to AI Agents tab...");
    const aiTabRes = await cdp.evaluate(`
        (() => {
            if (!window.__freelanceOs) return { ok: false, error: 'no plugin' };
            window.__freelanceOs.workflowMode = 'ai';
            if (window.__freelanceOs.activePanel) {
                window.__freelanceOs.render(window.__freelanceOs.activePanel);
                return { ok: true, mode: window.__freelanceOs.workflowMode };
            }
            return { ok: false, error: 'no active panel' };
        })()
    `);
    console.log("aiTabRes:", aiTabRes);
    await new Promise(r => setTimeout(r, 800));

    // 3. Inspect Pack Cards & New Project Button
    const packsInspect = await cdp.evaluate(`
        (() => {
            const cards = document.querySelectorAll('.os-ai-pack-card');
            const activeCards = document.querySelectorAll('.os-ai-pack-card.os-ai-pack-active');
            const createProjBtns = document.querySelectorAll('.os-ai-pack-create-proj');
            const visibleCreateBtns = Array.from(createProjBtns).filter(b => b.style.display !== 'none');
            return {
                totalPacks: cards.length,
                activePacks: activeCards.length,
                totalCreateProjBtns: createProjBtns.length,
                visibleCreateBtns: visibleCreateBtns.length,
                visibleBtnTexts: visibleCreateBtns.map(b => b.textContent.trim())
            };
        })()
    `);
    console.log("Packs inspection:", JSON.stringify(packsInspect, null, 2));

    // 4. Capture screenshot of AI Agents tab
    const bufAi = await cdp.screenshot();
    fs.writeFileSync('ai-tab-refinements-preview.png', bufAi);
    console.log("Saved AI tab screenshot to ai-tab-refinements-preview.png");

    // 5. Navigate to Overview to check AI Watchdogs
    console.log("Navigating to Overview tab to check Watchdogs...");
    const overviewRes = await cdp.evaluate(`
        (() => {
            if (!window.__freelanceOs) return { ok: false };
            window.__freelanceOs.workflowMode = 'overview';
            if (window.__freelanceOs.activePanel) {
                window.__freelanceOs.render(window.__freelanceOs.activePanel);
                return { ok: true };
            }
            return { ok: false };
        })()
    `);
    console.log("overviewRes:", overviewRes);
    await new Promise(r => setTimeout(r, 800));

    const watchdogInspect = await cdp.evaluate(`
        (() => {
            const bar = document.querySelector('.os-ai-watchdog-bar');
            if (!bar) return { hasWatchdogBar: false };
            const items = bar.querySelectorAll('.os-ai-watchdog-item');
            return {
                hasWatchdogBar: true,
                badge: bar.querySelector('.os-ai-watchdog-badge')?.textContent,
                itemsCount: items.length,
                items: Array.from(items).map(i => ({
                    title: i.querySelector('strong')?.textContent,
                    detail: i.querySelector('span')?.textContent,
                    btn: i.querySelector('button')?.textContent
                }))
            };
        })()
    `);
    console.log("Watchdogs inspection:", JSON.stringify(watchdogInspect, null, 2));

    // 6. Capture screenshot of Overview with Watchdogs
    const bufOverview = await cdp.screenshot();
    fs.writeFileSync('overview-watchdogs-preview.png', bufOverview);
    console.log("Saved Overview screenshot to overview-watchdogs-preview.png");

    cdp.close();
    console.log("Verification finished successfully!");
}

main().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
