import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
    const panels = await cdp.evaluate(`(() => {
        const list = document.querySelectorAll('.panels-grid > .panel');
        return Array.from(list).map((p, idx) => ({
            idx,
            className: p.className,
            offsetWidth: p.offsetWidth,
            title: p.querySelector('.panel-title')?.textContent || p.querySelector('h1, h2, h3')?.textContent
        }));
    })()`);
    console.log('Open panels in Thymer:', panels);
    cdp.close();
}
run();
