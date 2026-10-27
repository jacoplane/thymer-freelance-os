import { connectCdp } from './cdp.mjs';

async function removeTestStyle() {
    const cdp = await connectCdp();
    await cdp.evaluate(`(() => {
        const el = document.getElementById('test-responsive-fix');
        if (el) el.remove();
    })()`);
    cdp.close();
    console.log('Removed test-responsive-fix');
}
removeTestStyle();
