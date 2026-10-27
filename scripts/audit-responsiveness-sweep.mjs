import { connectCdp } from './cdp.mjs';

async function runSweep() {
    const cdp = await connectCdp();
    console.log('Starting comprehensive responsiveness sweep across all components...');

    const tabsToTest = ['overview', 'today', 'billing', 'ai', 'settings'];
    const widthsToTest = [
        { label: 'ultrawide_1800', width: 1800 },
        { label: 'desktop_1350', width: 1350 },
        { label: 'split_950', width: 950 },
        { label: 'narrow_680', width: 680 },
        { label: 'compact_440', width: 440 }
    ];

    const findings = [];

    for (const tab of tabsToTest) {
        console.log(`\nTesting Tab: ${tab}...`);
        // Switch tab
        await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            if (p) {
                p.workflowMode = '${tab}';
                p.render(p.activePanel);
            }
        })()`);
        await new Promise(r => setTimeout(r, 600));

        for (const w of widthsToTest) {
            await cdp.evaluate(`(() => {
                const app = document.querySelector('.os-app');
                if (app) {
                    app.style.setProperty('width', '${w.width}px', 'important');
                    app.style.setProperty('max-width', '${w.width}px', 'important');
                }
            })()`);
            await new Promise(r => setTimeout(r, 300));

            // Audit DOM for issues
            const audit = await cdp.evaluate(`(() => {
                const app = document.querySelector('.os-app');
                if (!app) return { ok: false };

                // 1. Check for horizontal overflow
                const scrollW = app.scrollWidth;
                const clientW = app.clientWidth;
                const hasHScroll = scrollW > clientW + 2;

                // 2. Tab-specific checks
                const issues = [];
                if (hasHScroll) {
                    issues.push(\`Horizontal scroll detected: scrollWidth=\${scrollW} > clientWidth=\${clientW}\`);
                }

                // Check text truncation / ellipses in task labels
                const truncatedTasks = [];
                document.querySelectorAll('.os-task-item').forEach((item, idx) => {
                    const label = item.querySelector('.os-task-label');
                    if (label && label.scrollWidth > label.clientWidth + 2) {
                        truncatedTasks.push({
                            idx,
                            text: label.textContent,
                            scrollW: label.scrollWidth,
                            clientW: label.clientWidth
                        });
                    }
                });
                if (truncatedTasks.length > 0) {
                    issues.push(\`\${truncatedTasks.length} task labels truncated in Agenda\`);
                }

                // Check card widths in grid
                const card = document.querySelector('.os-project-card');
                const cardGrid = document.querySelector('.os-cards');
                const cardCols = cardGrid ? window.getComputedStyle(cardGrid).gridTemplateColumns.split(' ').length : 0;
                const cardWidth = card ? card.offsetWidth : 0;

                // Check button wraps in card bottom
                const wrappedCardBottoms = [];
                document.querySelectorAll('.os-project-card').forEach((c, idx) => {
                    const b = c.querySelector('.os-card-bottom');
                    const span = b ? b.querySelector('span') : null;
                    const acts = b ? b.querySelector('.os-card-actions') : null;
                    if (span && acts && Math.abs(span.offsetTop - acts.offsetTop) > 8) {
                        wrappedCardBottoms.push(idx);
                    }
                });
                if (wrappedCardBottoms.length > 0) {
                    issues.push(\`\${wrappedCardBottoms.length} project cards have wrapped bottom actions\`);
                }

                return {
                    hasHScroll,
                    cardCols,
                    cardWidth,
                    truncatedTasksCount: truncatedTasks.length,
                    firstTruncatedTask: truncatedTasks[0] || null,
                    wrappedCardBottomsCount: wrappedCardBottoms.length,
                    issues
                };
            })()`);

            findings.push({
                tab,
                width: w.width,
                label: w.label,
                ...audit
            });
            console.log(`  [${w.label}] Card cols: ${audit.cardCols}, Card W: ${audit.cardWidth}px, Truncated tasks: ${audit.truncatedTasksCount}, Issues: ${audit.issues.join('; ') || 'None'}`);
        }
    }

    // Reset styles
    await cdp.evaluate(`(() => {
        const app = document.querySelector('.os-app');
        if (app) {
            app.style.removeProperty('width');
            app.style.removeProperty('max-width');
        }
    })()`);

    console.log('\nSweep complete!');
    cdp.close();
}

runSweep().catch(console.error);
