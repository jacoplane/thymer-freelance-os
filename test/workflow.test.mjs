import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/support-time.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../src/workflow.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const runtime = { AppPlugin: class {}, Date, Map, Set, console };
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; Object.assign(Plugin.prototype, Workflow); ({ Plugin, actionModel, startHereSuggestions, reconcileWorkflowPointers, reconcileNativeNextActions, workflowDefaults, projectRoot, taskDateSegments, reviewWeek, weeklyReviewText, weeklyPriorityLines, reviewPriorityKey, reviewPriorityIdKey, reconcileReviewPriorityItems, filterActions, summarizeSupportTime, normalizeWorkflowState, workflowStorageKey, resolveTaskProject, readWaitingDetails, validateWaitingInput, selectQueueItems, queuePresets, presetCompatible, waitingDetailsFor, cloneWorkflowState, isActionableTask, isWaitingTask, isTerminalTask, validDateValue, attentionSearchText, queueEmptyMessage, reviewTitle, weekDates, parseReviewSnapshot, reviewSnapshot, reviewPrioritySnapshot, journalDateTarget, previousReviewWeek, priorityTextSimilarity, reviewPriorityTask });`, runtime);
const project = { guid: 'project', name: 'Example project', status: 'in_progress', deadline: '' };
const task = (guid, props = {}) => ({ guid, projectGuid: 'project', projectName: 'Example project', text: guid, status: 'none', date: '', ...props });

test('reconciliation stops after an awaited read is superseded and keeps newer local pointers', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults();
    plugin.renderVersion = 1; plugin.workflowMutationVersion = 0;
    let release, started; const entered = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { release = resolve; }); let deleted = false;
    const segments = [{ type: 'ref', text: { guid: 'old-task' } }];
    const marker = { guid: 'marker', props: { freelance_os_next_action: 'project-next-v1' }, segments, delete: async () => { deleted = true; return true; } };
    const record = { getLineItems: async () => { started(); await gate; return [marker]; } };
    plugin.data = { getRecord: () => record };
    const pointerState = api.workflowDefaults(); pointerState.next.project = 'stale';
    const snapshot = { complete: true, pointerChanged: true, pointerState, expectedVersion: 1, mutationVersion: 0, byGuid: new Map(), nativeReconciliation: { remove: [{ recordGuid: 'project', line: marker, segments }], write: [] } };
    const applying = plugin.applyWorkflowSnapshot(snapshot); await entered;
    plugin.renderVersion = 2; plugin.workflowMutationVersion = 1;
    plugin.workflowState.next.project = 'newer'; release();
    assert.equal(await applying, false); assert.equal(snapshot.stale, true);
    assert.equal(deleted, false); assert.equal(plugin.workflowState.next.project, 'newer');
});

test('reconciliation preserves a reused marker when its reference changed on another client', async () => {
    const plugin = new api.Plugin(); plugin.renderVersion = 1; let deleted = false;
    const marker = { guid: 'marker', props: { freelance_os_next_action: 'project-next-v1' }, segments: [{ type: 'ref', text: { guid: 'new-task' } }], delete: async () => { deleted = true; return true; } };
    plugin.data = { getRecord: () => ({ getLineItems: async () => [marker] }) };
    const snapshot = { expectedVersion: 1, mutationVersion: 0, byGuid: new Map(), nativeReconciliation: { remove: [{ recordGuid: 'project', line: { guid: 'marker' }, segments: [{ type: 'ref', text: { guid: 'old-task' } }] }], write: [] } };
    assert.equal(await plugin.applyNativeReconciliation(snapshot), false);
    assert.equal(snapshot.stale, true); assert.equal(deleted, false);
});

test('background next-action writes do not overwrite a newly selected native marker', async () => {
    const plugin = new api.Plugin(); let changed = false;
    const marker = { guid: 'new-marker', props: { freelance_os_next_action: 'project-next-v1' }, segments: [{ type: 'ref', text: { guid: 'new-task' } }], setSegments: async () => { changed = true; return true; } };
    const record = { getLineItems: async () => [marker] };
    await assert.rejects(plugin.writeNativeNextAction(record, { guid: 'old-task', text: 'Old task' }, { expectedMarkers: [] }), error => error.code === 'STALE_WORKFLOW');
    assert.equal(changed, false);
});

test('reconciliation keeps an unchanged reference when its previously waiting task resumed', async () => {
    const plugin = new api.Plugin(); plugin.renderVersion = 1; let deleted = false;
    const segments = [{ type: 'ref', text: { guid: 'task' } }];
    const marker = { guid: 'marker', props: { freelance_os_next_action: 'project-next-v1' }, segments, delete: async () => { deleted = true; return true; } };
    const record = { guid: 'project', getLineItems: async () => [marker, { guid: 'task', getTaskStatus: () => 'none' }] };
    plugin.data = { getRecord: () => record };
    const snapshot = { expectedVersion: 1, tasks: [{ guid: 'task', status: 'waiting', recordGuid: 'project' }], byGuid: new Map([['project', { guid: 'project', parentGuid: '' }]]), nativeReconciliation: { remove: [{ recordGuid: 'project', line: marker, segments }], write: [] } };
    assert.equal(await plugin.applyNativeReconciliation(snapshot), false);
    assert.equal(deleted, false); assert.equal(snapshot.stale, true);
});

test('carried plain and linked priorities retain provenance and deduplication through storage reload', () => {
    for (const linked of [false, true]) {
        const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults(); let stored = '';
        plugin.setLocalStorage = (key, value) => { stored = value; return true; }; plugin.getLocalStorage = () => stored;
        const week = '2026-10-19', context = { week: '2026-10-12' };
        const item = { entry: { id: 'origin', text: 'Ship proposal' }, resolution: linked ? { kind: 'open', taskGuid: 'task', recordGuid: 'record', projectGuid: 'project' } : { kind: 'plain' } };
        plugin.carryPreviousPriority(context, item, null, week); plugin.workflowState = null;
        const reloaded = plugin.loadWorkflowState().drafts[week].priorityItems[0];
        assert.equal(reloaded.carriedFrom.week, context.week); assert.equal(reloaded.carriedFrom.priorityId, 'origin');
        plugin.carryPreviousPriority(context, item, null, week);
        assert.equal(plugin.workflowState.drafts[week].priorityItems.length, 1);
        if (linked) assert.equal(reloaded.taskGuid, 'task');
    }
    const state = api.normalizeWorkflowState({ drafts: { '2026-10-19': { notes: 'Keep', priorityItems: [{ id: 'p', text: 'Keep', carriedFrom: { week: 'bad', priorityId: 7 } }] } } });
    assert.equal(state.drafts['2026-10-19'].notes, 'Keep'); assert.equal(state.drafts['2026-10-19'].priorityItems[0].carriedFrom, undefined);
});

test('waiting save failures keep editor drafts and a successful retry clears only the saved values', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults();
    let fail = true, status = 'important', writes = 0;
    const item = { guid: 'waiting-task', status, lineItem: { props: {}, setMetaProperties: async () => { if (fail) return false; writes++; return true; }, setTaskStatus: async next => { status = next; return true; } } };
    const values = { reason: 'Approval needed', followup: '2026-10-28' };
    await assert.rejects(plugin.saveWaiting(item, values), /status was not changed/);
    assert.equal(status, 'important'); assert.equal(plugin.waitingEditorDrafts[item.guid].reason, values.reason);
    assert.equal(plugin.waitingEditorDrafts[item.guid].followup, values.followup);
    fail = false; await plugin.saveWaiting(item, values);
    assert.equal(status, 'waiting'); assert.equal(writes, 1); assert.equal(plugin.waitingEditorDrafts[item.guid], undefined);
    plugin.rememberWaitingEditor(item.guid, { ...values, reason: 'Newer edit' });
    plugin.clearWaitingEditor(item.guid, values);
    assert.equal(plugin.waitingEditorDrafts[item.guid].reason, 'Newer edit');
});

test('review saves preserve native origin metadata when the loaded task wrapper is stale', async () => {
    const plugin = new api.Plugin(); let writes = 0;
    const fresh = { guid: 'task', props: { freelance_os_review_priority: '2026-10-12|id:original' }, setMetaProperties: async () => { writes++; return true; } };
    plugin.data = { getRecord: () => ({ getLineItems: async () => [fresh] }) };
    const item = { guid: 'task', recordGuid: 'record', lineItem: { props: {}, setMetaProperties: async () => { writes++; return true; } } };
    assert.equal(await plugin.ensureReviewPriorityMarker(item, '2026-10-19', { id: 'later' }, { require: true }), true);
    assert.equal(writes, 0); assert.equal(item.lineItem.props.freelance_os_review_priority, '2026-10-12|id:original');
});

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

test('Start Here puts immediate urgency before project priority and explains each suggestion', () => {
    const state = api.workflowDefaults(); state.focus['2026-10-24'] = ['already-focused'];
    state.next.low = 'overdue'; state.next.high = 'high-future';
    const projects = [
        { guid: 'low', priority: 'medium' },
        { guid: 'high', priority: 'high', deadline: '2026-10-29' }
    ];
    const actions = [
        task('high-future', { projectGuid: 'high', date: '2026-10-27' }),
        task('today', { projectGuid: 'high', date: '2026-10-24' }),
        task('overdue', { projectGuid: 'low', date: '2026-10-22' }),
        task('due-soon', { projectGuid: 'low', date: '2026-10-25' }),
        task('important', { projectGuid: 'low', status: 'important' }),
        task('already-focused', { projectGuid: 'high' })
    ];
    const suggestions = api.startHereSuggestions(actions, projects, state, '2026-10-24', 4);
    assert.deepEqual(Array.from(suggestions, item => item.guid), ['overdue', 'today', 'due-soon', 'high-future']);
    assert.ok(Array.from(suggestions[0].suggestionReasons).includes('Overdue'));
    assert.ok(Array.from(suggestions[0].suggestionReasons).includes('Project next action'));
    assert.ok(Array.from(suggestions[1].suggestionReasons).includes('Due today'));
    assert.ok(Array.from(suggestions[3].suggestionReasons).includes('High-priority project'));
    assert.ok(Array.from(suggestions[3].suggestionReasons).includes('Project deadline 2026-10-29'));
    assert.ok(!suggestions.some(item => item.guid === 'already-focused'));
});

test('Start Here uses Focus pins, removes suggestions from the list, and protects the three-action limit', async () => {
    const plugin = new api.Plugin();
    plugin.workflowState = api.workflowDefaults();
    plugin.workflowData = { model: { focus: [] } };
    plugin.loadWorkflowState = () => plugin.workflowState;
    plugin.persistWorkflow = () => true;
    plugin.workflowAction = async (_button, operation) => operation();
    await plugin.toggleFocusTask({ guid: 'suggested' }, null, null);
    const day = Object.keys(plugin.workflowState.focus)[0];
    assert.deepEqual(Array.from(plugin.workflowState.focus[day]), ['suggested']);
    plugin.workflowData.model.focus = [{ guid: 'suggested' }];
    await plugin.toggleFocusTask({ guid: 'suggested' }, null, null);
    assert.deepEqual(Array.from(plugin.workflowState.focus[day]), []);
    plugin.workflowData.model.focus = [{ guid: 'one' }, { guid: 'two' }, { guid: 'three' }];
    plugin.workflowState.focus[day] = ['one', 'two', 'three'];
    await assert.rejects(plugin.toggleFocusTask({ guid: 'four' }, null, null), /three actions/);
    assert.deepEqual(Array.from(plugin.workflowState.focus[day]), ['one', 'two', 'three']);
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
            const line = { guid: `line-${++created}`, type, segments, props: {}, parent, getChildren: async () => lines.filter(item => item.parent === line), setSegments: async value => { line.segments = value; return true; }, setMetaProperties: async update => { Object.assign(line.props, update); return true; } };
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
        const line = { guid: `journal-${++created}`, type, segments, parent, props: {}, getChildren: async () => lines.filter(item => item.parent === line), setSegments: async value => { line.segments = value; return true; }, setMetaProperties: async update => { Object.assign(line.props, update); return true; } };
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
        const line = { guid: `journal-${++sequence}`, type, segments, parent, parent_guid: parent?.guid || 'journal-day', props: {}, getChildren: async () => lines.filter(item => item.parent === line), setSegments: async value => { line.segments = value; return true; }, setMetaProperties: async update => { Object.assign(line.props, update); return true; } };
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

test('persisted state validates each map without discarding unrelated valid fields', () => {
    const plugin = new api.Plugin();
    let raw = JSON.stringify({
        version: 1,
        mappings: { Projects: 'projects-guid', Broken: 42 },
        next: { project: 'task' },
        nextLabels: { project: 'Task title' },
        focus: { '2026-10-24': ['task', 7], today: ['task'] },
        waiting: { task: { reason: 'Client approval', followup: '2026-10-28', previousStatus: 'important' }, broken: 'note' },
        drafts: { '2026-10-19': { notes: 'Keep this', priorities: 42, step: 9, priorityItems: [{ id: 'one', text: 'Ship' }, {}] } },
        reviews: { '2026-10-19': { journalGuid: 'journal', savedAt: '2026-10-24T12:00:00Z' } },
        futureField: 'preserved'
    });
    plugin.getLocalStorage = () => raw;
    plugin.setLocalStorage = (key, value) => { raw = value; return true; };
    const state = plugin.loadWorkflowState();
    assert.equal(state.mappings.Projects, 'projects-guid');
    assert.equal(Object.keys(state.mappings).length, 1);
    assert.equal(state.next.project, 'task');
    assert.deepEqual(Array.from(state.focus['2026-10-24']), ['task']);
    assert.equal(Object.keys(state.focus).length, 1);
    assert.equal(state.waiting.task.reason, 'Client approval');
    assert.equal(state.waiting.task.followup, '2026-10-28');
    assert.equal(state.waiting.task.previousStatus, 'important');
    assert.equal(state.waiting.broken, undefined);
    assert.equal(state.drafts['2026-10-19'].notes, 'Keep this');
    assert.equal(state.drafts['2026-10-19'].priorities, '');
    assert.equal(state.drafts['2026-10-19'].step, 2);
    assert.equal(state.drafts['2026-10-19'].priorityItems.length, 1);
    assert.equal(state.drafts['2026-10-19'].priorityItems[0].id, 'one');
    assert.equal(state.reviews['2026-10-19'].journalGuid, 'journal');
    assert.equal(state.futureField, 'preserved');
    assert.equal(plugin.persistWorkflow(), true);
    assert.match(raw, /Keep this/);
});

test('corrupt or denied local storage does not crash and keeps the in-memory state', () => {
    const corrupt = new api.Plugin();
    corrupt.getLocalStorage = () => '{not json';
    corrupt.setLocalStorage = () => true;
    assert.equal(Object.keys(corrupt.loadWorkflowState().focus).length, 0);
    assert.equal(corrupt.workflowStorageCorrupt, true);
    assert.match(corrupt.workflowStorageError, /could not be read/);

    const denied = new api.Plugin();
    denied.workflowState = api.workflowDefaults();
    denied.workflowState.drafts['2026-10-19'] = { notes: 'Unsaved text', priorities: '', step: 0 };
    denied.getLocalStorage = () => JSON.stringify(denied.workflowState);
    denied.setLocalStorage = () => { throw new Error('quota'); };
    let toasts = 0; denied.ui = { addToaster: () => { toasts++; } };
    assert.equal(denied.persistWorkflow(), false);
    assert.match(denied.workflowStorageError, /could not be saved/);
    assert.equal(toasts, 1);
    assert.equal(denied.workflowState.drafts['2026-10-19'].notes, 'Unsaved text');

    const ignored = new api.Plugin();
    ignored.workflowState = api.workflowDefaults();
    let stored = '';
    ignored.getLocalStorage = () => stored;
    ignored.setLocalStorage = () => { return true; };
    assert.equal(ignored.persistWorkflow(), false);
    assert.match(ignored.workflowStorageError, /could not be saved/);
});

test('browser fallback storage is scoped to workspace and plugin', () => {
    const store = new Map();
    runtime.localStorage = {
        getItem: key => store.has(key) ? store.get(key) : null,
        setItem: (key, value) => { store.set(key, String(value)); },
        removeItem: key => { store.delete(key); }
    };
    try {
        const first = new api.Plugin();
        first.getWorkspaceGuid = () => 'workspace-a';
        first.getGuid = () => 'plugin-a';
        first.loadWorkflowState().focus['2026-10-24'] = ['task-a'];
        assert.equal(first.persistWorkflow(), true);
        assert.ok(store.has(api.workflowStorageKey('workspace-a', 'plugin-a')));

        const second = new api.Plugin();
        second.getWorkspaceGuid = () => 'workspace-b';
        second.getGuid = () => 'plugin-b';
        assert.equal(Object.keys(second.loadWorkflowState().focus).length, 0);
        second.loadWorkflowState().focus['2026-10-24'] = ['task-b'];
        assert.equal(second.persistWorkflow(), true);
        assert.notEqual(api.workflowStorageKey('workspace-a', 'plugin-a'), api.workflowStorageKey('workspace-b', 'plugin-b'));
    } finally {
        delete runtime.localStorage;
    }
});

test('task ownership rejects templates, prefers project ancestry and never guesses between roots', () => {
    const index = new Map([
        ['p1', { guid: 'p1', name: 'Same title', parentGuid: '' }],
        ['p2', { guid: 'p2', name: 'Same title', parentGuid: '' }],
        ['child', { guid: 'child', name: 'Child', parentGuid: 'p1' }],
        ['grand', { guid: 'grand', name: 'Grand', parentGuid: 'child' }],
        ['cycle-a', { guid: 'cycle-a', name: 'Cycle A', parentGuid: 'cycle-b' }],
        ['cycle-b', { guid: 'cycle-b', name: 'Cycle B', parentGuid: 'cycle-a' }]
    ]);
    const template = { guid: 'template', getName: () => 'Template', prop: key => key === 'type' ? { text: () => 'template' } : null };
    const source = guid => index.has(guid) ? index.get(guid) : { guid, getName: () => 'Journal', prop: () => null };
    const line = (refs = []) => ({ segments: refs.map(guid => ({ type: 'ref', text: { guid } })) });
    assert.equal(api.resolveTaskProject(line(['p2']), source('child'), index).kind, 'owned');
    assert.equal(api.resolveTaskProject(line(['p2']), source('child'), index).projectGuid, 'p1');
    assert.equal(api.resolveTaskProject(line(['p2']), template, index).kind, 'excluded');
    assert.equal(api.resolveTaskProject(line(['p2', 'child', 'grand']), source('journal'), index).candidateProjectGuids.length, 2);
    assert.equal(api.resolveTaskProject(line(['child', 'grand']), source('journal'), index).projectGuid, 'p1');
    assert.equal(api.resolveTaskProject(line(['p1', 'p2']), source('journal'), index).kind, 'ambiguous');
    assert.equal(api.resolveTaskProject(line(['cycle-a']), source('journal'), index).kind, 'unresolved');
    assert.equal(api.resolveTaskProject(line(['missing']), source('journal'), index).kind, 'none');
    assert.deepEqual(Array.from(api.resolveTaskProject(line(['child', 'grand']), source('journal'), index).candidateProjectGuids), ['p1']);
});

test('unknown project status is not treated as active', () => {
    const result = api.actionModel([{ guid: 'unknown', name: 'No status', status: 'unknown' }], [task('work', { projectGuid: 'unknown' })], api.workflowDefaults(), '2026-10-24');
    assert.equal(result.active.length, 0);
    assert.equal(result.actions.length, 0);
});

test('Overview reports failed or capped task searches as loaded, not complete', async () => {
    const collections = ['Clients', 'Invoices', 'Projects'].map(name => ({ getGuid: () => `c-${name}`, getName: () => name, getAllRecords: async () => [] }));
    const failed = new api.Plugin();
    failed.data = { getAllCollections: async () => collections, searchByQuery: async () => ({ error: 'search unavailable' }) };
    const failedData = await failed.loadData();
    assert.equal(failedData.taskCoverage.failed, true);
    assert.equal(failedData.taskCoverage.complete, false);
    assert.equal(failedData.loadError, undefined);

    const capped = new api.Plugin();
    const lines = Array.from({ length: 150 }, (_, index) => ({
        guid: `task-${index}`,
        segments: [{ type: 'text', text: `Task ${index}` }],
        getTaskStatus: () => 'none',
        getRecord: () => ({ guid: 'record', getName: () => 'Record', prop: () => null })
    }));
    capped.data = { getAllCollections: async () => collections, searchByQuery: async () => ({ lines }) };
    const cappedData = await capped.loadData();
    assert.equal(cappedData.taskCoverage.truncated, true);
    assert.equal(cappedData.taskCoverage.complete, false);
    assert.equal(cappedData.taskCoverage.loaded, 150);
    assert.equal(cappedData.agendaTasks.length, 150);
});

test('Overview keeps a missing project status visibly unknown', async () => {
    const projects = [{ guid: 'p', getName: () => 'No status project', prop: () => null }];
    const collections = ['Clients', 'Invoices', 'Projects'].map(name => ({
        getGuid: () => `c-${name}`, getName: () => name,
        getAllRecords: async () => name === 'Projects' ? projects : []
    }));
    const plugin = new api.Plugin();
    plugin.data = { getAllCollections: async () => collections, searchByQuery: async () => ({ lines: [] }) };
    const data = await plugin.loadData();
    assert.equal(data.projects[0].status, 'unknown');
    assert.equal(data.projects[0].status === 'in_progress', false);
});

test('stale or older workflow snapshots cannot replace newer pointer state', async () => {
    const plugin = new api.Plugin();
    plugin.workflowState = api.workflowDefaults();
    plugin.renderVersion = 5;
    plugin.workflowMutationVersion = 1;
    const staleGeneration = { complete: true, pointerChanged: true, pointerState: api.cloneWorkflowState(plugin.workflowState), nativeReconciliation: { write: [], remove: [] }, expectedVersion: 4, mutationVersion: 1, byGuid: new Map() };
    staleGeneration.pointerState.next.project = 'late-choice';
    assert.equal(await plugin.applyWorkflowSnapshot(staleGeneration, { expectedVersion: 4 }), false);
    assert.equal(staleGeneration.stale, true);
    assert.equal(Object.keys(plugin.workflowState.next).length, 0);

    const staleMutation = { complete: true, pointerChanged: true, pointerState: api.cloneWorkflowState(plugin.workflowState), nativeReconciliation: { write: [], remove: [] }, expectedVersion: 5, mutationVersion: 0, byGuid: new Map() };
    staleMutation.pointerState.next.project = 'older-choice';
    assert.equal(await plugin.applyWorkflowSnapshot(staleMutation, { expectedVersion: 5 }), false);
    assert.equal(Object.keys(plugin.workflowState.next).length, 0);
});

test('applying pointer state preserves drafts and reports a failed native write', async () => {
    const plugin = new api.Plugin();
    plugin.workflowState = api.workflowDefaults();
    plugin.workflowState.drafts['2026-10-19'] = { notes: 'Do not replace this draft', priorities: '', step: 1 };
    plugin.renderVersion = 1;
    plugin.workflowMutationVersion = 0;
    const snapshot = { complete: true, pointerChanged: true, pointerState: api.cloneWorkflowState(plugin.workflowState), nativeReconciliation: { write: [], remove: [] }, expectedVersion: 1, mutationVersion: 0, byGuid: new Map() };
    snapshot.pointerState.next.project = 'new-choice';
    assert.equal(await plugin.applyWorkflowSnapshot(snapshot, { expectedVersion: 1 }), true);
    assert.equal(plugin.workflowState.next.project, 'new-choice');
    assert.equal(plugin.workflowState.drafts['2026-10-19'].notes, 'Do not replace this draft');

    const failing = new api.Plugin();
    failing.workflowState = api.workflowDefaults();
    failing.renderVersion = 1;
    const projectRecord = { guid: 'project', prop: key => key === 'status' ? { text: () => 'in_progress' } : null };
    const failed = { complete: true, pointerChanged: false, pointerState: api.cloneWorkflowState(failing.workflowState), nativeReconciliation: { write: [{ project: { guid: 'project' }, task: { guid: 'task', recordGuid: 'missing', status: 'none', text: 'Task' } }], remove: [] }, expectedVersion: 1, mutationVersion: 0, byGuid: new Map([['project', { guid: 'project', record: projectRecord }]]) };
    failing.data = { getRecord: () => null };
    await failing.applyWorkflowSnapshot(failed, { expectedVersion: 1 });
    assert.match(failing.workflowSyncError, /last good dashboard state/);
});

test('unload removes subscriptions and a deferred refresh flushes after editing ends', async () => {
    runtime.setInterval = () => 41;
    runtime.clearInterval = () => {};
    runtime.setTimeout = setTimeout;
    runtime.clearTimeout = clearTimeout;
    runtime.window = {};
    const subscribed = []; const unsubscribed = [];
    const plugin = new api.Plugin();
    plugin.events = { on: event => { subscribed.push(event); return `handler-${event}`; }, off: id => unsubscribed.push(id) };
    plugin.ui = {
        injectCSS: () => {}, registerCustomPanelType: () => {}, addSidebarItem: () => {},
        addCommandPaletteCommand: () => {}, getPanels: () => []
    };
    plugin.onLoad();
    for (const event of ['lineitem.moved', 'lineitem.undeleted', 'record.moved', 'collection.updated']) assert.ok(subscribed.includes(event), `${event} subscribed`);
    plugin.onUnload();
    assert.equal(unsubscribed.length, plugin.workflowEventHandlers.length || subscribed.length);
    assert.equal(plugin.workflowEventHandlers.length, 0);

    runtime.document = { activeElement: { closest: () => ({}) } };
    const refresh = new api.Plugin(); let renders = 0;
    refresh.activePanel = {};
    refresh.render = async () => { renders++; };
    refresh.scheduleRefresh();
    await new Promise(resolve => setTimeout(resolve, 260));
    assert.equal(refresh.workflowRefreshPending, true);
    assert.equal(renders, 0);
    runtime.document.activeElement = { closest: () => null };
    refresh.flushRefresh();
    await new Promise(resolve => setTimeout(resolve, 260));
    assert.equal(renders, 1);
    clearTimeout(refresh.refreshTimer);
    delete runtime.document;
    delete runtime.window;
    delete runtime.setInterval;
    delete runtime.clearInterval;
    delete runtime.setTimeout;
    delete runtime.clearTimeout;
});

test('waiting details prefer valid native metadata and keep local notes as a fallback', () => {
    const line = value => value === undefined ? { props: {} } : { props: { freelance_os_waiting: value } };
    const local = { reason: 'Legacy private note', followup: '2026-10-20', previousStatus: 'important' };
    const native = api.readWaitingDetails(line(JSON.stringify({ v: 1, reason: '', followup: '', previousStatus: 'none' })), local);
    assert.equal(native.source, 'native');
    assert.equal(native.details.reason, '');
    assert.equal(native.details.followup, '');
    assert.equal(native.details.previousStatus, 'none');
    const fallback = api.readWaitingDetails(line(), local);
    assert.equal(fallback.source, 'local');
    assert.equal(fallback.details.reason, 'Legacy private note');
    const invalidJson = api.readWaitingDetails(line('{broken'), local);
    assert.equal(invalidJson.source, 'invalid');
    assert.equal(invalidJson.valid, false);
    assert.equal(invalidJson.details.reason, 'Legacy private note');
    const invalidDate = api.readWaitingDetails(line(JSON.stringify({ v: 1, reason: 'Waiting', followup: '2026-02-30', previousStatus: 'done' })), null);
    assert.equal(invalidDate.details.followup, '');
    assert.equal(invalidDate.details.previousStatus, 'none');
    assert.equal(invalidDate.valid, false);
    assert.throws(() => api.validateWaitingInput({ reason: '', followup: 'not-a-date' }), /valid follow-up/);
    assert.equal(api.validateWaitingInput({ reason: ' Note ', followup: '', previousStatus: 'done' }).previousStatus, 'none');
    let writes = 0;
    api.readWaitingDetails({ props: { freelance_os_waiting: native }, setMetaProperties: async () => { writes++; } }, null);
    assert.equal(writes, 0);
});

test('waiting save and resume round-trip the previous native status', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults();
    const props = {}; let nativeStatus = 'important';
    const line = { props, setMetaProperties: async update => { Object.assign(props, update); return true; }, setTaskStatus: async status => { nativeStatus = status; return true; } };
    const task = { guid: 'task', status: 'important', lineItem: line };
    const saved = await plugin.saveWaiting(task, { reason: ' Client approval ', followup: '2026-10-28' }, false);
    assert.equal(nativeStatus, 'waiting');
    assert.equal(saved.previousStatus, 'important');
    const metadata = JSON.parse(props.freelance_os_waiting);
    assert.deepEqual(metadata, { v: 1, reason: 'Client approval', followup: '2026-10-28', previousStatus: 'important' });
    task.status = 'waiting';
    const resumed = await plugin.resumeWaiting(task);
    assert.equal(nativeStatus, 'important');
    assert.equal(resumed.previousStatus, 'important');
    assert.equal(props.freelance_os_waiting, JSON.stringify(metadata));
});

test('waiting save reports partial failures without pretending success', async () => {
    const metadataFirst = new api.Plugin(); metadataFirst.workflowState = api.workflowDefaults();
    const props = {}; let statusCalls = 0;
    const statusFailure = { guid: 'task', status: 'important', lineItem: { props, setMetaProperties: async update => { Object.assign(props, update); return true; }, setTaskStatus: async () => { statusCalls++; return false; } } };
    await assert.rejects(metadataFirst.saveWaiting(statusFailure, { reason: 'Waiting', followup: '' }), /status could not be updated/);
    assert.ok(props.freelance_os_waiting);
    assert.equal(statusCalls, 1);

    const metadataFailure = new api.Plugin(); metadataFailure.workflowState = api.workflowDefaults();
    let statusAfterFailure = 'important';
    const metadataFailureTask = { guid: 'task', status: 'important', lineItem: { props: {}, setMetaProperties: async () => false, setTaskStatus: async status => { statusAfterFailure = status; return true; } } };
    await assert.rejects(metadataFailure.saveWaiting(metadataFailureTask, { reason: 'Waiting', followup: '' }), /status was not changed/);
    assert.equal(statusAfterFailure, 'important');

    const local = new api.Plugin(); local.workflowState = api.workflowDefaults(); let stored = '';
    local.getLocalStorage = () => stored;
    local.setLocalStorage = (key, value) => { stored = value; return true; };
    let localStatus = 'important';
    const localTask = { guid: 'local-task', status: 'important', lineItem: { props: {}, setTaskStatus: async status => { localStatus = status; return true; } } };
    local.saveWaitingLocal(localTask, { reason: 'Only here', followup: '' }, false);
    await local.setActionStatus(localTask, 'blocked');
    assert.equal(localStatus, 'waiting');
    assert.equal(local.workflowState.waiting['local-task'].reason, 'Only here');
});

test('queue presets scope counts before pagination and keep waiting out of actions', () => {
    const state = api.workflowDefaults();
    const tasks = [
        task('due', { text: 'Send proposal', date: '2026-10-24', projectName: 'Alpha' }),
        task('overdue', { text: 'Call client', status: 'important', date: '2026-10-23', projectName: 'Alpha' }),
        task('nodate', { text: 'Draft brief', date: '', projectGuid: 'project-two', projectName: 'Beta' }),
        task('wait-due', { text: 'Await approval', status: 'waiting', projectGuid: 'project-two', projectName: 'Beta', waitingDetails: { reason: 'Client approval', followup: '2026-10-24', previousStatus: 'none' } }),
        task('wait-none', { text: 'Await assets', status: 'waiting', projectGuid: 'project-two', projectName: 'Beta', waitingDetails: { reason: '', followup: '', previousStatus: 'none' } }),
        task('done', { text: 'Finished', status: 'done', date: '2026-10-24' })
    ];
    const projects = [project, { guid: 'project-two', name: 'Beta', status: 'in_progress', deadline: '' }];
    const model = api.actionModel(projects, tasks, state, '2026-10-24');
    assert.equal(model.actions.length, 3);
    assert.equal(model.waiting.length, 2);
    assert.equal(api.selectQueueItems(model, { queue: 'all', preset: 'due', today: '2026-10-24' }).count, 2);
    assert.equal(api.selectQueueItems(model, { queue: 'all', preset: 'important', today: '2026-10-24' }).count, 1);
    assert.equal(api.selectQueueItems(model, { queue: 'all', preset: 'nodate', today: '2026-10-24' }).count, 1);
    assert.equal(api.selectQueueItems(model, { queue: 'all', preset: 'due', projectGuid: 'project', today: '2026-10-24' }).count, 2);
    assert.equal(api.selectQueueItems(model, { queue: 'all', preset: 'due', query: 'Draft', today: '2026-10-24' }).count, 0);
    assert.equal(api.selectQueueItems(model, { queue: 'waiting', preset: 'followup-due', today: '2026-10-24' }).count, 1);
    assert.equal(api.selectQueueItems(model, { queue: 'waiting', preset: 'no-followup', today: '2026-10-24' }).count, 1);
    assert.equal(api.selectQueueItems(model, { queue: 'waiting', preset: 'any', query: 'approval', today: '2026-10-24' }).count, 1);
    assert.equal(api.selectQueueItems(model, { queue: 'attention', query: 'Client approval', today: '2026-10-24' }).count, 1);
    assert.equal(api.selectQueueItems(model, { queue: 'attention', today: '2026-10-24' }).unit, 'projects');
    assert.equal(api.selectQueueItems(model, { queue: 'all', preset: 'due', today: '2026-10-25' }).count, 2);
    assert.equal(api.presetCompatible('all', 'followup-due'), false);
    assert.equal(api.presetCompatible('waiting', 'no-followup'), true);
    assert.match(api.queueEmptyMessage('all', { filtered: true, complete: false }), /More may exist/);
    assert.doesNotMatch(api.queueEmptyMessage('all', { filtered: false, complete: false }), /caught up/);

    const many = Array.from({ length: 25 }, (_, index) => task(`t${index}`, { projectGuid: index % 2 ? 'project' : 'project-two' }));
    const manyModel = api.actionModel(projects, many, api.workflowDefaults(), '2026-10-24');
    assert.equal(api.selectQueueItems(manyModel, { queue: 'all', today: '2026-10-24' }).count, 25);
});


function makeReviewRecord(guid) {
    const lines = [];
    const record = {
        guid,
        getLineItems: async () => lines,
        createLineItem: async (parent, after, type, segments, props) => {
            const line = {
                guid: `${guid}-line-${lines.length + 1}`,
                type,
                segments,
                parent,
                props: props || {},
                getChildren: async () => lines.filter(item => item.parent === line),
                setSegments: async value => { line.segments = value; return true; },
                setMetaProperties: async update => { Object.assign(line.props, update); return true; },
                getUpdatedAt: () => new Date('2026-10-24T12:00:00Z')
            };
            lines.push(line);
            return line;
        }
    };
    return { record, lines };
}

function makeReviewJournal() {
    const records = new Map();
    const calls = [];
    const journal = {
        getGuid: () => 'journal',
        getName: () => 'Journal',
        isJournalPlugin: () => true,
        getJournalRecord: async (user, target) => {
            const key = target ? `${target.year}-${String(target.month + 1).padStart(2, '0')}-${String(target.day).padStart(2, '0')}` : 'today';
            calls.push(key);
            if (!records.has(key)) records.set(key, makeReviewRecord(`record-${key}`));
            return records.get(key).record;
        }
    };
    const entryAt = date => {
        if (!records.has(date)) records.set(date, makeReviewRecord(`record-${date}`));
        return records.get(date);
    };
    journal.__records = records;
    return { journal, records, calls, recordAt: date => entryAt(date).record, entryAt };
}

function setupReviewPlugin(journal, users = [{ guid: 'user' }]) {
    const plugin = new api.Plugin();
    plugin.workflowState = api.workflowDefaults();
    plugin.workflowState.mappings.Journal = 'journal';
    let stored = '';
    plugin.getLocalStorage = () => stored;
    plugin.setLocalStorage = (key, value) => { stored = value; return true; };
    plugin.data = {
        getAllCollections: async () => [journal],
        getActiveUsers: () => users,
        getRecord: guid => {
            for (const value of journal.__records?.values?.() || []) if (value.record.guid === guid || value.record === guid) return value.record;
            return null;
        }
    };
    return plugin;
}

function reviewWorkflow(plugin, today = '2026-10-24') {
    return { model: api.actionModel([], [], plugin.workflowState, today), recentDone: [], tasks: [] };
}

test('review discovery finds a saved section without relying on the local cache', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, records, recordAt, entryAt } = makeReviewJournal();
        const week = '2026-10-19';
        const saved = api.reviewSnapshot({ week, userGuid: 'user', state: 'saved', notes: 'Saved notes', priorityItems: [{ id: 'p1', text: 'Ship it' }], savedAt: '2026-10-22T10:00:00.000Z' });
        const heading = await await recordAt('2026-10-22').createLineItem(null, null, 'heading', [{ type: 'text', text: api.reviewTitle(week) }], { freelance_os_review: JSON.stringify(saved) });
        const plugin = setupReviewPlugin(journal);
        const discovery = await plugin.findWeeklyReview(journal, { guid: 'user' }, week);
        assert.equal(discovery.kind, 'one');
        assert.equal(discovery.candidates.length, 1);
        assert.equal(discovery.candidates[0].date, '2026-10-22');
        assert.equal(discovery.snapshot.notes, 'Saved notes');
        assert.equal(discovery.reference.headingGuid, heading.guid);
        assert.equal(Object.keys(plugin.workflowState.reviews).length, 0);
        assert.equal(api.weekDates(week).length, 7);
    } finally { delete runtime.DateTime; }
});

test('saving with no local cache updates the existing review on another day', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, records, recordAt, entryAt } = makeReviewJournal();
        const week = '2026-10-19';
        const saved = api.reviewSnapshot({ week, userGuid: 'user', state: 'saved', notes: 'Old notes', priorityItems: [], savedAt: '2026-10-22T10:00:00.000Z' });
        const record = recordAt('2026-10-22');
        const heading = await record.createLineItem(null, null, 'heading', [{ type: 'text', text: api.reviewTitle(week) }], { freelance_os_review: JSON.stringify(saved) });
        const body = await record.createLineItem(heading, null, 'text', [{ type: 'text', text: 'Freelance OS weekly review' }]);
        await record.createLineItem(body, null, 'text', [{ type: 'text', text: 'Week of 2026-10-19 · reviewed 2026-10-22' }]);
        await record.createLineItem(body, null, 'text', [{ type: 'text', text: 'Priorities for next week' }]);
        await record.createLineItem(body, null, 'text', [{ type: 'text', text: 'Old priority' }]);
        const plugin = setupReviewPlugin(journal);
        const reference = await plugin.saveReviewToJournal(reviewWorkflow(plugin, '2026-10-24'), { notes: 'New notes', priorities: 'New priority' }, '2026-10-24');
        assert.equal(reference.journalDate, '2026-10-22');
        assert.equal(reference.headingGuid, heading.guid);
        assert.equal(entryAt('2026-10-22').lines.filter(line => line.type === 'heading').length, 1);
        const snapshot = api.parseReviewSnapshot(heading);
        assert.equal(snapshot.state, 'saved');
        assert.equal(snapshot.notes, 'New notes');
        assert.equal(plugin.workflowState.reviews[week].headingGuid, heading.guid);
        assert.ok(entryAt('2026-10-22').lines.some(line => line.parent === body && line.segments?.[0]?.text === 'New notes'));
    } finally { delete runtime.DateTime; }
});

test('a pending review heading is discovered and repaired without a duplicate', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, records, recordAt, entryAt } = makeReviewJournal();
        const week = '2026-10-19';
        const pending = api.reviewSnapshot({ week, userGuid: 'user', state: 'pending', savedAt: '2026-10-22T10:00:00.000Z' });
        const record = recordAt('2026-10-22');
        const heading = await record.createLineItem(null, null, 'heading', [{ type: 'text', text: api.reviewTitle(week) }], { freelance_os_review: JSON.stringify(pending) });
        const plugin = setupReviewPlugin(journal);
        const reference = await plugin.saveReviewToJournal(reviewWorkflow(plugin, '2026-10-24'), { notes: 'Recovered' }, '2026-10-24');
        assert.equal(reference.headingGuid, heading.guid);
        assert.equal(entryAt('2026-10-22').lines.filter(line => line.type === 'heading').length, 1);
        assert.equal(api.parseReviewSnapshot(heading).state, 'saved');
        assert.equal(api.parseReviewSnapshot(heading).notes, 'Recovered');
    } finally { delete runtime.DateTime; }
});

test('multiple saved reviews require explicit selection and never create another section', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, records, recordAt, entryAt } = makeReviewJournal();
        const week = '2026-10-19';
        const makeExisting = async (date, notes) => {
            const record = recordAt(date);
            const snapshot = api.reviewSnapshot({ week, userGuid: 'user', state: 'saved', notes, priorityItems: [], savedAt: `${date}T10:00:00.000Z` });
            const heading = await record.createLineItem(null, null, 'heading', [{ type: 'text', text: api.reviewTitle(week) }], { freelance_os_review: JSON.stringify(snapshot) });
            const body = await record.createLineItem(heading, null, 'text', [{ type: 'text', text: 'Freelance OS weekly review' }]);
            await record.createLineItem(body, null, 'text', [{ type: 'text', text: `Week of ${week} · reviewed ${date}` }]);
            await record.createLineItem(body, null, 'text', [{ type: 'text', text: 'Priorities for next week' }]);
            return { record, heading, snapshot };
        };
        const first = await makeExisting('2026-10-21', 'First');
        const second = await makeExisting('2026-10-22', 'Second');
        const plugin = setupReviewPlugin(journal);
        const discovery = await plugin.findWeeklyReview(journal, { guid: 'user' }, week);
        assert.equal(discovery.kind, 'multiple');
        assert.deepEqual(Array.from(discovery.candidates, candidate => candidate.date), ['2026-10-21', '2026-10-22']);
        await assert.rejects(plugin.saveReviewToJournal(reviewWorkflow(plugin, '2026-10-24'), { notes: 'New' }, '2026-10-24'), /Multiple saved reviews/);
        assert.equal(entryAt('2026-10-21').lines.filter(line => line.type === 'heading').length, 1);
        assert.equal(entryAt('2026-10-22').lines.filter(line => line.type === 'heading').length, 1);
        plugin.selectedReviewWeek = week;
        plugin.selectedReviewHeadingGuid = first.heading.guid;
        const reference = await plugin.saveReviewToJournal(reviewWorkflow(plugin, '2026-10-24'), { notes: 'Updated first' }, '2026-10-24');
        assert.equal(reference.headingGuid, first.heading.guid);
        assert.equal(api.parseReviewSnapshot(first.heading).notes, 'Updated first');
        assert.equal(api.parseReviewSnapshot(second.heading).notes, 'Second');
        assert.equal(entryAt('2026-10-22').lines.filter(line => line.type === 'heading').length, 1);
    } finally { delete runtime.DateTime; }
});

test('an incomplete Journal read blocks creation and keeps the draft path retryable', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const week = '2026-10-19';
        const records = new Map();
        let creates = 0;
        const emptyRecord = key => ({ guid: `record-${key}`, getLineItems: async () => [], createLineItem: async () => { creates++; return null; } });
        const journal = {
            getGuid: () => 'journal', getName: () => 'Journal', isJournalPlugin: () => true,
            getJournalRecord: async (user, target) => {
                const key = `${target.year}-${String(target.month + 1).padStart(2, '0')}-${String(target.day).padStart(2, '0')}`;
                if (key === '2026-10-21') return { guid: 'broken', getLineItems: async () => { throw new Error('Journal read failed'); } };
                if (!records.has(key)) records.set(key, emptyRecord(key));
                return records.get(key);
            }
        };
        const plugin = setupReviewPlugin(journal);
        const discovery = await plugin.findWeeklyReview(journal, { guid: 'user' }, week);
        assert.equal(discovery.kind, 'incomplete');
        assert.match(discovery.error, /Journal read failed/);
        await assert.rejects(plugin.saveReviewToJournal(reviewWorkflow(plugin, '2026-10-24'), { notes: 'Keep me' }, '2026-10-24'), /could not be checked/);
        assert.equal(creates, 0);
    } finally { delete runtime.DateTime; }
});

test('legacy review sections expose stable priority provenance and upgrade only on save', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, records, recordAt, entryAt } = makeReviewJournal();
        const week = '2026-10-19';
        const record = recordAt('2026-10-20');
        const heading = await record.createLineItem(null, null, 'heading', [{ type: 'text', text: api.reviewTitle(week) }]);
        const body = await record.createLineItem(heading, null, 'text', [{ type: 'text', text: 'Freelance OS weekly review' }]);
        await record.createLineItem(body, null, 'text', [{ type: 'text', text: `Week of ${week} · reviewed 2026-10-20` }]);
        await record.createLineItem(body, null, 'text', [{ type: 'text', text: 'Wins and observations' }]);
        await record.createLineItem(body, null, 'text', [{ type: 'text', text: 'Legacy notes' }]);
        await record.createLineItem(body, null, 'text', [{ type: 'text', text: 'Priorities for next week' }]);
        const priorityLine = await record.createLineItem(body, null, 'text', [{ type: 'ref', text: { guid: 'task-legacy', title: 'Legacy priority' } }]);
        const plugin = setupReviewPlugin(journal);
        const discovery = await plugin.findWeeklyReview(journal, { guid: 'user' }, week);
        assert.equal(discovery.kind, 'one');
        assert.equal(discovery.legacy, true);
        assert.equal(discovery.legacyReview.notes, 'Legacy notes');
        assert.equal(discovery.legacyReview.priorityItems[0].taskGuid, 'task-legacy');
        assert.equal(discovery.legacyReview.priorityItems[0].id, `legacy-${priorityLine.guid}`);
        assert.equal(heading.props.freelance_os_review, undefined);
        const reference = await plugin.saveReviewToJournal(reviewWorkflow(plugin, '2026-10-24'), { notes: discovery.legacyReview.notes, priorities: discovery.legacyReview.priorities, priorityItems: discovery.legacyReview.priorityItems }, '2026-10-24');
        assert.equal(reference.headingGuid, heading.guid);
        assert.equal(api.parseReviewSnapshot(heading).state, 'saved');
        assert.equal(api.parseReviewSnapshot(heading).priorityItems[0].taskGuid, 'task-legacy');
    } finally { delete runtime.DateTime; }
});

test('a multi-user workspace requires an explicit Journal owner and ignores other owners\' snapshots', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, records, recordAt, entryAt } = makeReviewJournal();
        const week = '2026-10-19';
        const snapshot = api.reviewSnapshot({ week, userGuid: 'user-one', state: 'saved', notes: 'One', priorityItems: [] });
        await recordAt('2026-10-22').createLineItem(null, null, 'heading', [{ type: 'text', text: api.reviewTitle(week) }], { freelance_os_review: JSON.stringify(snapshot) });
        const plugin = setupReviewPlugin(journal, [{ guid: 'user-one' }, { guid: 'user-two' }]);
        assert.throws(() => plugin.resolveJournalOwner(journal), /Choose the Journal owner/);
        plugin.workflowState.journalOwners.journal = 'user-two';
        assert.equal(plugin.resolveJournalOwner(journal).guid, 'user-two');
        assert.equal((await plugin.findWeeklyReview(journal, { guid: 'user-two' }, week)).kind, 'none');
        assert.equal((await plugin.findWeeklyReview(journal, { guid: 'user-one' }, week)).kind, 'one');
    } finally { delete runtime.DateTime; }
});

test('a new review uses the explicit local today for its Journal target', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, records, calls, recordAt, entryAt } = makeReviewJournal();
        const plugin = setupReviewPlugin(journal);
        const reference = await plugin.saveReviewToJournal(reviewWorkflow(plugin, '2026-10-22'), { notes: 'Explicit date' }, '2026-10-22');
        assert.equal(reference.journalDate, '2026-10-22');
        assert.equal(entryAt('2026-10-22').lines.filter(line => line.type === 'heading').length, 1);
        assert.equal(api.parseReviewSnapshot(entryAt('2026-10-22').lines.find(line => line.type === 'heading')).state, 'saved');
        assert.equal(calls.filter(key => key === '2026-10-22').length, 2);
        assert.equal(calls.length, 8);
    } finally { delete runtime.DateTime; }
});

test('a valid cached review outside the nominal week stays usable and a stale heading is ignored', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, recordAt, entryAt } = makeReviewJournal();
        const week = '2026-10-19';
        const snapshot = api.reviewSnapshot({ week, userGuid: 'user', state: 'saved', notes: 'Outside week', priorityItems: [] });
        const heading = await recordAt('2026-10-27').createLineItem(null, null, 'heading', [{ type: 'text', text: api.reviewTitle(week) }], { freelance_os_review: JSON.stringify(snapshot) });
        const plugin = setupReviewPlugin(journal);
        plugin.workflowState.reviews[week] = { savedAt: '2026-10-27T10:00:00.000Z', journalGuid: 'journal', journalDate: '2026-10-27', userGuid: 'user', recordGuid: entryAt('2026-10-27').record.guid, headingGuid: heading.guid };
        const discovery = await plugin.findWeeklyReview(journal, { guid: 'user' }, week, { cached: plugin.workflowState.reviews[week] });
        assert.equal(discovery.kind, 'one');
        assert.equal(discovery.date, '2026-10-27');
        assert.equal(discovery.cached, true);
        plugin.workflowState.reviews[week].headingGuid = 'missing-heading';
        const stale = await plugin.findWeeklyReview(journal, { guid: 'user' }, week, { cached: plugin.workflowState.reviews[week] });
        assert.equal(stale.kind, 'none');
    } finally { delete runtime.DateTime; }
});

test('priority text reconciliation keeps carry provenance through insertion, edits, reordering and deletion', () => {
    const draft = {
        priorities: 'First\nSecond',
        priorityItems: [
            { id: 'a', text: 'First', carriedFrom: { week: '2026-10-12', priorityId: 'p1' } },
            { id: 'b', text: 'Second' }
        ]
    };
    let items = api.reconcileReviewPriorityItems(draft, 'Inserted\nFirst\nSecond');
    assert.equal(items.length, 3);
    assert.equal(items[0].id === 'a', false, 'an inserted line must not steal the first identity');
    assert.equal(items[1].id, 'a');
    assert.deepEqual(Array.from([items[1].carriedFrom.week, items[1].carriedFrom.priorityId]), ['2026-10-12', 'p1']);
    assert.equal(items[2].id, 'b');

    items = api.reconcileReviewPriorityItems(draft, 'First edited\nSecond');
    assert.equal(items[0].id, 'a');
    assert.equal(items[0].carriedFrom.priorityId, 'p1');
    assert.equal(items[1].id, 'b');

    items = api.reconcileReviewPriorityItems(draft, 'Second\nFirst edited');
    assert.equal(items[0].id, 'b');
    assert.equal(items[1].id, 'a');
    assert.equal(items[1].carriedFrom.priorityId, 'p1');

    const deletion = {
        priorities: 'A\nB\nC',
        priorityItems: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B', carriedFrom: { week: '2026-10-12', priorityId: 'p2' } }, { id: 'c', text: 'C' }]
    };
    items = api.reconcileReviewPriorityItems(deletion, 'A\nC');
    assert.deepEqual(Array.from(items, item => item.id), ['a', 'c']);

    const insertedAfterEdit = {
        priorities: 'First\nSecond',
        priorityItems: [{ id: 'a', text: 'First', carriedFrom: { week: '2026-10-12', priorityId: 'p1' } }, { id: 'b', text: 'Second' }]
    };
    items = api.reconcileReviewPriorityItems(insertedAfterEdit, 'New\nFirst edited\nSecond');
    assert.equal(items[1].id, 'a');
    assert.equal(items[1].carriedFrom.priorityId, 'p1');
    assert.equal(items[0].id === 'a', false);

    const rewrittenCarry = {
        priorities: 'First',
        priorityItems: [{ id: 'a', text: 'First', carriedFrom: { week: '2026-10-12', priorityId: 'p1' } }]
    };
    items = api.reconcileReviewPriorityItems(rewrittenCarry, 'Completely unrelated');
    assert.notEqual(items[0].id, 'a');
    assert.equal(items[0].carriedFrom, undefined);
});

test('an explicit missing task reference never falls back to a same-titled task', () => {
    const tasks = [
        { guid: 'same-title', text: 'Ship it', lineItem: { props: {} } },
        { guid: 'marker-task', text: 'Ship it', lineItem: { props: { freelance_os_review_priority: api.reviewPriorityIdKey('2026-10-12', 'p1') } } }
    ];
    assert.equal(api.reviewPriorityTask({ taskGuid: 'missing', text: 'Ship it' }, '2026-10-19', tasks), null);
    assert.equal(api.reviewPriorityTask({ id: 'p1', text: 'Ship it' }, '2026-10-12', tasks).guid, 'marker-task');
});

test('linking a task preserves an earlier origin marker but rejects same-week conflicts', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults(); plugin.setLocalStorage = () => {};
    const week = '2026-10-19';
    const priorKey = api.reviewPriorityIdKey('2026-10-12', 'origin');
    const properties = { freelance_os_review_priority: priorKey };
    let writes = 0;
    const task = { guid: 'task', projectGuid: 'project', recordGuid: 'project', text: 'Ship it', status: 'none', lineItem: { props: properties, setMetaProperties: async update => { writes++; Object.assign(properties, update); return true; } } };
    const workflow = { projects: [{ guid: 'project', status: 'in_progress' }], tasks: [task] };
    const entry = { id: 'current', text: 'Ship it' };
    plugin.workflowState.drafts[week] = { notes: '', priorities: 'Ship it', step: 2, priorityItems: [entry] };
    await plugin.linkReviewPriorityTask(workflow, week, entry, 'task');
    assert.equal(properties.freelance_os_review_priority, priorKey);
    assert.equal(writes, 0);
    assert.equal(entry.taskGuid, 'task');
    assert.equal(entry.recordGuid, 'project');

    const duplicate = { id: 'other', text: 'Other' };
    plugin.workflowState.drafts[week].priorityItems.push(duplicate);
    await assert.rejects(plugin.linkReviewPriorityTask(workflow, week, duplicate, 'task'), /already linked to another priority/);

    const conflictProperties = { freelance_os_review_priority: api.reviewPriorityIdKey(week, 'different') };
    const conflictTask = { guid: 'conflict', projectGuid: 'project', text: 'Conflict', status: 'none', lineItem: { props: conflictProperties, setMetaProperties: async () => true } };
    const conflictEntry = { id: 'new', text: 'New priority' };
    plugin.workflowState.drafts[week].priorityItems.push(conflictEntry);
    await assert.rejects(plugin.linkReviewPriorityTask({ projects: [{ guid: 'project', status: 'in_progress' }], tasks: [conflictTask] }, week, conflictEntry, 'conflict'), /another weekly priority/);
});

test('saving a later review preserves the original task marker and records the new association', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, records } = makeReviewJournal();
        const plugin = setupReviewPlugin(journal);
        const week = '2026-10-19';
        const priorKey = api.reviewPriorityIdKey('2026-10-12', 'origin');
        const properties = { freelance_os_review_priority: priorKey };
        let markerWrites = 0;
        const task = { guid: 'task', projectGuid: 'project', projectName: 'Project', recordGuid: 'project', text: 'Ship it', status: 'none', date: '', lineItem: { props: properties, setMetaProperties: async () => { markerWrites++; return true; } } };
        const project = { guid: 'project', name: 'Project', status: 'in_progress', deadline: '' };
        const workflow = { model: api.actionModel([project], [task], plugin.workflowState, week), recentDone: [], tasks: [task], projects: [project], byGuid: new Map([['project', { guid: 'project', name: 'Project', parentGuid: '', status: 'in_progress' }]]) };
        const draft = { notes: '', priorities: 'Ship it', step: 2, priorityItems: [{ id: 'current', text: 'Ship it', taskGuid: 'task', recordGuid: 'project', projectGuid: 'project' }] };
        const reference = await plugin.saveReviewToJournal(workflow, draft, week);
        assert.equal(properties.freelance_os_review_priority, priorKey);
        assert.equal(markerWrites, 0);
        const record = await plugin.getReviewRecord(reference, journal, { guid: 'user' });
        const heading = (await record.getLineItems(false)).find(line => line.guid === reference.headingGuid);
        const snapshot = api.parseReviewSnapshot(heading);
        assert.equal(snapshot.priorityItems[0].taskGuid, 'task');
        assert.equal(snapshot.priorityItems[0].recordGuid, 'project');
        assert.equal(snapshot.priorityItems[0].projectGuid, 'project');
    } finally { delete runtime.DateTime; }
});

test('three weeks of carrying one task create three review associations and no extra task', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal } = makeReviewJournal();
        const plugin = setupReviewPlugin(journal);
        const weeks = ['2026-10-05', '2026-10-12', '2026-10-19'];
        const priorKey = api.reviewPriorityIdKey(weeks[0], 'origin');
        const properties = { freelance_os_review_priority: priorKey };
        let markerWrites = 0; let createdTasks = 0;
        const task = { guid: 'task', projectGuid: 'project', projectName: 'Project', recordGuid: 'project', text: 'Ship it', status: 'none', date: '', lineItem: { props: properties, setMetaProperties: async () => { markerWrites++; return true; } } };
        const project = { guid: 'project', name: 'Project', status: 'in_progress', deadline: '', record: { createLineItem: async () => { createdTasks++; return null; } } };
        const byGuid = new Map([['project', { guid: 'project', name: 'Project', parentGuid: '', status: 'in_progress' }], ['project-record', { guid: 'project-record', name: 'Project', parentGuid: '', status: 'in_progress' }]]);
        const workflowFor = week => ({ model: api.actionModel([project], [task], plugin.workflowState, week), recentDone: [], tasks: [task], projects: [project], byGuid });
        plugin.workflowState.drafts[weeks[0]] = { notes: '', priorities: 'Ship it', step: 2, priorityItems: [{ id: 'p1', text: 'Ship it', taskGuid: 'task', recordGuid: 'project', projectGuid: 'project' }] };
        await plugin.saveReviewToJournal(workflowFor(weeks[0]), plugin.workflowState.drafts[weeks[0]], weeks[0]);
        const firstSnapshot = JSON.parse((await (await plugin.getReviewRecord(plugin.workflowState.reviews[weeks[0]], journal, { guid: 'user' })).getLineItems(false)).find(line => line.props?.freelance_os_review).props.freelance_os_review);
        for (const week of weeks.slice(1)) {
            const context = await plugin.loadPreviousReviewContext({ week, workflow: workflowFor(week) });
            assert.equal(context.kind, 'saved');
            assert.equal(context.items.length, 1);
            assert.equal(context.items[0].resolution.kind, 'open');
            const carried = plugin.carryPreviousPriority(context, context.items[0], {}, week);
            assert.ok(carried);
            const duplicate = plugin.carryPreviousPriority(context, context.items[0], {}, week);
            assert.equal(duplicate.id, carried.id);
            assert.equal(plugin.workflowState.drafts[week].priorityItems.length, 1);
            await plugin.saveReviewToJournal(workflowFor(week), plugin.workflowState.drafts[week], week);
        }
        assert.equal(properties.freelance_os_review_priority, priorKey);
        assert.equal(markerWrites, 0);
        assert.equal(createdTasks, 0);
        assert.equal(workflowFor(weeks[2]).tasks.length, 1);
        const currentFirst = JSON.parse((await (await plugin.getReviewRecord(plugin.workflowState.reviews[weeks[0]], journal, { guid: 'user' })).getLineItems(false)).find(line => line.props?.freelance_os_review).props.freelance_os_review);
        assert.deepEqual(currentFirst, firstSnapshot, 'the first saved review remains intact');
        const second = JSON.parse((await (await plugin.getReviewRecord(plugin.workflowState.reviews[weeks[1]], journal, { guid: 'user' })).getLineItems(false)).find(line => line.props?.freelance_os_review).props.freelance_os_review);
        const third = JSON.parse((await (await plugin.getReviewRecord(plugin.workflowState.reviews[weeks[2]], journal, { guid: 'user' })).getLineItems(false)).find(line => line.props?.freelance_os_review).props.freelance_os_review);
        assert.equal(second.priorityItems[0].taskGuid, 'task');
        assert.deepEqual(second.priorityItems[0].carriedFrom, { week: weeks[0], priorityId: 'p1' });
        assert.equal(third.priorityItems[0].taskGuid, 'task');
        assert.deepEqual(third.priorityItems[0].carriedFrom.week, weeks[1]);
        assert.equal([firstSnapshot, second, third].filter(snapshot => snapshot.priorityItems.some(item => item.taskGuid === 'task')).length, 3);
    } finally { delete runtime.DateTime; }
});

test('previous priorities prefer the saved snapshot over a local draft and stay empty calmly', async () => {
    runtime.DateTime = { dateOnly: (year, month, day) => ({ year, month, day }) };
    try {
        const { journal, recordAt } = makeReviewJournal();
        const plugin = setupReviewPlugin(journal);
        const previousWeek = '2026-10-12';
        const snapshot = api.reviewSnapshot({ week: previousWeek, userGuid: 'user', state: 'saved', notes: 'Saved', priorityItems: [{ id: 'saved-priority', text: 'Saved priority' }] });
        await recordAt('2026-10-15').createLineItem(null, null, 'heading', [{ type: 'text', text: api.reviewTitle(previousWeek) }], { freelance_os_review: JSON.stringify(snapshot) });
        plugin.workflowState.drafts[previousWeek] = { notes: '', priorities: 'Local priority', step: 2, priorityItems: [{ id: 'local-priority', text: 'Local priority' }] };
        const workflow = { tasks: [], projects: [], byGuid: new Map() };
        const saved = await plugin.loadPreviousReviewContext({ week: '2026-10-19', workflow });
        assert.equal(saved.kind, 'saved');
        assert.deepEqual(Array.from(saved.items, item => item.entry.id), ['saved-priority']);
        plugin.workflowState.drafts[previousWeek].priorityItems = [{ id: 'local-priority', text: 'Local priority' }];
        // With no Journal match, the local draft becomes the explicit fallback.
        const emptyJournal = { getGuid: () => 'other-journal', getName: () => 'Journal', isJournalPlugin: () => true, getJournalRecord: async () => null };
        plugin.workflowState.mappings.Journal = '';
        plugin.data = { getAllCollections: async () => [emptyJournal], getActiveUsers: () => [{ guid: 'user' }], getRecord: () => null };
        plugin.previousReviewContext = null;
        const draft = await plugin.loadPreviousReviewContext({ week: '2026-10-19', workflow });
        assert.equal(draft.kind, 'draft');
        assert.equal(draft.items[0].entry.text, 'Local priority');
        plugin.workflowState.drafts[previousWeek] = { notes: '', priorities: '', step: 0 };
        const emptyJournalValid = { getGuid: () => 'empty-journal', getName: () => 'Journal', isJournalPlugin: () => true, getJournalRecord: async () => ({ guid: 'empty-day', getLineItems: async () => [] }) };
        plugin.workflowState.mappings.Journal = 'journal';
        plugin.data = { getAllCollections: async () => [emptyJournalValid], getActiveUsers: () => [{ guid: 'user' }], getRecord: () => null };
        plugin.previousReviewContext = null;
        const none = await plugin.loadPreviousReviewContext({ week: '2026-10-19', workflow });
        assert.equal(none.kind, 'none');
        assert.equal(none.items.length, 0);
        assert.equal(none.warning, '');
    } finally { delete runtime.DateTime; }
});

test('historical tasks resolve from their source record even outside the active-project model', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults();
    const line = { guid: 'task-x', segments: [{ type: 'text', text: 'Inactive task' }], getTaskStatus: () => 'none', props: {} };
    const record = { guid: 'record-x', getLineItems: async () => [line] };
    plugin.data = { getRecord: guid => guid === 'record-x' ? record : null };
    const project = { guid: 'project-x', name: 'Old project', status: 'completed' };
    const workflow = { tasks: [], projects: [project], byGuid: new Map([['project-x', { guid: 'project-x', name: 'Old project', parentGuid: '', status: 'completed' }]]) };
    const resolved = await plugin.resolveHistoricalPriority({ id: 'p', text: 'Inactive task', taskGuid: 'task-x', recordGuid: 'record-x', projectGuid: 'project-x' }, '2026-10-12', workflow);
    assert.equal(resolved.kind, 'open');
    assert.equal(resolved.projectStatus, 'completed');
    assert.equal(resolved.text, 'Inactive task');
    const missing = await plugin.resolveHistoricalPriority({ id: 'p', text: 'Missing', taskGuid: 'missing', recordGuid: 'record-x' }, '2026-10-12', workflow);
    assert.equal(missing.kind, 'unavailable');
});

const TEST_CLIENT_GUID = 'CLIENTAAAAAAAAAAAAAAAAAAAA';
const TEST_OTHER_CLIENT_GUID = 'OTHERCLIENTAAAAAAAAAAAAAAA';

function captureRecord(guid, name, status, clientGuid = '') {
    return {
        guid, getName: () => name,
        prop: key => key === 'status' ? { choiceLabel: () => status } : key === 'client' && clientGuid ? { linkedRecord: () => ({ guid: clientGuid }) } : null
    };
}

test('project capture context applies once and preserves a user destination', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults();
    const project = captureRecord('project-a', 'Website refresh', 'in_progress', TEST_CLIENT_GUID);
    const backlog = captureRecord('project-b', 'Backlog project', 'backlog', TEST_CLIENT_GUID);
    const projects = { getGuid: () => 'projects', getName: () => 'Projects', getAllRecords: async () => [project, backlog] };
    const clients = { getGuid: () => 'clients', getName: () => 'Clients', getAllRecords: async () => [{ guid: TEST_CLIENT_GUID, getName: () => 'Northwind Studio' }] };
    plugin.data = { getAllCollections: async () => [projects, clients] };
    let activePanel = { getNavigation: () => ({ type: 'edit_panel' }), getActiveRecord: () => ({ guid: 'project-a' }), getElement: () => ({ querySelector: selector => selector === '.os-capture-feedback' ? feedback : null }) };
    const feedback = { textContent: '' };
    let toast = '';
    plugin.ui = { getActivePanel: () => activePanel, addToaster: ({ title }) => { toast = title; } };
    plugin.openDashboard = async () => { activePanel = { getNavigation: () => ({ type: 'custom' }), getActiveRecord: () => null, getElement: () => ({ querySelector: selector => selector === '.os-capture-feedback' ? feedback : null }) }; };
    plugin.render = async () => {};
    plugin.captureDraft = 'Draft kept';
    plugin.captureDestinationSource = 'default';
    plugin.captureProjectGuid = '';
    await plugin.captureTaskForActiveProject();
    assert.equal(plugin.captureProjectGuid, 'project-a');
    assert.equal(plugin.captureDestinationSource, 'context');
    assert.equal(plugin.captureContext.clientName, 'Northwind Studio');
    assert.equal(plugin.captureDraft, 'Draft kept');
    assert.match(feedback.textContent, /Existing draft kept/);

    activePanel = { getNavigation: () => ({ type: 'edit_panel' }), getActiveRecord: () => ({ guid: 'project-a' }), getElement: () => ({ querySelector: selector => selector === '.os-capture-feedback' ? feedback : null }) };
    plugin.captureDestinationSource = 'user';
    plugin.captureProjectGuid = '';
    toast = '';
    await plugin.captureTaskForActiveProject();
    assert.equal(plugin.captureProjectGuid, '');
    assert.equal(plugin.captureDestinationSource, 'user');
    assert.match(toast, /Kept your existing destination/);

    plugin.captureDestinationSource = 'default';
    plugin.captureProjectGuid = '';
    activePanel = { getNavigation: () => ({ type: 'edit_panel' }), getActiveRecord: () => ({ guid: 'project-b' }) };
    toast = '';
    await plugin.captureTaskForActiveProject();
    assert.match(toast, /Only in-progress or in-review/);
    assert.equal(plugin.captureProjectGuid, '');
    assert.equal(plugin.captureDestinationSource, 'default');
});

test('capture revalidates the destination collection and terminal state', async () => {
    const plugin = new api.Plugin();
    const closed = captureRecord('project-closed', 'Closed', 'completed');
    const projects = { getGuid: () => 'projects', getName: () => 'Projects', getAllRecords: async () => [closed] };
    plugin.data = { getAllCollections: async () => [projects] };
    await assert.rejects(plugin.captureTask('Keep this', 'project-closed', false), /closed/);
    await assert.rejects(plugin.captureTask('Keep this', 'missing', false), /no longer available/);
    const projectsWithoutJournal = { getGuid: () => 'projects', getName: () => 'Projects', getAllRecords: async () => [] };
    plugin.data = { getAllCollections: async () => [projectsWithoutJournal] };
    await assert.rejects(plugin.captureTask('Keep this', '', false), /Journal collection/);
});

test('agenda suggestions are limited to a client context with no project relationship', async () => {
    const plugin = new api.Plugin();
    const client = { guid: TEST_CLIENT_GUID, getName: () => 'Northwind Studio', prop: () => null };
    const active = captureRecord('project-a', 'Same title', 'in_progress', TEST_CLIENT_GUID);
    const closed = captureRecord('project-b', 'Same title', 'completed', TEST_CLIENT_GUID);
    const projects = { getGuid: () => 'projects', getName: () => 'Projects', getAllRecords: async () => [active, closed] };
    const clients = { getGuid: () => 'clients', getName: () => 'Clients', getAllRecords: async () => [client] };
    const invoices = { getGuid: () => 'invoices', getName: () => 'Invoices', getAllRecords: async () => [] };
    const task = (guid, record, segments) => ({ guid, segments, getRecord: () => record, getTaskStatus: () => 'none' });
    const onClient = task('client-task', client, [{ type: 'text', text: 'Send proposal' }]);
    const withProject = task('project-task', client, [{ type: 'text', text: 'Send proposal' }, { type: 'ref', text: { guid: 'project-a' } }]);
    const journalRecord = { guid: 'journal-record', getName: () => 'Journal', prop: () => null };
    const twoClients = task('two-client-task', journalRecord, [{ type: 'text', text: 'Two clients' }, { type: 'ref', text: { guid: TEST_CLIENT_GUID } }, { type: 'ref', text: { guid: TEST_OTHER_CLIENT_GUID } }]);
    const otherClient = { guid: TEST_OTHER_CLIENT_GUID, getName: () => 'Other', prop: () => null };
    clients.getAllRecords = async () => [client, otherClient];
    plugin.data = {
        getAllCollections: async () => [clients, invoices, projects],
        searchByQuery: async () => ({ lines: [onClient, withProject, twoClients] })
    };
    const data = await plugin.loadData();
    const suggestions = data.agendaTasks.find(task => task.guid === 'client-task');
    assert.equal(suggestions.clientGuid, TEST_CLIENT_GUID);
    assert.equal(suggestions.projectCandidates.length, 1);
    assert.equal(suggestions.projectCandidates[0].guid, 'project-a');
    const linked = data.agendaTasks.find(task => task.guid === 'project-task');
    assert.equal(linked.projectGuid, 'project-a');
    assert.equal(linked.projectCandidates.length, 0);
    const ambiguous = data.agendaTasks.find(task => task.guid === 'two-client-task');
    assert.equal(ambiguous.clientAmbiguous, true);
    assert.equal(ambiguous.projectCandidates.length, 0);
});

test('linking a suggested project appends a GUID ref without changing other segments', async () => {
    const plugin = new api.Plugin(); plugin.workflowState = api.workflowDefaults();
    const projectA = captureRecord('project-a', 'Same title', 'in_progress', TEST_CLIENT_GUID);
    const projectB = captureRecord('project-b', 'Same title', 'in_progress', TEST_CLIENT_GUID);
    const projects = { getGuid: () => 'projects', getName: () => 'Projects', getAllRecords: async () => [projectA, projectB] };
    const client = { guid: TEST_CLIENT_GUID, getName: () => 'Northwind Studio' };
    const clients = { getGuid: () => 'clients', getName: () => 'Clients', getAllRecords: async () => [client] };
    const segments = [{ type: 'text', text: 'Send ' }, { type: 'ref', text: { guid: 'deliverable' } }, { type: 'datetime', text: '2026-10-30' }];
    let written = null;
    const line = { guid: 'task', segments, setSegments: async value => { written = value; return true; }, getTaskStatus: () => 'none' };
    const source = { guid: TEST_CLIENT_GUID, getLineItems: async () => [line] };
    plugin.data = { getAllCollections: async () => [projects, clients], getRecord: guid => guid === TEST_CLIENT_GUID ? source : null };
    const linked = await plugin.linkTaskToSuggestedProject({ guid: 'task', recordGuid: TEST_CLIENT_GUID, text: 'Send' }, 'project-b');
    assert.equal(linked.guid, 'project-b');
    assert.equal(written.length, 4);
    assert.deepEqual(Array.from(written.slice(0, 3)), Array.from(segments));
    assert.deepEqual({ guid: written[3].text.guid, title: written[3].text.title }, { guid: 'project-b', title: 'Same title' });

    line.segments = [{ type: 'text', text: 'Send' }, { type: 'ref', text: { guid: 'project-a' } }];
    written = null;
    await assert.rejects(plugin.linkTaskToSuggestedProject({ guid: 'task', recordGuid: TEST_CLIENT_GUID }, 'project-b'), /already linked/);
    assert.equal(written, null);

    line.segments = [{ type: 'text', text: 'Send' }, { type: 'ref', text: { guid: 'project-a' } }, { type: 'ref', text: { guid: 'project-b' } }];
    await assert.rejects(plugin.linkTaskToSuggestedProject({ guid: 'task', recordGuid: TEST_CLIENT_GUID }, 'project-a'), /several projects/);

    const otherClientProject = captureRecord('project-c', 'Other', 'in_progress', TEST_OTHER_CLIENT_GUID);
    projects.getAllRecords = async () => [projectA, projectB, otherClientProject];
    line.segments = [{ type: 'text', text: 'Send' }];
    await assert.rejects(plugin.linkTaskToSuggestedProject({ guid: 'task', recordGuid: TEST_CLIENT_GUID }, 'project-c'), /belongs to this client/);
});
