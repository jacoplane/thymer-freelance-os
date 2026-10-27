import { connectCdp } from './cdp.mjs';

async function testWidths() {
    const cdp = await connectCdp();
    const results = await cdp.evaluate(`(() => {
        const app = document.querySelector('.os-app');
        const grid = document.querySelector('.os-grid');
        const main = document.querySelector('.os-main');
        const agenda = document.querySelector('.os-agenda');
        const cards = document.querySelector('.os-cards');
        
        const widthsToTest = [700, 950, 1100, 1200, 1400, 1600, 1800];
        const oldStyle = app.getAttribute('style') || '';
        const data = [];

        for (const w of widthsToTest) {
            app.style.width = w + 'px';
            app.style.maxWidth = w + 'px';
            const card = document.querySelector('.os-project-card');
            const cardCols = cards ? window.getComputedStyle(cards).gridTemplateColumns.split(' ').length : 0;
            data.push({
                testWidth: w,
                gridCols: window.getComputedStyle(grid).gridTemplateColumns,
                railWidth: document.querySelector('.os-rail')?.offsetWidth,
                mainWidth: main?.offsetWidth,
                agendaWidth: agenda?.offsetWidth,
                cardsColsCount: cardCols,
                firstCardWidth: card?.offsetWidth
            });
        }
        app.setAttribute('style', oldStyle);
        return data;
    })()`);
    console.log('Responsive Widths Analysis:');
    console.table(results);
    cdp.close();
}

testWidths().catch(console.error);
