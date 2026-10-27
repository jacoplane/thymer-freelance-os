import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    await cdp.evaluate('document.querySelector(".os-modal-close")?.click()');
    cdp.close();
}

main().catch(console.error);
