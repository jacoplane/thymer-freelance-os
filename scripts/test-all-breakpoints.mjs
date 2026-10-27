import { connectCdp } from './cdp.mjs';

async function testAllBreakpoints() {
    const cdp = await connectCdp();
    const app = await cdp.evaluate(`(() => document.querySelector('.os-app') ? true : false)()`);
    if (!app) {
        console.error('No .os-app found');
        cdp.close();
        return;
    }

    const testCases = [
        { name: '1-ultrawide-1800', width: 1800, height: 950 },
        { name: '2-desktop-1400', width: 1400, height: 900 },
        { name: '3-split-panel-950', width: 950, height: 900 },
        { name: '4-compact-split-700', width: 700, height: 850 },
        { name: '5-mobile-narrow-450', width: 450, height: 800 }
    ];

    for (const tc of testCases) {
        await cdp.evaluate(`(() => {
            const el = document.querySelector('.os-app');
            el.style.setProperty('width', '${tc.width}px', 'important');
            el.style.setProperty('max-width', '${tc.width}px', 'important');
        })()`);
        await new Promise(r => setTimeout(r, 400));
        await cdp.screenshot(`responsive-${tc.name}.png`);
        
        const m = await cdp.evaluate(`(() => {
            const grid = document.querySelector('.os-grid');
            const main = document.querySelector('.os-main');
            const agenda = document.querySelector('.os-agenda');
            const cards = document.querySelector('.os-cards');
            const firstCard = document.querySelector('.os-project-card');
            return {
                gridCols: window.getComputedStyle(grid).gridTemplateColumns,
                mainW: main?.offsetWidth,
                agendaW: agenda?.offsetWidth,
                cardCols: cards ? window.getComputedStyle(cards).gridTemplateColumns.split(' ').length : 0,
                cardW: firstCard?.offsetWidth
            };
        })()`);
        console.log(`[${tc.name}]`, JSON.stringify(m));
    }

    // Reset styles
    await cdp.evaluate(`(() => {
        const el = document.querySelector('.os-app');
        el.style.removeProperty('width');
        el.style.removeProperty('max-width');
    })()`);

    cdp.close();
}

testAllBreakpoints().catch(console.error);
