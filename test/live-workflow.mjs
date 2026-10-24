import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { guardedEvaluate, assertTestIdentity } from './live-safety.mjs';

// This runner owns every record/heading it mutates. Existing reviews are never disposable fixtures.
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9444', defaultViewport: null });
let page, cdp, initialized = false;
const report = {};
const sessionToken = `workflow-${Date.now()}`;
try {
    page = (await browser.pages()).find(page => page.url().includes('thymer.com'));
    if (!page) throw new Error('Thymer Desktop renderer is unavailable');
    cdp = await page.createCDPSession();
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    assertTestIdentity(await page.evaluate(() => ({ workspace: window.__freelanceOs?.getWorkspaceGuid(), plugin: window.__freelanceOs?.getGuid() })));
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    if (!process.env.OS_SKIP_RELOAD) {
        await page.evaluate(() => { window.__freelanceOsReloadPending = true; });
        await cdp.send('Page.reload', { ignoreCache: true });
        await page.waitForFunction(() => !window.__freelanceOsReloadPending && !!window.__freelanceOs, { polling: 100, timeout: 15000 });
    }
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    const output = process.env.OS_ARTIFACT_DIR || path.join(os.tmpdir(), 'freelance-os-verification');
    await fs.mkdir(output, { recursive: true });
    const run = guardedEvaluate.bind(null, page);
    initialized = true;
    await run(async token => {
        const p = window.__freelanceOs;
        if (window.__freelanceOsTestSession) throw new Error('A prior live-test session requires cleanup before another run.');
        const uiKeys = ['workflowMode', 'currentTab', 'projectFilter', 'invoiceFilter', 'clientProjectGuid', 'searchQuery', 'actionQueueTab', 'actionPreset', 'actionSearch', 'actionProject', 'queueLimit', 'agendaTab', 'agendaTabSetByUser', 'agendaLimit', 'captureDraft', 'captureProjectGuid', 'captureDestinationSource', 'captureContext', 'captureImportant', 'workflowMessage', 'workflowSyncError', 'weeklyReviewDiscovery', 'reviewDiscovery', 'previousReviewContext', 'selectedReviewWeek', 'selectedReviewHeadingGuid', 'waitingEditorDrafts'];
        const s = window.__freelanceOsTestSession = {
            token, records: [], headings: [],
            state: JSON.stringify(p.loadWorkflowState()), raw: p.workflowStorageAdapter().read(),
            ui: Object.fromEntries(uiKeys.map(key => [key, p[key]])),
            panels: p.ui.getPanels().map(panel => panel.getId()), panel: p.activePanel,
            methods: { applyNativeReconciliation: p.applyNativeReconciliation, saveReviewSnapshot: p.saveReviewSnapshot, writeReviewBody: p.writeReviewBody }, baseline: []
        };
        const collections = await p.data.getAllCollections();
        s.collections = collections;
        for (const role of ['Projects', 'Journal']) {
            const collection = collections.find(c => c.getGuid() === p.collectionGuid(role, collections));
            if (!collection) throw new Error(`Missing ${role} test collection`);
            for (const record of await collection.getAllRecords()) s.baseline.push({ record, recordGuid: record.guid, lines: JSON.stringify((await record.getLineItems(false)).map(l => ({ guid: l.guid, parent_guid: l.parent_guid, segments: l.segments, props: l.props })).sort((a, b) => a.guid.localeCompare(b.guid))) });
        }
        // Limit background native reconciliation to test-owned projects while leaving real UI scopes visible.
        p.applyNativeReconciliation = function(snapshot) {
            snapshot.nativeReconciliation = {
                remove: snapshot.nativeReconciliation.remove.filter(m => s.records.includes(m.recordGuid)),
                write: snapshot.nativeReconciliation.write.filter(w => s.records.includes(w.project.guid))
            };
            return s.methods.applyNativeReconciliation.call(this, snapshot);
        };
        // Register the heading immediately after creation, before metadata/body operations can fail.
        p.saveReviewSnapshot = async function(heading, snapshot, options) {
            if (!s.reviewWeeks?.includes(snapshot.week)) throw new Error('Test review write outside reserved fixture weeks');
            const recordGuid = heading.getRecord().guid;
            if (!s.headings.some(h => h.headingGuid === heading.guid)) s.headings.push({ headingGuid: heading.guid, recordGuid, record: heading.getRecord() });
            return s.methods.saveReviewSnapshot.call(this, heading, snapshot, options);
        };
        p.workflowState = { ...p.workflowState, next: {}, nextLabels: {}, nextRecovery: {}, focus: {}, drafts: {}, reviews: {} };
        p.waitingEditorDrafts = {};
    }, sessionToken);
    const setup = await run(async () => {
        const p = window.__freelanceOs, s = window.__freelanceOsTestSession;
        const projects = s.collections.find(c => c.getGuid() === p.collectionGuid('Projects', s.collections));
        const guid = projects.createRecord(`${s.token} project`);
        if (!guid) throw new Error('Fixture project creation failed');
        s.records.push(guid); // Registered before any further await/property write.
        let record;
        for (let i = 0; i < 20 && !record; i++) { record = (await projects.getAllRecords()).find(r => r.guid === guid); if (!record) await new Promise(r => setTimeout(r, 50)); }
        if (!record || record.prop('status').setChoice('in_progress') === false) throw new Error('Fixture project initialization failed');
        await p.initializeProject(record, { firstAction: `${s.token} template action` });
        s.tasks = [];
        for (let i = 0; i < 4; i++) {
            const line = await record.createLineItem(null, null, 'task', [{ type: 'text', text: `${s.token} task ${i}` }], i === 3 ? { freelance_os_review_checkpoint: 'checkpoint-v1' } : null);
            if (!line) throw new Error('Fixture task creation failed');
            s.tasks.push({ guid: line.guid, recordGuid: guid });
        }
        const journal = s.collections.find(c => c.getGuid() === p.collectionGuid('Journal', s.collections));
        const user = p.resolveJournalOwner(journal);
        // Reserve empty future dates, avoiding every existing review and every nonempty day.
        for (let offset = 0; offset < 100; offset++) {
            const date = new Date(2096, 0, 2 + offset * 21, 12);
            const dates = Array.from({ length: 3 }, (_, i) => { const d = new Date(date); d.setDate(d.getDate() + i * 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
            const weeks = dates.map(value => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
            let available = true;
            for (let i = 0; i < dates.length; i++) {
                if ((await p.findWeeklyReview(journal, user, weeks[i])).kind !== 'none') { available = false; break; }
                const day = await p.getReviewRecord({ journalDate: dates[i], userGuid: user.guid, journalGuid: journal.getGuid() }, journal, user);
                if (s.baseline.some(record => record.recordGuid === day.guid)) { available = false; break; }
                if ((await day.getLineItems(false)).length) { available = false; break; }
            }
            if (available) { s.reviewDates = dates; s.reviewWeeks = weeks; break; }
        }
        if (!s.reviewWeeks) throw new Error('No empty review fixture dates available');
        p.workflowMode = 'today'; p.actionQueueTab = 'all'; p.actionProject = guid; p.actionSearch = ''; p.actionPreset = 'any'; p.queueLimit = 1000;
        await p.render(s.panel);
        return { project: guid, tasks: s.tasks, dates: s.reviewDates, weeks: s.reviewWeeks };
    });
    const clickTask = async (guid, selector) => run(({ guid, selector }) => {
        const p = window.__freelanceOs, s = window.__freelanceOsTestSession;
        const row = s.panel.getElement().querySelector(`.os-action-list [data-task="${guid}"]`);
        if (!s.tasks.some(t => t.guid === guid) || !row) throw new Error('Action outside fixture tasks');
        row.querySelector(selector).click();
    }, { guid, selector });
    await clickTask(setup.tasks[0].guid, '.os-next-action');
    await page.waitForFunction(({ project, guid }) => window.__freelanceOs.workflowState.next[project] === guid, { polling: 100, timeout: 10000 }, { project: setup.project, guid: setup.tasks[0].guid });
    report.nativeNextAction = true;
    for (const fixture of setup.tasks.slice(0, 3)) {
        await clickTask(fixture.guid, '.os-focus-action');
        await page.waitForFunction(guid => window.__freelanceOs.workflowData.model.focus.some(t => t.guid === guid), { polling: 100, timeout: 10000 }, fixture.guid);
    }
    await clickTask(setup.tasks[3].guid, '.os-focus-action');
    await page.waitForFunction(() => window.__freelanceOs.workflowMessage?.includes('three actions'), { polling: 100, timeout: 10000 });
    report.focusLimit = true;
    report.waiting = await run(async () => {
        const p = window.__freelanceOs, s = window.__freelanceOsTestSession;
        const task = p.workflowData.tasks.find(t => t.guid === s.tasks[0].guid);
        await p.rescheduleAction(task, '2030-06-15');
        await p.saveWaiting(task, { reason: 'Fixture approval', followup: '2030-06-12' });
        await p.render(s.panel);
        const waiting = p.workflowData.tasks.find(t => t.guid === task.guid);
        const details = JSON.parse(waiting.lineItem.props.freelance_os_waiting);
        if (waiting.status !== 'waiting' || details.reason !== 'Fixture approval' || waiting.date !== '2030-06-15') throw new Error('Waiting state/date/metadata mismatch');
        if (p.workflowData.model.focus.some(t => t.guid === task.guid) || p.workflowState.next[task.projectGuid]) throw new Error('Waiting work stayed actionable');
        return true;
    });
    // Verify capture loss and waiting failure against real rendered components without native writes.
    report.auditEditors = await run(async () => {
        const p = window.__freelanceOs;
        const a = Object.create(Object.getPrototypeOf(p));
        a.workflowState = { next: {}, nextLabels: {}, waiting: {}, focus: {}, drafts: {}, reviews: {} };
        a.workflowMode = 'today'; a.captureProjectGuid = 'missing-project'; a.captureDestinationSource = 'user'; a.captureDraft = 'Keep this draft';
        a.getWorkspaceGuid = () => p.getWorkspaceGuid(); a.ui = { addToaster() {} };
        a.loadWorkflowData = async () => ({ error: 'Fixture', projects: [] });
        let captureCalls = 0; a.captureTask = async () => { captureCalls++; return { prioritySaved: true }; };
        const container = document.createElement('div'); await a.render({ getElement: () => container });
        container.querySelector('.os-capture-btn').click(); await Promise.resolve(); await Promise.resolve();
        if (captureCalls || a.captureDraft !== 'Keep this draft' || container.querySelector('.os-capture-project').value !== 'missing-project') throw new Error('Capture destination fell back');
        const destination = container.querySelector('.os-capture-project'); destination.value = ''; destination.dispatchEvent(new Event('change'));
        container.querySelector('.os-capture-btn').click(); await Promise.resolve(); await Promise.resolve();
        if (captureCalls !== 1 || a.captureProjectGuid !== '' || a.captureDestinationSource !== 'user') throw new Error('Explicit Journal selection did not recover capture');
        const item = { guid: 'mock', text: 'Mock task', projectGuid: 'mock-project', projectName: 'Mock project', status: 'important', date: '', lineItem: { props: {}, setMetaProperties: async () => false } };
        a.render = async () => { a.row = a.renderActionRow(item, {}); };
        const row = a.renderActionRow(item, {}); row.querySelector('.os-wait-reason').value = 'Keep approval text'; row.querySelector('.os-wait-date').value = '2030-06-12';
        await row.querySelector('.os-wait-save').onclick({ target: row.querySelector('.os-wait-save') });
        if (a.row.querySelector('.os-wait-reason').value !== 'Keep approval text' || a.row.querySelector('.os-wait-date').value !== '2030-06-12') throw new Error('Waiting input lost on failure');
        let savedNote;
        item.lineItem.setMetaProperties = async props => { savedNote = JSON.parse(props.freelance_os_waiting); Object.assign(item.lineItem.props, props); return true; };
        item.lineItem.setTaskStatus = async status => { item.status = status; return true; };
        await a.row.querySelector('.os-wait-save').onclick({ target: a.row.querySelector('.os-wait-save') });
        if (savedNote?.reason !== 'Keep approval text' || savedNote.followup !== '2030-06-12' || a.waitingEditorDrafts.mock) throw new Error('Waiting retry did not save retained input');
        return { missingCaptureRejected: true, explicitJournalRecovers: true, waitingFailureRetainsText: true, waitingRetrySavesRetainedText: true };
    });
    report.freshReviews = await run(async () => {
        const p = window.__freelanceOs, s = window.__freelanceOsTestSession;
        const journal = s.collections.find(c => c.getGuid() === p.collectionGuid('Journal', s.collections)); const user = p.resolveJournalOwner(journal);
        const draft = { notes: 'Fresh fixture review', priorities: 'Carry fixture proposal', priorityItems: [{ id: `${s.token}-priority`, text: 'Carry fixture proposal', taskGuid: s.tasks[1].guid, recordGuid: s.tasks[1].recordGuid, projectGuid: s.records[0] }] };
        const original = await p.saveReviewToJournal(p.workflowData, draft, s.reviewDates[0]);
        const first = await p.findWeeklyReview(journal, user, s.reviewWeeks[0]);
        if (first.kind !== 'one' || first.snapshot.state !== 'saved') throw new Error('Fresh first save failed');
        const firstSnapshot = JSON.stringify(first.snapshot);
        const originLine = (await p.data.getRecord(s.records[0]).getLineItems(false)).find(l => l.guid === s.tasks[1].guid);
        const origin = originLine.props.freelance_os_review_priority;
        let previous = draft.priorityItems[0];
        for (let i = 1; i < 3; i++) {
            const current = { notes: 'Carried fixture review', priorities: '', priorityItems: [] }; p.workflowState.drafts[s.reviewWeeks[i]] = current;
            const resolution = await p.resolveHistoricalPriority(previous, s.reviewWeeks[i - 1], p.workflowData);
            const item = { entry: previous, resolution };
            p.carryPreviousPriority({ week: s.reviewWeeks[i - 1] }, item, null, s.reviewWeeks[i]);
            p.persistWorkflow(); p.workflowState = null; p.loadWorkflowState();
            const reloaded = p.workflowState.drafts[s.reviewWeeks[i]];
            p.carryPreviousPriority({ week: s.reviewWeeks[i - 1] }, item, null, s.reviewWeeks[i]);
            if (reloaded.priorityItems.length !== 1 || !reloaded.priorityItems[0].carriedFrom) throw new Error('Carry lost identity on reload');
            await p.saveReviewToJournal(p.workflowData, reloaded, s.reviewDates[i]); previous = reloaded.priorityItems[0];
        }
        const fresh = (await p.data.getRecord(s.records[0]).getLineItems(false)).find(l => l.guid === s.tasks[1].guid);
        if (fresh.props.freelance_os_review_priority !== origin || JSON.stringify((await p.findWeeklyReview(journal, user, s.reviewWeeks[0])).snapshot) !== firstSnapshot) throw new Error('Carry rewrote history');
        // Update the same native section explicitly; never save into the user's current week.
        const updated = await p.saveReviewToJournal(p.workflowData, { ...draft, notes: 'Updated fixture review' }, s.reviewDates[0]);
        if (updated.headingGuid !== original.headingGuid) throw new Error('Review update duplicated its section');
        return { firstSaveSucceeded: true, threeWeeksOneTask: true, carrySurvivesReload: true, originUnchanged: true, sameSectionUpdate: true };
    });
    // Exercise interruption after pending identity is written; ledger already owns the heading.
    report.pendingCleanup = await run(async () => {
        const p = window.__freelanceOs, s = window.__freelanceOsTestSession;
        const journal = s.collections.find(c => c.getGuid() === p.collectionGuid('Journal', s.collections)); const user = p.resolveJournalOwner(journal);
        const date = new Date(`${s.reviewDates[2]}T12:00:00`); date.setDate(date.getDate() + 7);
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const monday = new Date(date); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
        const week = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        if ((await p.findWeeklyReview(journal, user, week)).kind !== 'none') throw new Error('Pending fixture date collision');
        s.reviewWeeks.push(week); const before = s.headings.length;
        p.writeReviewBody = async () => { throw new Error('Injected fixture body failure'); };
        try { await p.saveReviewToJournal(p.workflowData, { notes: 'Interrupted fixture', priorities: '', priorityItems: [] }, day); throw new Error('Expected body failure'); }
        catch (error) { if (error.message !== 'Injected fixture body failure') throw error; }
        finally { p.writeReviewBody = s.methods.writeReviewBody; }
        const pending = await p.findWeeklyReview(journal, user, week);
        if (pending.kind !== 'one' || pending.snapshot.state !== 'pending' || s.headings.length !== before + 1) throw new Error('Pending heading was not owned immediately');
        const repaired = await p.saveReviewToJournal(p.workflowData, { notes: 'Repaired fixture', priorities: '', priorityItems: [] }, day);
        if (repaired.headingGuid !== pending.heading.guid) throw new Error('Pending retry duplicated a section');
        return { failureRegistered: true, retrySameHeading: true };
    });
    // Review controls/priority bridge can be exercised without clicking Save on an existing real review.
    await run(async () => {
        const p = window.__freelanceOs, s = window.__freelanceOsTestSession; const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7);
        const week = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        p.workflowState.drafts[week] = { step: 2, notes: 'Fixture review preview', priorities: 'Fixture priority', priorityItems: [{ id: `${s.token}-ui`, text: 'Fixture priority' }] };
        p.workflowMode = 'review'; await p.render(s.panel);
    });
    assert.equal(await run(() => !!window.__freelanceOsTestSession.panel.getElement().querySelector('.os-review-priority-row')), true);
    await page.screenshot({ path: path.join(output, 'workflow-review.png') });
    await run(async () => { const p = window.__freelanceOs, s = window.__freelanceOsTestSession; p.workflowMode = 'today'; p.actionQueueTab = 'all'; await p.render(s.panel); });
    report.layouts = [];
    for (let count = 1; count <= 3; count++) {
        if (count > 1) await run(async () => { const p = window.__freelanceOs; await p.openCollection(p.collectionGuid('Invoices'), p.ui.getPanels().at(-1)); });
        const measure = await run(() => { const app = window.__freelanceOsTestSession.panel.getElement().querySelector('.os-app'); const rect = app.getBoundingClientRect(); return { width: Math.round(rect.width), overflow: [...app.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > rect.right + 1).map(e => e.className).slice(0, 8) }; });
        assert.deepEqual(measure.overflow, []); report.layouts.push(measure);
        await page.screenshot({ path: path.join(output, `workflow-${count}-panels.png`) });
    }
} finally {
    try {
        if (initialized) report.cleanup = await guardedEvaluate(page, async token => {
            const p = window.__freelanceOs, s = window.__freelanceOsTestSession; const failures = [];
            if (!s || s.token !== token) return { skippedUnownedSession: true, failures: [] };
            // Continue through independent cleanup failures; never skip restoring local state.
            for (const ref of s.headings) {
                try {
                    const record = p.data.getRecord(ref.recordGuid) || ref.record;
                    const lines = await record.getLineItems(false), ids = new Set([ref.headingGuid]); let previous;
                    do { previous = ids.size; for (const l of lines) if (ids.has(l.parent_guid)) ids.add(l.guid); } while (ids.size !== previous);
                    for (const l of [...lines].reverse()) if (ids.has(l.guid) && await l.delete() === false) throw new Error(`Could not remove fixture line ${l.guid}`);
                    if ((await record.getLineItems(false)).some(l => ids.has(l.guid))) throw new Error('Fixture review remained after cleanup');
                } catch (error) { failures.push(error.message); }
            }
            for (const guid of s.records.reverse()) { try { p.data.getRecord(guid)?.trash(); } catch (error) { failures.push(error.message); } }
            p.applyNativeReconciliation = s.methods.applyNativeReconciliation; p.saveReviewSnapshot = s.methods.saveReviewSnapshot; p.writeReviewBody = s.methods.writeReviewBody;
            clearTimeout(p.refreshTimer); p.workflowRefreshPending = false;
            p.workflowState = JSON.parse(s.state);
            const adapter = p.workflowStorageAdapter(); adapter.write(s.raw);
            Object.assign(p, s.ui);
            for (const panel of p.ui.getPanels()) if (!s.panels.includes(panel.getId())) p.ui.closePanel(panel);
            p.activePanel = s.panel;
            for (const baseline of s.baseline) {
                const record = p.data.getRecord(baseline.recordGuid) || baseline.record;
                if (!record) { failures.push('Existing record disappeared'); continue; }
                const actual = JSON.stringify((await record.getLineItems(false)).map(l => ({ guid: l.guid, parent_guid: l.parent_guid, segments: l.segments, props: l.props })).sort((a, b) => a.guid.localeCompare(b.guid)));
                if (actual !== baseline.lines) failures.push(`Existing record changed: ${baseline.recordGuid}`);
            }
            const rawRestored = adapter.read() === s.raw;
            if (!rawRestored) failures.push('Raw local state was not restored');
            const result = { ownedRecords: s.records.length, ownedReviewSections: s.headings.length, rawStateRestored: rawRestored, unrelatedRecordsUnchanged: !failures.length, failures };
            if (s.ui.workflowMode === 'overview' && s.panel) await p.render(s.panel);
            if (!failures.length) delete window.__freelanceOsTestSession;
            return result;
        }, sessionToken);
        if (report.cleanup) assert.deepEqual(report.cleanup.failures, []);
    } finally {
        await cdp?.send('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {});
        await browser.disconnect();
        console.log(JSON.stringify(report, null, 2));
    }
}
