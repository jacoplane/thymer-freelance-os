import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        return {
            title: document.title,
            online: navigator.onLine,
            readyState: document.readyState,
            hasModal: !!document.querySelector('.modal, .toaster, .error'),
            toaster: document.querySelector('.toaster')?.innerText,
            bodyText: document.body.innerText.slice(0, 300)
        };
    })()`);
    console.log('Thymer Desktop Window Status:', JSON.stringify(info, null, 2));
    cdp.close();
}

main().catch(console.error);
