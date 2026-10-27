import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        const p1 = document.querySelectorAll('.panels-grid > .panel')[1];
        const bar = p1?.querySelector('.panel-bar--tabsbar');
        return {
            barHtml: bar?.outerHTML
        };
    })()`);
    console.log('Bar HTML:', info);
    cdp.close();
}
run();
