import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const output = process.env.OS_ARTIFACT_DIR || path.join(os.tmpdir(), 'freelance-os-verification');
await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9444', defaultViewport: null });
const page = (await browser.pages()).find(page => page.url().includes('thymer.com'));
const cdp = await page.createCDPSession();
await cdp.send('Emulation.clearDeviceMetricsOverride');
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let savedState, fixtures = [], review, originalPanels = [];
try {
    if (!process.env.OS_SKIP_RELOAD) await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.os-workflow-modes');
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowMode = 'today'; await plugin.render(plugin.activePanel); });
    await page.waitForSelector('.os-workflow');
    await page.evaluate(() => { const plugin = window.__freelanceOs; for (const panel of plugin.ui.getPanels()) if (panel.getId() !== plugin.activePanel.getId()) plugin.ui.closePanel(panel); });
    savedState = await page.evaluate(() => JSON.stringify(window.__freelanceOs.loadWorkflowState()));
    originalPanels = await page.evaluate(() => window.__freelanceOs.ui.getPanels().map(panel => panel.getId()));
    const report = {};
    const setup = await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        const project = plugin.workflowData.model.active[0];
        const record = plugin.data.getRecord(project.guid);
        const created = [];
        for (let index = 0; index < 4; index++) {
            const line = await record.createLineItem(null, null, 'task', [{ type: 'text', text: `Workflow verification ${index} ${Date.now()}` }]);
            if (!line) throw new Error('Fixture task creation failed');
            created.push({ guid: line.guid, recordGuid: record.guid });
        }
        plugin.actionQueueTab = 'all'; plugin.queueLimit = 1000;
        await plugin.render(plugin.activePanel);
        return { created, project: project.guid };
    });
    fixtures = setup.created;
    await page.evaluate(async ({ fixtures, project }) => {
        const plugin = window.__freelanceOs;
        plugin.workflowState.next[project] = fixtures[0].guid;
        const today = new Date().toLocaleDateString('en-CA');
        plugin.workflowState.focus[today] = [];
        plugin.persistWorkflow();
        await plugin.render(plugin.activePanel);
    }, { fixtures, project: setup.project });
    for (const fixture of fixtures.slice(0, 3)) {
        await page.evaluate(guid => document.querySelector(`.os-action-list [data-task="${guid}"] .os-focus-action`).click(), fixture.guid);
        await page.waitForFunction(() => window.__freelanceOs.workflowData.model.focus.length === Number(document.querySelector('.os-focus-count').textContent.split('/')[0]), { polling: 100 });
        await page.waitForFunction(guid => document.querySelector(`.os-action-list [data-task="${guid}"] .os-focus-action`)?.textContent === 'Unpin', { polling: 100 }, fixture.guid);
    }
    await page.evaluate(guid => document.querySelector(`.os-action-list [data-task="${guid}"] .os-focus-action`).click(), fixtures[3].guid);
    await page.waitForFunction(() => document.querySelector('.os-workflow-message')?.textContent.includes('three actions'), { polling: 100 });
    assert.equal(await page.evaluate(() => window.__freelanceOs.workflowData.model.focus.length), 3);
    report.focusLimit = true;
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowState = null; plugin.loadWorkflowState(); await plugin.render(plugin.activePanel); });
    assert.equal(await page.evaluate(() => window.__freelanceOs.workflowData.model.focus.length), 3);
    report.focusSurvivesStateReload = true;
    await page.evaluate(async guid => {
        const plugin = window.__freelanceOs;
        const task = plugin.workflowData.tasks.find(task => task.guid === guid);
        await plugin.rescheduleAction(task, '2030-06-15');
        await plugin.setActionStatus(task, 'blocked');
        plugin.workflowState.waiting[guid] = { reason: 'Awaiting approval', followup: '2030-06-12' };
        plugin.persistWorkflow(); plugin.actionQueueTab = 'waiting';
        await plugin.render(plugin.activePanel);
    }, fixtures[0].guid);
    const waitingTask = await page.evaluate(guid => { const task = window.__freelanceOs.workflowData.tasks.find(task => task.guid === guid); return { date: task?.date, status: task?.status, segments: task?.lineItem.segments }; }, fixtures[0].guid);
    assert.equal(waitingTask.status, 'waiting');
    assert.equal(waitingTask.date, '2030-06-15');
    assert.equal(await page.evaluate(guid => window.__freelanceOs.workflowData.model.focus.some(task => task.guid === guid), fixtures[0].guid), false);
    report.waitingAndReschedule = true;
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs; plugin.workflowMode = 'review'; plugin.workflowMessage = '';
        await plugin.render(plugin.activePanel);
        document.querySelector('[data-step="2"]').click();
    });
    await page.waitForSelector('.os-review-notes');
    await page.evaluate(() => {
        for (const [selector, value] of [['.os-review-notes', 'A useful milestone'], ['.os-review-priorities', 'Finish the proposal']]) {
            const field = document.querySelector(selector); field.value = value; field.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowState = null; plugin.loadWorkflowState(); plugin.workflowMode = 'review'; await plugin.render(plugin.activePanel); });
    await page.waitForSelector('.os-review-notes');
    assert.equal(await page.$eval('.os-review-priorities', field => field.value), 'Finish the proposal');
    report.reviewDraftSurvivesStateReload = true;
    review = await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        const first = await plugin.saveReviewToJournal(plugin.workflowData, { notes: 'Verification draft', priorities: 'First plan' }, '2098-10-20');
        const second = await plugin.saveReviewToJournal(plugin.workflowData, { notes: 'Verification draft', priorities: 'Updated plan' }, '2098-10-21');
        const record = await plugin.getReviewRecord(first);
        const roots = (await record.getLineItems()).filter(line => line.guid === first.headingGuid);
        const children = typeof roots[0].getChildren === 'function' ? await roots[0].getChildren() : (await record.getLineItems()).filter(line => line.parent_guid === roots[0].guid);
        const allLines = await record.getLineItems();
        return { ...first, sameEntry: first.headingGuid === second.headingGuid, bodies: children.length, bodyUpdated: allLines.filter(line => children.some(body => line.parent_guid === body.guid)).some(line => line.segments?.some(segment => segment.text?.includes('Updated plan'))) };
    });
    assert.equal(review.sameEntry, true); assert.equal(review.bodies, 1); assert.equal(review.bodyUpdated, true);
    report.journalSaveAndUpdate = true;
    await page.evaluate(async review => { const plugin = window.__freelanceOs; await plugin.openItem(review.headingGuid, review.recordGuid, plugin.activePanel); }, review);
    await page.waitForFunction(() => window.__freelanceOs.ui.getPanels().length === 2, { polling: 100 });
    await page.waitForFunction(() => [...document.querySelectorAll('.panel:has(> .panel-scroller-y)')].at(-1)?.innerText.includes('Weekly review · week of 2098-10-20'), { polling: 100, timeout: 10000 });
    await page.screenshot({ path: path.join(output, 'workflow-journal-verification.png') });
    await page.evaluate(() => { const plugin = window.__freelanceOs; for (const panel of plugin.ui.getPanels()) if (panel.getId() !== plugin.activePanel.getId()) plugin.ui.closePanel(panel); });
    await page.screenshot({ path: path.join(output, 'workflow-review-cycle-2.png') });
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        plugin.workflowMode = 'today'; plugin.actionQueueTab = 'all';
        await plugin.render(plugin.activePanel);
        document.querySelector('.os-action-edit').open = true;
    });
    await page.evaluate(guid => document.querySelector(`.os-action-list [data-task="${guid}"] .os-action-done`).click(), fixtures[3].guid);
    await page.waitForFunction(guid => !window.__freelanceOs.workflowData.model.actions.some(task => task.guid === guid), { polling: 100 }, fixtures[3].guid);
    report.nativeCompletion = true;
    const measure = () => page.evaluate(() => {
        const app = document.querySelector('.os-app'); const rect = app.getBoundingClientRect();
        return { width: Math.round(rect.width), overflow: [...app.querySelectorAll('*')].filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().right > rect.right + 1).map(element => element.className).slice(0, 8) };
    });
    report.single = await measure();
    await page.screenshot({ path: path.join(output, 'workflow-today-cycle-2.png') });
    for (let count = 2; count <= 3; count++) {
        await page.evaluate(async () => { const plugin = window.__freelanceOs; await plugin.openCollection(plugin.collectionGuid('Invoices'), plugin.ui.getPanels().at(-1)); });
        await page.waitForFunction(count => window.__freelanceOs.ui.getPanels().length >= count, { polling: 100 }, originalPanels.length + count - 1);
        report[`panels${count}`] = await measure();
        await page.screenshot({ path: path.join(output, `workflow-${count}-panels-cycle-2.png`) });
    }
    for (const key of ['single', 'panels2', 'panels3']) assert.deepEqual(report[key].overflow, [], `${key} overflows`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(report, null, 2));
} finally {
    await page.evaluate(async ({ fixtures, review, savedState, originalPanels }) => {
        const plugin = window.__freelanceOs;
        for (const fixture of fixtures) {
            const record = plugin.data.getRecord(fixture.recordGuid);
            const line = (await record.getLineItems()).find(line => line.guid === fixture.guid);
            if (line && await line.delete() === false) throw new Error('Fixture cleanup failed');
        }
        if (review) {
            const record = await plugin.getReviewRecord(review);
            const heading = (await record.getLineItems()).find(line => line.guid === review.headingGuid);
            if (heading) {
                const allLines = await record.getLineItems();
                const removeChildren = async parent => { for (const line of allLines.filter(line => line.parent_guid === parent.guid)) { await removeChildren(line); if (await line.delete() === false) throw new Error('Review fixture cleanup failed'); } };
                await removeChildren(heading); if (await heading.delete() === false) throw new Error('Review fixture heading cleanup failed');
            }
        }
        if (savedState) { plugin.workflowState = JSON.parse(savedState); plugin.persistWorkflow(); }
        for (const panel of plugin.ui.getPanels()) if (!originalPanels.includes(panel.getId()) && panel.getId() !== plugin.activePanel.getId()) plugin.ui.closePanel(panel);
        plugin.workflowMode = 'today'; plugin.actionQueueTab = null;
        await plugin.render(plugin.activePanel);
    }, { fixtures, review, savedState, originalPanels });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await browser.disconnect();
}
