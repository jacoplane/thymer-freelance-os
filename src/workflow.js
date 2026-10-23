function workflowDefaults() {
    return { version: 1, mappings: {}, next: {}, nextLabels: {}, nextRecovery: {}, focus: {}, waiting: {}, drafts: {}, reviews: {} };
}

const CLIENT_REVIEW_CHECKPOINT_PROPERTY = 'freelance_os_review_checkpoint';

function reviewWeek(today = localDate()) {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    return localDate(date);
}

function projectRoot(guid, records) {
    const visited = new Set();
    while (guid && records.has(guid) && !visited.has(guid)) {
        visited.add(guid);
        const record = records.get(guid);
        if (!record.parentGuid) return guid;
        guid = record.parentGuid;
    }
    return '';
}

function taskDateSegments(segments, date, value = date) {
    const next = segments.map(segment => ({ ...segment }));
    const index = next.findIndex(segment => segment.type === 'datetime');
    if (index >= 0) {
        if (date) next[index] = { type: 'datetime', text: value };
        else next.splice(index, 1);
    } else if (date) next.push({ type: 'datetime', text: value });
    return next;
}

async function workflowChildren(line, record) {
    if (typeof line.getChildren === 'function') return line.getChildren();
    // Older desktop builds expose cached children and parent_guid instead of getChildren().
    const lines = await record.getLineItems();
    return lines.filter(item => item.parent_guid === line.guid);
}

