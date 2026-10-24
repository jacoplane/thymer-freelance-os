import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();
    console.log('Reloading Thymer Desktop page to load deployed bundle...');
    await cdp.evaluate('window.location.reload()');
    
    // Wait for reload
    await new Promise(r => setTimeout(r, 2500));
    cdp.close();

    // Re-connect
    const cdp2 = await connectCdp();
    await new Promise(r => setTimeout(r, 1000));
    
    const info = await cdp2.evaluate(`(() => {
        const p = window.__freelanceOs;
        return {
            title: document.title,
            hasUpdateHeaderFn: typeof p?.updatePanelHeaderActions === 'function',
            hasDocActionHandler: typeof p?.docActionHandler === 'function'
        };
    })()`);
    console.log('Reloaded state:', JSON.stringify(info, null, 2));
    cdp2.close();
}

main().catch(console.error);
