import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Run after deployment. Screenshots stay local because they contain workspace data.
const output = process.env.OS_ARTIFACT_DIR || path.join(os.tmpdir(), 'freelance-os-verification');
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9444', defaultViewport: null });
const page = (await browser.pages()).find(p => p.url().includes('thymer.com'));
const cdp = await page.createCDPSession();
await cdp.send('Emulation.clearDeviceMetricsOverride');
const errors = [];
page.on('pageerror', e => errors.push(e.message));
let originalPanels = [];
try {
    if (!process.env.OS_SKIP_RELOAD) await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.os-shell', { timeout: 20000 });
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowMode = 'overview'; await plugin.render(plugin.activePanel); });
    originalPanels = await page.evaluate(() => window.__freelanceOs.ui.getPanels().map(p => p.getId()));
    const dimensions = await page.evaluate(() => [innerWidth, innerHeight]);
    const report = {};
    report.capture = await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        const project = (await plugin.loadData()).projects[0];
        const record = plugin.data.getRecord(project.guid);
        const marker = `Freelance OS verification ${Date.now()}`;
        try {
            await plugin.captureTask(marker, project.guid, true);
            const lines = await record.getLineItems();
            const task = lines.find(l => l.segments?.some(s => s.text === marker));
            if (!task) throw new Error('Captured task was not found in selected project');
            return { persisted: true, priority: task.getTaskStatus() };
        } finally {
            for (const line of await record.getLineItems()) {
                if (line.segments?.some(s => s.text === marker)) {
                    if (await line.delete() === false) throw new Error('Verification task cleanup failed');
                }
            }
        }
    });
    assert.equal(report.capture.priority, 'important');
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        plugin.currentTab = 'clients';
        await plugin.render(plugin.activePanel);
        document.querySelector('.os-shell').focus();
    });
    // Dispatch in the renderer: background Electron windows may ignore CDP input.
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })));
    assert.equal(await page.evaluate(() => document.activeElement.className), 'os-capture-input');
    await page.evaluate(() => {
        const input = document.querySelector('.os-capture-input');
        input.value = 'Draft preservation check';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(async () => { await window.__freelanceOs.render(window.__freelanceOs.activePanel); });
    assert.equal(await page.$eval('.os-capture-input', el => el.value), 'Draft preservation check');
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        const original = plugin.captureTask;
        plugin.captureTask = async () => { throw new Error('Verification: unavailable destination'); };
        document.querySelector('.os-capture-btn').click();
        // Let the handler settle before restoring the real save function.
        await Promise.resolve(); await Promise.resolve();
        plugin.captureTask = original;
    });
    await page.waitForFunction(() => document.querySelector('.os-capture-feedback').textContent.includes('text is kept'), { polling: 100, timeout: 5000 });
    assert.equal(await page.$eval('.os-capture-input', el => el.value), 'Draft preservation check');
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        plugin.captureDraft = '';
        await plugin.render(plugin.activePanel);
    });
    assert.equal(await page.$$eval('.os-client-value', elements => elements.length > 0), true);
    const measure = () => page.evaluate(() => {
        const app = document.querySelector('.os-app');
        const shell = document.querySelector('.os-shell');
        const rect = app.getBoundingClientRect();
        const overflowing = [...app.querySelectorAll('*')].filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > rect.right + 1;
        }).map(el => el.className).slice(0, 10);
        return { panels: window.__freelanceOs.ui.getPanels().length, width: Math.round(rect.width), grid: getComputedStyle(app.querySelector('.os-grid')).gridTemplateColumns, padding: getComputedStyle(shell).padding, overflow: app.scrollWidth > app.clientWidth, overflowing, failedPanel: document.body.innerText.includes('Failed to load panel') };
    });
    const resetScroll = () => page.evaluate(() => {
        let element = document.querySelector('.os-app');
        while (element) { element.scrollTop = 0; element = element.parentElement; }
    });
    report.single = await measure();
    await resetScroll();
    await page.screenshot({ path: path.join(output, 'freelance-os-cycle-2.png') });
    for (const [count, collection] of [[2, '1YT6YD3EYV6F06TZY5GKGVJMNR'], [3, '1FD58J39X6KJ4JK5F06T7P4TSR']]) {
        await page.evaluate(async guid => {
            const plugin = window.__freelanceOs;
            const panels = plugin.ui.getPanels();
            await plugin.openCollection(guid, panels[panels.length - 1]);
        }, collection);
        await page.waitForFunction(count => window.__freelanceOs.ui.getPanels().length >= count, { polling: 100, timeout: 5000 }, count);
        await resetScroll();
        await page.screenshot({ path: path.join(output, `freelance-os-${count}-panels.png`) });
        report[`panels${count}`] = await measure();
    }
    for (const key of ['single', 'panels2', 'panels3']) {
        assert.equal(report[key].overflow, false, `${key} horizontal overflow`);
        assert.deepEqual(report[key].overflowing, [], `${key} clipped elements`);
        assert.equal(report[key].failedPanel, false);
    }
    assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), dimensions);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(report, null, 2));
    console.log(`Screenshots saved in ${output}`);
} finally {
    await page.evaluate(async ids => {
        const plugin = window.__freelanceOs;
        for (const panel of plugin.ui.getPanels()) if (!ids.includes(panel.getId())) plugin.ui.closePanel(panel);
        plugin.captureDraft = '';
        plugin.currentTab = 'projects';
        await plugin.render(plugin.activePanel);
    }, originalPanels);
    await browser.disconnect();
}
