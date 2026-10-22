import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/workflow.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const runtime = { AppPlugin: class {}, Date, Map, Set, console };
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; Object.assign(Plugin.prototype, Workflow); ({ Plugin, actionModel, workflowDefaults, projectRoot, taskDateSegments, reviewWeek, weeklyReviewText, filterActions });`, runtime);
const project = { guid: 'project', name: 'Example project', status: 'in_progress', deadline: '' };
const task = (guid, props = {}) => ({ guid, projectGuid: 'project', projectName: 'Example project', text: guid, status: 'none', date: '', ...props });

test('nested pages resolve to their project and cycles do not loop', () => {
    const map = new Map([['project', project], ['child', { parentGuid: 'project' }], ['grandchild', { parentGuid: 'child' }]]);
    assert.equal(api.projectRoot('grandchild', map), 'project');
    map.set('child', { parentGuid: 'grandchild' });
    assert.equal(api.projectRoot('child', map), '');
});

test('queue excludes terminal projects, done and blocked tasks from action and focus lists', () => {
    const state = api.workflowDefaults(); state.next.project = 'ready'; state.focus['2026-10-22'] = ['ready', 'wait', 'done'];
    const result = api.actionModel([project, { guid: 'closed', status: 'completed' }], [task('ready'), task('wait', { status: 'blocked' }), task('done', { status: 'done' }), task('old', { projectGuid: 'closed' })], state, '2026-10-22');
    assert.deepEqual(Array.from(result.focus, item => item.guid), ['ready']);
    assert.equal(result.waiting.length, 1); assert.equal(result.actions.length, 1); assert.equal(result.attention.length, 0);
    assert.equal(api.actionModel([project], [task('ready')], state, '2026-10-23').focus.length, 0);
});

test('missing next action and overdue project deadlines are explicit, incomplete scans do not invent gaps', () => {
    const state = api.workflowDefaults();
    assert.equal(api.actionModel([project], [], state, '2026-10-22').attention[0].issues[0], 'Add a next action');
    assert.equal(api.actionModel([project], [], state, '2026-10-22', false).attention.length, 0);
    assert.equal(api.actionModel([{ ...project, deadline: '2026-10-21' }], [], state, '2026-10-22').attention[0].issues.includes('Project deadline overdue'), true);
});

test('rescheduling retains links, formatting and additional date segments', () => {
    const segments = [{ type: 'text', text: 'Review ' }, { type: 'ref', text: { guid: 'project' } }, { type: 'datetime', text: '2026-10-01' }, { type: 'datetime', text: '2026-11-01' }];
    const next = api.taskDateSegments(segments, '2026-10-25');
    assert.equal(next[1].text.guid, 'project'); assert.equal(next[2].text, '2026-10-25'); assert.equal(next[3].text, '2026-11-01');
    assert.equal(segments[2].text, '2026-10-01');
    assert.equal(api.taskDateSegments(segments, '').length, 3);
});

test('review week rolls over correctly at a year boundary', () => {
    assert.equal(api.reviewWeek('2027-01-01'), '2026-12-28');
    assert.equal(api.reviewWeek('2026-10-25'), '2026-10-19');
});

test('failed native task mutation rejects instead of claiming success', async () => {
    const plugin = new api.Plugin();
    await assert.rejects(plugin.setActionStatus({ lineItem: { setTaskStatus: async () => false } }, 'done'));
    await assert.rejects(plugin.rescheduleAction({ lineItem: { segments: [], setSegments: async () => false } }, '2026-10-25'));
});

test('blocked terminology maps to the SDK waiting state', async () => {
    const plugin = new api.Plugin(); let native;
    await plugin.setActionStatus({ lineItem: { setTaskStatus: async status => { native = status; return true; } } }, 'blocked');
    assert.equal(native, 'waiting');
});

test('workspace mapping supports renamed collections and native board routing', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults();
    plugin.workflowState.mappings.Projects = 'custom-projects';
    plugin.workflowCollections = [{ getGuid: () => 'custom-projects', getName: () => 'Work' }];
    assert.equal(plugin.collectionGuid('Projects'), 'custom-projects');
    let navigation;
    plugin.getWorkspaceGuid = () => 'workspace';
    plugin.data = { getPluginByGuid: () => ({ getConfiguration: () => ({ name: 'Work', views: [{ id: 'work-board', label: 'Board' }] }) }) };
    plugin.ui = { createPanel: async () => ({ navigateTo: value => { navigation = value; } }) };
    await plugin.openCollection('custom-projects', {}, 'board');
    assert.equal(navigation.subId, 'work-board');
});

test('fresh workspaces resolve their own collections and ignore stale mappings', () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults();
    plugin.workflowState.mappings.Projects = 'removed-projects';
    plugin.workflowCollections = [
        { getGuid: () => 'fresh-projects', getName: () => 'Projects' },
        { getGuid: () => 'fresh-journal', getName: () => 'Daily notes', isJournalPlugin: () => true }
    ];
    assert.equal(plugin.collectionGuid('Projects'), 'fresh-projects');
    assert.equal(plugin.collectionGuid('Journal'), 'fresh-journal');
    assert.equal(plugin.collectionGuid('Invoices'), '');
});

test('task navigation falls back to a real record panel when item navigation is unsupported', async () => {
    const plugin = new api.Plugin(); let final;
    plugin.getWorkspaceGuid = () => 'workspace';
    plugin.ui = { createPanel: async () => ({ navigateTo: async value => { if (value.itemGuid) return false; final = value; } }) };
    await plugin.openItem('task', 'record', {});
    assert.equal(final.type, 'edit_panel'); assert.equal(final.rootId, 'record'); assert.equal(final.itemGuid, undefined);
});

test('SDK rescheduling passes a structured date instead of a discarded string', async () => {
    const plugin = new api.Plugin(); let stored;
    await plugin.rescheduleAction({ lineItem: { segments: [{ type: 'ref', text: { guid: 'project' } }], setSegments: async value => { stored = value; return true; } } }, '2030-06-15');
    assert.equal(stored[1].text.d, '20300615'); assert.equal(stored[0].text.guid, 'project');
});

test('queue search combines project scope with task and project text', () => {
    const tasks = [task('proposal', { text: 'Send proposal' }), task('other', { projectGuid: 'other', text: 'Send proposal' })];
    assert.equal(api.filterActions(tasks, 'PROPOSAL', 'project').length, 1);
    assert.equal(api.filterActions(tasks, 'Example project').length, 2);
    assert.equal(api.filterActions(tasks, 'missing').length, 0);
});

test('waiting follow-ups due today raise a project attention signal', () => {
    const state = api.workflowDefaults(); state.waiting.wait = { followup: '2026-10-22' };
    const result = api.actionModel([project], [task('wait', { status: 'waiting' })], state, '2026-10-22');
    assert.equal(result.attention[0].issues.includes('Follow-up due'), true);
});

test('weekly review uses observed signals and preserves the written plan', () => {
    const state = api.workflowDefaults(); const model = api.actionModel([project], [], state, '2026-10-22');
    const text = api.weeklyReviewText({ model, recentDone: [] }, { notes: 'Shipped a milestone', priorities: 'Finish onboarding' }, state, '2026-10-22');
    assert.match(text, /Next action still to choose/); assert.match(text, /Finish onboarding/);
});

test('weekly review updates the same Journal entry when saved on another day', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults(); plugin.setLocalStorage = () => {};
    const records = new Map(); let day = 0; let created = 0;
    const makeRecord = guid => {
        const lines = [];
        const record = { guid, getLineItems: async () => lines, createLineItem: async (parent, after, type, segments) => {
            const line = { guid: `line-${++created}`, segments, getChildren: async () => lines.filter(item => item.parent === line), setSegments: async value => { line.segments = value; return true; }, parent };
            lines.push(line); return line;
        } }; records.set(guid, record); return record;
    };
    const journal = { getGuid: () => 'journal', getName: () => 'Journal', isJournalPlugin: () => true, getJournalRecord: async () => records.get(`day${day}`) || makeRecord(`day${day}`) };
    plugin.workflowState.mappings.Journal = 'journal';
    plugin.data = { getAllCollections: async () => [journal], getActiveUsers: () => [{}], getRecord: guid => records.get(guid) };
    const workflow = { model: api.actionModel([], [], plugin.workflowState, '2026-10-22'), recentDone: [] };
    const first = await plugin.saveReviewToJournal(workflow, { notes: 'First' }, '2026-10-22');
    const firstCount = created;
    day = 1;
    const second = await plugin.saveReviewToJournal(workflow, { notes: 'Updated' }, '2026-10-23');
    assert.equal(first.headingGuid, second.headingGuid);
    assert.equal(created, firstCount);
});

test('virtual Journal pages are reopened on their original date when no ordinary record exists', async () => {
    runtime.DateTime = {dateOnly:(year,month,day)=>({year,month,day})};
    const plugin = new api.Plugin(); let requested;
    const record = {guid:'virtual-journal'};
    const journal = {getGuid:()=> 'journal',isJournalPlugin:()=>true,getJournalRecord:async(user,date)=>{requested={user,date};return record;}};
    plugin.data = {getAllCollections:async()=>[journal],getActiveUsers:()=>[{guid:'author'}],getRecord:()=>null};
    assert.equal(await plugin.getReviewRecord({journalGuid:'journal',userGuid:'author',recordGuid:'virtual-journal',journalDate:'2026-10-22',savedAt:'2026-10-24T12:00:00Z'}),record);
    assert.equal(requested.user.guid,'author');assert.equal(requested.date.year,2026);assert.equal(requested.date.month,9);assert.equal(requested.date.day,22);
    delete runtime.DateTime;
});
