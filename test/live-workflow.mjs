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
let savedState, savedUi, fixtures = [], review, originalPanels = [];
try {
    if (!process.env.OS_SKIP_RELOAD) await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.os-workflow-modes');
    savedUi = await page.evaluate(() => {
        const plugin = window.__freelanceOs;
        return {
            panels: plugin.ui.getPanels().map(panel => panel.getId()),
            workflowMode: plugin.workflowMode, currentTab: plugin.currentTab, actionQueueTab: plugin.actionQueueTab,
            queueLimit: plugin.queueLimit, actionSearch: plugin.actionSearch, actionProject: plugin.actionProject,
            clientProjectGuid: plugin.clientProjectGuid, projectFilter: plugin.projectFilter, invoiceFilter: plugin.invoiceFilter,
            searchQuery: plugin.searchQuery, expandedProjects: [...plugin.expandedProjects]
        };
    });
    originalPanels = savedUi.panels;
    savedState = await page.evaluate(() => JSON.stringify(window.__freelanceOs.loadWorkflowState()));
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowMode = 'today'; await plugin.render(plugin.activePanel); });
    await page.waitForSelector('.os-workflow');
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
        const today = new Date().toLocaleDateString('en-CA');
        plugin.workflowState.focus[today] = [];
        plugin.actionQueueTab = 'all';
        plugin.persistWorkflow();
        await plugin.render(plugin.activePanel);
        await new Promise(resolve => setTimeout(resolve, 100));
        document.querySelector(`.os-action-list [data-task="${fixtures[0].guid}"] .os-next-action`).click();
    }, { fixtures, project: setup.project });
    await page.waitForFunction(async ({ project, task }) => {
        const plugin = window.__freelanceOs; const record = plugin.data.getRecord(project); const lines = await record.getLineItems(false);
        const label = plugin.workflowData.tasks.find(item => item.guid === task)?.text;
        return lines.some(line => line.props?.freelance_os_next_action === 'project-next-v1' && line.segments?.some(segment => segment.type === 'ref' && segment.text?.guid === task && segment.text?.title === label));
    }, { polling: 100, timeout: 10000 }, { project: setup.project, task: fixtures[0].guid });
    report.nativeNextReferenceCreated = true;
    await page.evaluate(async ({ project }) => {
        const plugin = window.__freelanceOs;
        delete plugin.workflowState.next[project]; delete plugin.workflowState.nextLabels[project]; plugin.persistWorkflow();
        plugin.workflowState = null; plugin.loadWorkflowState(); await plugin.loadWorkflowData();
    }, { project: setup.project });
    assert.equal(await page.evaluate(project => window.__freelanceOs.workflowState.next[project], setup.project), fixtures[0].guid);
    report.nativeNextReferenceRehydratesWithoutLocalPointer = true;
    await page.evaluate(async guid => {
        const plugin = window.__freelanceOs; const task = plugin.workflowData.tasks.find(item => item.guid === guid);
        await task.lineItem.setSegments([{ type: 'text', text: 'Workflow renamed action' }]);
        await plugin.loadWorkflowData();
    }, fixtures[0].guid);
    await page.waitForFunction(async ({ project, task }) => {
        const plugin = window.__freelanceOs; const lines = await plugin.data.getRecord(project).getLineItems(false);
        return lines.some(line => line.props?.freelance_os_next_action === 'project-next-v1' && line.segments?.some(segment => segment.type === 'ref' && segment.text?.guid === task && segment.text?.title === 'Workflow renamed action'));
    }, { polling: 100, timeout: 10000 }, { project: setup.project, task: fixtures[0].guid });
    report.taskRenameRefreshesNativeReferenceTitle = true;
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
    await page.waitForFunction(async project => {
        const plugin = window.__freelanceOs; const record = plugin.data.getRecord(project); const lines = await record.getLineItems(false);
        return !lines.some(line => line.props?.freelance_os_next_action === 'project-next-v1');
    }, { polling: 100, timeout: 10000 }, setup.project);
    assert.equal(await page.evaluate(project => window.__freelanceOs.workflowState.next[project], setup.project), undefined);
    report.waitingClearsNativeNextReference = true;
    report.waitingAndReschedule = true;
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        plugin.workflowMode = 'review';
        const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7);
        const week = date.toLocaleDateString('en-CA');
        plugin.workflowState.drafts[week] ||= { notes: '', priorities: '', step: 0 };
        plugin.workflowState.drafts[week].step = 1;
        await plugin.render(plugin.activePanel);
    });
    await page.waitForFunction(() => document.querySelector('.os-workflow h3')?.textContent === 'Active projects' && document.querySelectorAll('.os-project-attention').length === window.__freelanceOs.workflowData.model.active.length, { polling: 100, timeout: 10000 });
    await page.evaluate(({ project, next }) => {
        const plugin = window.__freelanceOs;
        const name = plugin.workflowData.model.active.find(item => item.guid === project)?.name;
        const row = [...document.querySelectorAll('.os-project-attention')].find(item => item.querySelector('.os-action-title')?.textContent === name);
        row.querySelector('select').value = next; row.querySelector('.os-pick-next').click();
    }, { project: setup.project, next: fixtures[1].guid });
    await page.waitForFunction(async ({ project, task }) => {
        const plugin = window.__freelanceOs; const record = plugin.data.getRecord(project); const lines = await record.getLineItems(false);
        const label = plugin.workflowData.tasks.find(item => item.guid === task)?.text;
        return lines.some(line => line.props?.freelance_os_next_action === 'project-next-v1' && line.segments?.some(segment => segment.type === 'ref' && segment.text?.guid === task && segment.text?.title === label));
    }, { polling: 100, timeout: 10000 }, { project: setup.project, task: fixtures[1].guid });
    report.weeklyReviewUpdatesNativeReference = true;
    await page.waitForFunction(() => window.__freelanceOs.workflowData.model.next.some(task => task.guid === document.querySelector('.os-project-attention select')?.value), { polling: 100, timeout: 10000 });
    await page.evaluate(async project => { const plugin = window.__freelanceOs; await plugin.openRecord(project, plugin.activePanel); }, setup.project);
    await page.waitForFunction(count => window.__freelanceOs.ui.getPanels().length > count, { polling: 100, timeout: 10000 }, originalPanels.length);
    await page.waitForFunction(async ({ project, task }) => {
        const plugin = window.__freelanceOs; const record = plugin.data.getRecord(project); const lines = await record.getLineItems(false);
        const label = plugin.workflowData.tasks.find(item => item.guid === task)?.text;
        return lines.some(line => line.props?.freelance_os_next_action === 'project-next-v1' && line.segments?.some(segment => segment.type === 'ref' && segment.text?.guid === task && segment.text?.title === label));
    }, { polling: 100, timeout: 10000 }, { project: setup.project, task: fixtures[1].guid });
    await page.screenshot({ path: path.join(output, 'workflow-project-native-next.png') });
    report.projectPageShowsLinkedNextAction = true;
    await page.evaluate(async ids => {
        const plugin = window.__freelanceOs;
        for (const panel of plugin.ui.getPanels()) if (!ids.includes(panel.getId())) plugin.ui.closePanel(panel);
        await plugin.render(plugin.activePanel);
    }, originalPanels);
    const projectCheckin = await page.evaluate(project => {
        const plugin = window.__freelanceOs;
        const rows = [...document.querySelectorAll('.os-project-attention')];
        const projectRow = rows.find(row => row.querySelector('.os-action-title')?.textContent === plugin.workflowData.model.active.find(item => item.guid === project)?.name);
        return {
            active: plugin.workflowData.model.active.length, rows: rows.length,
            maxRowHeight: Math.max(0, ...rows.map(row => row.getBoundingClientRect().height)),
            nextSelected: projectRow?.querySelector('select')?.value || '',
            summary: projectRow?.querySelector('.os-action-meta')?.textContent || ''
        };
    }, setup.project);
    assert.equal(projectCheckin.rows, projectCheckin.active, 'weekly review lists every active project');
    assert.equal(projectCheckin.nextSelected, fixtures[1].guid, 'weekly review keeps the selected next action visible');
    assert.ok(projectCheckin.summary.includes('Workflow verification 1'));
    assert.equal(projectCheckin.summary.includes('Choose a next action · Choose a next action'), false);
    report.projectCheckin = projectCheckin;
    await page.screenshot({ path: path.join(output, 'workflow-project-checkin.png') });
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowMode = 'overview'; plugin.currentTab = 'projects'; await plugin.render(plugin.activePanel); });
    await page.waitForSelector('.os-project-next-link');
    const projectQueueHandoff = await page.evaluate(async ({ project, task }) => {
        const plugin = window.__freelanceOs;
        const name = plugin.data.getRecord(project).getName();
        const card = [...document.querySelectorAll('.os-project-card')].find(item => item.querySelector('.os-card-title')?.textContent === name);
        const summary = card?.querySelector('.os-project-next-link')?.textContent || '';
        card?.querySelector('.os-project-next-link')?.click();
        await plugin.render(plugin.activePanel);
        return { summary, mode: plugin.workflowMode, projectFilter: plugin.actionProject, queueTab: plugin.actionQueueTab };
    }, { project: setup.project, task: fixtures[1].guid });
    await page.waitForFunction(guid => !!document.querySelector(`.os-action-list [data-task="${guid}"]`), { polling: 100, timeout: 10000 }, fixtures[1].guid);
    projectQueueHandoff.taskVisible = true;
    assert.match(projectQueueHandoff.summary, /Next action.*Workflow verification 1/);
    assert.equal(projectQueueHandoff.mode, 'today'); assert.equal(projectQueueHandoff.projectFilter, setup.project);
    assert.equal(projectQueueHandoff.queueTab, 'next'); assert.equal(projectQueueHandoff.taskVisible, true);
    report.projectQueueHandoff = projectQueueHandoff;
    await page.evaluate(async guid => {
        const plugin = window.__freelanceOs; const task = plugin.workflowData.tasks.find(item => item.guid === guid);
        await plugin.setActionStatus(task, 'done'); await plugin.render(plugin.activePanel);
    }, fixtures[1].guid);
    await page.waitForFunction(async project => {
        const plugin = window.__freelanceOs; const record = plugin.data.getRecord(project); const lines = await record.getLineItems(false);
        return !lines.some(line => line.props?.freelance_os_next_action === 'project-next-v1') && !plugin.workflowState.next[project];
    }, { polling: 100, timeout: 10000 }, setup.project);
    report.completingSelectedNextClearsNativeReference = true;
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs; plugin.workflowMode = 'review'; plugin.workflowMessage = '';
        const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7);
        const week = date.toLocaleDateString('en-CA'); plugin.workflowState.drafts[week].step = 1;
        await plugin.render(plugin.activePanel);
        await new Promise(resolve => setTimeout(resolve, 100));
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
    await page.waitForFunction(() => [...document.querySelectorAll('.panel:has(> .panel-scroller-y)')].some(panel => panel.innerText.includes('Weekly review · week of 2098-10-20')), { polling: 100, timeout: 10000 });
    await page.screenshot({ path: path.join(output, 'workflow-journal-verification.png') });
    await page.evaluate(ids => { const plugin = window.__freelanceOs; for (const panel of plugin.ui.getPanels()) if (!ids.includes(panel.getId())) plugin.ui.closePanel(panel); }, originalPanels);
    await page.screenshot({ path: path.join(output, 'workflow-review-cycle-2.png') });
    await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        plugin.workflowMode = 'today'; plugin.actionQueueTab = 'all'; plugin.actionProject = ''; plugin.actionSearch = ''; plugin.queueLimit = 1000;
        await plugin.render(plugin.activePanel);
    });
    await page.waitForFunction(guid => !!document.querySelector(`.os-action-list [data-task="${guid}"] .os-action-edit`), { polling: 100, timeout: 10000 }, fixtures[3].guid);
    await page.evaluate(guid => { document.querySelector(`.os-action-list [data-task="${guid}"] .os-action-edit`).open = true; }, fixtures[3].guid);
    await page.evaluate(guid => document.querySelector(`.os-action-list [data-task="${guid}"] .os-action-done`).click(), fixtures[3].guid);
    await page.waitForFunction(guid => !window.__freelanceOs.workflowData.model.actions.some(task => task.guid === guid), { polling: 100 }, fixtures[3].guid);
    report.nativeCompletion = true;
    const measure = () => page.evaluate(() => {
        const app = document.querySelector('.os-app'); const rect = app.getBoundingClientRect();
        return { width: Math.round(rect.width), overflow: [...app.querySelectorAll('*')].filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().right > rect.right + 1).map(element => element.className).slice(0, 8) };
    });
    report.single = await measure();
    report[`panels${originalPanels.length}`] = report.single;
    await page.screenshot({ path: path.join(output, 'workflow-today-cycle-2.png') });
    for (let count = originalPanels.length + 1; count <= 3; count++) {
        const before = await page.evaluate(() => window.__freelanceOs.ui.getPanels().length);
        await page.evaluate(async () => { const plugin = window.__freelanceOs; await plugin.openCollection(plugin.collectionGuid('Invoices'), plugin.ui.getPanels().at(-1)); });
        await new Promise(resolve => setTimeout(resolve, 900));
        const actual = await page.evaluate(() => window.__freelanceOs.ui.getPanels().length);
        if (actual <= before) break;
        report[`panels${actual}`] = await measure();
        await page.screenshot({ path: path.join(output, `workflow-${actual}-panels-cycle-2.png`) });
    }
    for (const key of Object.keys(report).filter(key => key === 'single' || /^panels[23]$/.test(key))) assert.deepEqual(report[key].overflow, [], `${key} overflows`);
    assert.equal(report.projectCheckin.maxRowHeight < 180, true, 'review rows stay compact in the available panel width');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(report, null, 2));
} finally {
    await page.evaluate(async ({ fixtures, review, savedState, savedUi }) => {
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
        for (const panel of plugin.ui.getPanels()) if (!savedUi.panels.includes(panel.getId())) plugin.ui.closePanel(panel);
        plugin.workflowMode = savedUi.workflowMode; plugin.currentTab = savedUi.currentTab; plugin.actionQueueTab = savedUi.actionQueueTab;
        plugin.queueLimit = savedUi.queueLimit; plugin.actionSearch = savedUi.actionSearch; plugin.actionProject = savedUi.actionProject;
        plugin.clientProjectGuid = savedUi.clientProjectGuid; plugin.projectFilter = savedUi.projectFilter; plugin.invoiceFilter = savedUi.invoiceFilter;
        plugin.searchQuery = savedUi.searchQuery; plugin.expandedProjects = new Set(savedUi.expandedProjects);
        await plugin.render(plugin.activePanel);
    }, { fixtures, review, savedState, savedUi });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await browser.disconnect();
}
