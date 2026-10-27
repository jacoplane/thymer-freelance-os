import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        const panels = p.ui.getPanels();
        const p1 = panels[1];
        const methods = [];
        let proto = Object.getPrototypeOf(p1);
        while (proto && proto !== Object.prototype) {
            methods.push(...Object.getOwnPropertyNames(proto));
            proto = Object.getPrototypeOf(proto);
        }
        return {
            panelsCount: panels.length,
            methods
        };
    })()`);
    console.log('Panel methods:', info);
    cdp.close();
}
run();
