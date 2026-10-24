import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { connectMcp } from '../scripts/thymer-mcp.mjs';
import { assertTestIdentity, guardedEvaluate, TEST_WORKSPACE } from './live-safety.mjs';

const token = `Billing verification ${Date.now()}`;
const output = process.env.OS_ARTIFACT_DIR || path.join(os.tmpdir(), 'freelance-os-billing');
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9444', defaultViewport: null });
const page = (await browser.pages()).find(p => p.url().includes('thymer.com'));
const cdp = await page.createCDPSession(); await cdp.send('Emulation.clearDeviceMetricsOverride');
const run = guardedEvaluate.bind(null, page);
let original, call, initialized = false;
const records = [], report = {}, errors = [];
try {
    assertTestIdentity(await page.evaluate(() => ({ workspace: window.__freelanceOs?.getWorkspaceGuid(), plugin: window.__freelanceOs?.getGuid() })));
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await page.evaluate(() => { window.__billingReloadPending = true; });
    await cdp.send('Page.reload', { ignoreCache: true });
    await page.waitForFunction(() => !window.__billingReloadPending && window.__freelanceOs?.activePanel && typeof window.__freelanceOs.renderBilling === 'function');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    page.on('pageerror', error => errors.push(error.message));
    call = await connectMcp();
    original = await run(async () => {
        const p = window.__freelanceOs, data = await p.loadData();
        return { panels: p.ui.getPanels().map(p => p.getId()), state: Object.fromEntries(['workflowMode', 'billingTab', 'billingSearch', 'billingMessage', 'invoiceFilter'].map(key => [key, p[key]])), invoices: data.invoices.map(i => ({ guid: i.guid, stage: i.stage, status: i.status, amount: i.amount, dueDate: i.dueDate, issuedDate: i.issuedDate, paidDate: i.paidDate })), dimensions: [innerWidth, innerHeight] };
    });
    initialized = true;
    const native = async (name, args) => { await run(() => true); return call(name, { workspace: TEST_WORKSPACE, ...args }); };
    const create = async (collection, title, properties) => { const response = await native('create_record', { collection, title, properties }); const guid = response.guid || response.record?.guid; assert.ok(guid); records.push(guid); return guid; };
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const earlier = new Date(`${today}T12:00:00`); earlier.setDate(earlier.getDate() - 5);
    const overdue = `${earlier.getFullYear()}-${String(earlier.getMonth() + 1).padStart(2, '0')}-${String(earlier.getDate()).padStart(2, '0')}`;
    const read = async guid => run(async guid => { const { record, ...invoice } = (await window.__freelanceOs.loadData()).invoices.find(invoice => invoice.guid === guid); return invoice; }, guid);
    const show = async (filter = 'all', tab = 'invoices') => run(async ({ filter, tab, token }) => { const p = window.__freelanceOs; p.workflowMode = 'billing'; p.billingTab = tab; p.invoiceFilter = filter; p.billingSearch = token; await p.render(p.activePanel); }, { filter, tab, token });
    const action = async guid => page.locator(`[data-invoice="${guid}"] .os-billing-row-action`).click();
    const submitDialog = async () => {
        await page.locator('.os-billing-dialog .btn-submit').click();
        await page.waitForFunction(() => !document.querySelector('.os-billing-dialog') || document.querySelector('.os-billing-error')?.hidden === false, { timeout: 5000 });
        const error = await page.evaluate(() => document.querySelector('.os-billing-error:not([hidden])')?.textContent || '');
        assert.equal(error, '', error);
    };
    const client = await create('Clients', `${token} Studio`, { status: 'maintenance', monthly_chf: 80, included_hours: 2, billing_cycle: 'Monthly', plan: 'Website care' });
    const draft = await create('Invoices', `${token} Draft`, { invoice_id: `${token} Draft`, client, status: 'draft', payment_status: 'unpaid', amount_chf: 250, currency: 'CHF', due: today });
    const unpaid = await create('Invoices', `${token} Confirm`, { invoice_id: `${token} Confirm`, client, status: 'sent', payment_status: 'unconfirmed', amount_chf: 120, currency: 'CHF', issued: overdue, due: overdue });
    const foreign = await create('Invoices', `${token} EUR`, { invoice_id: `${token} EUR`, client, status: 'sent', payment_status: 'unconfirmed', amount_chf: 99, currency: 'EUR', issued: overdue, due: overdue });
    await show();
    assert.equal(await page.$$eval('.os-billing-table tbody tr', rows => rows.length), 3);
    assert.match(await page.$eval('.os-billing-currency-note', e => e.textContent), /counts cover all currencies/);
    await page.screenshot({ path: path.join(output, 'billing-desktop.png') });
    await action(draft);
    await page.waitForFunction(async guid => (await window.__freelanceOs.loadData()).invoices.find(i => i.guid === guid)?.stage === 'ready', {}, draft);
    assert.equal((await read(draft)).status, 'unpaid');
    await action(draft); await page.waitForSelector('.os-billing-dialog');
    await page.$eval('.os-billing-dialog .input-date', (e, today) => { e.value = today; }, today);
    await submitDialog();
    const sent = await read(draft); assert.equal(sent.stage, 'sent'); assert.equal(sent.status, 'unpaid'); assert.equal(sent.issuedDate, today);
    report.sendingDoesNotMarkPayment = true;

    await action(unpaid); await page.waitForSelector('.os-billing-dialog');
    await (await page.$('.os-billing-dialog')).screenshot({ path: path.join(output, 'billing-payment-dialog.png') });
    await page.keyboard.press('Escape'); await page.waitForSelector('.os-billing-dialog', { hidden: true });
    assert.equal((await read(unpaid)).status, 'unconfirmed');
    await action(unpaid); await page.waitForSelector('.os-billing-dialog');
    await submitDialog();
    const settled = await read(unpaid); assert.equal(settled.status, 'paid'); assert.equal(settled.stage, 'sent'); assert.equal(settled.paidDate, today);
    assert.equal((await read(foreign)).status, 'unconfirmed');
    report.explicitDatedFullPayment = true;

    await action(draft); await page.waitForSelector('.os-billing-dialog');
    await native('update_record_property', { record: draft, property: 'amount_chf', value: 251 });
    await page.locator('.os-billing-dialog .btn-submit').click();
    await page.waitForFunction(() => document.querySelector('.os-billing-error')?.textContent.includes('amount, currency, or client changed'));
    assert.equal((await read(draft)).status, 'unpaid'); assert.equal((await read(draft)).paidDate, '');
    await page.keyboard.press('Escape'); await page.waitForSelector('.os-billing-dialog', { hidden: true });
    await native('update_record_property', { record: draft, property: 'amount_chf', value: 250 });
    report.stalePaymentFormPreservesUnpaidState = true;

    await page.locator('.os-billing-add').click(); await page.waitForSelector('.os-billing-dialog');
    await page.type('.input-title', `${token} Added`); await page.select('.input-client', client); await page.type('.input-amount', '42');
    await (await page.$('.os-billing-dialog')).screenshot({ path: path.join(output, 'billing-add-invoice.png') });
    await submitDialog();
    const added = await run(async title => (await window.__freelanceOs.loadData()).invoices.find(i => i.name === title)?.guid, `${token} Added`);
    assert.ok(added); records.push(added);
    const created = await read(added); assert.equal(created.stage, 'draft'); assert.equal(created.status, 'unpaid'); assert.equal(created.issuedDate, ''); assert.equal(created.paidDate, '');
    report.uiCreatesDraftWithoutInventedDates = true;
    await page.locator('.os-billing-add').click(); await page.waitForSelector('.os-billing-dialog');
    await page.type('.input-title', `${token} Added`); await page.select('.input-client', client); await page.type('.input-amount', '42');
    await page.locator('.os-billing-dialog .btn-submit').click();
    await page.waitForFunction(() => document.querySelector('.os-billing-error')?.textContent.includes('already exists'));
    await page.keyboard.press('Escape'); await page.waitForSelector('.os-billing-dialog', { hidden: true });
    report.duplicateReferenceAndKeyboardRecovery = true;
    await page.locator('.os-billing-add').click(); await page.waitForSelector('.os-billing-dialog');
    await page.type('.input-title', `${token} Paid entry`); await page.select('.input-client', client); await page.type('.input-amount', '60');
    await page.select('.input-stage', 'sent'); await page.select('.input-status', 'paid');
    await page.$eval('.input-issued', (e, today) => { e.value = today; }, today);
    await page.$eval('.input-paid-date', (e, today) => { e.value = today; }, today);
    await submitDialog();
    const paidEntry = await run(async title => (await window.__freelanceOs.loadData()).invoices.find(i => i.name === title)?.guid, `${token} Paid entry`);
    assert.ok(paidEntry); records.push(paidEntry);
    const paidCreated = await read(paidEntry); assert.equal(paidCreated.stage, 'sent'); assert.equal(paidCreated.status, 'paid'); assert.equal(paidCreated.issuedDate, today); assert.equal(paidCreated.paidDate, today);
    report.explicitPaidEntryVerifiedWithBothDates = true;

    await show('all', 'plans');
    assert.equal(await page.$$eval('.os-billing-table tbody tr', rows => rows.length), 1);
    const plan = await page.$eval('.os-billing-table tbody', e => e.innerText);
    assert.match(plan, /80 CHF/); assert.match(plan, /Monthly/); assert.match(plan, /2 h/);
    await page.screenshot({ path: path.join(output, 'billing-maintenance.png') });
    report.maintenanceReference = true;
    await show('overdue'); assert.equal(await page.$$eval('.os-billing-table tbody tr', rows => rows.length), 1);
    await page.locator('.os-billing-register').click();
    await page.waitForFunction(ids => window.__freelanceOs.ui.getPanels().some(p => !ids.includes(p.getId())), {}, original.panels);
    await page.waitForFunction(ids => window.__freelanceOs.ui.getPanels().find(p => !ids.includes(p.getId()))?.getNavigation().type === 'overview', {}, original.panels);
    const navigation = await run(ids => window.__freelanceOs.ui.getPanels().find(p => !ids.includes(p.getId())).getNavigation(), original.panels);
    assert.equal(navigation.type, 'overview'); assert.match(navigation.subId, /overdue/);
    await run(ids => { const p = window.__freelanceOs; for (const panel of p.ui.getPanels()) if (!ids.includes(panel.getId())) p.ui.closePanel(panel); }, original.panels);
    report.nativeRegisterPreservesSelectedFilter = true;

    await show(); await page.locator('.os-btn-board').click(); await page.waitForSelector('.board-card');
    const config = (await native('get_collection_config_json', { collection: 'Invoices' })).config;
    const expected = config.views.find(view => view.label === 'Preparation');
    assert.equal(expected.group_by_field_id, config.fields.find(field => field.label === 'status').id);
    await page.waitForFunction(guid => !!document.querySelector(`.board-card[data-guid="${guid}"]`), {}, added);
    assert.equal(await page.$(`.board-card[data-guid="${unpaid}"]`), null);
    assert.equal(await page.$(`.board-card[data-guid="${paidEntry}"]`), null);
    const source = await page.$(`.board-card[data-guid="${added}"] .item-drag-handle`); assert.ok(source);
    const target = (await page.$$('.board-column'))[1]; assert.match(await target.$eval('.board-column-title', e => e.innerText), /ready/);
    const from = await source.boundingBox(), to = await target.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await new Promise(resolve => setTimeout(resolve, 150)); await page.mouse.move(from.x + 30, from.y + 20, { steps: 8 }); await page.mouse.move(to.x + 65, to.y + 100, { steps: 20 }); await page.mouse.up();
    await page.waitForFunction(guid => document.querySelector(`.board-card[data-guid="${guid}"]`)?.closest('.board-column')?.querySelector('.board-column-title')?.innerText.includes('ready'), { timeout: 5000 }, added);
    const moved = await read(added); assert.equal(moved.stage, 'ready'); assert.equal(moved.status, 'unpaid'); assert.equal(moved.issuedDate, ''); assert.equal(moved.paidDate, '');
    await page.screenshot({ path: path.join(output, 'billing-board-split.png') });
    await run(async client => { const p = window.__freelanceOs; await p.openRecord(client, p.activePanel); }, client);
    await page.waitForFunction(ids => window.__freelanceOs.ui.getPanels().length >= ids.length + 2, {}, original.panels);
    await page.screenshot({ path: path.join(output, 'billing-narrow.png') });
    const layout = await run(() => { const app = document.querySelector('.os-app'), wrap = document.querySelector('.os-billing-table-wrap'); return { outerOverflow: app.scrollWidth > app.clientWidth + 2, tableScrollable: wrap.scrollWidth > wrap.clientWidth, width: app.clientWidth }; });
    assert.equal(layout.outerOverflow, false);
    assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), original.dimensions);
    report.nativeBoardMovesOnlySendingStage = true; report.nativeSplitLayout = layout;
    assert.deepEqual(errors, []);
} finally {
    if (initialized) {
        const owned = await run(async token => {
            const p = window.__freelanceOs, ids = [];
            document.querySelector('.os-billing-dialog')?.closest('.os-modal-backdrop')?.remove();
            for (const collection of await p.data.getAllCollections()) if (['Clients', 'Invoices'].includes(collection.getName())) for (const record of await collection.getAllRecords()) if (record.getName().startsWith(token)) ids.push(record.guid);
            return ids;
        }, token);
        for (const guid of new Set([...records, ...owned])) { await run(() => true); await call('trash_record', { workspace: TEST_WORKSPACE, record: guid }); }
        const remaining = await run(async original => {
            const p = window.__freelanceOs;
            for (const panel of p.ui.getPanels()) if (!original.panels.includes(panel.getId())) p.ui.closePanel(panel);
            Object.assign(p, original.state); const data = await p.loadData(); await p.render(p.activePanel);
            return data.invoices.map(i => ({ guid: i.guid, stage: i.stage, status: i.status, amount: i.amount, dueDate: i.dueDate, issuedDate: i.issuedDate, paidDate: i.paidDate }));
        }, original);
        assert.deepEqual(remaining, original.invoices); report.existingInvoicesUnchanged = true; report.cleanedUp = true;
    }
    await browser.disconnect();
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, screenshots: output }, null, 2));
}
