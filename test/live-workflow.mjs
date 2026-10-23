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
let savedState, savedUi, fixtures = [], reviews = [], review, originalPanels = [];
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
            const props = index === 3 ? { freelance_os_review_checkpoint: 'checkpoint-v1' } : null;
            const line = await record.createLineItem(null, null, 'task', [{ type: 'text', text: `Workflow verification ${index} ${Date.now()}` }], props);
            if (!line) throw new Error('Fixture task creation failed');
            created.push({ guid: line.guid, recordGuid: record.guid });
        }
        plugin.actionQueueTab = 'all'; plugin.queueLimit = 1000;
        await plugin.render(plugin.activePanel);
        return { created, project: project.guid };
    });
    fixtures = setup.created;
    report.clientReviewCheckpointCue = await page.evaluate(async () => {
        const plugin = window.__freelanceOs;
        const workflow = await plugin.loadWorkflowData();
        const marked = workflow.tasks.find(task => task.clientReview && task.text.startsWith('Workflow verification 3 '));
        const attention = workflow.model.attention.find(item => item.project.guid === marked?.projectGuid);
        return !!marked && attention?.issues.includes('1 client review missing a date') === true;
    });
    assert.equal(report.clientReviewCheckpointCue, true, 'a marked native task appears as a review checkpoint in project attention');
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
            rowHeights: rows.map(row => ({ height: Math.round(row.getBoundingClientRect().height), width: Math.round(row.getBoundingClientRect().width), text: row.innerText.replace(/\s+/g, ' ').slice(0, 140) })),
            nextSelected: projectRow?.querySelector('select')?.value || '',
            summary: projectRow?.querySelector('.os-action-meta')?.textContent || ''
        };
    }, setup.project);
    assert.equal(projectCheckin.rows, projectCheckin.active, 'weekly review lists every active project');
    assert.equal(projectCheckin.nextSelected, fixtures[1].guid, 'weekly review keeps the selected next action visible');
    assert.ok(projectCheckin.summary.includes('Workflow verification 1'));
    assert.ok(projectCheckin.summary.includes('waiting task'), `waiting tasks are visible in the project cue: ${projectCheckin.summary}`);
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
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowMode = 'review'; const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7); const week = date.toLocaleDateString('en-CA'); plugin.workflowState.drafts[week].step = 1; await plugin.render(plugin.activePanel); });
    await page.waitForFunction(() => document.querySelector('.os-project-attention .os-project-recovery')?.textContent.includes('was completed'), { polling: 100, timeout: 10000 });
    report.completedNextActionRecoveryCue = await page.$eval('.os-project-attention .os-project-recovery', element => element.textContent);
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
        for (const [selector, value] of [['.os-review-notes', 'A useful milestone'], ['.os-review-priorities', 'Finish the proposal\nCreate a checklist']]) {
            const field = document.querySelector(selector); field.value = value; field.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowState = null; plugin.loadWorkflowState(); plugin.workflowMode = 'review'; await plugin.render(plugin.activePanel); });
    await page.waitForSelector('.os-review-notes');
    assert.equal(await page.$eval('.os-review-priorities', field => field.value), 'Finish the proposal\nCreate a checklist');
    report.reviewDraftSurvivesStateReload = true;
    await page.waitForFunction(() => document.querySelectorAll('.os-review-priority-row').length === 2, { polling: 100, timeout: 10000 });
    const priorityBridgeBeforeLink = await page.evaluate(() => {
        const app = document.querySelector('.os-app'); const rect = app.getBoundingClientRect();
        const rows = [...document.querySelectorAll('.os-review-priority-row')];
        return { rows: rows.length, disabledBeforeProject: rows.every(row => row.querySelector('.os-review-priority-task').disabled && row.querySelector('.os-review-priority-link').disabled && row.querySelector('.os-review-priority-add').disabled), overflow: [...app.querySelectorAll('.os-review-priority-row *')].some(element => { const box = element.getBoundingClientRect(); return box.width > 0 && (box.right > rect.right + 1 || box.left < rect.left - 1); }) };
    });
    assert.equal(priorityBridgeBeforeLink.rows, 2); assert.equal(priorityBridgeBeforeLink.disabledBeforeProject, true); assert.equal(priorityBridgeBeforeLink.overflow, false);
    report.priorityBridgeBeforeLink = priorityBridgeBeforeLink;
    await page.screenshot({ path: path.join(output, 'workflow-priority-bridge-before-link.png') });
    await page.evaluate(({ project, task }) => {
        const row = document.querySelectorAll('.os-review-priority-row')[0];
        const projectSelect = row.querySelector('.os-review-priority-project'); projectSelect.value = project; projectSelect.dispatchEvent(new Event('change', { bubbles: true }));
        const taskSelect = row.querySelector('.os-review-priority-task'); taskSelect.value = task; taskSelect.dispatchEvent(new Event('change', { bubbles: true }));
        row.querySelector('.os-review-priority-link').click();
    }, { project: setup.project, task: fixtures[2].guid });
    await page.waitForFunction(task => document.querySelector('.os-review-priority-linked')?.textContent.includes('Workflow verification 2'), { polling: 100, timeout: 10000 }, fixtures[2].guid);
    await page.evaluate(project => {
        const row = [...document.querySelectorAll('.os-review-priority-row')].find(item => item.querySelector('.os-review-priority-copy')?.textContent === 'Create a checklist');
        const projectSelect = row.querySelector('.os-review-priority-project'); projectSelect.value = project; projectSelect.dispatchEvent(new Event('change', { bubbles: true }));
        row.querySelector('.os-review-priority-add').click();
    }, setup.project);
    await page.waitForFunction(() => [...document.querySelectorAll('.os-review-priority-linked')].some(item => item.textContent.includes('Create a checklist')), { polling: 100, timeout: 10000 });
    const createdPriorityFixture = await page.evaluate(() => { const task = window.__freelanceOs.workflowData.tasks.find(item => item.text === 'Create a checklist'); return task ? { guid: task.guid, recordGuid: task.recordGuid } : null; });
    assert.ok(createdPriorityFixture, 'Create task adds one native project task'); fixtures.push(createdPriorityFixture);
    let priorityLink = await page.evaluate(({ project, task }) => {
        const plugin = window.__freelanceOs;
        const linked = plugin.workflowData.tasks.find(item => item.guid === task);
        const entry = Object.values(plugin.workflowState.drafts).flatMap(draft => draft.priorityItems || []).find(item => item.taskGuid === task);
        const week = Object.keys(plugin.workflowState.drafts).find(key => plugin.workflowState.drafts[key].priorityItems?.includes(entry));
        return { marker: linked?.lineItem?.props?.freelance_os_review_priority, expected: entry ? `${week}|id:${entry.id}` : '', id: entry?.id, week, project: linked?.projectGuid };
    }, { project: setup.project, task: fixtures[2].guid });
    assert.equal(priorityLink.marker, priorityLink.expected); assert.equal(priorityLink.project, setup.project);
    await page.evaluate(() => {
        const field = document.querySelector('.os-review-priorities'); field.value = 'Deliver the first proposal\nCreate a checklist'; field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector('.os-review-priority-linked')?.textContent.includes('Workflow verification 2'));
    const currentWeek = await page.evaluate(() => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (date.getDay() + 6) % 7); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; });
    const savedAtBeforeFirstSave = await page.evaluate(week => window.__freelanceOs.workflowState.reviews[week]?.savedAt || '', currentWeek);
    await page.evaluate(() => document.querySelector('.os-save-review').click());
    await page.waitForFunction(({ week, before }) => !window.__freelanceOs.reviewSaving && !!window.__freelanceOs.workflowState.reviews[week]?.savedAt && window.__freelanceOs.workflowState.reviews[week].savedAt !== before, { polling: 100, timeout: 10000 }, { week: currentWeek, before: savedAtBeforeFirstSave });
    let currentReview = await page.evaluate(() => {
        const plugin = window.__freelanceOs; const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (date.getDay() + 6) % 7); const week = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return plugin.workflowState.reviews[week];
    });
    assert.ok(currentReview, 'the current week review has a saved Journal reference');
    reviews.push(currentReview);
    await page.evaluate(async () => { const plugin = window.__freelanceOs; plugin.workflowState = null; plugin.loadWorkflowState(); plugin.workflowMode = 'review'; await plugin.render(plugin.activePanel); });
    await page.waitForFunction(() => document.querySelector('.os-review-priorities')?.value === 'Deliver the first proposal\nCreate a checklist' && [...document.querySelectorAll('.os-review-priority-linked')].some(item => item.textContent.includes('Workflow verification 2')), { polling: 100, timeout: 10000 });
    const savedAtBeforeUpdate = await page.evaluate(week => window.__freelanceOs.workflowState.reviews[week]?.savedAt || '', currentWeek);
    await page.evaluate(() => document.querySelector('.os-save-review').click());
    await page.waitForFunction(({ week, before }) => !window.__freelanceOs.reviewSaving && window.__freelanceOs.workflowState.reviews[week]?.savedAt !== before, { polling: 100, timeout: 10000 }, { week: currentWeek, before: savedAtBeforeUpdate });
    priorityLink = await page.evaluate(({ task, id, week }) => {
        const plugin = window.__freelanceOs; const linkedTask = plugin.workflowData.tasks.find(item => item.guid === task);
        return { marker: linkedTask?.lineItem?.props?.freelance_os_review_priority, id, week };
    }, { task: fixtures[2].guid, id: priorityLink.id, week: priorityLink.week });
    assert.equal(priorityLink.marker, `${priorityLink.week}|id:${priorityLink.id}`);
    report.existingTaskPriorityLinkSurvivesEditAndReviewReload = true;
    const currentJournalReview = await page.evaluate(async ({ review, task }) => {
        const plugin = window.__freelanceOs; const record = await plugin.getReviewRecord(review); const lines = await record.getLineItems();
        const linked = lines.find(line => line.segments?.some(segment => segment.type === 'ref' && segment.text?.guid === task));
        return { found: !!linked, title: linked?.segments?.find(segment => segment.type === 'ref')?.text?.title };
    }, { review: currentReview, task: fixtures[2].guid });
    assert.equal(currentJournalReview.found, true); assert.equal(currentJournalReview.title, 'Deliver the first proposal');
    const journalCreatedPriority = await page.evaluate(async ({ review, task }) => {
        const record = await window.__freelanceOs.getReviewRecord(review); const lines = await record.getLineItems();
        const linked = lines.find(line => line.segments?.some(segment => segment.type === 'ref' && segment.text?.guid === task));
        return linked?.segments?.find(segment => segment.type === 'ref')?.text?.title || '';
    }, { review: currentReview, task: createdPriorityFixture.guid });
    assert.equal(journalCreatedPriority, 'Create a checklist');
    report.savedPriorityIsNativeJournalReference = true;
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
    assert.equal(report.projectCheckin.maxRowHeight < 180, true, `review rows stay compact in the available panel width: ${JSON.stringify(report.projectCheckin.rowHeights)}`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(report, null, 2));
} finally {
    await page.evaluate(async ({ fixtures, reviews, savedState, savedUi }) => {
        const plugin = window.__freelanceOs;
        for (const fixture of fixtures) {
            const record = plugin.data.getRecord(fixture.recordGuid);
            const line = (await record.getLineItems()).find(line => line.guid === fixture.guid);
            if (line && await line.delete() === false) throw new Error('Fixture cleanup failed');
        }
        for (const savedReview of reviews) {
            if (!savedReview) continue;
            const record = await plugin.getReviewRecord(savedReview);
            const heading = (await record.getLineItems()).find(line => line.guid === savedReview.headingGuid);
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
    }, { fixtures, reviews: [...reviews, review], savedState, savedUi });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await browser.disconnect();
}
