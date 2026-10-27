import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
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
    console.log('Layout Metrics:', JSON.stringify(metrics, null, 2));
    cdp.close();
}
run();
