import { connectCdp } from "./cdp.mjs";

async function main() {
    const cdp = await connectCdp();
    
    // Step 1: Click the AI tab button
    const clickRes = await cdp.evaluate(`
        (() => {
            const aiBtn = Array.from(document.querySelectorAll("button, .os-tab")).find(b => b.textContent && b.textContent.includes("AI Agents"));
            if (aiBtn) {
                aiBtn.click();
                return { clicked: true };
            }
            return { clicked: false };
        })()
    `);
    console.log("Click AI tab result:", clickRes);

    // Wait for render() to finish
    await new Promise(r => setTimeout(r, 600));

    // Step 2: Check cards, filters, and active packs
    const res = await cdp.evaluate(`
        (() => {
            const cards = document.querySelectorAll(".os-ai-pack-card");
            const filterBtns = document.querySelectorAll(".os-ai-filter-btn");
            const activeBadges = document.querySelectorAll(".os-ai-pack-card.os-ai-pack-active");
            return {
                packCardsCount: cards.length,
                filterBtnsCount: filterBtns.length,
                activePacksCount: activeBadges.length,
                packNames: Array.from(cards).map(c => c.querySelector(".os-ai-pack-name")?.textContent)
            };
        })()
    `);
    console.log("CDP Live UI Result:", JSON.stringify(res, null, 2));

    // Step 3: Test clicking a category filter (e.g. Technology)
    const filterTest = await cdp.evaluate(`
        (() => {
            const techBtn = Array.from(document.querySelectorAll(".os-ai-filter-btn")).find(b => b.textContent.includes("Technology"));
            if (techBtn) techBtn.click();
            const visibleCards = Array.from(document.querySelectorAll(".os-ai-pack-card")).filter(c => c.style.display !== "none");
            return {
                techBtnClicked: !!techBtn,
                visibleAfterFilterCount: visibleCards.length,
                visiblePackNames: visibleCards.map(c => c.querySelector(".os-ai-pack-name")?.textContent)
            };
        })()
    `);
    console.log("Filter Test Result:", JSON.stringify(filterTest, null, 2));

    // Step 4: Click 'All Packs' to reset filter
    await cdp.evaluate(`
        (() => {
            const allBtn = Array.from(document.querySelectorAll(".os-ai-filter-btn")).find(b => b.textContent.includes("All Packs"));
            if (allBtn) allBtn.click();
        })()
    `);

    // Step 5: Test activating the Software & AI Engineering pack
    const toggleTest = await cdp.evaluate(`
        (() => {
            const devPackToggle = document.querySelector(".os-ai-pack-card[data-pack-id='pack-software-dev'] .os-ai-pack-toggle");
            if (devPackToggle) devPackToggle.click();
            const card = document.querySelector(".os-ai-pack-card[data-pack-id='pack-software-dev']");
            return {
                devPackToggleFound: !!devPackToggle,
                isNowActive: card ? card.classList.contains("os-ai-pack-active") : false,
                buttonText: devPackToggle ? devPackToggle.textContent.trim() : ""
            };
        })()
    `);
    console.log("Toggle Test Result:", JSON.stringify(toggleTest, null, 2));

    cdp.close();
}

main().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
