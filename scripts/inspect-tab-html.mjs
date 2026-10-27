import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        const p1 = document.querySelectorAll('.panels-grid > .panel')[1];
        const tab = p1?.querySelector('.panel-tab');
        return {
            tabHtml: tab?.outerHTML
        };
    })()`);
    console.log('Tab HTML:', info);
    cdp.close();
}
run();
