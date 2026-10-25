import { connectCdp } from './cdp.mjs';
import fs from 'fs';

async function main() {
    const cdp = await connectCdp();
    // Switch to Overview tab
    await cdp.evaluate(`(() => {
        const tabs = Array.from(document.querySelectorAll('.os-workflow-modes button, .os-tab-btn, button'));
        const overview = tabs.find(b => b.innerText.trim() === 'Overview');
        if (overview) overview.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    // Click "Clients & leads" tab under Actions
    await cdp.evaluate(`(() => {
        const tabs = Array.from(document.querySelectorAll('.os-action-tab, button'));
        const cliTab = tabs.find(b => b.innerText.includes('Clients & leads') || b.innerText.includes('Clients'));
        if (cliTab) cliTab.click();
    })()`);
    await new Promise(r => setTimeout(r, 800));

    const shot = await cdp.screenshot();
    const p = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\3a871dc0-e9e9-4ac5-b31e-fe33e0535c90\\persona-1-clients-tab.png';
    fs.writeFileSync(p, shot);
    console.log('Saved', p);

    const clientCards = await cdp.evaluate(`(() => {
        return Array.from(document.querySelectorAll('.os-client-card, .os-card-title, [class*="client"]')).map(el => el.innerText.trim()).filter(Boolean);
    })()`);
    console.log('Clients visible:', clientCards.slice(0, 10));

    cdp.close();
}

main().catch(console.error);
