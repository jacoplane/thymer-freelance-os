import { connectCdp } from './cdp.mjs';

async function checkTops() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        const bottom = document.querySelector('.os-project-card .os-card-bottom');
        const s = bottom?.querySelector('span');
        const a = bottom?.querySelector('.os-card-actions');
        return {
            dateText: s?.textContent,
            dateTop: s?.offsetTop,
            dateHeight: s?.offsetHeight,
            actionsTop: a?.offsetTop,
            actionsHeight: a?.offsetHeight
        };
    })()`);
    console.log('Offsets:', info);
    cdp.close();
}
checkTops();
