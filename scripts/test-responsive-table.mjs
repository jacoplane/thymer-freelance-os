import { connectCdp } from './cdp.mjs';

async function testWidths() {
    const cdp = await connectCdp();
    const results = await cdp.evaluate(`(() => {
        const app = document.querySelector('.os-app');
        const grid = document.querySelector('.os-grid');
        const main = document.querySelector('.os-main');
        const agenda = document.querySelector('.os-agenda');
        const cards = document.querySelector('.os-cards');
        const widths = [600, 750, 950, 1150, 1300, 1500, 1800];
        const out = [];

        for (const w of widths) {
            // Apply inline width with !important
            app.style.setProperty('width', w + 'px', 'important');
            app.style.setProperty('max-width', w + 'px', 'important');
            const card = document.querySelector('.os-project-card');
            const cols = cards ? window.getComputedStyle(cards).gridTemplateColumns.split(' ') : [];
            out.push({
                containerWidth: w,
                gridCols: window.getComputedStyle(grid).gridTemplateColumns,
                mainWidth: main?.offsetWidth,
                agendaWidth: agenda?.offsetWidth,
                cardsCount: cols.length,
                cardWidth: Math.round(card?.offsetWidth || 0)
            });
        }
        app.style.removeProperty('width');
        app.style.removeProperty('max-width');
        return out;
    })()`);
    console.log('Responsive Behavior Table:');
    console.table(results);
    cdp.close();
}

testWidths().catch(console.error);
