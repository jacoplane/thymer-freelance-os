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
let originalPanels = [];
let originalDashboardState = null;
try {
    if (!process.env.OS_SKIP_RELOAD) await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.os-app');
    const saved = await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        const state = { workflowMode: plugin.workflowMode, currentTab: plugin.currentTab, invoiceFilter: plugin.invoiceFilter };
        plugin.workflowMode = 'overview';
        await plugin.render(plugin.activePanel);
        return { panels: plugin.ui.getPanels().map(panel => panel.getId()), state };
    });
    originalPanels = saved.panels;
    originalDashboardState = saved.state;
    await page.evaluate(({ panels, state }) => {
        window.__freelanceOsLiveOriginalPanelIds = panels;
        window.__freelanceOsLiveOriginalDashboardState = state;
    }, saved);
    const dimensions = await page.evaluate(() => [innerWidth, innerHeight]);
    const results = [];
    for (const collection of collections) {
        for (const definition of VIEW_PLANS[collection]) {
            const expected = await page.evaluate(async ({ collection, definition }) => {
                const plugin = window.__freelanceOs;
                const original = window.__freelanceOsLiveOriginalPanelIds || [];
                for (const panel of plugin.ui.getPanels()) if (!original.includes(panel.getId())) plugin.ui.closePanel(panel);
                const api = (await plugin.data.getAllCollections()).find(c => c.getName() === collection);
                const config = api.getConfiguration();
                const view = config.views.find(v => v.label === definition.label);
                // An unfiltered collection uses its own record API. Collection names with
                // spaces cannot safely be interpolated as one magic tag.
                const query = view.query
                    ? await plugin.data.searchByQuery(`@document ${view.query}`, 1000)
                    : { records: await api.getAllRecords() };
                if (query.error) throw new Error(`${collection}/${view.label}: ${query.error}`);
                const panel = await plugin.ui.createPanel({ afterPanel: plugin.activePanel });
                panel.navigateTo({ type: 'overview', rootId: api.getGuid(), subId: view.id, workspaceGuid: plugin.getWorkspaceGuid() });
                return { id: view.id, panelId: panel.getId(), guids: query.records.map(record => record.guid).sort(), type: view.type };
            }, { collection, definition });
            await page.waitForFunction(({ id, panelId }) => {
                const plugin = window.__freelanceOs;
                const panel = plugin.ui.getPanels().find(item => item.getId() === panelId)?.getElement()?.closest('.panel');
                return !!panel?.querySelector(`[data-view="${id}"].is-active`);
            }, { polling: 100, timeout: 10000 }, expected);
            await page.waitForFunction(({ guids, type, panelId }) => {
                const plugin = window.__freelanceOs;
                const panel = plugin.ui.getPanels().find(item => item.getId() === panelId)?.getElement()?.closest('.panel');
                if (!panel) return false;
                const selector = type === 'board' ? '.board-card[data-guid]' : '.table-view-row[data-guid]';
                const actual = [...panel.querySelectorAll(selector)].map(row => row.dataset.guid).sort();
                const loaded = type === 'board' ? !!panel.querySelector('.board-column') : !!panel.querySelector('.table-view-header-row');
                return loaded && JSON.stringify(actual) === JSON.stringify(guids);
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
            const original = window.__freelanceOsLiveOriginalPanelIds || [];
            for (const panel of plugin.ui.getPanels()) if (!original.includes(panel.getId())) plugin.ui.closePanel(panel);
            document.querySelector('[data-invoice-filter="review"]').click();
        });
        await page.waitForFunction(original => {
            const plugin = window.__freelanceOs;
            const panel = plugin.ui.getPanels().find(item => !original.includes(item.getId()));
            return panel?.getNavigation().subId === plugin.data.getPluginByGuid(plugin.collectionGuid('Invoices')).getConfiguration().views.find(view => view.label === 'To confirm').id;
        }, { polling: 100, timeout: 5000 }, originalPanels);
    }
    assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), dimensions);
    assert.deepEqual(failures, []);
    console.log(JSON.stringify(results, null, 2));
} finally {
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        const original = window.__freelanceOsLiveOriginalPanelIds || [];
        for (const panel of plugin.ui.getPanels()) if (!original.includes(panel.getId())) plugin.ui.closePanel(panel);
        plugin.workflowMode = window.__freelanceOsLiveOriginalDashboardState?.workflowMode || 'overview';
        plugin.currentTab = window.__freelanceOsLiveOriginalDashboardState?.currentTab || 'projects';
        plugin.invoiceFilter = window.__freelanceOsLiveOriginalDashboardState?.invoiceFilter || 'all';
        await plugin.render(plugin.activePanel);
        delete window.__freelanceOsLiveOriginalPanelIds;
        delete window.__freelanceOsLiveOriginalDashboardState;
    });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await browser.disconnect();
}
