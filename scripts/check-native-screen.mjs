import { connectCdp } from './cdp.mjs';

async function checkNative() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        const firstCard = document.querySelector('.os-project-card');
        const actions = firstCard?.querySelector('.os-card-actions');
        const bottom = firstCard?.querySelector('.os-card-bottom');
        const dateSpan = bottom?.querySelector('span');
        return {
            windowW: window.innerWidth,
            gridCols: window.getComputedStyle(document.querySelector('.os-grid')).gridTemplateColumns,
            cardW: firstCard?.offsetWidth,
            cardH: firstCard?.offsetHeight,
            bottomH: bottom?.offsetHeight,
            dateSpanW: dateSpan?.offsetWidth,
            actionsW: actions?.offsetWidth,
            wrapped: (dateSpan && actions) ? (dateSpan.offsetTop !== actions.offsetTop) : false
        };
    })()`);
    console.log('Native screen metrics:', JSON.stringify(info, null, 2));
    await cdp.screenshot('native-dashboard-v051.png');
    cdp.close();
}
checkNative();
