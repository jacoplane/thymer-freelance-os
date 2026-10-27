import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        const app = document.querySelector('.os-app');
        const parents = [];
        let p = app ? app.parentElement : null;
        while (p && parents.length < 6) {
            parents.push({
                tag: p.tagName,
                className: p.className,
                id: p.id,
                offsetWidth: p.offsetWidth,
                clientWidth: p.clientWidth
            });
            p = p.parentElement;
        }
        return {
            windowWidth: window.innerWidth,
            parents
        };
    })()`);
    console.log('Parent hierarchy:', JSON.stringify(info, null, 2));
    cdp.close();
}
run();
