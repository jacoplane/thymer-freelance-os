import { connectCdp } from "./cdp.mjs";
import fs from "node:fs/promises";

async function main() {
    const cdp = await connectCdp();

    // 1. Click the AI tab
    await cdp.evaluate(`
        (() => {
            const aiBtn = Array.from(document.querySelectorAll("button, .os-tab")).find(b => b.textContent && b.textContent.includes("AI Agents"));
            if (aiBtn) aiBtn.click();
        })()
    `);

    await new Promise(r => setTimeout(r, 600));

    // 2. Query harness section details
    const harnessData = await cdp.evaluate(`
        (() => {
            const harness = document.querySelector(".os-ai-harness-section");
            if (!harness) return { exists: false };

            const tabs = Array.from(harness.querySelectorAll(".os-ai-tool-tab")).map(t => ({
                id: t.getAttribute("data-tool-id"),
                text: t.textContent.trim(),
                isActive: t.classList.contains("active")
            }));

            const panes = Array.from(harness.querySelectorAll(".os-ai-tool-pane")).map(p => ({
                id: p.getAttribute("data-tool-pane"),
                isDisplayed: p.style.display !== "none",
                title: p.querySelector("h4")?.textContent.trim(),
                stepTitles: Array.from(p.querySelectorAll(".os-ai-step-title")).map(st => st.textContent.trim()),
                stepCodes: Array.from(p.querySelectorAll(".os-ai-step-code-box code")).map(sc => sc.textContent.trim()),
                checklist: Array.from(p.querySelectorAll(".os-ai-check-item")).map(ci => ci.textContent.trim())
            }));

            return {
                exists: true,
                tabsCount: tabs.length,
                tabs,
                panesCount: panes.length,
                activePane: panes.find(p => p.isDisplayed)
            };
        })()
    `);

    console.log("Harness UI Data:", JSON.stringify(harnessData, null, 2));

    // 3. Test clicking through all 6 tool tabs
    const toolIds = ['opencode', 'codex', 'omp', 'claude-code', 'cursor', 'antigravity'];
    for (const toolId of toolIds) {
        const switchRes = await cdp.evaluate(`
            ((id) => {
                const tab = document.querySelector('.os-ai-tool-tab[data-tool-id="' + id + '"]');
                if (tab) tab.click();
                const pane = document.querySelector('.os-ai-tool-pane[data-tool-pane="' + id + '"]');
                return {
                    clicked: !!tab,
                    isDisplayed: pane ? pane.style.display !== 'none' : false,
                    title: pane?.querySelector('h4')?.textContent.trim()
                };
            })("${toolId}")
        `);
        console.log(`Switched to tab ${toolId}:`, switchRes);
        await new Promise(r => setTimeout(r, 150));
    }

    // 4. Test clicking copy button on Antigravity step 1
    const copyTest = await cdp.evaluate(`
        (() => {
            const copyBtn = document.querySelector('.os-ai-tool-pane[data-tool-pane="antigravity"] .os-ai-copy-btn');
            if (copyBtn) copyBtn.click();
            return {
                copyBtnFound: !!copyBtn,
                btnTextAfterClick: copyBtn?.textContent.trim()
            };
        })()
    `);
    console.log("Copy Button Click Test:", copyTest);

    // 5. Capture screenshot of the Harness Setup view
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile("ai-harness-preview.png", Buffer.from(screenshot.data, "base64"));
    console.log("Saved screenshot to ai-harness-preview.png");

    cdp.close();
}

main().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
