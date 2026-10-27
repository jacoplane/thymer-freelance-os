import { connectCdp } from './cdp.mjs';

async function testStyleChange() {
    const cdp = await connectCdp();
    await cdp.evaluate(`(() => {
        let styleEl = document.getElementById('test-responsive-fix');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'test-responsive-fix';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = \`
            /* Fix 1: Agenda has fixed comfortable width, Main expands */
            .os-grid {
                grid-template-columns: 170px minmax(0, 1fr) 340px !important;
                gap: 16px !important;
            }
            
            /* Fix 2: Card min-width increased from 220px to 290px */
            .os-cards {
                grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)) !important;
                gap: 14px !important;
            }
            
            /* Fix 3: Project card internal breathing room */
            .os-project-card {
                padding: 14px 16px !important;
                gap: 8px !important;
                border-radius: 9px !important;
            }
            .os-card-title {
                font-size: 13.5px !important;
                line-height: 1.4 !important;
            }
            .os-card-bottom {
                padding-top: 8px !important;
                gap: 8px !important;
            }
            .os-card-actions {
                gap: 6px !important;
                flex-wrap: wrap !important;
            }
            .os-card-action-btn {
                padding: 3px 8px !important;
                font-size: 11px !important;
                white-space: nowrap !important;
            }
            
            /* Fix 4: Agenda styling polish */
            .os-agenda {
                padding: 16px !important;
            }
            .os-task-item {
                padding: 7px 10px !important;
            }
        \`;
    })()`);
    await new Promise(r => setTimeout(r, 600));
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
            cardsColsCount: cards ? window.getComputedStyle(cards).gridTemplateColumns.split(' ').length : 0,
            cardsGridTemplateColumns: cards ? window.getComputedStyle(cards).gridTemplateColumns : null
        };
    })()`);
    console.log('After Style Fix Metrics:', JSON.stringify(metrics, null, 2));
    await cdp.screenshot('preview-responsive-fix.png');
    cdp.close();
}

testStyleChange().catch(console.error);
