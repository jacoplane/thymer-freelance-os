import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/support-time.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../src/workflow.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const runtime = { AppPlugin: class {}, Date, Map, Set, console };
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; Object.assign(Plugin.prototype, Workflow); ({ Plugin, actionModel, reconcileWorkflowPointers, reconcileNativeNextActions, workflowDefaults, projectRoot, taskDateSegments, reviewWeek, weeklyReviewText, weeklyPriorityLines, reviewPriorityKey, reviewPriorityIdKey, reconcileReviewPriorityItems, filterActions, summarizeSupportTime });`, runtime);
const project = { guid: 'project', name: 'Example project', status: 'in_progress', deadline: '' };
const task = (guid, props = {}) => ({ guid, projectGuid: 'project', projectName: 'Example project', text: guid, status: 'none', date: '', ...props });

test('support time totals only valid sessions in the current month and compares active client allowances', () => {
    const now = new Date('2026-10-23T12:00:00');
    const clients = [{guid:'AAAAAAAAAAAAAAAAAAAAAAAAAA',name:'Studio',status:'active',includedHours:2},{guid:'BBBBBBBBBBBBBBBBBBBBBBBBBB',name:'Archive',status:'archived',includedHours:5}];
    const record = (name,date,hours,client) => ({guid:name,name,getName:()=>name,prop:key=>key==='date'?{date:()=>date}:key==='hours'?{number:()=>hours}:key==='description'?{text:()=>''}:null,linkedRecord:key=>key==='client'?{guid:client}:null});
    const summary = api.summarizeSupportTime(clients,[record('Current','2026-10-20',1.5,'AAAAAAAAAAAAAAAAAAAAAAAAAA'),record('Earlier','2026-09-30',2,'AAAAAAAAAAAAAAAAAAAAAAAAAA'),record('Other','2026-10-21',0,'AAAAAAAAAAAAAAAAAAAAAAAAAA')],now);
    assert.equal(summary.hours,1.5); assert.equal(summary.allowance,2); assert.equal(summary.sessions.length,1);
    assert.equal(summary.clients[0].logged,1.5); assert.equal(summary.month,'2026-10');
});

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
    assert.equal(result.waiting.length, 1); assert.equal(result.actions.length, 1); assert.equal(result.attention.length, 1);
    assert.ok(result.attention[0].issues.includes('1 waiting task'));
    assert.equal(api.actionModel([project], [task('ready')], state, '2026-10-23').focus.length, 0);
});

test('client review checkpoints surface overdue, due-soon and missing-date cues', () => {
    const state = api.workflowDefaults();
    const tasks = [
        task('review-overdue', { clientReview: true, date: '2026-10-20' }),
        task('review-soon', { clientReview: true, date: '2026-10-28' }),
        task('review-undated', { clientReview: true })
    ];
    const result = api.actionModel([project], tasks, state, '2026-10-24');
    assert.deepEqual(Array.from(result.attention[0].issues), ['Choose a next action', '1 client review overdue', '1 client review due in 7 days', '1 client review missing a date']);
    assert.equal(result.attention[0].clientReviewTasks.length, 3);
});

test('workflow cleanup removes completed, waiting, missing and cross-project pointers', () => {
    const state = api.workflowDefaults();
    state.next.project = 'done'; state.next.other = 'ready'; state.next.missing = 'deleted';
    state.focus['2026-10-22'] = ['ready', 'done', 'wait', 'deleted'];
    state.focus['2026-10-21'] = ['deleted'];
    const model = api.actionModel([project], [task('ready'), task('wait', { status: 'waiting' }), task('done', { status: 'done' })], state, '2026-10-22');
    assert.equal(api.reconcileWorkflowPointers(state, model), true);
    assert.deepEqual(Object.keys(state.next), []);
    assert.deepEqual(Array.from(state.focus['2026-10-22']), ['ready']);
    assert.equal(state.focus['2026-10-21'], undefined);
});

test('workflow cleanup refreshes the saved next-action label from the task', () => {
    const state = api.workflowDefaults(); state.next.project = 'ready'; state.nextLabels.project = 'Old task title';
    const model = api.actionModel([project], [task('ready', { text: 'Current task title' })], state, '2026-10-22');
    assert.equal(api.reconcileWorkflowPointers(state, model), true);
    assert.equal(state.nextLabels.project, 'Current task title');
});

test('a completed or removed next action leaves a clear recovery reason', () => {
    const state = api.workflowDefaults(); state.next.project = 'done'; state.nextLabels.project = 'Finish the draft';
    const model = api.actionModel([project], [], state, '2026-10-22');
    api.reconcileWorkflowPointers(state, model, [task('done', { text: 'Finish the draft', status: 'done' })]);
    assert.equal(state.nextRecovery.project.reason, 'completed'); assert.equal(state.nextRecovery.project.label, 'Finish the draft');
    const removedState = api.workflowDefaults(); removedState.next.project = 'missing'; removedState.nextLabels.project = 'Deleted action';
    api.reconcileWorkflowPointers(removedState, api.actionModel([project], [], removedState, '2026-10-22'), []);
    assert.equal(removedState.nextRecovery.project.reason, 'removed'); assert.equal(removedState.nextRecovery.project.label, 'Deleted action');
});

test('incomplete workflow scans preserve pointers until task data is reliable', () => {
    const state = api.workflowDefaults(); state.next.project = 'not-yet-loaded'; state.focus.today = ['not-yet-loaded'];
    const model = api.actionModel([project], [], state, '2026-10-22', false);
    assert.equal(api.reconcileWorkflowPointers(state, model), false);
    assert.equal(state.next.project, 'not-yet-loaded');
    assert.deepEqual(state.focus.today, ['not-yet-loaded']);
});

test('native project next-action references take precedence and refresh their labels', () => {
    const state = api.workflowDefaults(); state.next.project = 'old'; state.nextLabels.project = 'Old local choice';
    const marker = { recordGuid: 'project', segments: [{ type: 'ref', text: { guid: 'ready' } }] };
    const result = api.reconcileNativeNextActions(state, [project], [task('ready', { text: 'Native project choice' })], [marker]);
    assert.equal(state.next.project, 'ready'); assert.equal(state.nextLabels.project, 'Native project choice');
    assert.equal(result.write[0].task.guid, 'ready'); assert.deepEqual(Array.from(result.remove), []);
});

test('legacy local next actions are queued for native backfill and stale native references are removed', () => {
    const state = api.workflowDefaults(); state.next.project = 'ready'; state.nextLabels.project = 'Ready';
    const markers = [{ recordGuid: 'project', segments: [{ type: 'ref', text: { guid: 'finished' } }] }];
    const result = api.reconcileNativeNextActions(state, [project], [task('ready'), task('finished', { status: 'done' })], markers);
    assert.equal(state.next.project, undefined); assert.equal(state.nextLabels.project, undefined);
    assert.equal(result.write.length, 0); assert.equal(result.remove[0], markers[0]);
    const legacy = api.workflowDefaults(); legacy.next.project = 'ready';
    const backfill = api.reconcileNativeNextActions(legacy, [project], [task('ready')], []);
    assert.equal(backfill.write[0].task.guid, 'ready');
});

test('incomplete task scans preserve both native references and local selections', () => {
    const state = api.workflowDefaults(); state.next.project = 'local';
    const marker = { recordGuid: 'project', segments: [{ type: 'ref', text: { guid: 'native' } }] };
    const result = api.reconcileNativeNextActions(state, [project], [], [marker], false);
    assert.equal(state.next.project, 'local'); assert.equal(result.remove.length, 0); assert.equal(result.write.length, 0);
});

test('closed projects do not regain local action pointers from a retained page reference', () => {
    const state = api.workflowDefaults(); state.next.closed = 'ready'; state.nextLabels.closed = 'Ready';
    const closed = { ...project, guid: 'closed', status: 'completed' };
    const marker = { recordGuid: 'closed', segments: [{ type: 'ref', text: { guid: 'ready', title: 'Ready' } }] };
    const result = api.reconcileNativeNextActions(state, [closed], [task('ready', { projectGuid: 'closed' })], [marker]);
    assert.equal(state.next.closed, undefined); assert.equal(state.nextLabels.closed, undefined);
    assert.equal(result.remove.length, 0); assert.equal(result.write.length, 0);
});

test('native project reference is replaced and cleared without touching project content', async () => {
    const section = { guid: 'section', type: 'heading', parent_guid: 'project', segments: [{ type: 'text', text: 'Next actions' }], props: {} };
    const userTask = { guid: 'user-task', type: 'task', parent_guid: 'section', segments: [{ type: 'text', text: 'User-authored task' }], props: {} };
    const lines = [section, userTask]; let nextId = 0;
    const record = {
        guid: 'project',
        getLineItems: async () => lines,
        createLineItem: async (parent, after, type, segments, props) => {
            const line = {
                guid: `created-${++nextId}`, type, parent_guid: parent?.guid || 'project', segments, props,
                setSegments: async value => { line.segments = value; return true; },
                delete: async () => { const index = lines.indexOf(line); if (index >= 0) lines.splice(index, 1); return true; }
            };
            lines.push(line); return line;
        }
    };
    const plugin = new api.Plugin();
    await plugin.writeNativeNextAction(record, task('first'));
    let markers = lines.filter(line => line.props?.freelance_os_next_action === 'project-next-v1');
    assert.equal(markers.length, 1); assert.equal(markers[0].segments[1].text.guid, 'first'); assert.equal(markers[0].segments[1].text.title, 'first');
    await plugin.writeNativeNextAction(record, task('second'));
    markers = lines.filter(line => line.props?.freelance_os_next_action === 'project-next-v1');
    assert.equal(markers.length, 1); assert.equal(markers[0].segments[1].text.guid, 'second'); assert.equal(markers[0].segments[1].text.title, 'second');
    await plugin.writeNativeNextAction(record, null);
    assert.equal(lines.some(line => line.props?.freelance_os_next_action === 'project-next-v1'), false);
    assert.ok(lines.includes(userTask)); assert.equal(userTask.segments[0].text, 'User-authored task');
});

test('projects without a next-actions section get it beneath the project title', async () => {
    const title = { guid: 'title', type: 'heading', parent_guid: 'project', segments: [{ type: 'text', text: 'Project title' }], props: { hsize: 1 } };
    const existing = { guid: 'existing', type: 'heading', parent_guid: 'title', segments: [{ type: 'text', text: 'Project brief' }], props: { hsize: 2 } };
    const lines = [title, existing]; let nextId = 0;
    const record = {
        guid: 'project', getLineItems: async () => lines,
        createLineItem: async (parent, after, type, segments, props) => {
            const line = { guid: `created-${++nextId}`, type, parent_guid: parent?.guid || 'project', segments, props, setSegments: async value => { line.segments = value; return true; } };
            lines.push(line); return line;
        }
    };
    const plugin = new api.Plugin();
    await plugin.writeNativeNextAction(record, task('linked-task'));
    const section = lines.find(line => line.props?.freelance_os_next_action === 'section-v1');
    const marker = lines.find(line => line.props?.freelance_os_next_action === 'project-next-v1');
    assert.equal(section.parent_guid, title.guid); assert.equal(marker.parent_guid, section.guid);
    assert.equal(lines.includes(existing), true);
});

test('clearing a pointer keeps user content and prunes only an empty generated section', async () => {
    const section = { guid: 'generated', type: 'heading', parent_guid: 'title', segments: [], props: { freelance_os_next_action: 'section-v1' }, delete: async () => { const i = lines.indexOf(section); if (i >= 0) lines.splice(i, 1); return true; } };
    const userLine = { guid: 'user', type: 'text', parent_guid: 'generated', segments: [{ type: 'text', text: 'Keep this note' }], props: {} };
    const marker = { guid: 'marker', type: 'text', parent_guid: 'generated', segments: [{ type: 'text', text: 'Next action: ' }, { type: 'ref', text: { guid: 'ready' } }], props: { freelance_os_next_action: 'project-next-v1' }, delete: async () => { const i = lines.indexOf(marker); if (i >= 0) lines.splice(i, 1); return true; } };
    const lines = [section, userLine, marker]; const record = { getLineItems: async () => lines };
    const plugin = new api.Plugin();
    await plugin.writeNativeNextAction(record, null);
    assert.ok(lines.includes(section)); assert.ok(lines.includes(userLine)); assert.equal(lines.includes(marker), false);
    lines.splice(lines.indexOf(userLine), 1);
    await plugin.writeNativeNextAction(record, null);
    assert.equal(lines.includes(section), false);
});

test('missing next action and overdue project deadlines are explicit, incomplete scans do not invent gaps', () => {
    const state = api.workflowDefaults();
    assert.equal(api.actionModel([project], [], state, '2026-10-22').attention[0].issues[0], 'Add a next action');
    assert.equal(api.actionModel([project], [], state, '2026-10-22', false).attention.length, 0);
    assert.equal(api.actionModel([{ ...project, deadline: '2026-10-21' }], [], state, '2026-10-22').attention[0].issues.includes('Project deadline overdue'), true);
    state.next.project = 'ready';
    const selected = api.actionModel([{ ...project, deadline: '2026-10-21' }], [task('ready')], state, '2026-10-22');
    assert.equal(selected.attention[0].next.guid, 'ready');
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
    assert.equal(result.attention[0].issues.includes('1 follow-up due'), true);
    assert.equal(result.attention[0].waitingTasks.length, 1);
});

test('weekly review uses observed signals and preserves the written plan', () => {
    const state = api.workflowDefaults(); const model = api.actionModel([project], [], state, '2026-10-22');
    const text = api.weeklyReviewText({ model, recentDone: [] }, { notes: 'Shipped a milestone', priorities: 'Finish onboarding' }, state, '2026-10-22');
    assert.match(text, /Next action still to choose/); assert.match(text, /Finish onboarding/);
});

test('weekly priorities split into non-empty lines and use stable case-insensitive keys', () => {
    assert.deepEqual(Array.from(api.weeklyPriorityLines('  Ship the draft\n\n  Ask for feedback  '), item => item.text), ['Ship the draft', 'Ask for feedback']);
    assert.equal(api.reviewPriorityKey('2026-10-19', ' Ship the draft '), api.reviewPriorityKey('2026-10-19', 'SHIP THE DRAFT'));
});

test('weekly priority identity survives wording edits and reordering', () => {
    const draft = { priorities: 'Finish proposal\nRequest feedback' };
    api.reconcileReviewPriorityItems(draft, draft.priorities);
    draft.priorityItems[0].taskGuid = 'proposal-task';
    draft.priorityItems[1].taskGuid = 'feedback-task';
    const ids = Object.fromEntries(draft.priorityItems.map(item => [item.text, item.id]));
    api.reconcileReviewPriorityItems(draft, 'Finish the proposal\nRequest feedback');
    assert.equal(draft.priorityItems[0].id, ids['Finish proposal']);
    assert.equal(draft.priorityItems[0].taskGuid, 'proposal-task');
    api.reconcileReviewPriorityItems(draft, 'Request feedback\nFinish the proposal');
    assert.equal(draft.priorityItems[0].id, ids['Request feedback']);
    assert.equal(draft.priorityItems[0].taskGuid, 'feedback-task');
    assert.equal(draft.priorityItems[1].id, ids['Finish proposal']);
    assert.equal(draft.priorityItems[1].taskGuid, 'proposal-task');
});

test('weekly priority creates one native project task and retries do not duplicate it', async () => {
    const plugin = new api.Plugin();
    const created = [];
    const projectRecord = { guid: 'project', createLineItem: async (parent, after, type, segments, props) => {
        const line = { guid: `task-${created.length + 1}`, type, segments, props, getTaskStatus: () => 'none' };
        created.push(line); return line;
    } };
    const workflow = { projects: [{ guid: 'project', name: 'Example project', status: 'in_progress', record: projectRecord }], tasks: [], model: { active: [] } };
    const first = await plugin.addReviewPriorityTask(workflow, '2026-10-19', 'Ship the draft', 'project');
    workflow.tasks.push(first.task);
    const retry = await plugin.addReviewPriorityTask(workflow, '2026-10-19', ' Ship the draft ', 'project');
    assert.equal(first.existing, false);
    assert.equal(retry.existing, true);
    assert.equal(retry.task.guid, first.task.guid);
    assert.equal(created.length, 1);
    assert.equal(created[0].type, 'task');
    assert.equal(created[0].segments[0].text, 'Ship the draft');
    assert.equal(created[0].props.freelance_os_review_priority, '2026-10-19|ship the draft');
});

test('weekly priority can link an existing native task and keeps its identity stable', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults(); plugin.setLocalStorage = () => {};
    const properties = {};
    const existing = { guid: 'existing-task', text: 'Review the proposal', status: 'none', projectGuid: 'project', projectName: 'Example project', lineItem: { props: properties, setMetaProperties: async update => { Object.assign(properties, update); return true; } } };
    const workflow = { projects: [{ guid: 'project', name: 'Example project', status: 'in_progress' }], tasks: [existing] };
    const entry = { id: 'priority-1', text: 'Finish the proposal' };
    const linked = await plugin.linkReviewPriorityTask(workflow, '2026-10-19', entry, existing.guid);
    assert.equal(linked, existing);
    assert.equal(entry.taskGuid, existing.guid);
    assert.equal(properties.freelance_os_review_priority, api.reviewPriorityIdKey('2026-10-19', entry.id));
});

test('weekly priority refuses inactive or unknown projects before creating a task', async () => {
    const plugin = new api.Plugin(); let created = false;
    const workflow = { projects: [{ guid: 'closed', status: 'completed', record: { createLineItem: async () => { created = true; } } }], tasks: [] };
    await assert.rejects(plugin.addReviewPriorityTask(workflow, '2026-10-19', 'Ship the draft', 'closed'), /Choose an active project/);
    await assert.rejects(plugin.addReviewPriorityTask(workflow, '2026-10-19', 'Ship the draft', 'missing'), /Choose an active project/);
    assert.equal(created, false);
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

test('saved Journal priorities link to project tasks that came from the review', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults(); plugin.setLocalStorage = () => {};
    let created = 0; const lines = [];
    const record = { guid: 'journal-day', getLineItems: async () => lines, createLineItem: async (parent, after, type, segments) => {
        const line = { guid: `journal-${++created}`, type, segments, parent, getChildren: async () => lines.filter(item => item.parent === line), setSegments: async value => { line.segments = value; return true; } };
        lines.push(line); return line;
    } };
    const journal = { getGuid: () => 'journal', getName: () => 'Journal', isJournalPlugin: () => true, getJournalRecord: async () => record };
    plugin.data = { getAllCollections: async () => [journal], getActiveUsers: () => [{ guid: 'user' }], getRecord: () => null };
    const key = api.reviewPriorityKey('2026-10-19', 'Ship the draft');
    const taskLine = { guid: 'project-task', props: { freelance_os_review_priority: key } };
    const workflow = { model: api.actionModel([], [], plugin.workflowState, '2026-10-22'), recentDone: [], tasks: [{ guid: taskLine.guid, text: 'Ship the draft', lineItem: taskLine }] };
    await plugin.saveReviewToJournal(workflow, { notes: '', priorities: 'Ship the draft\nAsk for feedback' }, '2026-10-22');
    const linked = lines.find(line => line.segments?.some(segment => segment.type === 'ref' && segment.text?.guid === 'project-task'));
    const plain = lines.find(line => line.segments?.some(segment => segment.type === 'text' && segment.text === 'Ask for feedback'));
    assert.ok(linked, 'converted priority is a native reference in Journal');
    assert.equal(linked.segments[0].text.title, 'Ship the draft');
    assert.ok(plain, 'unconverted priority remains readable text');
});

test('a linked priority keeps its task reference when edited and a saved review is reopened', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults(); plugin.setLocalStorage = () => {};
    const lines = []; let sequence = 0;
    const record = { guid: 'journal-day', getLineItems: async () => lines, createLineItem: async (parent, after, type, segments) => {
        const line = { guid: `journal-${++sequence}`, type, segments, parent, parent_guid: parent?.guid || 'journal-day', getChildren: async () => lines.filter(item => item.parent === line), setSegments: async value => { line.segments = value; return true; } };
        lines.push(line); return line;
    } };
    const journal = { getGuid: () => 'journal', isJournalPlugin: () => true, getJournalRecord: async () => record };
    plugin.data = { getAllCollections: async () => [journal], getActiveUsers: () => [{ guid: 'user' }], getRecord: () => record };
    const week = api.reviewWeek('2098-10-20'); const id = 'priority-stable'; const properties = { freelance_os_review_priority: api.reviewPriorityIdKey(week, id) };
    const taskLine = { guid: 'project-task', props: properties, setMetaProperties: async update => { Object.assign(properties, update); return true; } };
    const workflow = { model: api.actionModel([], [], plugin.workflowState, '2098-10-20'), recentDone: [], tasks: [{ guid: 'project-task', text: 'Deliver approved draft', lineItem: taskLine, projectName: 'Example project' }] };
    const draft = { notes: 'A clear outcome', priorities: 'Deliver first draft', priorityItems: [{ id, text: 'Deliver first draft', taskGuid: 'project-task' }] };
    const first = await plugin.saveReviewToJournal(workflow, draft, '2098-10-20');
    const reopened = JSON.parse(JSON.stringify(draft));
    api.reconcileReviewPriorityItems(reopened, 'Send approved draft');
    assert.equal(reopened.priorityItems[0].id, id);
    assert.equal(reopened.priorityItems[0].taskGuid, 'project-task');
    const second = await plugin.saveReviewToJournal(workflow, reopened, '2098-10-21');
    const heading = lines.find(line => line.guid === second.headingGuid);
    const body = lines.find(line => line.parent === heading);
    const linked = lines.find(line => line.parent === body && line.segments?.some(segment => segment.type === 'ref' && segment.text?.guid === 'project-task'));
    assert.equal(first.headingGuid, second.headingGuid);
    assert.equal(linked.segments[0].text.title, 'Send approved draft');
    assert.equal(properties.freelance_os_review_priority, api.reviewPriorityIdKey(week, id));
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
