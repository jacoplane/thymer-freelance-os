import { connectCdp } from './cdp.mjs';

async function run() {
    const cdp = await connectCdp();
    const info = await cdp.evaluate(`(() => {
        const panels = document.querySelectorAll('.panels-grid > .panel');
        if (panels.length > 1) {
            const header = panels[1].querySelector('.panel-header') || panels[1].firstElementChild;
            return {
                headerHtml: header?.outerHTML?.slice(0, 500),
                buttons: Array.from(panels[1].querySelectorAll('button, [role="button"], .btn')).map(b => ({
                    cls: b.className,
                    title: b.title,
                    aria: b.getAttribute('aria-label'),
                    text: b.textContent.trim()
                }))
            };
        }
        return null;
    })()`);
    console.log('Panel 1 header and buttons:', JSON.stringify(info, null, 2));
    cdp.close();
}
run();
