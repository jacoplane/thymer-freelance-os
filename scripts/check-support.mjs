import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    const res = await cdp.evaluate(`(() => {
        const el = document.querySelector('.os-support-time');
        return el ? el.innerText : 'not found';
    })()`);
    console.log('Support Section Text:\n', res);
    cdp.close();
}

main().catch(console.error);
