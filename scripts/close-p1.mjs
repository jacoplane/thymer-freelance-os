import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
    await cdp.evaluate(`(() => {
        const p1 = document.querySelectorAll('.panels-grid > .panel')[1];
        const closeIcon = p1?.querySelector('.panel-close-icon');
        if (closeIcon) closeIcon.click();
    })()`);
    await new Promise(r => setTimeout(r, 1000));
    const metrics = await cdp.evaluate(`(() => {
        const app = document.querySelector('.os-app');
        const grid = document.querySelector('.os-grid');
        const rail = document.querySelector('.os-rail');
        const main = document.querySelector('.os-main');
        const agenda = document.querySelector('.os-agenda');
        const cards = document.querySelector('.os-cards');
        const firstCard = document.querySelector('.os-project-card');
        return {
            panelsCount: document.querySelectorAll('.panels-grid > .panel').length,
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
    console.log('Single Panel Metrics:', JSON.stringify(metrics, null, 2));
    await cdp.screenshot('single-panel-view.png');
    cdp.close();
}
run();
