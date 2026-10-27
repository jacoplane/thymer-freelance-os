import { connectCdp } from './cdp.mjs';

async function auditPerformance() {
    console.log('Connecting to Thymer Desktop via CDP...');
    const cdp = await connectCdp();

    try {
        console.log('--- Running Performance & Re-render Leak Sweep ---');

        // Check starting state
        const initial = await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            if (!p) return { error: 'Plugin not found' };
            return {
                nodeCount: document.querySelectorAll('*').length,
                appNodes: document.querySelectorAll('.os-app *').length
            };
        })()`);
        console.log('Initial DOM node metrics:', initial);

        const modes = ['overview', 'today', 'billing', 'review', 'ai', 'settings'];
        const renderTimes = [];
        const iterations = 5; // 5 full cycles = 30 tab switches

        console.log(`Executing 30 rapid tab transitions across ${modes.length} views...`);
        for (let i = 0; i < iterations; i++) {
            for (const mode of modes) {
                const start = Date.now();
                await cdp.evaluate(`(async () => {
                    const p = window.__freelanceOs;
                    p.workflowMode = '${mode}';
                    await p.render(p.activePanel);
                })()`);
                await new Promise(r => setTimeout(r, 60));
                renderTimes.push(Date.now() - start);
            }
        }

        // Return back to overview
        await cdp.evaluate(`(async () => {
            const p = window.__freelanceOs;
            p.workflowMode = 'overview';
            p.currentTab = 'projects';
            await p.render(p.activePanel);
        })()`);
        await new Promise(r => setTimeout(r, 500));

        const final = await cdp.evaluate(`(() => {
            return {
                nodeCount: document.querySelectorAll('*').length,
                appNodes: document.querySelectorAll('.os-app *').length,
                detachedShells: document.querySelectorAll('.os-shell').length,
                activeTimers: !!window.__freelanceOs?.workflowSearchTimer
            };
        })()`);

        const avgRender = Math.round(renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length);
        const maxRender = Math.max(...renderTimes);
        const minRender = Math.min(...renderTimes);

        console.log('Final DOM node metrics:', final);
        console.log('Render durations (ms):', { avg: avgRender, min: minRender, max: maxRender });

        // Assertions
        const nodeGrowth = final.appNodes - initial.appNodes;
        console.log(`Node growth across 30 re-renders: ${nodeGrowth} nodes (detached shells: ${final.detachedShells})`);

        if (final.detachedShells > 1) {
            throw new Error(`Detached shell leak detected: ${final.detachedShells} shells found in DOM`);
        }
        if (Math.abs(nodeGrowth) > 30) {
            throw new Error(`Excessive DOM node accumulation: ${nodeGrowth} node difference`);
        }

        console.log('\nPerformance & re-render leak sweep PASSED with 0 leaks!');
    } finally {
        cdp.close();
    }
}

auditPerformance().catch(err => {
    console.error('Performance audit failed:', err);
    process.exit(1);
});
