import { connectCdp } from './cdp.mjs';

async function check() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        const firstCard = document.querySelector('.os-project-card');
        const actions = firstCard?.querySelector('.os-card-actions');
        const bottom = firstCard?.querySelector('.os-card-bottom');
        const title = firstCard?.querySelector('.os-card-title');
        return {
            cardWidth: firstCard?.offsetWidth,
            cardHeight: firstCard?.offsetHeight,
            titleWrapHeight: title?.offsetHeight,
            bottomHeight: bottom?.offsetHeight,
            actionsWidth: actions?.offsetWidth,
            bottomChildren: Array.from(bottom?.children || []).map(c => ({
                text: c.textContent.trim(),
                width: c.offsetWidth,
                offsetTop: c.offsetTop
            }))
        };
    })()`);
    console.log('Card details:', JSON.stringify(info, null, 2));
    cdp.close();
}
check();
