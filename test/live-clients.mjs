import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { connectMcp } from '../scripts/thymer-mcp.mjs';
import { assertTestIdentity, guardedEvaluate, TEST_WORKSPACE } from './live-safety.mjs';

const token = `CRM verification ${Date.now()}`;
const output = process.env.OS_ARTIFACT_DIR || path.join(os.tmpdir(), 'freelance-os-clients');
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9444', defaultViewport: null });
const page = (await browser.pages()).find(p => p.url().includes('thymer.com'));
const cdp = await page.createCDPSession();
await cdp.send('Emulation.clearDeviceMetricsOverride');
const run = guardedEvaluate.bind(null, page);
let original, call, initialized = false;
const records = [], errors = [], report = {};
try {
    assertTestIdentity(await page.evaluate(() => ({ workspace: window.__freelanceOs?.getWorkspaceGuid(), plugin: window.__freelanceOs?.getGuid() })));
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__freelanceOs?.updateClientDetails === 'function');
    page.on('pageerror', error => errors.push(error.message));
    call = await connectMcp();
    original = await run(() => {
        const p = window.__freelanceOs;
        return { panels: p.ui.getPanels().map(panel => panel.getId()), state: Object.fromEntries(['workflowMode', 'currentTab', 'clientFilter', 'searchQuery', 'clientProjectGuid'].map(key => [key, p[key]])), dimensions: [innerWidth, innerHeight] };
    });
    initialized = true;
    const native = async (name, args) => {
        await run(() => true);
        return call(name, { workspace: TEST_WORKSPACE, ...args });
    };
    const create = async (collection, title, properties) => {
        const response = await native('create_record', { collection, title, properties });
        const guid = response.guid || response.record?.guid; assert.ok(guid); records.push(guid); return guid;
    };
    const show = async filter => {
        await run(async ({ token, filter }) => {
            const p = window.__freelanceOs;
            p.workflowMode = 'overview'; p.currentTab = 'clients'; p.clientFilter = filter; p.searchQuery = token.toLowerCase();
            await p.render(p.activePanel);
        }, { token, filter });
    };
    const read = async guid => run(async guid => {
        const p = window.__freelanceOs;
        const collection = (await p.data.getAllCollections()).find(c => c.getName() === 'Clients');
        const record = (await collection.getAllRecords()).find(r => r.guid === guid);
        return Object.fromEntries(['status', 'lead_stage', 'contact', 'email', 'phone'].map(label => {
            const property = record.prop(label); return [label, property.choiceLabel?.() || property.text?.() || ''];
        }));
    }, guid);
    const lead = await create('Clients', `${token} Studio`, { status: 'prospect', lead_stage: 'contacted', contact: 'Alex Example', email: 'alex@example.test', phone: '+41 22 555 01 23' });
    await native('insert_markdown', { record: lead, markdown: 'Interested in a website refresh. Short context supplied by the user.' });
    await show('leads');
    assert.equal(await page.$eval('.os-cards .os-lead-stage', e => e.value), 'contacted');
    await page.select('.os-cards .os-lead-stage', 'discussing');
    await page.waitForFunction(() => !document.querySelector('.os-lead-stage')?.disabled);
    assert.equal((await read(lead)).lead_stage, 'discussing');
    report.nativeMcpLeadAndStage = true;
    await page.$eval('.os-app', e => e.scrollTo(0, 0));
    await page.$eval('.os-app', e => e.dataset.verification = 'clients');
    await (await page.$('.os-app')).screenshot({ path: path.join(output, 'clients-desktop.png') });
    await page.locator('.os-edit-client').click();
    await page.waitForSelector('.os-client-form');
    await page.$eval('.input-phone', e => { e.value = '+41 22 555 09 87'; });
    await page.$eval('.input-email', e => { e.value = ''; });
    await page.select('.os-client-form .input-status', 'active');
    await page.locator('.os-client-form .btn-submit').click();
    await page.waitForSelector('.os-client-form', { hidden: true });
    assert.deepEqual(await read(lead), { status: 'active', lead_stage: 'discussing', contact: 'Alex Example', email: '', phone: '+41 22 555 09 87' });
    const body = await native('get_record', { record: lead, format: 'markdown' });
    assert.match(JSON.stringify(body), /Interested in a website refresh/);
    report.conversionPreservesIdentityAndNotes = true;

    await page.locator('.btn-new-lead').click();
    await page.type('.input-title', `${token} Design`);
    await page.type('.input-contact', 'Morgan Example');
    await page.type('.input-email', 'morgan@example.test');
    await page.select('.input-stage', 'contacted');
    await (await page.$('.os-client-form')).screenshot({ path: path.join(output, 'client-form.png') });
    await page.locator('.os-client-form .btn-submit').click();
    await page.waitForSelector('.os-client-form', { hidden: true });
    const created = await run(async title => {
        const p = window.__freelanceOs;
        const c = (await p.data.getAllCollections()).find(c => c.getName() === 'Clients');
        return (await c.getAllRecords()).find(r => r.getName() === title)?.guid;
    }, `${token} Design`);
    assert.ok(created); records.push(created);
    assert.equal((await read(created)).lead_stage, 'contacted');
    report.uiCreate = true;

    await page.locator('.btn-new-lead').click();
    await page.type('.input-title', `${token} Design`);
    await page.locator('.os-client-form .btn-submit').click();
    await page.waitForFunction(() => document.querySelector('.os-client-form-error')?.textContent.includes('already exists'));
    await page.keyboard.press('Escape');
    assert.equal(await page.$('.os-client-form'), null);
    report.duplicatePreventionAndEscape = true;

    const project = await create('Projects', `${token} Website`, { status: 'in_progress', client: lead });
    const task = await native('create_line_item', { record: project, type: 'task', segments: [{ type: 'text', text: 'Update the homepage ' }, { type: 'datetime', text: '2026-11-02' }] });
    assert.ok(task.guid || task.line_item?.guid);
    await native('insert_markdown', { record: project, markdown: '- [ ] Fix the contact form' });
    const projectBody = await native('get_record', { record: project, format: 'markdown' });
    assert.match(JSON.stringify(projectBody), /Update the homepage/); assert.match(JSON.stringify(projectBody), /Fix the contact form/);
    report.nativeProjectTasks = true;

    await show('leads');
    await page.locator('.os-view-all').click();
    await page.waitForFunction(ids => window.__freelanceOs.ui.getPanels().some(p => !ids.includes(p.getId())), {}, original.panels);
    await page.waitForFunction(() => !!document.querySelector('.table-view-header-row'));
    const nativeView = await run(ids => window.__freelanceOs.ui.getPanels().find(p => !ids.includes(p.getId()))?.getNavigation(), original.panels);
    assert.equal(nativeView.type, 'overview'); assert.match(nativeView.subId, /prospects/);
    assert.equal(await page.evaluate(() => document.body.innerText.includes('Failed to load panel')), false);
    await page.screenshot({ path: path.join(output, 'clients-split.png') });
    const overflow = await run(() => [...document.querySelectorAll('.os-project-card, .os-main, .os-client-stage')].filter(e => e.scrollWidth > e.clientWidth + 2).length);
    assert.equal(overflow, 0);
    report.nativeLeadsViewAndSplitLayout = true;
    await run(ids => { const p = window.__freelanceOs; for (const panel of p.ui.getPanels()) if (!ids.includes(panel.getId())) p.ui.closePanel(panel); }, original.panels);
    await page.locator('.os-edit-client').click();
    await page.select('.input-status', 'archived');
    await page.locator('.os-client-form .btn-submit').click();
    await page.waitForSelector('.os-client-form', { hidden: true });
    assert.equal((await read(created)).status, 'archived');
    report.archive = true;
    const unstaged = await create('Clients', `${token} Unstaged`, { status: 'prospect' });
    await show('leads');
    await run(async guid => {
        const p = window.__freelanceOs;
        const data = await p.loadData();
        p.showCreateClientModal(p.activePanel, data.clients.find(c => c.guid === guid));
    }, unstaged);
    assert.equal(await page.$eval('.input-stage', e => e.value), '');
    await page.type('.input-phone', '+41 22 555 00 11');
    await page.locator('.os-client-form .btn-submit').click();
    await page.waitForSelector('.os-client-form', { hidden: true });
    assert.equal((await read(unstaged)).lead_stage, '');
    report.contactEditPreservesUnsetStage = true;
    assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), original.dimensions);
    assert.deepEqual(errors, []);
} finally {
    if (initialized) {
        const owned = await run(async token => {
            const p = window.__freelanceOs, ids = [];
            for (const c of await p.data.getAllCollections()) if (['Clients', 'Projects'].includes(c.getName())) {
                for (const r of await c.getAllRecords()) if (r.getName()?.startsWith(token)) ids.push(r.guid);
            }
            document.querySelector('.os-client-form')?.closest('.os-modal-backdrop')?.remove();
            return ids;
        }, token);
        for (const guid of new Set([...records, ...owned])) {
            await run(() => true);
            await call('trash_record', { workspace: TEST_WORKSPACE, record: guid });
        }
        await run(async original => {
            const p = window.__freelanceOs;
            for (const panel of p.ui.getPanels()) if (!original.panels.includes(panel.getId())) p.ui.closePanel(panel);
            Object.assign(p, original.state); await p.render(p.activePanel);
        }, original);
        report.cleanedUp = true;
    }
    await browser.disconnect();
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, screenshots: output }, null, 2));
}
