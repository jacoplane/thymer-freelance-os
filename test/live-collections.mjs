import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { VIEW_PLANS } from '../scripts/collection-view-plan.mjs';

const requested = process.argv[2];
const collections = requested ? [requested] : Object.keys(VIEW_PLANS);
const directory = process.env.OS_ARTIFACT_DIR || path.join(os.tmpdir(), 'freelance-os-verification');
await fs.mkdir(directory, { recursive: true });
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9444', defaultViewport: null });
const page = (await browser.pages()).find(p => p.url().includes('thymer.com'));
const cdp = await page.createCDPSession();
await cdp.send('Emulation.clearDeviceMetricsOverride');
// Allow native view rendering while Electron is behind another window. No sizing override.
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
const failures = [];
page.on('pageerror', error => failures.push(error.message));
try {
    if (!process.env.OS_SKIP_RELOAD) await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.os-app');
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowMode = 'overview'; await plugin.render(plugin.activePanel); });
    await page.evaluate(() => {
        const plugin = window.__freelanceOs;
        for (const panel of plugin.ui.getPanels()) if (panel.getId() !== plugin.activePanel.getId()) plugin.ui.closePanel(panel);
    });
    const dimensions = await page.evaluate(() => [innerWidth, innerHeight]);
    const results = [];
    for (const collection of collections) {
        for (const definition of VIEW_PLANS[collection]) {
            const expected = await page.evaluate(async ({ collection, definition }) => {
                const plugin = window.__freelanceOs;
                for (const panel of plugin.ui.getPanels()) if (panel.getId() !== plugin.activePanel.getId()) plugin.ui.closePanel(panel);
                const api = (await plugin.data.getAllCollections()).find(c => c.getName() === collection);
                const config = api.getConfiguration();
                const view = config.views.find(v => v.label === definition.label);
                const query = await plugin.data.searchByQuery(`@document @${collection} ${view.query || ''}`, 1000);
                if (query.error) throw new Error(`${collection}/${view.label}: ${query.error}`);
                const panel = await plugin.ui.createPanel({ afterPanel: plugin.activePanel });
                panel.navigateTo({ type: 'overview', rootId: api.getGuid(), subId: view.id, workspaceGuid: plugin.getWorkspaceGuid() });
                return { id: view.id, guids: query.records.map(record => record.guid).sort(), type: view.type };
            }, { collection, definition });
            await page.waitForFunction(id => [...document.querySelectorAll('.panel:has(> .panel-scroller-y)')].at(-1)?.querySelector(`[data-view="${id}"].is-active`), { polling: 100, timeout: 10000 }, expected.id);
            await page.waitForFunction(({ guids, type }) => {
                const panel = [...document.querySelectorAll('.panel:has(> .panel-scroller-y)')].at(-1);
                const selector = type === 'board' ? '.board-card[data-guid]' : '.table-view-row[data-guid]';
                const actual = [...panel.querySelectorAll(selector)].map(row => row.dataset.guid).sort();
                return JSON.stringify(actual) === JSON.stringify(guids) && (guids.length > 0 || panel.innerText.includes('No pages') || !!panel.querySelector('.board-column'));
            }, { polling: 100, timeout: 10000 }, expected);
            assert.equal(await page.evaluate(() => document.body.innerText.includes('Failed to load panel')), false);
            results.push({ collection, view: definition.label, records: expected.guids.length });
            if (definition.key === 'register' || definition.key === 'review' || definition.key === 'board' || definition.key === 'directory') {
                await page.screenshot({ path: path.join(directory, `${collection.toLowerCase()}-${definition.key}-native.png`) });
            }
        }
    }
    if (collections.includes('Invoices')) {
        await page.evaluate(() => {
            const plugin = window.__freelanceOs;
            for (const panel of plugin.ui.getPanels()) if (panel.getId() !== plugin.activePanel.getId()) plugin.ui.closePanel(panel);
            document.querySelector('[data-invoice-filter="review"]').click();
        });
        await page.waitForFunction(() => window.__freelanceOs.ui.getPanels().at(-1).getNavigation().subId === window.__freelanceOs.data.getPluginByGuid('1YT6YD3EYV6F06TZY5GKGVJMNR').getConfiguration().views.find(v => v.label === 'To confirm').id, { polling: 100, timeout: 5000 });
    }
    assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), dimensions);
    assert.deepEqual(failures, []);
    console.log(JSON.stringify(results, null, 2));
} finally {
    await page.evaluate(() => {
        const plugin = window.__freelanceOs;
        for (const panel of plugin.ui.getPanels()) if (panel.getId() !== plugin.activePanel.getId()) plugin.ui.closePanel(panel);
    });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await browser.disconnect();
}
