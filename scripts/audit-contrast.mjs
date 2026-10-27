import { connectCdp } from './cdp.mjs';

async function checkContrast() {
    const cdp = await connectCdp();
    const results = await cdp.evaluate(`(() => {
        function getLuminance(r, g, b) {
            const a = [r, g, b].map(v => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        }

        function parseRgb(colorStr) {
            const match = colorStr.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
            if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
            return [200, 200, 200];
        }

        function getContrast(rgb1, rgb2) {
            const l1 = getLuminance(...rgb1);
            const l2 = getLuminance(...rgb2);
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
        }

        const app = document.querySelector('.os-app');
        const bg = window.getComputedStyle(document.querySelector('.os-project-card') || app).backgroundColor;
        const bgRgb = parseRgb(bg);

        const samples = [
            { name: 'Card Title (--os-text)', el: document.querySelector('.os-card-title') },
            { name: 'Card Client (--os-muted)', el: document.querySelector('.os-card-client') },
            { name: 'Project Next Link (--os-accent)', el: document.querySelector('.os-project-next-link') },
            { name: 'Date Label', el: document.querySelector('.os-card-bottom > span') },
            { name: 'Action Button (+ Invoice)', el: document.querySelector('.os-card-action-btn') },
            { name: 'Status In Progress Badge', el: document.querySelector('.status-in_progress') },
            { name: 'Status Backlog Badge', el: document.querySelector('.status-backlog') },
            { name: 'Task Label', el: document.querySelector('.os-task-label') },
            { name: 'Task Project Tag', el: document.querySelector('.os-task-project') },
            { name: 'Task Date Tag', el: document.querySelector('.os-task-date') }
        ];

        return samples.map(s => {
            if (!s.el) return { name: s.name, found: false };
            const style = window.getComputedStyle(s.el);
            const fgRgb = parseRgb(style.color);
            const ratio = getContrast(fgRgb, bgRgb);
            return {
                name: s.name,
                found: true,
                fg: style.color,
                bg,
                ratio: ratio.toFixed(2),
                wcagAA: ratio >= 4.5 ? 'PASS' : (ratio >= 3.0 ? 'PASS (Large/Bold)' : 'FAIL')
            };
        });
    })()`);

    console.log('Color Contrast Audit:');
    console.table(results);
    cdp.close();
}

checkContrast().catch(console.error);