function actionModel(projects, tasks, state, today = localDate(), complete = true) {
    const active = projects.filter(project => ['in_progress', 'in_review'].includes(project.status));
    const activeIds = new Set(active.map(project => project.guid));
    const open = tasks.filter(task => activeIds.has(task.projectGuid) && !['done', 'canceled', 'cancelled'].includes(task.status));
    const waiting = open.filter(task => ['blocked', 'waiting'].includes(task.status));
    const actions = open.filter(task => !['blocked', 'waiting'].includes(task.status));
    const next = actions.filter(task => state.next[task.projectGuid] === task.guid);
    const selected = new Set(state.focus[today] || []);
    const focus = actions.filter(task => selected.has(task.guid));
    const attention = active.flatMap(project => {
        const projectTasks = open.filter(task => task.projectGuid === project.guid);
        // Client review checkpoints get their own clearer deadline cue below.
        const overdueTasks = projectTasks.filter(task => !task.clientReview && task.date && task.date < today);
        const waitingTasks = projectTasks.filter(task => ['blocked', 'waiting'].includes(task.status));
        const followupTasks = waitingTasks.filter(task => state.waiting[task.guid]?.followup && state.waiting[task.guid].followup <= today);
        const clientReviewTasks = projectTasks.filter(task => task.clientReview);
        const clientReviewOverdue = clientReviewTasks.filter(task => task.date && task.date < today);
        const clientReviewDueSoon = clientReviewTasks.filter(task => task.date && task.date >= today && dateDay(task.date) <= dateDay(today) + 7);
        const clientReviewUndated = clientReviewTasks.filter(task => !task.date);
        const issues = [];
        if (complete && !next.some(task => task.projectGuid === project.guid)) issues.push(projectTasks.some(task => !['blocked', 'waiting'].includes(task.status)) ? 'Choose a next action' : projectTasks.length ? 'All work is waiting' : 'Add a next action');
        if (dateDay(project.deadline) !== null && project.deadline < today) issues.push('Project deadline overdue');
        else if (dateDay(project.deadline) !== null && dateDay(project.deadline) <= dateDay(today) + 7) issues.push('Project deadline within 7 days');
        if (overdueTasks.length) issues.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`);
        if (waitingTasks.length) issues.push(`${waitingTasks.length} waiting task${waitingTasks.length === 1 ? '' : 's'}`);
        if (followupTasks.length) issues.push(`${followupTasks.length} follow-up${followupTasks.length === 1 ? '' : 's'} due`);
        if (clientReviewOverdue.length) issues.push(`${clientReviewOverdue.length} client review overdue`);
        if (clientReviewDueSoon.length) issues.push(`${clientReviewDueSoon.length} client review due in 7 days`);
        if (clientReviewUndated.length) issues.push(`${clientReviewUndated.length} client review missing a date`);
        const recovery = state.nextRecovery?.[project.guid] || null;
        return issues.length ? [{ project, issues, tasks: actions.filter(task => task.projectGuid === project.guid), next: next.find(task => task.projectGuid === project.guid), overdueTasks, waitingTasks, followupTasks, clientReviewTasks, recovery }] : [];
    });
    const rank = task => (task.date && task.date < today ? 0 : task.date === today ? 1 : task.status === 'important' ? 2 : 3);
    const sort = (a, b) => rank(a) - rank(b) || (a.date || '9999').localeCompare(b.date || '9999') || a.text.localeCompare(b.text);
    actions.sort(sort); next.sort(sort); focus.sort(sort);
    waiting.sort((a, b) => (state.waiting[a.guid]?.followup || '9999').localeCompare(state.waiting[b.guid]?.followup || '9999'));
    return { active, actions, next, focus, waiting, attention, overdue: actions.filter(task => task.date && task.date < today), complete };
}

function reconcileWorkflowPointers(state, model, allTasks = []) {
    if (!model.complete) return false;
    let changed = false;
    const actionable = new Map(model.actions.map(task => [task.guid, task]));
    for (const [projectGuid, taskGuid] of Object.entries(state.next)) {
        const task = actionable.get(taskGuid);
        if (!task || task.projectGuid !== projectGuid) {
            const previous = allTasks.find(item => item.guid === taskGuid);
            const reason = previous && previous.status === 'done' ? 'completed' : previous && ['blocked', 'waiting'].includes(previous.status) ? 'waiting' : 'removed';
            state.nextRecovery ||= {};
            state.nextRecovery[projectGuid] = { reason, label: previous?.text || state.nextLabels[projectGuid] || '' };
            delete state.next[projectGuid];
            delete state.nextLabels[projectGuid];
            changed = true;
        } else if (state.nextLabels[projectGuid] !== task.text) {
            state.nextLabels[projectGuid] = task.text;
            changed = true;
        }
        if (state.nextRecovery?.[projectGuid] && task?.projectGuid === projectGuid) {
            delete state.nextRecovery[projectGuid];
            changed = true;
        }
    }
    for (const projectGuid of Object.keys(state.nextLabels)) if (!state.next[projectGuid]) {
        delete state.nextLabels[projectGuid];
        changed = true;
    }
    const valid = new Set(actionable.keys());
    for (const [day, taskGuids] of Object.entries(state.focus)) {
        const retained = taskGuids.filter(guid => valid.has(guid));
        if (retained.length !== taskGuids.length) {
            if (retained.length) state.focus[day] = retained;
            else delete state.focus[day];
            changed = true;
        }
    }
    return changed;
}

const NEXT_ACTION_MARKER = 'project-next-v1';
const NEXT_ACTION_PROPERTY = 'freelance_os_next_action';
const REVIEW_PRIORITY_PROPERTY = 'freelance_os_review_priority';

function weeklyPriorityLines(value = '') {
    return value.split(/\r?\n/).map(text => text.trim()).filter(Boolean).map(text => ({ text }));
}

function reviewPriorityKey(week, text) {
    return `${week}|${text.trim().toLowerCase()}`;
}

let reviewPrioritySequence = 0;
function reviewPriorityIdKey(week, id) {
    return `${week}|id:${id}`;
}

function nextReviewPriorityId() {
    reviewPrioritySequence++;
    return `priority-${Date.now().toString(36)}-${reviewPrioritySequence.toString(36)}`;
}

function reconcileReviewPriorityItems(draft, value) {
    const lines = weeklyPriorityLines(value);
    const previous = Array.isArray(draft.priorityItems) ? draft.priorityItems : [];
    const retained = new Set();
    const items = lines.map((line, index) => {
        const exact = previous.findIndex((item, itemIndex) => !retained.has(itemIndex) && String(item.text || '').trim().toLowerCase() === line.text.toLowerCase());
        if (exact >= 0) { retained.add(exact); return { ...previous[exact], text: line.text }; }
        return { line, index };
    });
    for (let index = 0; index < items.length; index++) {
        if (!items[index]?.line) continue;
        const sameIndex = index < previous.length && !retained.has(index) ? index : -1;
        const fallback = sameIndex >= 0 ? sameIndex : previous.findIndex((item, itemIndex) => !retained.has(itemIndex));
        if (fallback >= 0) {
            retained.add(fallback);
            items[index] = { ...previous[fallback], text: items[index].line.text };
        } else items[index] = { id: nextReviewPriorityId(), text: items[index].line.text };
    }
    draft.priorityItems = items;
    draft.priorities = value;
    return items;
}

function reviewPriorityTask(entry, week, tasks = []) {
    if (entry?.taskGuid) {
        const linked = tasks.find(task => task.guid === entry.taskGuid);
        if (linked) return linked;
    }
    return tasks.find(task => task.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY] === reviewPriorityIdKey(week, entry?.id)
        || task.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY] === reviewPriorityKey(week, entry?.text));
}

function nativeNextActionMarkers(lines) {
    return lines.filter(line => line.props?.[NEXT_ACTION_PROPERTY] === NEXT_ACTION_MARKER);
}

function reconcileNativeNextActions(state, projects, tasks, markers, complete = true) {
    if (!complete) return { write: [], remove: [] };
    const actionable = new Map(tasks.filter(task => !['done', 'canceled', 'cancelled', 'blocked', 'waiting'].includes(task.status)).map(task => [task.guid, task]));
    const projectByRecord = new Map(projects.map(project => [project.guid, project]));
    const write = [];
    const remove = [];
    for (const project of projects) {
        const projectMarkers = markers.filter(marker => marker.recordGuid === project.guid);
        if (!['in_progress', 'in_review'].includes(project.status)) {
            delete state.next[project.guid];
            delete state.nextLabels[project.guid];
            delete state.nextRecovery?.[project.guid];
            continue;
        }
        if (projectMarkers.length) {
            const valid = projectMarkers.map(marker => {
                const ref = marker.segments?.find(segment => segment.type === 'ref')?.text;
                const guid = typeof ref === 'object' ? ref.guid : ref;
                return { marker, task: actionable.get(guid), ref };
            }).find(entry => entry.task?.projectGuid === project.guid);
            if (valid) {
                const { task, marker, ref } = valid;
                state.next[project.guid] = task.guid;
                state.nextLabels[project.guid] = task.text;
                delete state.nextRecovery?.[project.guid];
                remove.push(...projectMarkers.filter(candidate => candidate !== marker));
                if (typeof ref !== 'object' || ref.title !== task.text) write.push({ project, task });
            } else {
                const marker = projectMarkers[0];
                const ref = marker.segments?.find(segment => segment.type === 'ref')?.text;
                const guid = typeof ref === 'object' ? ref?.guid : ref;
                const previous = tasks.find(task => task.guid === guid);
                const reason = previous && previous.status === 'done' ? 'completed' : previous && ['blocked', 'waiting'].includes(previous.status) ? 'waiting' : 'removed';
                state.nextRecovery ||= {};
                state.nextRecovery[project.guid] = { reason, label: previous?.text || (typeof ref === 'object' ? ref?.title : '') || state.nextLabels[project.guid] || '' };
                delete state.next[project.guid];
                delete state.nextLabels[project.guid];
                remove.push(...projectMarkers);
            }
            continue;
        }
        const prior = actionable.get(state.next[project.guid]);
        if (prior?.projectGuid === project.guid) {
            state.nextLabels[project.guid] = prior.text;
            write.push({ project, task: prior });
        } else if (state.next[project.guid]) {
            const previous = tasks.find(task => task.guid === state.next[project.guid]);
            const reason = previous && previous.status === 'done' ? 'completed' : previous && ['blocked', 'waiting'].includes(previous.status) ? 'waiting' : 'removed';
            state.nextRecovery ||= {};
            state.nextRecovery[project.guid] = { reason, label: previous?.text || state.nextLabels[project.guid] || '' };
            delete state.next[project.guid];
            delete state.nextLabels[project.guid];
        }
    }
    for (const marker of markers) if (!projectByRecord.has(marker.recordGuid)) remove.push(marker);
    return { write, remove };
}

function filterActions(tasks, query = '', projectGuid = '') {
    const text = query.trim().toLowerCase();
    return tasks.filter(task => (!projectGuid || task.projectGuid === projectGuid) && (!text || `${task.text} ${task.projectName}`.toLowerCase().includes(text)));
}

function weeklyReviewText(workflow, draft, state, today = localDate()) {
    const model = workflow.model;
    const lines = ['Freelance OS weekly review', `Week of ${reviewWeek(today)} · reviewed ${today}`, '', 'Project check-in',
        ...model.active.map(project => {
            const next = model.next.find(task => task.projectGuid === project.guid);
            return `${project.name}: ${next ? next.text : 'Next action still to choose'}`;
        }), '', 'Waiting and follow-ups',
        ...model.waiting.map(task => `${task.projectName}: ${task.text}${state.waiting[task.guid]?.reason ? ` — ${state.waiting[task.guid].reason}` : ''}${state.waiting[task.guid]?.followup ? ` (follow up ${state.waiting[task.guid].followup})` : ''}`),
        '', `Open overdue actions: ${model.overdue.length}`, `Done tasks updated in the last 7 days: ${workflow.recentDone.length}`,
        ...workflow.recentDone.map(task => `${task.projectName}: ${task.text}`), '', 'Wins and observations', draft.notes || 'No notes added.', '', 'Priorities for next week', draft.priorities || 'No priorities added.'];
    if (!model.complete) lines.push('', 'Some project tasks could not be loaded; this review is incomplete.');
    return lines.join('\n');
}

const Workflow = {
    loadWorkflowState() {
        if (this.workflowState) return this.workflowState;
        let saved;
        try { saved = JSON.parse(this.getLocalStorage?.('workflow-v1') || '{}'); } catch { saved = {}; }
        const defaults = workflowDefaults();
        this.workflowState = { ...defaults };
        for (const key of Object.keys(defaults).filter(key => key !== 'version')) {
            if (saved[key] && typeof saved[key] === 'object' && !Array.isArray(saved[key])) this.workflowState[key] = saved[key];
        }
        return this.workflowState;
    },

    persistWorkflow() {
        try { this.setLocalStorage('workflow-v1', JSON.stringify(this.workflowState)); return true; }
        catch { this.workflowMessage = 'Local changes could not be saved. Keep this dashboard open and try again.'; return false; }
    },

    collectionGuid(role, collections = this.workflowCollections || []) {
        const state = this.loadWorkflowState();
        const mapped = collections.find(collection => collection.getGuid() === state.mappings[role]);
        return mapped?.getGuid() || collections.find(collection => role === 'Journal' ? collection.isJournalPlugin?.() : collection.getName?.().toLowerCase() === role.toLowerCase())?.getGuid() || '';
    },

    async loadWorkflowData() {
        const state = this.loadWorkflowState();
        const collections = this.workflowCollections = await this.data.getAllCollections();
        const collection = collections.find(item => item.getGuid() === this.collectionGuid('Projects', collections));
        if (!collection) return { error: 'Choose your Projects collection in Settings.' };
        const records = await collection.getAllRecords();
        const byGuid = new Map(records.map(record => [record.guid, { record, guid: record.guid, name: record.getName(), parentGuid: getParentGuid(record), status: String(getProp(record, 'status')).toLowerCase(), deadline: getProp(record, 'deadline') }]));
        const projects = [...byGuid.values()].filter(record => !record.parentGuid && record.name !== 'Kanban - Active Projects' && !isTemplateRecord(record.record));
        let complete = true;
        const taskMap = new Map();
        const nextMarkers = [];
        const clientReviewSections = new Set();
        const add = line => {
            const status = line.getTaskStatus?.();
            if (status === null || status === undefined) return;
            const recordGuid = line.getRecord?.()?.guid;
            let root = projectRoot(recordGuid, byGuid);
            if (!root) {
                const refs = new Set((line.segments || []).filter(segment => segment.type === 'ref').map(segment => projectRoot(typeof segment.text === 'object' ? segment.text?.guid : segment.text, byGuid)).filter(Boolean));
                if (refs.size === 1) root = [...refs][0];
            }
            if (!root || !byGuid.has(root)) return;
            const text = extractLineText(line);
            if (!text) return;
            const clientReview = line.props?.[CLIENT_REVIEW_CHECKPOINT_PROPERTY] === 'checkpoint-v1' || clientReviewSections.has(line.parent_guid) || taskMap.get(line.guid)?.clientReview === true;
            taskMap.set(line.guid, { guid: line.guid, lineItem: line, text, status, recordGuid, projectGuid: root, projectName: byGuid.get(root).name, date: dateDay(extractLineDate(line)) !== null ? extractLineDate(line) : '', updated: line.getUpdatedAt?.(), clientReview });
        };
        // Read actual project pages, so an arbitrary workspace search limit cannot create false gaps.
        for (let index = 0; index < records.length; index += 8) {
            await Promise.all(records.slice(index, index + 8).map(async record => {
                try {
                    const lines = await record.getLineItems(false);
                    for (const line of lines) if (line.type === 'heading' && extractLineText(line).toLowerCase().replace(/[^a-z]/g, '') === 'clientreviewcheckpoints') clientReviewSections.add(line.guid);
                    for (const line of lines) {
                        add(line);
                        if (line.props?.[NEXT_ACTION_PROPERTY] === NEXT_ACTION_MARKER) nextMarkers.push({ line, recordGuid: record.guid, segments: line.segments });
                    }
                }
                catch { complete = false; }
            }));
        }
        try {
            const linked = await this.data.searchByQuery('@task @todo', 1000);
            if (linked.error) throw new Error(linked.error);
            linked.lines?.forEach(add);
            if (linked.lines?.length >= 1000) complete = false;
        } catch { complete = false; }
        const tasks = [...taskMap.values()];
        const today = localDate();
        const recentDone = tasks.filter(task => task.status === 'done' && task.updated instanceof Date && task.updated.getTime() >= Date.now() - 7 * 86400000);
        const priorNextState = JSON.stringify({ next: state.next, nextLabels: state.nextLabels, nextRecovery: state.nextRecovery });
        const nativeReconciliation = reconcileNativeNextActions(state, projects, tasks, nextMarkers, complete);
        const model = actionModel(projects, tasks, state, today, complete);
        const stateChanged = reconcileWorkflowPointers(state, model, tasks) || priorNextState !== JSON.stringify({ next: state.next, nextLabels: state.nextLabels, nextRecovery: state.nextRecovery });
        if (stateChanged) this.persistWorkflow();
        if (complete && !this.syncingNativeNextActions) {
            this.syncingNativeNextActions = true;
            try {
                const touchedProjects = new Set();
                for (const marker of nativeReconciliation.remove) {
                    if (await marker.line.delete() === false) throw new Error('Stale project next action could not be removed');
                    if (byGuid.has(marker.recordGuid)) touchedProjects.add(marker.recordGuid);
                }
                for (const guid of touchedProjects) await this.pruneNativeNextActionSection(byGuid.get(guid).record);
                for (const { project, task } of nativeReconciliation.write) await this.writeNativeNextAction(project.record, task);
            } catch {
                // Preserve the last good local state; the next refresh can retry native sync.
            } finally { this.syncingNativeNextActions = false; }
        }
        return { projects, tasks, model, recentDone, byGuid };
    },

    async writeNativeNextAction(record, task) {
        if (!record) throw new Error('Project page is unavailable');
        const lines = await record.getLineItems(false);
        const markers = nativeNextActionMarkers(lines);
        if (!task) {
            for (const marker of markers) if (await marker.delete() === false) throw new Error('Project next action could not be cleared');
            await this.pruneNativeNextActionSection(record);
            return true;
        }
        let marker = markers[0];
        if (marker) {
            const segments = [{ type: 'text', text: 'Next action: ' }, { type: 'ref', text: { guid: task.guid, title: task.text } }];
            if (JSON.stringify(marker.segments || []) !== JSON.stringify(segments) && await marker.setSegments(segments) === false) throw new Error('Project next action could not be updated');
            for (const duplicate of markers.slice(1)) if (await duplicate.delete() === false) throw new Error('Duplicate project next action could not be removed');
            return true;
        }

        let section = lines.find(line => line.type === 'heading' && extractLineText(line).toLowerCase().replace(/[^a-z]/g, '') === 'nextactions');
        if (!section) {
            const title = lines.find(line => line.type === 'heading' && line.parent_guid === record.guid && (line.getHeadingSize?.() === 1 || line.props?.hsize === 1))
                || lines.find(line => line.type === 'heading' && line.parent_guid === record.guid);
            const rootLines = lines.filter(line => line.parent_guid === record.guid);
            section = await record.createLineItem(title || null, title ? null : rootLines.at(-1) || null, 'heading', [{ type: 'text', text: 'Next actions' }], { hsize: 2, [NEXT_ACTION_PROPERTY]: 'section-v1' });
            if (!section) throw new Error('Project next actions section could not be created');
        }
        const children = lines.filter(line => line.parent_guid === section.guid);
        const segments = [{ type: 'text', text: 'Next action: ' }, { type: 'ref', text: { guid: task.guid, title: task.text } }];
        marker = await record.createLineItem(section, children.at(-1) || null, 'text', segments, { [NEXT_ACTION_PROPERTY]: NEXT_ACTION_MARKER });
        if (!marker) throw new Error('Project next action reference could not be saved');
        return true;
    },

    async pruneNativeNextActionSection(record) {
        const lines = await record.getLineItems(false);
        const section = lines.find(line => line.props?.[NEXT_ACTION_PROPERTY] === 'section-v1');
        if (!section) return true;
        if (lines.some(line => line.parent_guid === section.guid)) return true;
        if (await section.delete() === false) throw new Error('Empty project next actions section could not be removed');
        return true;
    },

    async setActionStatus(task, status) {
        // The desktop MCP calls this "blocked"; the Plugin SDK calls it "waiting".
        if (await task.lineItem.setTaskStatus(status === 'blocked' ? 'waiting' : status) === false) throw new Error('Task state was not saved');
    },

    async rescheduleAction(task, date) {
        if (date && dateDay(date) === null) throw new Error('Choose a valid date');
        const parts = date ? date.split('-').map(Number) : [];
        // SDK segments require a DateTimeValue; MCP's date-string shorthand is not supported here.
        const value = date ? (typeof DateTime !== 'undefined' ? DateTime.dateOnly(parts[0], parts[1] - 1, parts[2]).value() : { d: date.replace(/-/g, '') }) : '';
        if (await task.lineItem.setSegments(taskDateSegments(task.lineItem.segments || [], date, value)) === false) throw new Error('Task date was not saved');
    },

    async getReviewRecord(reference, journal, user) {
        if (!journal) {
            const collections = await this.data.getAllCollections();
            journal = collections.find(collection => collection.getGuid() === (reference?.journalGuid || this.collectionGuid('Journal', collections)));
            user = this.data.getActiveUsers?.().find(item => item.guid === reference?.userGuid) || this.data.getActiveUsers?.()[0];
        }
        if (!journal?.isJournalPlugin?.() || !user) throw new Error('Choose a Journal collection in Settings');
        const cached = reference?.recordGuid ? this.data.getRecord?.(reference.recordGuid) : null;
        if (cached) return cached;
        const date = reference?.journalDate || (reference?.savedAt ? localDate(new Date(reference.savedAt)) : '');
        const parts = date ? date.split('-').map(Number) : [];
        const target = date ? DateTime.dateOnly(parts[0], parts[1] - 1, parts[2]) : undefined;
        return journal.getJournalRecord(user, target);
    },

    async saveReviewToJournal(workflow, draft, today = localDate()) {
        if (this.reviewSaving) return null;
        this.reviewSaving = true;
        try {
            const collections = await this.data.getAllCollections();
            const journal = collections.find(collection => collection.getGuid() === this.collectionGuid('Journal', collections));
            const user = this.data.getActiveUsers?.()[0];
            if (!journal?.isJournalPlugin?.() || !user) throw new Error('Choose a Journal collection in Settings');
            const prior = this.workflowState.reviews[reviewWeek(today)];
            const record = await this.getReviewRecord(prior?.journalGuid === journal.getGuid() ? prior : null, journal, user);
            if (!record) throw new Error('Journal is unavailable');
            const title = `Weekly review · week of ${reviewWeek(today)}`;
            const week = reviewWeek(today);
            if (!Array.isArray(draft.priorityItems)) reconcileReviewPriorityItems(draft, draft.priorities || '');
            this.hydrateReviewPriorityLinks(draft, week, workflow.tasks || []);
            const lines = await record.getLineItems();
            let heading = lines.find(line => extractLineText(line) === title);
            if (!heading) heading = await record.createLineItem(null, null, 'heading', [{ type: 'text', text: title }]);
            if (!heading) throw new Error('Review heading could not be saved');
            const children = await workflowChildren(heading, record);
            let body = children.find(line => extractLineText(line).startsWith('Freelance OS weekly review'));
            const segments = [{ type: 'text', text: 'Freelance OS weekly review' }];
            if (body) { if (await body.setSegments(segments) === false) throw new Error('Review could not be updated'); }
            else body = await record.createLineItem(heading, null, 'text', segments);
            if (!body) throw new Error('Review summary could not be saved');
            // Native text segments flatten newlines. Save separate lines so the Journal stays readable.
            const summaryLines = weeklyReviewText(workflow, draft, this.workflowState, today).split('\n').slice(1).filter(line => line.trim());
            const existing = await workflowChildren(body, record);
            let inPriorities = false;
            let priorityIndex = 0;
            let previous = null;
            for (let index = 0; index < summaryLines.length; index++) {
                const text = summaryLines[index];
                if (text === 'Priorities for next week') inPriorities = true;
                const entry = inPriorities ? draft.priorityItems?.[priorityIndex] : null;
                const linkedTask = entry?.text === text ? reviewPriorityTask(entry, week, workflow.tasks || []) : null;
                if (entry?.text === text) priorityIndex++;
                if (entry && linkedTask && linkedTask.lineItem?.setMetaProperties) {
                    await linkedTask.lineItem.setMetaProperties({ [REVIEW_PRIORITY_PROPERTY]: reviewPriorityIdKey(week, entry.id) });
                    entry.taskGuid = linkedTask.guid;
                }
                const content = linkedTask
                    ? [{ type: 'ref', text: { guid: linkedTask.guid, title: text } }]
                    : [{ type: 'text', text }];
                let line = existing[index];
                if (line) { if (await line.setSegments(content) === false) throw new Error('Review line could not be updated'); }
                else line = await record.createLineItem(body, previous, 'text', content);
                if (!line) throw new Error('Review line could not be saved');
                previous = line;
            }
            for (const line of existing.slice(summaryLines.length)) if (await line.delete() === false) throw new Error('Outdated review line could not be removed');
            const details = record.getJournalDetails?.();
            const reference = { savedAt: new Date().toISOString(), journalGuid: journal.getGuid(), journalDate: localDate(details?.date || new Date()), userGuid: details?.userGuid || user.guid, recordGuid: record.guid, headingGuid: heading.guid };
            this.workflowState.reviews[reviewWeek(today)] = reference;
            this.persistWorkflow();
            return reference;
        } finally { this.reviewSaving = false; }
    },

    hydrateReviewPriorityLinks(draft, week, tasks = []) {
        if (!Array.isArray(draft.priorityItems)) reconcileReviewPriorityItems(draft, draft.priorities || '');
        for (const entry of draft.priorityItems) {
            const linked = reviewPriorityTask(entry, week, tasks);
            if (linked) entry.taskGuid = linked.guid;
        }
        return draft.priorityItems;
    },

    async linkReviewPriorityTask(workflow, week, entry, taskGuid) {
        const task = (workflow.tasks || []).find(item => item.guid === taskGuid);
        if (!task || !['in_progress', 'in_review'].includes(workflow.projects.find(project => project.guid === task.projectGuid)?.status)) throw new Error('Choose an open task in an active project.');
        if (['done', 'canceled', 'cancelled', 'blocked', 'waiting'].includes(task.status)) throw new Error('Choose an actionable task. Waiting or completed tasks cannot be linked as a priority.');
        const key = reviewPriorityIdKey(week, entry.id);
        const marker = task.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY];
        if (marker && marker !== key && marker !== reviewPriorityKey(week, entry.text)) throw new Error('This task is already linked to another weekly priority.');
        const duplicate = (workflow.tasks || []).find(item => item.guid !== task.guid && item.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY] === key);
        if (duplicate) throw new Error('This priority is already linked to another task.');
        if (typeof task.lineItem?.setMetaProperties !== 'function') throw new Error('This Thymer build cannot save task links. Update Thymer and try again.');
        if (await task.lineItem.setMetaProperties({ [REVIEW_PRIORITY_PROPERTY]: key }) === false) throw new Error('The task link could not be saved.');
        entry.taskGuid = task.guid;
        entry.projectGuid = task.projectGuid;
        this.persistWorkflow();
        return task;
    },

    async addReviewPriorityTask(workflow, week, priority, projectGuid, entry = null) {
        const text = String(priority || '').trim();
        if (!text) throw new Error('Write a priority first.');
        const project = workflow.projects.find(item => item.guid === projectGuid && ['in_progress', 'in_review'].includes(item.status));
        if (!project) throw new Error('Choose an active project.');
        const key = entry?.id ? reviewPriorityIdKey(week, entry.id) : reviewPriorityKey(week, text);
        const existing = (workflow.tasks || []).find(task => task.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY] === key);
        if (existing) { if (entry) entry.taskGuid = existing.guid; return { task: existing, existing: true }; }
        const line = await project.record.createLineItem(null, null, 'task', [{ type: 'text', text }], { [REVIEW_PRIORITY_PROPERTY]: key });
        if (!line) throw new Error('Project task could not be created.');
        const task = { guid: line.guid, lineItem: line, text, projectGuid, projectName: project.name, recordGuid: project.guid, status: 'none', date: '' };
        if (entry) { entry.taskGuid = task.guid; entry.projectGuid = projectGuid; }
        return { task, existing: false };
    },

    async workflowAction(button, operation, panel) {
        button.disabled = true;
        this.workflowMessage = '';
        try { await operation(); await this.render(panel); }
        catch (error) { this.workflowMessage = error.message || 'Change could not be saved. Try again.'; await this.render(panel); }
    },

    mountWorkflowApp(container, app) {
        const old = container.querySelector('.os-app');
        const scrollTop = old?.scrollTop || 0;
        const focused = document.activeElement;
        const taskGuid = focused?.closest('[data-task]')?.dataset.task;
        const focusKey = focused?.dataset.focusKey;
        const fieldClass = focused?.classList?.[0];
        const start = focused?.selectionStart;
        const end = focused?.selectionEnd;
        const opened = new Set([...container.querySelectorAll('.os-action-edit[open]')].map(node => node.closest('[data-task]').dataset.task));
        app.querySelectorAll('[data-task]').forEach(row => { if (opened.has(row.dataset.task)) row.querySelector('details').open = true; });
        const viewport = document.createElement('div'); viewport.className = 'os-app'; viewport.appendChild(app);
        container.replaceChildren(viewport);
        viewport.scrollTop = scrollTop;
        if (taskGuid && fieldClass) {
            const replacement = [...app.querySelectorAll('[data-task]')].find(row => row.dataset.task === taskGuid)?.querySelector(`.${fieldClass}`);
            if (replacement) {
                replacement.focus({ preventScroll: true });
                if (typeof start === 'number' && replacement.type !== 'date') replacement.setSelectionRange?.(start, end);
            }
        } else if (focusKey) {
            const replacement = app.querySelector(`[data-focus-key="${focusKey}"]`);
            if (replacement) {
                replacement.focus({ preventScroll: true });
                if (typeof start === 'number' && replacement.tagName === 'INPUT') replacement.setSelectionRange?.(start, end);
            }
        }
    },

    renderActionRow(task, panel, options = {}) {
        const state = this.loadWorkflowState();
        const row = document.createElement('div');
        row.className = 'os-action-row';
        row.dataset.task = task.guid;
        const waiting = ['blocked', 'waiting'].includes(task.status);
        const focused = (state.focus[localDate()] || []).includes(task.guid);
        row.innerHTML = `<input type="checkbox" class="os-action-done" aria-label="Complete ${escapeHtml(task.text)}" />
            <div class="os-action-copy"><button class="os-action-title">${escapeHtml(task.text)}</button><div class="os-action-meta">${escapeHtml(task.projectName)}${task.date ? ` · <span class="${task.date < localDate() ? 'os-cash-warning' : ''}">${task.date < localDate() ? 'Overdue · ' : ''}${task.date}</span>` : ''}${task.status === 'important' ? ' · Important' : ''}${state.next[task.projectGuid] === task.guid ? ' · Next action' : ''}</div></div>
            <div class="os-action-buttons">${waiting ? '' : `<button class="os-button os-focus-action" aria-pressed="${focused}">${focused ? 'Unpin' : 'Focus'}</button><button class="os-button os-next-action">${state.next[task.projectGuid] === task.guid ? 'Unset next' : 'Set next'}</button>`}
            <details class="os-action-edit"><summary>Edit</summary><div class="os-action-editor"><label>Due date<input type="date" class="os-input os-action-date" value="${task.date}" /></label><button class="os-button os-date-save">Save date</button>
            <label>Waiting on<input class="os-input os-wait-reason" value="${escapeHtml(state.waiting[task.guid]?.reason || '')}" placeholder="Person or dependency" /></label><label>Follow-up date<input type="date" class="os-input os-wait-date" value="${escapeHtml(state.waiting[task.guid]?.followup || '')}" /></label><button class="os-button os-wait-save">${waiting ? 'Update waiting note' : 'Mark waiting'}</button>${waiting ? '<button class="os-button os-resume-action">Ready to work</button>' : ''}</div></details></div>`;
        row.querySelector('.os-action-title').onclick = () => this.openItem(task.guid, task.recordGuid, panel);
        row.querySelector('.os-action-done').onchange = event => this.workflowAction(event.target, () => this.setActionStatus(task, 'done'), panel);
        row.querySelector('.os-focus-action')?.addEventListener('click', event => this.workflowAction(event.target, async () => {
            const focus = state.focus[localDate()] || [];
            if (focused) state.focus[localDate()] = focus.filter(guid => guid !== task.guid);
            else {
                const current = this.workflowData.model.focus.map(action => action.guid);
                if (current.length >= 3) throw new Error('Your focus list has three actions. Unpin one before adding another.');
                state.focus[localDate()] = [...current, task.guid];
            }
            this.persistWorkflow();
        }, panel));
        row.querySelector('.os-next-action')?.addEventListener('click', event => this.workflowAction(event.target, async () => {
            if (state.next[task.projectGuid] === task.guid) {
                await this.writeNativeNextAction(this.workflowData.byGuid.get(task.projectGuid)?.record, null);
                delete state.next[task.projectGuid]; delete state.nextLabels[task.projectGuid];
            } else {
                await this.writeNativeNextAction(this.workflowData.byGuid.get(task.projectGuid)?.record, task);
                state.next[task.projectGuid] = task.guid; state.nextLabels[task.projectGuid] = task.text;
            }
            delete state.nextRecovery?.[task.projectGuid];
            this.persistWorkflow();
        }, panel));
        row.querySelector('.os-date-save').onclick = event => this.workflowAction(event.target, () => this.rescheduleAction(task, row.querySelector('.os-action-date').value), panel);
        row.querySelector('.os-wait-save').onclick = event => this.workflowAction(event.target, async () => {
            await this.setActionStatus(task, 'blocked');
            state.waiting[task.guid] = { reason: row.querySelector('.os-wait-reason').value.trim(), followup: row.querySelector('.os-wait-date').value, previousStatus: waiting ? state.waiting[task.guid]?.previousStatus || 'none' : task.status };
            this.persistWorkflow();
        }, panel);
        row.querySelector('.os-resume-action')?.addEventListener('click', event => this.workflowAction(event.target, () => this.setActionStatus(task, state.waiting[task.guid]?.previousStatus || 'none'), panel));
        if (waiting && state.waiting[task.guid]) {
            const note = document.createElement('div'); note.className = 'os-wait-note';
            if (state.waiting[task.guid].followup && state.waiting[task.guid].followup <= localDate()) note.classList.add('os-followup-due');
            note.textContent = `${state.waiting[task.guid].reason || 'Waiting on a dependency'}${state.waiting[task.guid].followup ? ` · Follow up ${state.waiting[task.guid].followup}` : ' · No follow-up date'}`;
            row.querySelector('.os-action-copy').appendChild(note);
        }
        return row;
    },

    renderProjectAttention(workflow, panel, { allActive = false } = {}) {
        const list = document.createElement('div'); list.className = 'os-attention-list';
        const attentionByGuid = new Map(workflow.model.attention.map(item => [item.project.guid, item]));
        const projects = allActive
            ? workflow.model.active.map(project => {
                const item = attentionByGuid.get(project.guid);
                const projectTasks = workflow.tasks.filter(task => task.projectGuid === project.guid && !['done', 'canceled', 'cancelled'].includes(task.status));
                return { project, issues: item?.issues || [], tasks: workflow.model.actions.filter(task => task.projectGuid === project.guid), next: workflow.model.next.find(task => task.projectGuid === project.guid), overdueTasks: item?.overdueTasks || projectTasks.filter(task => task.date && task.date < localDate()), waitingTasks: item?.waitingTasks || projectTasks.filter(task => ['blocked', 'waiting'].includes(task.status)), followupTasks: item?.followupTasks || [], clientReviewTasks: item?.clientReviewTasks || projectTasks.filter(task => task.clientReview), recovery: item?.recovery || this.workflowState.nextRecovery?.[project.guid] || null };
            })
            : workflow.model.attention;
        if (!projects.length) list.innerHTML = `<p class="os-workflow-empty">${!workflow.model.active.length ? 'No explicitly active projects found. Check your Projects mapping and project statuses in Settings.' : !workflow.model.complete ? 'Project checks are incomplete. Refresh to retry.' : 'Every active project has a next action and no deadline warnings.'}</p>`;
        for (const item of projects) {
            const issueSummary = item.issues.filter(issue => !['Choose a next action', 'Add a next action', 'All work is waiting'].includes(issue));
            const recoveryReason = ({ completed: 'was completed', waiting: 'is waiting', removed: 'is no longer available' })[item.recovery?.reason];
            const nextStatus = item.next
                ? `Next: ${item.next.text}`
                : item.recovery ? `Previous next action ${recoveryReason || 'changed'}${item.recovery.label ? `: “${item.recovery.label}”` : ''} · choose another`
                    : item.issues.includes('All work is waiting') ? 'All work is waiting'
                        : item.issues.some(issue => issue.toLowerCase().includes('next action') || issue === 'Add a next action') ? '' : 'Choose a next action';
            const clientReviewText = item.clientReviewTasks?.length && !issueSummary.some(issue => issue.includes('client review')) ? `${item.clientReviewTasks.length} client review checkpoint${item.clientReviewTasks.length === 1 ? '' : 's'} open` : '';
            const stateText = [issueSummary.join(' · '), clientReviewText, nextStatus].filter(Boolean).join(' · ');
            const row = document.createElement('div'); row.className = 'os-project-attention';
            row.innerHTML = `<div class="os-project-checkin-copy"><button class="os-action-title">${escapeHtml(item.project.name)}</button><p class="os-action-meta ${item.recovery ? 'os-project-recovery' : ''}">${escapeHtml(stateText || (item.next ? `Next: ${item.next.text}` : 'Choose a next action'))}</p></div><div class="os-next-picker"><select aria-label="Next action for ${escapeHtml(item.project.name)}"><option value="">Choose an existing task…</option>${item.tasks.map(task => `<option value="${task.guid}">${escapeHtml(task.text)}${task.date ? ` · ${escapeHtml(task.date)}` : ''}</option>`).join('')}</select><button class="os-button os-pick-next" ${item.tasks.length ? '' : 'disabled'}>${item.next ? 'Update next' : 'Set next'}</button><button class="os-button os-add-next">Add task</button></div>`;
            row.querySelector('select').value = item.next?.guid || '';
            const attentionTasks = [...new Map([...(item.overdueTasks || []), ...(item.waitingTasks || []), ...(item.clientReviewTasks || [])].map(task => [task.guid, task])).values()];
            if (attentionTasks.length) {
                const details = document.createElement('details'); details.className = 'os-project-cues';
                const summary = document.createElement('summary'); summary.textContent = `${item.clientReviewTasks?.length ? `${item.clientReviewTasks.length} client review checkpoint${item.clientReviewTasks.length === 1 ? '' : 's'}` : `${attentionTasks.length} task${attentionTasks.length === 1 ? '' : 's'} need attention`}`;
                const cueList = document.createElement('div'); cueList.className = 'os-project-cue-list';
                for (const task of attentionTasks.slice(0, 4)) {
                    const cue = document.createElement('button'); cue.type = 'button'; cue.className = 'os-project-cue';
                    const labels = [];
                    if ((item.overdueTasks || []).some(candidate => candidate.guid === task.guid)) labels.push(`Overdue${task.date ? ` · ${task.date}` : ''}`);
                    if ((item.waitingTasks || []).some(candidate => candidate.guid === task.guid)) labels.push(`Waiting${this.workflowState.waiting[task.guid]?.followup ? ` · follow up ${this.workflowState.waiting[task.guid].followup}` : ''}`);
                    if ((item.clientReviewTasks || []).some(candidate => candidate.guid === task.guid)) labels.push(`Client review${task.date ? ` · due ${task.date}` : ' · due date needed'}`);
                    cue.textContent = `${task.text} · ${labels.join(' · ')}`;
                    cue.onclick = () => this.openItem(task.guid, task.recordGuid, panel);
                    cueList.appendChild(cue);
                }
                if (attentionTasks.length > 4) { const more = document.createElement('span'); more.className = 'os-action-meta'; more.textContent = `+ ${attentionTasks.length - 4} more in the action queue`; cueList.appendChild(more); }
                details.append(summary, cueList); row.querySelector('.os-project-checkin-copy').appendChild(details);
            }
            row.querySelector('.os-action-title').onclick = () => this.openRecord(item.project.guid, panel);
            row.querySelector('.os-pick-next').onclick = event => this.workflowAction(event.target, async () => {
                const guid = row.querySelector('select').value;
                if (!guid) throw new Error('Choose a task first.');
                const task = item.tasks.find(candidate => candidate.guid === guid);
                if (!task) throw new Error('That task is no longer available. Refresh the project review.');
                await this.writeNativeNextAction(item.project.record, task);
                this.workflowState.next[item.project.guid] = guid;
                this.workflowState.nextLabels[item.project.guid] = task.text;
                delete this.workflowState.nextRecovery?.[item.project.guid];
                this.persistWorkflow();
            }, panel);
            row.querySelector('.os-add-next').onclick = () => {
                this.captureProjectGuid = item.project.guid;
                const select = document.querySelector('.os-capture-project'); if (select) select.value = item.project.guid;
                document.querySelector('.os-capture-input')?.focus();
            };
            list.appendChild(row);
        }
        return list;
    },

    renderWorkflow(workflow, panel) {
        const section = document.createElement('section'); section.className = 'os-workflow';
        if (workflow.error) { section.innerHTML = `<p role="alert">${escapeHtml(workflow.error)}</p>`; return section; }
        const model = workflow.model;
        if (this.workflowMessage) { const message = document.createElement('p'); message.className = 'os-workflow-message'; message.setAttribute('role', 'status'); message.textContent = this.workflowMessage; section.appendChild(message); }
        if (!model.complete) { const warning = document.createElement('p'); warning.textContent = 'Some task data could not be loaded. Project gaps may be incomplete. Refresh to retry.'; warning.className = 'os-workflow-message'; section.appendChild(warning); }
        if (this.workflowMode === 'review') {
            const week = reviewWeek();
            const draft = this.workflowState.drafts[week] ||= { notes: '', priorities: '', step: 0 };
            this.hydrateReviewPriorityLinks(draft, week, workflow.tasks || []);
            const names = ['Clear the decks', 'Check projects', 'Plan next week'];
            const header = document.createElement('div'); header.className = 'os-review-heading';
            header.innerHTML = `<h2>Weekly review</h2><p class="os-action-meta">Week of ${week} · draft saved on this device</p><div class="os-review-steps">${names.map((name, index) => `<button class="os-button ${draft.step === index ? 'os-primary' : ''}" data-step="${index}" aria-current="${draft.step === index ? 'step' : 'false'}">${name}</button>`).join('')}</div>`;
            header.querySelectorAll('[data-step]').forEach(button => { button.onclick = () => { draft.step = Number(button.dataset.step); this.persistWorkflow(); this.render(panel); }; });
            section.appendChild(header);
            if (draft.step === 0) {
                section.insertAdjacentHTML('beforeend', `<h3>Overdue actions (${model.overdue.length})</h3><p class="os-action-meta">Complete, reschedule, or mark a dependency as waiting.</p>`);
                model.overdue.forEach(task => section.appendChild(this.renderActionRow(task, panel)));
                if (!model.overdue.length) section.insertAdjacentHTML('beforeend', '<p class="os-workflow-empty">No overdue project actions.</p>');
                section.insertAdjacentHTML('beforeend', `<h3>Done recently (${workflow.recentDone.length})</h3><p class="os-action-meta">Tasks marked done and updated in the last 7 days.</p>`);
                workflow.recentDone.slice(0, 12).forEach(task => { const item = document.createElement('p'); item.className = 'os-review-done'; item.textContent = `${task.projectName} · ${task.text}`; section.appendChild(item); });
                if (workflow.recentDone.length > 12) section.insertAdjacentHTML('beforeend', `<p class="os-action-meta">Showing the first 12. The Journal summary includes all ${workflow.recentDone.length}.</p>`);
                if (!workflow.recentDone.length) section.insertAdjacentHTML('beforeend', '<p class="os-workflow-empty">No recently updated done tasks.</p>');
            } else if (draft.step === 1) {
                section.insertAdjacentHTML('beforeend', '<h3>Active projects</h3><p class="os-action-meta">Confirm one concrete next action for each project. These choices appear in Today → Next actions and in the Journal review.</p>');
                section.appendChild(this.renderProjectAttention(workflow, panel, { allActive: true }));
                section.insertAdjacentHTML('beforeend', `<h3>Waiting (${model.waiting.length})</h3>`);
                model.waiting.forEach(task => section.appendChild(this.renderActionRow(task, panel)));
                if (!model.waiting.length) section.insertAdjacentHTML('beforeend', '<p class="os-workflow-empty">No project tasks are marked waiting.</p>');
            } else {
                const form = document.createElement('div'); form.className = 'os-review-form';
                form.innerHTML = `<label>Wins and observations<textarea class="os-review-notes" rows="3" placeholder="What moved forward? What needs to change?">${escapeHtml(draft.notes)}</textarea></label><label>Priorities for next week<textarea class="os-review-priorities" rows="3" placeholder="Choose a few concrete outcomes for the coming week.">${escapeHtml(draft.priorities)}</textarea><span class="os-action-meta">One priority per line. Turn any priority into a project task below when you’re ready.</span></label><div class="os-review-priority-bridge"><h3>Make priorities actionable</h3><p class="os-action-meta">Add a priority to an existing project. It joins the action queue without changing that project’s chosen next action; the review text stays intact.</p><div class="os-review-priority-list"></div></div><details><summary>Preview Journal summary</summary><pre class="os-review-preview"></pre></details><div class="os-review-save-row"><button class="os-button os-primary os-save-review">${this.workflowState.reviews[week] ? 'Update Journal review' : 'Save review to Journal'}</button><span class="os-action-meta">${this.workflowState.reviews[week] ? 'A review has been saved this week.' : 'Your draft stays here until you save.'}</span></div>`;
                const preview = () => { form.querySelector('pre').textContent = weeklyReviewText(workflow, draft, this.workflowState); };
                const renderPriorityBridge = () => this.renderReviewPriorityBridge(form.querySelector('.os-review-priority-list'), workflow, week, draft, panel);
                form.querySelector('.os-review-notes').oninput = event => { draft.notes = event.target.value; this.persistWorkflow(); preview(); };
                form.querySelector('.os-review-priorities').oninput = event => {
                    this.hydrateReviewPriorityLinks(draft, week, workflow.tasks || []);
                    reconcileReviewPriorityItems(draft, event.target.value);
                    this.persistWorkflow(); preview(); renderPriorityBridge();
                };
                renderPriorityBridge();
                preview();
                form.querySelector('.os-save-review').onclick = event => this.workflowAction(event.target, async () => { await this.saveReviewToJournal(workflow, draft); this.ui.addToaster({ title: 'Weekly review saved to Journal', autoDestroyTime: 3000, dismissible: true }); }, panel);
                section.appendChild(form);
            }
            const footer = document.createElement('div'); footer.className = 'os-review-footer';
            footer.innerHTML = `<button class="os-button os-review-back" ${draft.step === 0 ? 'disabled' : ''}>Back</button><button class="os-button os-review-next" ${draft.step === 2 ? 'disabled' : ''}>${draft.step === 0 ? 'Check projects' : 'Plan next week'} →</button>`;
            footer.querySelector('.os-review-back').onclick = () => { draft.step--; this.persistWorkflow(); this.render(panel); };
            footer.querySelector('.os-review-next').onclick = () => { draft.step++; this.persistWorkflow(); this.render(panel); };
            if (draft.step === 2) footer.querySelector('.os-review-next').remove();
            section.appendChild(footer);
            return section;
        }
        section.insertAdjacentHTML('beforeend', `<div class="os-workflow-heading"><div><h2>Today’s focus</h2><p class="os-action-meta">Choose up to three actions for ${localDate()}.</p></div><span class="os-focus-count">${model.focus.length} / 3</span></div>`);
        const focus = document.createElement('div'); focus.className = 'os-focus-list';
        model.focus.forEach(task => focus.appendChild(this.renderActionRow(task, panel)));
        if (!model.focus.length) focus.innerHTML = '<p class="os-workflow-empty">Pin actions from the queue below to give today a clear starting point.</p>';
        section.appendChild(focus);
        const key = this.actionQueueTab || (model.next.length ? 'next' : 'attention');
        const tabs = document.createElement('div'); tabs.className = 'os-action-tabs';
        tabs.innerHTML = [['next', 'Next actions', model.next.length], ['attention', 'Needs attention', model.attention.length], ['waiting', 'Waiting', model.waiting.length], ['all', 'All actions', model.actions.length]].map(([id, name, count]) => `<button class="os-tab ${key === id ? 'active' : ''}" data-queue="${id}" aria-pressed="${key === id}">${name} (${count})</button>`).join('');
        tabs.querySelectorAll('button').forEach(button => { button.onclick = () => { this.actionQueueTab = button.dataset.queue; this.queueLimit = 20; this.render(panel); }; });
        section.appendChild(tabs);
        const controls = document.createElement('div'); controls.className = 'os-queue-controls';
        controls.innerHTML = `<input type="search" class="os-input os-queue-search" data-focus-key="queue-search" aria-label="Search project actions" placeholder="Find an action or project…" value="${escapeHtml(this.actionSearch || '')}" /><select class="os-input os-queue-project" data-focus-key="queue-project" aria-label="Filter by project"><option value="">All active projects</option>${model.active.map(project => `<option value="${project.guid}">${escapeHtml(project.name)}</option>`).join('')}</select>`;
        controls.querySelector('select').value = this.actionProject || '';
        controls.querySelector('select').onchange = event => { this.actionProject = event.target.value; this.queueLimit = 20; this.render(panel); };
        controls.querySelector('input').oninput = event => { this.actionSearch = event.target.value; this.queueLimit = 20; clearTimeout(this.workflowSearchTimer); this.workflowSearchTimer = setTimeout(() => this.render(panel), 150); };
        section.appendChild(controls);
        const list = document.createElement('div'); list.className = 'os-action-list';
        if (key === 'attention') {
            const attention = model.attention.filter(item => (!this.actionProject || item.project.guid === this.actionProject) && (!this.actionSearch || `${item.project.name} ${item.issues.join(' ')} ${item.tasks.map(task => task.text).join(' ')}`.toLowerCase().includes(this.actionSearch.toLowerCase())));
            if ((this.actionSearch || this.actionProject) && !attention.length) list.innerHTML = '<p class="os-workflow-empty">No matching projects. Clear the filters to see more.</p>';
            else list.appendChild(this.renderProjectAttention({ ...workflow, model: { ...model, attention } }, panel));
        }
        else {
            const source = key === 'all' ? model.actions : key === 'waiting' ? model.waiting : model.next;
            const tasks = filterActions(source, this.actionSearch, this.actionProject);
            tasks.slice(0, this.queueLimit || 20).forEach(task => list.appendChild(this.renderActionRow(task, panel)));
            if (!tasks.length) {
                list.innerHTML = `<p class="os-workflow-empty">${this.actionSearch || this.actionProject ? 'No matching actions. Clear the filters to see more.' : key === 'next' ? 'No next actions selected. Review your projects to choose one per active project.' : key === 'waiting' ? 'No project tasks are marked waiting.' : 'No actionable tasks in active projects. Capture a task or check project statuses.'}</p>`;
                if (key === 'next') { const button = document.createElement('button'); button.className = 'os-button'; button.textContent = 'Review projects'; button.onclick = () => { this.actionQueueTab = 'attention'; this.render(panel); }; list.appendChild(button); }
            }
            if (tasks.length > (this.queueLimit || 20)) { const more = document.createElement('button'); more.className = 'os-button'; more.textContent = `Show more (${tasks.length - (this.queueLimit || 20)} remaining)`; more.onclick = () => { this.queueLimit = (this.queueLimit || 20) + 20; this.render(panel); }; list.appendChild(more); }
        }
        section.appendChild(list);
        if (this.actionSearch || this.actionProject) {
            const clear = document.createElement('button'); clear.className = 'os-button'; clear.textContent = 'Clear filters';
            clear.onclick = () => { this.actionSearch = ''; this.actionProject = ''; this.render(panel); }; section.appendChild(clear);
        }
        return section;
    },

    renderReviewPriorityBridge(container, workflow, week, draft, panel) {
        const entries = this.hydrateReviewPriorityLinks(draft, week, workflow.tasks || []);
        if (!entries.length) {
            container.innerHTML = '<p class="os-workflow-empty">Write a priority above to see task options.</p>';
            return;
        }
        const projects = workflow.model.active;
        container.replaceChildren();
        entries.forEach((priority, index) => {
            const row = document.createElement('div'); row.className = 'os-review-priority-row';
            const copy = document.createElement('div'); copy.className = 'os-review-priority-copy'; copy.textContent = priority.text;
            row.appendChild(copy);
            const linked = reviewPriorityTask(priority, week, workflow.tasks || []);
            if (linked && this.editingReviewPriorityId !== priority.id) {
                const status = document.createElement('span'); status.className = 'os-review-priority-linked';
                status.textContent = `${linked.projectName} · ${linked.text}${['done', 'canceled', 'cancelled'].includes(linked.status) ? ' · complete' : ''}`;
                const open = document.createElement('button'); open.type = 'button'; open.className = 'os-button'; open.textContent = 'Open task';
                open.onclick = () => this.openItem(linked.guid, linked.recordGuid, panel);
                const change = document.createElement('button'); change.type = 'button'; change.className = 'os-button'; change.textContent = 'Change link';
                change.onclick = () => { this.editingReviewPriorityId = priority.id; this.render(panel); };
                row.append(status, open, change);
            } else {
                const controls = document.createElement('div'); controls.className = 'os-review-priority-controls';
                const projectSelect = document.createElement('select'); projectSelect.className = 'os-input os-review-priority-project';
                projectSelect.dataset.focusKey = `review-priority-project-${priority.id}`;
                projectSelect.setAttribute('aria-label', `Project for priority: ${priority.text}`);
                projectSelect.innerHTML = '<option value="">Choose project…</option>' + projects.map(project => `<option value="${escapeHtml(project.guid)}">${escapeHtml(project.name)}</option>`).join('');
                projectSelect.value = priority.projectGuid || linked?.projectGuid || '';
                const taskSelect = document.createElement('select'); taskSelect.className = 'os-input os-review-priority-task';
                taskSelect.dataset.focusKey = `review-priority-task-${priority.id}`;
                taskSelect.setAttribute('aria-label', `Existing task for priority: ${priority.text}`);
                const populateTasks = () => {
                    const available = (workflow.model.actions || []).filter(task => task.projectGuid === projectSelect.value);
                    taskSelect.innerHTML = `<option value="">${available.length ? 'Choose existing task…' : projectSelect.value ? 'No open tasks in this project' : 'Choose a project first'}</option>` + available.map(task => `<option value="${escapeHtml(task.guid)}">${escapeHtml(task.text)}</option>`).join('');
                    taskSelect.disabled = !projectSelect.value || !available.length;
                    link.disabled = !taskSelect.value;
                };
                const link = document.createElement('button'); link.type = 'button'; link.className = 'os-button os-review-priority-link'; link.textContent = 'Link task'; link.disabled = true;
                const create = document.createElement('button'); create.type = 'button'; create.className = 'os-button os-review-priority-add'; create.textContent = 'Create task'; create.disabled = !projectSelect.value;
                projectSelect.onchange = () => { priority.projectGuid = projectSelect.value; populateTasks(); create.disabled = !projectSelect.value; this.persistWorkflow(); };
                taskSelect.onchange = () => { link.disabled = !taskSelect.value; };
                populateTasks();
                link.onclick = event => this.workflowAction(event.currentTarget, async () => {
                    const task = await this.linkReviewPriorityTask(this.workflowData, week, priority, taskSelect.value);
                    this.editingReviewPriorityId = null;
                    this.ui.addToaster({ title: `Priority linked to ${task.projectName}`, autoDestroyTime: 3000, dismissible: true });
                }, panel);
                create.onclick = event => this.workflowAction(event.currentTarget, async () => {
                    const result = await this.addReviewPriorityTask(this.workflowData, week, priority.text, projectSelect.value, priority);
                    this.editingReviewPriorityId = null;
                    this.ui.addToaster({ title: result.existing ? 'Priority is already a project task' : 'Priority added to project tasks', autoDestroyTime: 3000, dismissible: true });
                }, panel);
                controls.append(projectSelect, taskSelect, link, create);
                row.appendChild(controls);
            }
            container.appendChild(row);
        });
    },

    renderWorkflowSettings(panel) {
        const section = document.createElement('section'); section.className = 'os-workflow os-workflow-settings';
        section.innerHTML = '<h2>Workspace settings</h2><p>Choose the collections Freelance OS should use. Active projects use in_progress and in_review; waiting tasks use Thymer’s native waiting state.</p><p class="os-action-meta">Focus, next-action choices, waiting notes, mappings, and review drafts are saved on this device. Task changes and reviews saved to Journal sync with your workspace.</p>';
        const form = document.createElement('div'); form.className = 'os-settings-fields';
        for (const role of COLLECTION_ROLES) {
            const label = document.createElement('label'); label.textContent = role;
            const select = document.createElement('select'); select.className = 'os-input'; select.dataset.role = role;
            select.innerHTML = '<option value="">Choose collection…</option>' + (this.workflowCollections || []).filter(collection => role !== 'Journal' || collection.isJournalPlugin?.()).map(collection => `<option value="${collection.getGuid()}">${escapeHtml(collection.getName())}</option>`).join('');
            select.value = this.collectionGuid(role); label.appendChild(select); form.appendChild(label);
        }
        const button = document.createElement('button'); button.className = 'os-button os-primary'; button.textContent = 'Save mappings';
        button.onclick = () => { form.querySelectorAll('select').forEach(select => { if (select.value) this.workflowState.mappings[select.dataset.role] = select.value; else delete this.workflowState.mappings[select.dataset.role]; }); this.persistWorkflow(); this.workflowMode = 'today'; this.render(panel); };
        section.append(form, button);
        return section;
    }
};
