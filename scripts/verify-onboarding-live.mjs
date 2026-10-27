import { connectCdp } from "./cdp.mjs";
import fs from "node:fs";

async function main() {
    console.log("Connecting to Thymer Desktop on port 9444...");
    const cdp = await connectCdp();

    // 1. Open Freelance OS dashboard and ensure onboarding card is visible
    console.log("Opening dashboard and resetting dismissedOnboarding to false for live test...");
    const initRes = await cdp.evaluate(`
        (async () => {
            const p = window.__freelanceOs;
            if (!p) return { ok: false, error: 'no freelance-os plugin' };
            await p.openDashboard();
            p.workflowState.dismissedOnboarding = false;
            p.workflowMode = 'overview';
            if (p.activePanel) p.render(p.activePanel);
            return { ok: true };
        })()
    `);
    console.log("initRes:", initRes);
    await new Promise(r => setTimeout(r, 1000));

    // 2. Inspect Onboarding Card DOM
    const cardInspect = await cdp.evaluate(`
        (() => {
            const card = document.querySelector('.os-onboarding-card');
            if (!card) return { hasCard: false };
            const steps = Array.from(card.querySelectorAll('.os-onboarding-step')).map(s => ({
                num: s.querySelector('.os-onboarding-step-num')?.textContent.trim(),
                header: s.querySelector('.os-onboarding-step-header strong')?.textContent.trim(),
                badge: s.querySelector('.os-onboarding-step-header .os-badge')?.textContent.trim(),
                desc: s.querySelector('p')?.textContent.trim(),
                btnText: s.querySelector('button')?.textContent.trim()
            }));
            return {
                hasCard: true,
                title: card.querySelector('.os-onboarding-title-group h3')?.textContent.trim(),
                stepsCount: steps.length,
                steps
            };
        })()
    `);
    console.log("Onboarding Card Inspection:\n", JSON.stringify(cardInspect, null, 2));

    // 3. Capture screenshot of Overview with Onboarding Card
    const bufCard = await cdp.screenshot();
    fs.writeFileSync('onboarding-overview-preview.png', bufCard);
    console.log("✓ Saved screenshot to onboarding-overview-preview.png");

    // 4. Test Dismiss action
    console.log("Testing Dismiss ✕ click...");
    const dismissRes = await cdp.evaluate(`
        (() => {
            const btn = document.querySelector('.os-onboarding-dismiss');
            if (btn) {
                btn.click();
                return {
                    clicked: true,
                    cardStillInDom: !!document.querySelector('.os-onboarding-card'),
                    dismissedState: window.__freelanceOs?.workflowState?.dismissedOnboarding
                };
            }
            return { clicked: false };
        })()
    `);
    console.log("Dismiss test result:", JSON.stringify(dismissRes, null, 2));

    // 5. Test Settings Reset action
    console.log("Testing Settings 'Show Getting Started guide' reset button...");
    const resetRes = await cdp.evaluate(`
        (async () => {
            const p = window.__freelanceOs;
            p.workflowMode = 'settings';
            await p.render(p.activePanel);
            const resetBtn = document.querySelector('.os-reset-guide-btn');
            if (resetBtn) {
                resetBtn.click();
                await new Promise(r => setTimeout(r, 100));
                return {
                    clicked: true,
                    modeAfterClick: p.workflowMode,
                    cardBackInDom: !!document.querySelector('.os-onboarding-card'),
                    dismissedState: p.workflowState?.dismissedOnboarding
                };
            }
            return { clicked: false };
        })()
    `);
    console.log("Reset test result:", JSON.stringify(resetRes, null, 2));

    cdp.close();
    console.log("All onboarding tests completed successfully!");
}

main().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
