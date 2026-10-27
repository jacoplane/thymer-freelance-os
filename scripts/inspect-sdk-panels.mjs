import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    const res = await cdp.evaluate(`(() => {
        const el = window.__freelanceOs.ui.getPanels()[0].getElement();
        return {
            childrenCount: el.children.length,
            classes: Array.from(el.children).map(c => c.className),
            hasDocument: !!el.querySelector('.document, [class*="document"], [class*="line"]'),
            innerTextSnippet: el.innerText.substring(0, 400)
        };
    })()`);
    console.log('Panel DOM info:', res);
    cdp.close();
}

main().catch(console.error);
