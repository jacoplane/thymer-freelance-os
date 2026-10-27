import { connectCdp } from './cdp.mjs';

function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function parseRgb(colorStr) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return null;
    return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1
    };
}

function getContrast(rgb1, rgb2) {
    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

async function runFullContrastSweep() {
    const cdp = await connectCdp();
    const tabs = ['overview', 'today', 'billing', 'ai', 'settings'];
    const failures = [];

    for (const tab of tabs) {
        await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            if (p) {
                p.workflowMode = '${tab}';
                p.render(p.activePanel);
            }
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const elements = await cdp.evaluate(`(() => {
            function parseRgba(str) {
                const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
                if (!m) return null;
                return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), m[4] !== undefined ? parseFloat(m[4]) : 1];
            }

            function blendColors(fg, bg) {
                const alpha = fg[3];
                return [
                    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
                    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
                    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
                    1
                ];
            }

            function getCompositeBg(el) {
                const stack = [];
                let cur = el;
                while (cur && cur !== document.documentElement) {
                    const style = window.getComputedStyle(cur);
                    const bg = style.backgroundColor;
                    const parsed = parseRgba(bg);
                    if (parsed && parsed[3] > 0) {
                        stack.unshift(parsed);
                    }
                    cur = cur.parentElement;
                }
                let base = [26, 28, 32, 1]; // root dark canvas
                for (const layer of stack) {
                    base = blendColors(layer, base);
                }
                return \`rgb(\${base[0]}, \${base[1]}, \${base[2]})\`;
            }

            const app = document.querySelector('.os-app');
            if (!app) return [];

            const results = [];
            const all = app.querySelectorAll('*');
            all.forEach(el => {
                if (el.children.length > 0 && Array.from(el.childNodes).some(n => n.nodeType === 1)) {
                    const directText = Array.from(el.childNodes)
                        .filter(n => n.nodeType === 3)
                        .map(n => n.textContent.trim())
                        .join('');
                    if (!directText) return;
                }
                const text = el.textContent?.trim();
                if (!text || text.length === 0) return;

                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

                const fg = style.color;
                const bg = getCompositeBg(el);
                const fontSize = parseFloat(style.fontSize);
                const fontWeight = style.fontWeight;
                const isLarge = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight, 10) >= 600));

                results.push({
                    tag: el.tagName.toLowerCase(),
                    cls: el.className,
                    text: text.slice(0, 35),
                    fg,
                    bg,
                    isLarge
                });
            });
            return results;
        })()`);

        for (const el of elements) {
            const fgRgb = parseRgb(el.fg);
            const bgRgb = parseRgb(el.bg);
            if (!fgRgb || !bgRgb) continue;

            const ratio = getContrast(fgRgb, bgRgb);
            const threshold = el.isLarge ? 3.0 : 4.5;
            if (ratio < threshold) {
                failures.push({
                    tab,
                    tag: el.tag,
                    cls: el.cls,
                    text: el.text,
                    fg: el.fg,
                    bg: el.bg,
                    ratio: ratio.toFixed(2),
                    required: threshold
                });
            }
        }
    }

    console.log(`\n=== FULL CONTRAST SWEEP FINDINGS ===`);
    console.log(`Total Contrast Failures (< WCAG AA): ${failures.length}`);
    if (failures.length > 0) {
        console.table(failures);
    }
    cdp.close();
}

runFullContrastSweep().catch(console.error);
