import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
    // Close panel 1 if open
    await cdp.evaluate(`(() => {
        const panels = document.querySelectorAll('.panels-grid > .panel');
        if (panels.length > 1) {
            const closeBtn = panels[1].querySelector('.panel-close, [title="Close panel"], button.close, [aria-label="Close"]');
            if (closeBtn) closeBtn.click();
            else {
                // Try via Thymer UI API if available
                const p = window.__freelanceOs;
                if (p?.ui?.getActivePanel) {
                    const allPanels = p.ui.getPanels ? p.ui.getPanels() : [];
                    if (allPanels.length > 1 && allPanels[1]?.destroy) {
                        allPanels[1].destroy();
                    }
                }
            }
        }
    })()`);
    await new Promise(r => setTimeout(r, 1000));
    await cdp.screenshot('fullscreen-dashboard.png');
    
    const metrics = await cdp.evaluate(`(() => {
        const app = document.querySelector('.os-app');
        const grid = document.querySelector('.os-grid');
        const rail = document.querySelector('.os-rail');
        const main = document.querySelector('.os-main');
        const agenda = document.querySelector('.os-agenda');
        const cards = document.querySelector('.os-cards');
        const firstCard = document.querySelector('.os-project-card');
        return {
            windowWidth: window.innerWidth,
            appWidth: app?.offsetWidth,
            gridWidth: grid?.offsetWidth,
            railWidth: rail?.offsetWidth,
            mainWidth: main?.offsetWidth,
            agendaWidth: agenda?.offsetWidth,
            cardsWidth: cards?.offsetWidth,
            cardWidth: firstCard?.offsetWidth,
            cardsGridTemplateColumns: cards ? window.getComputedStyle(cards).gridTemplateColumns : null
        };
    })()`);
    console.log('Fullscreen Metrics:', JSON.stringify(metrics, null, 2));
    cdp.close();
}
run();
