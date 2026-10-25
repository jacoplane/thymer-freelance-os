import { connectCdp } from './cdp.mjs';
import fs from 'fs';

async function main() {
    const cdp = await connectCdp();
    const html = await cdp.evaluate(`(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText && e.innerText.includes('Guide CMS Emdash'));
        if (el) {
            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            return el.outerHTML;
        }
        return 'not found';
    })()`);
    console.log('Target element in DOM:', html);
    await new Promise(r => setTimeout(r, 600));

    const shot = await cdp.screenshot();
    fs.writeFileSync('C:/dev/thymer-freelance-os/scrolled-doc.png', shot);
    console.log('Saved scrolled-doc.png');
    cdp.close();
}

main().catch(console.error);
