function workflowDefaults() {
    return {
        version: 1,
        dismissedOnboarding: false,
        baseCurrency: 'CHF',
        ai: {
            clientLanguage: 'French',
            pricingBuffer: 25,
            watchdogProposals: true,
            watchdogInvoices: true,
            watchdogBudget: true
        },
        activePacks: [],
        mappings: {},
        journalOwners: {},
        next: {},
        nextLabels: {},
        nextRecovery: {},
        focus: {},
        waiting: {},
        drafts: {},
        reviews: {}
    };
}

const WORKFLOW_STORAGE_KEY = 'workflow-v1';
const WORKFLOW_VERSION = 1;
const TERMINAL_TASK_STATUSES = new Set(['done', 'canceled', 'cancelled']);
const WAITING_TASK_STATUSES = new Set(['blocked', 'waiting']);
const ACTIVE_PROJECT_STATUSES = new Set(['in_progress', 'in_review']);
const RESUMABLE_TASK_STATUSES = new Set(['none', 'important', 'started', 'billable', 'discuss', 'alert', 'starred']);
const WAITING_DETAILS_PROPERTY = 'freelance_os_waiting';
const WAITING_DETAILS_VERSION = 1;

const CLIENT_REVIEW_CHECKPOINT_PROPERTY = 'freelance_os_review_checkpoint';

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidDate(value) {
    return typeof value === 'string' && dateDay(value) !== null;
}

function validDateValue(value) {
    return isValidDate(value) ? value : '';
}

function taskStatus(value) {
    return typeof value === 'string' ? value : value?.status || '';
}

function isTerminalTask(value) {
    return TERMINAL_TASK_STATUSES.has(taskStatus(value));
}

function isWaitingTask(value) {
    return WAITING_TASK_STATUSES.has(taskStatus(value));
}

function isActionableTask(value) {
    const status = taskStatus(value);
    return !!status && !isTerminalTask(status) && !isWaitingTask(status);
}

function isActiveProject(project) {
    return ACTIVE_PROJECT_STATUSES.has(String(project?.status || '').toLowerCase());
}

function isUncategorizedProject(project) {
    const s = String(project?.status || '').toLowerCase().trim();
    return !s || s === 'none' || s === 'undefined';
}

function isTrackedProject(project) {
    return isActiveProject(project) || (isUncategorizedProject(project) && !['backlog', 'completed', 'archived', 'cancelled'].includes(String(project?.status || '').toLowerCase().trim()));
}

function normalizeResumableStatus(value) {
    return RESUMABLE_TASK_STATUSES.has(value) ? value : 'none';
}

function cloneWorkflowState(state) {
    const defaults = workflowDefaults();
    if (!isPlainObject(state)) return defaults;
    try {
        const parsed = JSON.parse(JSON.stringify(state));
        return {
            ...defaults,
            ...parsed,
            dismissedOnboarding: parsed.dismissedOnboarding === true,
            baseCurrency: typeof parsed.baseCurrency === 'string' && parsed.baseCurrency.trim() ? parsed.baseCurrency.trim().toUpperCase() : defaults.baseCurrency,
            ai: {
                ...defaults.ai,
                ...(isPlainObject(parsed.ai) ? parsed.ai : {})
            },
            activePacks: Array.isArray(parsed.activePacks) ? [...parsed.activePacks] : []
        };
    }
    catch { return { ...defaults }; }
}

function sanitizeStringMap(value) {
    const output = {};
    if (!isPlainObject(value)) return output;
    for (const [key, entry] of Object.entries(value)) {
        if (typeof key === 'string' && typeof entry === 'string') output[key] = entry;
    }
    return output;
}

function normalizeWorkflowState(saved) {
    const defaults = workflowDefaults();
    if (!isPlainObject(saved)) return defaults;
    const state = { ...defaults, ...saved };
    state.version = Number.isInteger(saved.version) ? saved.version : WORKFLOW_VERSION;
    state.mappings = sanitizeStringMap(saved.mappings);
    state.journalOwners = sanitizeStringMap(saved.journalOwners);
    state.next = sanitizeStringMap(saved.next);
    state.nextLabels = sanitizeStringMap(saved.nextLabels);
    state.nextRecovery = {};
    if (isPlainObject(saved.nextRecovery)) {
        for (const [key, entry] of Object.entries(saved.nextRecovery)) {
            if (!isPlainObject(entry) || typeof entry.reason !== 'string') continue;
            state.nextRecovery[key] = { reason: entry.reason, label: typeof entry.label === 'string' ? entry.label : '' };
        }
    }
    state.focus = {};
    if (isPlainObject(saved.focus)) {
        for (const [day, entries] of Object.entries(saved.focus)) {
            if (!isValidDate(day) || !Array.isArray(entries)) continue;
            const guidList = entries.filter(value => typeof value === 'string' && value);
            if (guidList.length) state.focus[day] = guidList;
        }
    }
    state.waiting = {};
    if (isPlainObject(saved.waiting)) {
        for (const [guid, entry] of Object.entries(saved.waiting)) {
            if (!isPlainObject(entry)) continue;
            const normalized = {};
            if (typeof entry.reason === 'string') normalized.reason = entry.reason;
            if (typeof entry.followup === 'string') normalized.followup = entry.followup;
            if (typeof entry.previousStatus === 'string') normalized.previousStatus = entry.previousStatus;
            if (Object.keys(normalized).length) state.waiting[guid] = normalized;
        }
    }
    state.activePacks = Array.isArray(saved.activePacks)
        ? saved.activePacks.filter(p => typeof p === 'string' && p.trim())
        : [];
    state.dismissedOnboarding = saved.dismissedOnboarding === true;
    state.drafts = {};
    if (isPlainObject(saved.drafts)) {
        for (const [week, entry] of Object.entries(saved.drafts)) {
            if (!isValidDate(week) || !isPlainObject(entry)) continue;
            const draft = {
                notes: typeof entry.notes === 'string' ? entry.notes : '',
                priorities: typeof entry.priorities === 'string' ? entry.priorities : '',
                step: Number.isInteger(entry.step) ? Math.min(2, Math.max(0, entry.step)) : 0
            };
            if (Array.isArray(entry.priorityItems)) {
                draft.priorityItems = entry.priorityItems.filter(item => isPlainObject(item) && typeof item.id === 'string' && typeof item.text === 'string').map(item => {
                    const normalized = { id: item.id, text: item.text };
                    for (const key of ['taskGuid', 'recordGuid', 'projectGuid']) if (typeof item[key] === 'string') normalized[key] = item[key];
                    if (isPlainObject(item.carriedFrom) && isValidDate(item.carriedFrom.week)
                        && typeof item.carriedFrom.priorityId === 'string' && item.carriedFrom.priorityId.trim()) {
                        normalized.carriedFrom = { week: item.carriedFrom.week, priorityId: item.carriedFrom.priorityId };
                    }
                    return normalized;
                });
            }
            state.drafts[week] = draft;
        }
    }
    state.reviews = {};
    if (isPlainObject(saved.reviews)) {
        for (const [week, entry] of Object.entries(saved.reviews)) {
            if (!isValidDate(week) || !isPlainObject(entry)) continue;
            const review = {};
            for (const key of ['savedAt', 'journalGuid', 'journalDate', 'userGuid', 'recordGuid', 'headingGuid']) {
                if (typeof entry[key] === 'string' && entry[key]) review[key] = entry[key];
            }
            if (Object.keys(review).length) state.reviews[week] = review;
        }
    }
    return state;
}

function workflowStorageKey(workspaceGuid, pluginGuid) {
    return `freelance-os/${workspaceGuid || 'unknown'}/${pluginGuid || 'unknown'}/${WORKFLOW_STORAGE_KEY}`;
}

function readWaitingDetails(line, localFallback) {
    const fallback = isPlainObject(localFallback) ? {
        reason: typeof localFallback.reason === 'string' ? localFallback.reason : '',
        followup: validDateValue(localFallback.followup),
        previousStatus: normalizeResumableStatus(localFallback.previousStatus)
    } : null;
    const raw = line?.props?.[WAITING_DETAILS_PROPERTY];
    if (raw === undefined || raw === null || raw === '') {
        return fallback
            ? { details: fallback, source: 'local', valid: true }
            : { details: { reason: '', followup: '', previousStatus: 'none' }, source: 'none', valid: true };
    }
    if (typeof raw !== 'string') return { details: fallback || { reason: '', followup: '', previousStatus: 'none' }, source: 'invalid', valid: false };
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return { details: fallback || { reason: '', followup: '', previousStatus: 'none' }, source: 'invalid', valid: false }; }
    if (!isPlainObject(parsed) || parsed.v !== WAITING_DETAILS_VERSION) {
        return { details: fallback || { reason: '', followup: '', previousStatus: 'none' }, source: 'invalid', valid: false };
    }
    // Native metadata is authoritative, including an explicitly empty reason or follow-up.
    const reason = typeof parsed.reason === 'string' ? parsed.reason : '';
    const followup = typeof parsed.followup === 'string' ? validDateValue(parsed.followup) : '';
    const details = { reason, followup, previousStatus: normalizeResumableStatus(parsed.previousStatus) };
    const valid = (parsed.followup === undefined || parsed.followup === '' || (typeof parsed.followup === 'string' && !!followup))
        && (parsed.previousStatus === undefined || parsed.previousStatus === '' || RESUMABLE_TASK_STATUSES.has(parsed.previousStatus));
    return { details, source: 'native', valid };
}

function validateWaitingInput(values = {}) {
    const reason = typeof values.reason === 'string' ? values.reason.trim() : '';
    const followup = typeof values.followup === 'string' ? values.followup.trim() : '';
    if (followup && !isValidDate(followup)) throw new Error('Choose a valid follow-up date.');
    const previousStatus = values.previousStatus === undefined ? 'none' : normalizeResumableStatus(values.previousStatus);
    return { reason, followup, previousStatus };
}

function waitingDetailsFor(task, state) {
    if (task?.waitingDetails) return task.waitingDetails;
    return readWaitingDetails(task?.lineItem, state?.waiting?.[task?.guid]).details;
}

function resolveTaskProject(line, sourceRecord, projectIndex) {
    const record = sourceRecord || line?.getRecord?.() || null;
    if (record && isTemplateRecord(record)) return { kind: 'excluded', candidateProjectGuids: [] };
    const recordGuid = record?.guid || '';
    if (recordGuid && projectIndex?.has(recordGuid)) {
        const root = projectRoot(recordGuid, projectIndex);
        if (root) return { kind: 'owned', projectGuid: root, candidateProjectGuids: [root] };
        return { kind: 'unresolved', candidateProjectGuids: [] };
    }
    const roots = new Set();
    const unresolved = [];
    for (const segment of line?.segments || []) {
        if (segment.type !== 'ref') continue;
        const guid = typeof segment.text === 'object' ? segment.text?.guid : segment.text;
        if (!guid || !projectIndex?.has(guid)) continue;
        const root = projectRoot(guid, projectIndex);
        if (root) roots.add(root);
        else unresolved.push(guid);
    }
    const candidates = [...roots];
    if (candidates.length > 1) return { kind: 'ambiguous', candidateProjectGuids: candidates };
    if (candidates.length === 1) return { kind: 'referenced', projectGuid: candidates[0], candidateProjectGuids: candidates, unresolvedReferenceGuids: unresolved };
    if (unresolved.length) return { kind: 'unresolved', candidateProjectGuids: [] };
    return { kind: 'none', candidateProjectGuids: [] };
}

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
    const active = projects.filter(isActiveProject);
    const trackedProjects = projects.filter(isTrackedProject);
    const trackedIds = new Set(trackedProjects.map(project => project.guid));
    const open = tasks.filter(task => trackedIds.has(task.projectGuid) && !isTerminalTask(task));
    const waiting = open.filter(isWaitingTask);
    const actions = open.filter(isActionableTask);
    const next = actions.filter(task => state.next[task.projectGuid] === task.guid);
    const selected = new Set(state.focus[today] || []);
    const focus = actions.filter(task => selected.has(task.guid));
    const attention = trackedProjects.flatMap(project => {
        const projectTasks = open.filter(task => task.projectGuid === project.guid);
        // Client review checkpoints get their own clearer deadline cue below.
        const overdueTasks = projectTasks.filter(task => !task.clientReview && task.date && task.date < today);
        const waitingTasks = projectTasks.filter(isWaitingTask);
        const followupTasks = waitingTasks.filter(task => {
            const followup = waitingDetailsFor(task, state).followup;
            return !!followup && followup <= today;
        });
        const clientReviewTasks = projectTasks.filter(task => task.clientReview);
        const clientReviewOverdue = clientReviewTasks.filter(task => task.date && task.date < today);
        const clientReviewDueSoon = clientReviewTasks.filter(task => task.date && task.date >= today && dateDay(task.date) <= dateDay(today) + 7);
        const clientReviewUndated = clientReviewTasks.filter(task => !task.date);
        const issues = [];
        if (!isActiveProject(project)) {
            issues.push('Project status not set');
        }
        if (complete && !next.some(task => task.projectGuid === project.guid)) issues.push(projectTasks.some(isActionableTask) ? 'Choose a next action' : projectTasks.length ? 'All work is waiting' : 'Add a next action');
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
    waiting.sort((a, b) => (waitingDetailsFor(a, state).followup || '9999').localeCompare(waitingDetailsFor(b, state).followup || '9999'));
    return { active, actions, next, focus, waiting, attention, overdue: actions.filter(task => task.date && task.date < today), complete, state };
}

function startHereSuggestions(actions, projects, state, today = localDate(), limit = 3) {
    const byProject = new Map((projects || []).map(project => [project.guid, project]));
    const focused = new Set(state?.focus?.[today] || []);
    const urgency = task => task.date && task.date < today ? 0 : task.date === today ? 1 : task.date ? 2 : 3;
    const taskPriority = task => task.status === 'important' ? 0 : 1;
    const projectPriority = task => byProject.get(task.projectGuid)?.priority === 'high' ? 0 : 1;
    const candidates = (actions || []).filter(task => !focused.has(task.guid)).slice().sort((a, b) =>
        urgency(a) - urgency(b)
        || (a.date || '9999').localeCompare(b.date || '9999')
        || taskPriority(a) - taskPriority(b)
        || projectPriority(a) - projectPriority(b)
        || a.text.localeCompare(b.text)
    );
    return candidates.slice(0, Math.max(0, limit)).map(task => {
        const project = byProject.get(task.projectGuid);
        const reasons = [];
        if (task.date && task.date < today) reasons.push('Overdue');
        else if (task.date === today) reasons.push('Due today');
        if (task.status === 'important') reasons.push('Important task');
        if (project?.priority === 'high') reasons.push('High-priority project');
        if (state?.next?.[task.projectGuid] === task.guid) reasons.push('Project next action');
        if (dateDay(project?.deadline) !== null && project.deadline < today) reasons.push('Project deadline overdue');
        else if (dateDay(project?.deadline) !== null && dateDay(project.deadline) <= dateDay(today) + 7) reasons.push(`Project deadline ${project.deadline}`);
        if (task.date && task.date > today) reasons.push(`Due ${task.date}`);
        if (!reasons.length) reasons.push(task.date ? 'Open project action' : 'No due date set');
        return { ...task, suggestionReasons: reasons };
    });
}

function attentionSearchText(item) {
    return [
        item.project?.name,
        ...(item.issues || []),
        item.next?.text,
        ...(item.tasks || []).map(task => task.text),
        ...(item.overdueTasks || []).map(task => task.text),
        ...(item.waitingTasks || []).flatMap(task => {
            const details = task.waitingDetails || {};
            return [task.text, details.reason, details.followup];
        }),
        ...(item.clientReviewTasks || []).map(task => task.text)
    ].filter(Boolean).join(' ');
}

function queuePresets(queue) {
    if (queue === 'all') return [{ id: 'any', label: 'Any' }, { id: 'due', label: 'Due/overdue' }, { id: 'important', label: 'Important' }, { id: 'nodate', label: 'No date' }];
    if (queue === 'waiting') return [{ id: 'any', label: 'Any' }, { id: 'followup-due', label: 'Follow-up due' }, { id: 'no-followup', label: 'No follow-up' }];
    return [{ id: 'any', label: 'Any' }];
}

function presetCompatible(queue, preset) {
    return queuePresets(queue).some(option => option.id === preset);
}

function queuePresetLabel(queue, preset) {
    return queuePresets(queue).find(option => option.id === preset)?.label || 'Any';
}

function queueEmptyMessage(queue, { filtered = false, complete = true } = {}) {
    if (filtered) return `No ${queue === 'attention' ? 'projects' : 'actions'} match these filters.${complete ? '' : ' More may exist because task data is incomplete.'}`;
    if (!complete) return `No loaded ${queue === 'attention' ? 'project checks' : queue === 'waiting' ? 'waiting tasks' : queue === 'next' ? 'next actions' : 'actions'}. Task data is incomplete; refresh to retry.`;
    if (queue === 'next') return 'No next actions selected. Review your projects to choose one per active project.';
    if (queue === 'waiting') return 'No project tasks are marked waiting.';
    if (queue === 'attention') return 'Every active project has a next action and no deadline warnings.';
    return 'No actionable tasks in active projects. Capture a task or check project statuses.';
}

function selectQueueItems(model, { queue = 'all', preset = 'any', query = '', projectGuid = '', today = localDate() } = {}) {
    const text = String(query || '').trim().toLowerCase();
    const state = model?.state || null;
    if (queue === 'attention') {
        const items = (model?.attention || []).filter(item => {
            if (projectGuid && item.project?.guid !== projectGuid) return false;
            return !text || attentionSearchText(item).toLowerCase().includes(text);
        });
        return { items, count: items.length, complete: model?.complete !== false, unit: 'projects' };
    }
    const source = queue === 'waiting' ? model?.waiting : queue === 'next' ? model?.next : model?.actions;
    let items = filterActions(source || [], query, projectGuid);
    if (queue === 'waiting') {
        if (preset === 'followup-due') items = items.filter(task => {
            const followup = waitingDetailsFor(task, state).followup;
            return isValidDate(followup) && followup <= today;
        });
        else if (preset === 'no-followup') items = items.filter(task => !isValidDate(waitingDetailsFor(task, state).followup));
    } else {
        if (preset === 'due') items = items.filter(task => isValidDate(task.date) && task.date <= today);
        else if (preset === 'important') items = items.filter(task => task.status === 'important');
        else if (preset === 'nodate') items = items.filter(task => !isValidDate(task.date));
    }
    return { items, count: items.length, complete: model?.complete !== false, unit: 'tasks' };
}

function reconcileWorkflowPointers(state, model, allTasks = []) {
    if (!model.complete) return false;
    let changed = false;
    const actionable = new Map(model.actions.map(task => [task.guid, task]));
    for (const [projectGuid, taskGuid] of Object.entries(state.next)) {
        const task = actionable.get(taskGuid);
        if (!task || task.projectGuid !== projectGuid) {
            const previous = allTasks.find(item => item.guid === taskGuid);
            const reason = previous && previous.status === 'done' ? 'completed' : previous && isWaitingTask(previous) ? 'waiting' : 'removed';
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
const REVIEW_SNAPSHOT_PROPERTY = 'freelance_os_review';
const REVIEW_SNAPSHOT_VERSION = 1;
const REVIEW_BODY_SUMMARY = 'Freelance OS weekly review';

function reviewTitle(week) {
    return `Weekly review · week of ${week}`;
}

function weekDates(week) {
    const start = new Date(`${week}T12:00:00`);
    if (Number.isNaN(start.getTime())) return [];
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return localDate(date);
    });
}

function journalDateTarget(date) {
    const parts = String(date || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(part => !Number.isInteger(part))) return undefined;
    if (typeof DateTime !== 'undefined' && DateTime?.dateOnly) return DateTime.dateOnly(parts[0], parts[1] - 1, parts[2]);
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function parseReviewSnapshot(line) {
    const raw = line?.props?.[REVIEW_SNAPSHOT_PROPERTY];
    if (typeof raw !== 'string' || !raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!isPlainObject(parsed) || parsed.v !== REVIEW_SNAPSHOT_VERSION) return null;
    if (!isValidDate(parsed.week) || typeof parsed.userGuid !== 'string' || !parsed.userGuid) return null;
    if (!['saved', 'pending'].includes(parsed.state)) return null;
    return parsed;
}

function reviewPrioritySnapshot(items = []) {
    return (Array.isArray(items) ? items : []).filter(isPlainObject).map(item => {
        const normalized = { id: String(item.id || ''), text: String(item.text || '') };
        for (const key of ['taskGuid', 'recordGuid', 'projectGuid']) if (typeof item[key] === 'string') normalized[key] = item[key];
        if (isPlainObject(item.carriedFrom)) normalized.carriedFrom = { ...item.carriedFrom };
        return normalized;
    }).filter(item => item.id && item.text);
}

function reviewSnapshot({ week, userGuid, state = 'saved', notes = '', priorityItems = [], savedAt = new Date().toISOString() }) {
    const snapshot = { v: REVIEW_SNAPSHOT_VERSION, week, userGuid, state, savedAt };
    if (state === 'saved') {
        snapshot.notes = String(notes || '');
        snapshot.priorityItems = reviewPrioritySnapshot(priorityItems);
    }
    return snapshot;
}

async function readLegacyReview(record, body) {
    const children = await workflowChildren(body, record);
    let section = '';
    const notes = [];
    const priorityItems = [];
    for (const line of children) {
        const text = extractLineText(line);
        if (text === 'Wins and observations') { section = 'notes'; continue; }
        if (text === 'Priorities for next week') { section = 'priorities'; continue; }
        if (!text) continue;
        if (section === 'notes') notes.push(text);
        else if (section === 'priorities') {
            const ref = (line.segments || []).find(segment => segment.type === 'ref')?.text;
            const taskGuid = typeof ref === 'object' ? ref?.guid : ref;
            priorityItems.push({ id: `legacy-${line.guid}`, text, ...(taskGuid ? { taskGuid } : {}), sourceLineGuid: line.guid });
        }
    }
    return { notes: notes.join('\n'), priorities: priorityItems.map(item => item.text).join('\n'), priorityItems };
}

function weeklyPriorityLines(value = '') {
    return value.split(/\r?\n/).map(text => text.trim()).filter(Boolean).map(text => ({ text }));
}

function reviewPriorityKey(week, text) {
    return `${week}|${text.trim().toLowerCase()}`;
}

function previousReviewWeek(week) {
    const date = new Date(`${week}T12:00:00`);
    date.setDate(date.getDate() - 7);
    return localDate(date);
}

function priorityTextSimilarity(left, right) {
    const tokenize = value => new Set(String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const a = tokenize(left);
    const b = tokenize(right);
    if (!a.size || !b.size) return 0;
    let shared = 0;
    for (const token of a) if (b.has(token)) shared++;
    return shared / Math.max(a.size, b.size);
}

function reviewPriorityResolution(task, extra = {}) {
    if (!task) return null;
    const status = task.status || 'none';
    const kind = TERMINAL_TASK_STATUSES.has(status) ? (status === 'done' ? 'done' : 'canceled') : WAITING_TASK_STATUSES.has(status) ? 'waiting' : 'open';
    return { kind, task, text: task.text, taskGuid: task.guid, recordGuid: task.recordGuid, projectGuid: task.projectGuid, projectName: task.projectName, projectStatus: task.projectStatus, ...extra };
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
    const items = new Array(lines.length).fill(null);
    const retained = new Set();
    // Exact text matches anchor identities first, including reordering.
    lines.forEach((line, index) => {
        const exact = previous.findIndex((item, itemIndex) => !retained.has(itemIndex) && String(item.text || '').trim().toLowerCase() === line.text.toLowerCase());
        if (exact >= 0) { retained.add(exact); items[index] = { ...previous[exact], text: line.text }; }
    });
    // Edited wording keeps its identity when the meaning is recognisably the same.
    lines.forEach((line, index) => {
        if (items[index]) return;
        let best = -1;
        let bestScore = 0.3;
        for (let itemIndex = 0; itemIndex < previous.length; itemIndex++) {
            if (retained.has(itemIndex)) continue;
            const score = priorityTextSimilarity(line.text, previous[itemIndex].text);
            if (score > bestScore) { best = itemIndex; bestScore = score; }
        }
        if (best >= 0) { retained.add(best); items[index] = { ...previous[best], text: line.text }; }
    });
    // A complete rewrite with the same number of lines keeps order-based provenance.
    const openLines = lines.map((line, index) => items[index] ? -1 : index).filter(index => index >= 0);
    const openItems = previous.map((item, index) => retained.has(index) ? -1 : index).filter(index => index >= 0);
    if (openLines.length && openLines.length === openItems.length && !openItems.some(index => previous[index].carriedFrom)) {
        openLines.forEach((lineIndex, offset) => { items[lineIndex] = { ...previous[openItems[offset]], text: lines[lineIndex].text }; });
    }
    lines.forEach((line, index) => { if (!items[index]) items[index] = { id: nextReviewPriorityId(), text: line.text }; });
    draft.priorityItems = items;
    draft.priorities = value;
    return items;
}

function reviewPriorityTask(entry, week, tasks = []) {
    if (entry?.taskGuid) return tasks.find(task => task.guid === entry.taskGuid) || null;
    return tasks.find(task => task.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY] === reviewPriorityIdKey(week, entry?.id)
        || task.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY] === reviewPriorityKey(week, entry?.text)) || null;
}

function nativeNextActionMarkers(lines) {
    return lines.filter(line => line.props?.[NEXT_ACTION_PROPERTY] === NEXT_ACTION_MARKER);
}

function reconcileNativeNextActions(state, projects, tasks, markers, complete = true) {
    if (!complete) return { write: [], remove: [] };
    const actionable = new Map(tasks.filter(isActionableTask).map(task => [task.guid, task]));
    const projectByRecord = new Map(projects.map(project => [project.guid, project]));
    const write = [];
    const remove = [];
    for (const project of projects) {
        const projectMarkers = markers.filter(marker => marker.recordGuid === project.guid);
        if (!isTrackedProject(project)) {
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
                const reason = previous && previous.status === 'done' ? 'completed' : previous && isWaitingTask(previous) ? 'waiting' : 'removed';
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
            const reason = previous && previous.status === 'done' ? 'completed' : previous && isWaitingTask(previous) ? 'waiting' : 'removed';
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
        ...model.waiting.map(task => {
            const details = waitingDetailsFor(task, state);
            const note = [details.reason ? ` — ${details.reason}` : '', details.followup ? ` (follow up ${details.followup})` : ''].join('');
            return `${task.projectName}: ${task.text}${note}`;
        }),
        '', `Open overdue actions: ${model.overdue.length}`, `Done tasks updated in the last 7 days: ${workflow.recentDone.length}`,
        ...workflow.recentDone.map(task => `${task.projectName}: ${task.text}`), '', 'Wins and observations', draft.notes || 'No notes added.', '', 'Priorities for next week', draft.priorities || 'No priorities added.'];
    if (!model.complete) lines.push('', 'Some project tasks could not be loaded; this review is incomplete.');
    return lines.join('\n');
}

const Workflow = {
    getBaseCurrency() {
        return this.workflowState?.baseCurrency || 'CHF';
    },
    workflowStorageAdapter() {
        if (typeof this.getLocalStorage === 'function' && typeof this.setLocalStorage === 'function') {
            return {
                kind: 'plugin',
                read: () => this.getLocalStorage(WORKFLOW_STORAGE_KEY),
                write: value => this.setLocalStorage(WORKFLOW_STORAGE_KEY, value) !== false
            };
        }
        let storage = null;
        try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch { storage = null; }
        if (!storage) return null;
        const workspaceGuid = this.getWorkspaceGuid?.() || this.workspaceGuid || this.collectionRoot?.wsguid || '';
        const pluginGuid = this.getGuid?.() || this.collectionRoot?.guid || '';
        const key = workflowStorageKey(workspaceGuid, pluginGuid);
        return {
            kind: 'browser',
            key,
            read: () => storage.getItem(key),
            write: value => { storage.setItem(key, value); return true; }
        };
    },

    loadWorkflowState() {
        if (this.workflowState) return this.workflowState;
        this.workflowStorageError = '';
        this.workflowStorageCorrupt = false;
        const defaults = workflowDefaults();
        let raw = '';
        try {
            const adapter = this.workflowStorageAdapter();
            if (!adapter) throw new Error('Local storage is unavailable');
            this.workflowStorageKind = adapter.kind;
            raw = adapter.read() || '';
        } catch (error) {
            this.workflowStorageError = 'Dashboard settings and drafts could not be read from local storage. You can keep working, but changes may not be saved.';
            this.workflowState = defaults;
            return this.workflowState;
        }
        if (!raw) {
            this.workflowState = defaults;
            return this.workflowState;
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
            if (!isPlainObject(parsed)) throw new Error('Saved state is not an object');
        } catch (error) {
            this.workflowStorageCorrupt = true;
            this.workflowStorageError = 'Saved dashboard state could not be read. It will be replaced by your next save; review any unsaved text before continuing.';
            this.workflowState = defaults;
            return this.workflowState;
        }
        this.workflowState = normalizeWorkflowState(parsed);
        return this.workflowState;
    },

    persistWorkflow() {
        try {
            const adapter = this.workflowStorageAdapter();
            if (!adapter) throw new Error('Local storage is unavailable');
            const serialized = JSON.stringify(this.loadWorkflowState());
            const written = adapter.write(serialized);
            if (written === false) throw new Error('Storage rejected the write');
            const readBack = adapter.read();
            if (readBack !== serialized) throw new Error('Storage did not retain the write');
            this.workflowStorageKind = adapter.kind;
            this.workflowStorageError = '';
            this.workflowStorageCorrupt = false;
            return true;
        } catch (error) {
            this.workflowStorageError = 'Local changes could not be saved. Keep this dashboard open and try again.';
            const now = Date.now();
            if (typeof this.ui?.addToaster === 'function' && now - (this.workflowStorageAlertAt || 0) > 5000) {
                this.workflowStorageAlertAt = now;
                this.ui.addToaster({ title: 'Local changes could not be saved on this device.', autoDestroyTime: 5000, dismissible: true });
            }
            return false;
        }
    },

    collectionGuid(role, collections = this.workflowCollections || []) {
        const state = this.loadWorkflowState();
        const mapped = collections.find(collection => collection.getGuid() === state.mappings[role]);
        return mapped?.getGuid() || collections.find(collection => role === 'Journal' ? collection.isJournalPlugin?.() : collection.getName?.().toLowerCase() === role.toLowerCase())?.getGuid() || '';
    },

    async loadWorkflowData(options = {}) {
        const expectedVersion = Number.isInteger(options.expectedVersion) ? options.expectedVersion : null;
        const mutationVersion = this.workflowMutationVersion || 0;
        const state = cloneWorkflowState(this.loadWorkflowState());
        const collections = this.workflowCollections = await this.data.getAllCollections();
        const collection = collections.find(item => item.getGuid() === this.collectionGuid('Projects', collections));
        if (!collection) return { error: 'Choose your Projects collection in Settings.' };
        const records = await collection.getAllRecords();
        const byGuid = new Map(records.map(record => [record.guid, { record, guid: record.guid, name: record.getName(), parentGuid: getParentGuid(record), status: String(getProp(record, 'status') || '').toLowerCase(), priority: String(getProp(record, 'priority') || 'medium').toLowerCase(), deadline: getProp(record, 'deadline') }]));
        const projects = [...byGuid.values()].filter(record => !record.parentGuid && record.name !== 'Kanban - Active Projects' && !isTemplateRecord(record.record));
        const coverage = { complete: true, recordsFailed: 0, searchFailed: false, searchTruncated: false };
        const ownershipIssues = { ambiguous: 0, unresolved: 0, excluded: 0 };
        const diagnosticTasks = new Set();
        const countOwnershipIssue = (line, kind) => {
            if (line.guid) {
                if (diagnosticTasks.has(line.guid)) return;
                diagnosticTasks.add(line.guid);
            }
            ownershipIssues[kind]++;
        };
        const taskMap = new Map();
        const nextMarkers = [];
        const clientReviewSections = new Set();
        const add = line => {
            const status = line.getTaskStatus?.();
            if (status === null || status === undefined) return;
            const sourceRecord = (typeof line.getRecord === 'function' ? line.getRecord() : null) || null;
            const ownership = resolveTaskProject(line, sourceRecord, byGuid);
            if (ownership.kind === 'excluded') { countOwnershipIssue(line, 'excluded'); return; }
            if (ownership.kind === 'ambiguous') { countOwnershipIssue(line, 'ambiguous'); return; }
            if (ownership.kind === 'unresolved') { countOwnershipIssue(line, 'unresolved'); return; }
            if (!ownership.projectGuid || !byGuid.has(ownership.projectGuid)) return;
            const text = extractLineText(line);
            if (!text) return;
            const clientReview = line.props?.[CLIENT_REVIEW_CHECKPOINT_PROPERTY] === 'checkpoint-v1' || clientReviewSections.has(line.parent_guid) || taskMap.get(line.guid)?.clientReview === true;
            const waiting = readWaitingDetails(line, state.waiting?.[line.guid]);
            taskMap.set(line.guid, {
                guid: line.guid, lineItem: line, text, status,
                recordGuid: sourceRecord?.guid || line.getRecord?.()?.guid || ownership.projectGuid,
                projectGuid: ownership.projectGuid, projectName: byGuid.get(ownership.projectGuid).name,
                date: validDateValue(extractLineDate(line)), updated: line.getUpdatedAt?.(), clientReview,
                waitingDetails: waiting.details, waitingSource: waiting.source, waitingValid: waiting.valid
            });
        };
        // Read actual project pages, so an arbitrary workspace search limit cannot create false gaps.
        for (let index = 0; index < records.length; index += 8) {
            await Promise.all(records.slice(index, index + 8).map(async record => {
                try {
                    const lines = await record.getLineItems(false);
                    for (const line of lines) if (line.type === 'heading' && ['clientreviewcheckpoints', 'waitingonclient'].includes(extractLineText(line).toLowerCase().replace(/[^a-z]/g, ''))) clientReviewSections.add(line.guid);
                    for (const line of lines) {
                        add(line);
                        if (line.props?.[NEXT_ACTION_PROPERTY] === NEXT_ACTION_MARKER) nextMarkers.push({ line, recordGuid: record.guid, segments: line.segments });
                    }
                }
                catch { coverage.complete = false; coverage.recordsFailed++; }
            }));
        }
        try {
            const linked = await this.data.searchByQuery('@task @todo', 1000);
            if (linked?.error) throw new Error(linked.error);
            if (!linked || !Array.isArray(linked.lines)) throw new Error('Task search returned an invalid result');
            linked.lines.forEach(add);
            if (linked.lines.length >= 1000) { coverage.complete = false; coverage.searchTruncated = true; }
        } catch { coverage.complete = false; coverage.searchFailed = true; }
        const complete = coverage.complete;
        const tasks = [...taskMap.values()];
        const today = localDate();
        const recentDone = tasks.filter(task => task.status === 'done' && task.updated instanceof Date && task.updated.getTime() >= Date.now() - 7 * 86400000);
        const priorNextState = JSON.stringify({ next: state.next, nextLabels: state.nextLabels, nextRecovery: state.nextRecovery });
        const nativeReconciliation = reconcileNativeNextActions(state, projects, tasks, nextMarkers, complete);
        const model = actionModel(projects, tasks, state, today, complete);
        const stateChanged = reconcileWorkflowPointers(state, model, tasks) || priorNextState !== JSON.stringify({ next: state.next, nextLabels: state.nextLabels, nextRecovery: state.nextRecovery });
        const snapshot = {
            projects, tasks, model, recentDone, byGuid, complete,
            coverage: { ...coverage, loadedTasks: tasks.length }, ownershipIssues,
            pointerState: state, pointerChanged: stateChanged,
            nativeReconciliation: { ...nativeReconciliation, remove: nativeReconciliation.remove.map(marker => ({ ...marker, expectedSegments: JSON.stringify(marker.segments || []) })) },
            nativeMarkers: nextMarkers.map(marker => ({ recordGuid: marker.recordGuid, guid: marker.line.guid, segments: JSON.stringify(marker.segments || []) })),
            expectedVersion, mutationVersion
        };
        if (!options.deferApply) await this.applyWorkflowSnapshot(snapshot, { expectedVersion, skipNative: true });
        return snapshot;
    },

    async applyWorkflowSnapshot(snapshot, { expectedVersion = snapshot?.expectedVersion ?? null, skipNative = false } = {}) {
        if (!snapshot || snapshot.error || snapshot.applied) return !!snapshot?.applied;
        const generationStale = expectedVersion !== null && expectedVersion !== this.renderVersion;
        const mutationStale = (snapshot.mutationVersion || 0) !== (this.workflowMutationVersion || 0);
        if (generationStale || mutationStale) {
            snapshot.stale = true;
            return false;
        }
        if (snapshot.complete && !skipNative) {
            await this.applyNativeReconciliation(snapshot);
            if (snapshot.stale) return false;
        }
        if (!this.workflowSnapshotCurrent(snapshot, expectedVersion)) { snapshot.stale = true; return false; }
        if (snapshot.complete && snapshot.pointerChanged && !this.workflowSyncError) {
            // Only pointer state is replaced. Drafts, mappings and unrelated live edits stay intact.
            const live = this.loadWorkflowState();
            live.next = snapshot.pointerState.next;
            live.nextLabels = snapshot.pointerState.nextLabels;
            live.nextRecovery = snapshot.pointerState.nextRecovery;
            live.focus = snapshot.pointerState.focus;
            this.persistWorkflow();
        }
        snapshot.applied = true;
        return true;
    },

    workflowSnapshotCurrent(snapshot, expectedVersion = snapshot.expectedVersion) {
        return (expectedVersion == null || expectedVersion === this.renderVersion)
            && (snapshot.mutationVersion || 0) === (this.workflowMutationVersion || 0);
    },

    async applyNativeReconciliation(snapshot) {
        const job = async () => {
            const guard = () => this.workflowSnapshotCurrent(snapshot);
            const check = () => {
                if (guard()) return;
                const error = new Error('A newer workflow change superseded this sync.');
                error.code = 'STALE_WORKFLOW';
                throw error;
            };
            try {
                check();
                const touchedProjects = new Set();
                for (const marker of snapshot.nativeReconciliation.remove) {
                    const record = this.data.getRecord?.(marker.recordGuid) || snapshot.byGuid.get(marker.recordGuid)?.record;
                    if (!record) continue;
                    const lines = await record.getLineItems(false);
                    check();
                    const current = lines.find(line => line.guid === marker.line?.guid);
                    if (!current || current.props?.[NEXT_ACTION_PROPERTY] !== NEXT_ACTION_MARKER) continue;
                    const expectedSegments = marker.expectedSegments ?? JSON.stringify(marker.segments || []);
                    if (JSON.stringify(current.segments || []) !== expectedSegments) {
                        const error = new Error('The project next action changed while syncing.');
                        error.code = 'STALE_WORKFLOW';
                        throw error;
                    }
                    const ref = current.segments?.find(segment => segment.type === 'ref')?.text;
                    const taskGuid = typeof ref === 'object' ? ref?.guid : ref;
                    const priorTask = snapshot.tasks?.find(task => task.guid === taskGuid);
                    if (priorTask && !isActionableTask(priorTask)) {
                        const source = this.data.getRecord?.(priorTask.recordGuid) || snapshot.byGuid.get(priorTask.recordGuid)?.record;
                        if (!source) throw new Error('The task source could not be checked before removing a next action.');
                        const freshLines = await source.getLineItems(false);
                        check();
                        const freshTask = freshLines.find(line => line.guid === taskGuid);
                        if (freshTask && isActionableTask(freshTask.getTaskStatus?.()) && resolveTaskProject(freshTask, source, snapshot.byGuid).projectGuid === marker.recordGuid) {
                            const error = new Error('The previous next action became actionable again.'); error.code = 'STALE_WORKFLOW'; throw error;
                        }
                        const latest = (await record.getLineItems(false)).find(line => line.guid === current.guid);
                        check();
                        if (!latest || JSON.stringify(latest.segments || []) !== expectedSegments) {
                            const error = new Error('The project next action changed while checking its task.'); error.code = 'STALE_WORKFLOW'; throw error;
                        }
                    }
                    if (await current.delete() === false) throw new Error('Stale project next action could not be removed');
                    check();
                    touchedProjects.add(marker.recordGuid);
                }
                for (const guid of touchedProjects) { await this.pruneNativeNextActionSection(this.data.getRecord?.(guid) || snapshot.byGuid.get(guid)?.record, guard); check(); }
                for (const { project, task } of snapshot.nativeReconciliation.write) {
                    check();
                    const record = this.data.getRecord?.(project.guid) || snapshot.byGuid.get(project.guid)?.record;
                    if (!record) throw new Error('A project page is no longer available');
                    const freshStatus = String(getProp(record, 'status') || '').toLowerCase();
                    if (!isActiveProject({ status: freshStatus })) continue;
                    const sourceRecord = this.data.getRecord?.(task.recordGuid) || snapshot.byGuid.get(task.recordGuid)?.record;
                    if (!sourceRecord) throw new Error('A task source page is no longer available');
                    const lines = await sourceRecord.getLineItems(false);
                    check();
                    const freshLine = lines.find(line => line.guid === task.guid);
                    if (!freshLine) throw new Error('A selected task is no longer available');
                    if (!isActionableTask({ status: freshLine.getTaskStatus?.() })) throw new Error('A selected task is no longer actionable');
                    const freshOwnership = resolveTaskProject(freshLine, sourceRecord, snapshot.byGuid);
                    if (freshOwnership.projectGuid !== project.guid) throw new Error('A selected task moved to another project');
                    task.text = extractLineText(freshLine) || task.text;
                    const removed = new Set(snapshot.nativeReconciliation.remove.map(marker => marker.line?.guid));
                    const expectedMarkers = snapshot.nativeMarkers?.filter(marker => marker.recordGuid === project.guid && !removed.has(marker.guid));
                    await this.writeNativeNextAction(record, task, { guard, expectedMarkers });
                    check();
                }
                this.workflowSyncError = '';
                return true;
            } catch (error) {
                if (error.code === 'STALE_WORKFLOW') { snapshot.stale = true; return false; }
                this.workflowSyncError = 'Project next-action sync could not be completed. Your last good dashboard state is preserved; refresh to retry.';
                return false;
            }
        };
        this.workflowNativeSync = (this.workflowNativeSync || Promise.resolve()).catch(() => {}).then(job);
        return this.workflowNativeSync;
    },

    async writeNativeNextAction(record, task, { guard = () => true, expectedMarkers } = {}) {
        const check = () => {
            if (guard()) return;
            const error = new Error('A newer workflow change superseded this sync.');
            error.code = 'STALE_WORKFLOW';
            throw error;
        };
        if (!record) throw new Error('Project page is unavailable');
        const lines = await record.getLineItems(false);
        check();
        const markers = nativeNextActionMarkers(lines);
        if (expectedMarkers && (markers.length !== expectedMarkers.length || markers.some(marker =>
            !expectedMarkers.some(expected => expected.guid === marker.guid && expected.segments === JSON.stringify(marker.segments || []))))) {
            const error = new Error('The project next action changed while syncing.');
            error.code = 'STALE_WORKFLOW';
            throw error;
        }
        if (!task) {
            for (const marker of markers) { check(); if (await marker.delete() === false) throw new Error('Project next action could not be cleared'); }
            await this.pruneNativeNextActionSection(record, guard);
            return true;
        }
        let marker = markers[0];
        if (marker) {
            const segments = [{ type: 'text', text: 'Next action: ' }, { type: 'ref', text: { guid: task.guid, title: task.text } }];
            if (JSON.stringify(marker.segments || []) !== JSON.stringify(segments) && await marker.setSegments(segments) === false) throw new Error('Project next action could not be updated');
            for (const duplicate of markers.slice(1)) { check(); if (await duplicate.delete() === false) throw new Error('Duplicate project next action could not be removed'); }
            return true;
        }

        let section = lines.find(line => line.type === 'heading' && ['nextactions', 'deliverablesandtasks', 'tasks'].includes(extractLineText(line).toLowerCase().replace(/[^a-z]/g, '')));
        if (!section) {
            const title = lines.find(line => line.type === 'heading' && line.parent_guid === record.guid && (line.getHeadingSize?.() === 1 || line.props?.hsize === 1))
                || lines.find(line => line.type === 'heading' && line.parent_guid === record.guid);
            const rootLines = lines.filter(line => line.parent_guid === record.guid);
            section = await record.createLineItem(title || null, title ? null : rootLines.at(-1) || null, 'heading', [{ type: 'text', text: 'Next actions' }], { hsize: 2, [NEXT_ACTION_PROPERTY]: 'section-v1' });
            if (!section) throw new Error('Project next actions section could not be created');
            check();
        }
        const children = lines.filter(line => line.parent_guid === section.guid);
        const segments = [{ type: 'text', text: 'Next action: ' }, { type: 'ref', text: { guid: task.guid, title: task.text } }];
        marker = await record.createLineItem(section, children.at(-1) || null, 'text', segments, { [NEXT_ACTION_PROPERTY]: NEXT_ACTION_MARKER });
        if (!marker) throw new Error('Project next action reference could not be saved');
        return true;
    },

    async pruneNativeNextActionSection(record, guard = () => true) {
        const lines = await record.getLineItems(false);
        if (!guard()) { const error = new Error('A newer workflow change superseded this sync.'); error.code = 'STALE_WORKFLOW'; throw error; }
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

    async saveWaitingDetails(task, details) {
        const validated = validateWaitingInput(details);
        if (typeof task.lineItem?.setMetaProperties !== 'function') throw new Error('This Thymer build cannot sync waiting notes.');
        const payload = JSON.stringify({
            v: WAITING_DETAILS_VERSION,
            reason: validated.reason,
            followup: validated.followup,
            previousStatus: validated.previousStatus
        });
        if (await task.lineItem.setMetaProperties({ [WAITING_DETAILS_PROPERTY]: payload }) === false) throw new Error('The waiting note could not be saved.');
        return validated;
    },

    async saveWaiting(task, values, currentlyWaiting = false) {
        this.rememberWaitingEditor(task.guid, values);
        const previousStatus = currentlyWaiting
            ? waitingDetailsFor(task, this.workflowState).previousStatus
            : normalizeResumableStatus(task.status);
        const validated = validateWaitingInput({ ...values, previousStatus });
        try { await this.saveWaitingDetails(task, validated); }
        catch (error) { throw new Error(`${error.message} The task status was not changed.`); }
        try { await this.setActionStatus(task, 'blocked'); }
        catch (error) { throw new Error('The waiting note was saved, but the task status could not be updated. Retry to finish.'); }
        this.clearWaitingEditor(task.guid, values);
        return validated;
    },

    rememberWaitingEditor(taskGuid, values) {
        this.waitingEditorDrafts ||= {};
        this.waitingEditorDrafts[taskGuid] = { reason: String(values.reason || ''), followup: String(values.followup || '') };
        return this.waitingEditorDrafts[taskGuid];
    },

    clearWaitingEditor(taskGuid, savedValues) {
        const draft = this.waitingEditorDrafts?.[taskGuid];
        if (draft && draft.reason === String(savedValues.reason || '') && draft.followup === String(savedValues.followup || '')) delete this.waitingEditorDrafts[taskGuid];
    },

    saveWaitingLocal(task, values, currentlyWaiting = false) {
        const previousStatus = currentlyWaiting
            ? waitingDetailsFor(task, this.workflowState).previousStatus
            : normalizeResumableStatus(task.status);
        const validated = validateWaitingInput({ ...values, previousStatus });
        this.workflowState.waiting[task.guid] = validated;
        if (!this.persistWorkflow()) throw new Error('The waiting note could not be saved on this device. Your text is kept in this form.');
        return validated;
    },

    async resumeWaiting(task) {
        const details = waitingDetailsFor(task, this.workflowState);
        await this.setActionStatus(task, details.previousStatus);
        return details;
    },

    async rescheduleAction(task, date) {
        if (date && dateDay(date) === null) throw new Error('Choose a valid date');
        const parts = date ? date.split('-').map(Number) : [];
        // SDK segments require a DateTimeValue; MCP's date-string shorthand is not supported here.
        const value = date ? (typeof DateTime !== 'undefined' ? DateTime.dateOnly(parts[0], parts[1] - 1, parts[2]).value() : { d: date.replace(/-/g, '') }) : '';
        if (await task.lineItem.setSegments(taskDateSegments(task.lineItem.segments || [], date, value)) === false) throw new Error('Task date was not saved');
    },

    resolveJournalOwner(journal, collections = this.workflowCollections || []) {
        const users = typeof this.data.getActiveUsers === 'function' ? this.data.getActiveUsers() : [];
        if (!users.length) throw new Error('No active Thymer user is available for the Journal.');
        if (users.length === 1) return users[0];
        const state = this.loadWorkflowState();
        const journalGuid = journal?.getGuid?.() || '';
        const selected = journalGuid ? state.journalOwners?.[journalGuid] : '';
        const user = users.find(item => item.guid === selected);
        if (!user) throw new Error('Choose the Journal owner in Settings before saving a review.');
        return user;
    },

    async getReviewRecord(reference, journal, user) {
        if (!journal) {
            const collections = await this.data.getAllCollections();
            journal = collections.find(collection => collection.getGuid() === (reference?.journalGuid || this.collectionGuid('Journal', collections)));
        }
        if (!journal?.isJournalPlugin?.()) throw new Error('Choose a Journal collection in Settings');
        if (!user) user = this.resolveJournalOwner(journal);
        if (reference?.userGuid && reference.userGuid !== user.guid) reference = null;
        const cached = reference?.recordGuid ? this.data.getRecord?.(reference.recordGuid) : null;
        if (cached) return cached;
        const date = reference?.journalDate || (reference?.savedAt ? localDate(new Date(reference.savedAt)) : '');
        return journal.getJournalRecord(user, date ? journalDateTarget(date) : undefined);
    },

    async reviewCandidatesForRecord(record, user, week, date, journalGuid) {
        const lines = await record.getLineItems(false);
        const candidates = [];
        for (const heading of lines.filter(line => line.type === 'heading')) {
            const snapshot = parseReviewSnapshot(heading);
            if (snapshot) {
                if (snapshot.week !== week || snapshot.userGuid !== user.guid) continue;
                let legacyReview = null;
                if (snapshot.state === 'pending') {
                    try {
                        const pendingChildren = await workflowChildren(heading, record);
                        const pendingBody = pendingChildren.find(line => extractLineText(line).startsWith(REVIEW_BODY_SUMMARY));
                        if (pendingBody) legacyReview = await readLegacyReview(record, pendingBody);
                    } catch { legacyReview = null; }
                }
                candidates.push({
                    record, heading, date, snapshot, legacy: false, legacyReview,
                    reference: {
                        savedAt: typeof snapshot.savedAt === 'string' ? snapshot.savedAt : '',
                        journalGuid, journalDate: date, userGuid: user.guid,
                        recordGuid: record.guid, headingGuid: heading.guid
                    }
                });
                continue;
            }
            if (extractLineText(heading) !== reviewTitle(week)) continue;
            const children = await workflowChildren(heading, record);
            const body = children.find(line => {
                const text = extractLineText(line);
                return text === REVIEW_BODY_SUMMARY || text.startsWith(REVIEW_BODY_SUMMARY);
            });
            if (!body) {
                // A heading created immediately before a failed first write can still be repaired.
                candidates.push({
                    record, heading, date, snapshot: null, legacy: true, pending: true,
                    legacyReview: { notes: '', priorities: '', priorityItems: [] },
                    reference: {
                        savedAt: heading.getUpdatedAt?.() instanceof Date ? heading.getUpdatedAt().toISOString() : '',
                        journalGuid, journalDate: date, userGuid: user.guid,
                        recordGuid: record.guid, headingGuid: heading.guid
                    }
                });
                continue;
            }
            const bodyChildren = await workflowChildren(body, record);
            const hasExpectedBody = bodyChildren.some(line => extractLineText(line).startsWith('Week of '))
                && bodyChildren.some(line => extractLineText(line) === 'Priorities for next week');
            if (!hasExpectedBody) continue;
            const legacyReview = await readLegacyReview(record, body);
            candidates.push({
                record, heading, date, snapshot: null, legacy: true, legacyReview,
                reference: {
                    savedAt: heading.getUpdatedAt?.() instanceof Date ? heading.getUpdatedAt().toISOString() : '',
                    journalGuid, journalDate: date, userGuid: user.guid,
                    recordGuid: record.guid, headingGuid: heading.guid
                }
            });
        }
        return candidates;
    },

    async findWeeklyReview(journal, user, week, { cached = null } = {}) {
        if (!journal?.isJournalPlugin?.() || !user) throw new Error('Choose a Journal collection and owner in Settings');
        const candidates = new Map();
        let failure = '';
        const add = candidate => {
            const existing = candidates.get(candidate.heading.guid);
            if (!existing || (!existing.snapshot && candidate.snapshot)) candidates.set(candidate.heading.guid, candidate);
        };
        if (cached?.headingGuid && cached.recordGuid && (!cached.userGuid || cached.userGuid === user.guid)) {
            const savedDate = cached.savedAt && !Number.isNaN(new Date(cached.savedAt).getTime()) ? localDate(new Date(cached.savedAt)) : '';
            const date = isValidDate(cached.journalDate) ? cached.journalDate : savedDate;
            try {
                let record = this.data.getRecord?.(cached.recordGuid) || null;
                if (!record && date) record = await journal.getJournalRecord(user, journalDateTarget(date));
                if (record) {
                    const found = await this.reviewCandidatesForRecord(record, user, week, date || localDate(new Date()), journal.getGuid());
                    const match = found.find(candidate => candidate.heading.guid === cached.headingGuid);
                    if (match) add({ ...match, cached: true, reference: { ...match.reference, savedAt: match.reference.savedAt || cached.savedAt || '' } });
                }
            } catch (error) {
                failure = error.message || 'The cached review location could not be read.';
            }
        }
        const seenRecords = new Set();
        for (const date of weekDates(week)) {
            let record;
            try { record = await journal.getJournalRecord(user, journalDateTarget(date)); }
            catch (error) { if (!failure) failure = error.message || 'A Journal day could not be read.'; continue; }
            if (!record) { if (!failure) failure = 'A Journal day could not be read.'; continue; }
            if (seenRecords.has(record.guid)) continue;
            seenRecords.add(record.guid);
            try {
                const found = await this.reviewCandidatesForRecord(record, user, week, date, journal.getGuid());
                for (const candidate of found) add(candidate);
            } catch (error) {
                if (!failure) failure = error.message || 'A Journal day could not be read.';
            }
        }
        const list = [...candidates.values()].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.heading.guid.localeCompare(b.heading.guid));
        if (failure) return { kind: 'incomplete', candidates: list, error: failure };
        if (list.length > 1) return { kind: 'multiple', candidates: list };
        if (list.length === 1) return { kind: 'one', candidates: list, ...list[0] };
        return { kind: 'none', candidates: [] };
    },

    async loadWeeklyReviewContext({ force = false } = {}) {
        const week = reviewWeek();
        let journal;
        let user;
        try {
            const collections = await this.data.getAllCollections();
            journal = collections.find(collection => collection.getGuid() === this.collectionGuid('Journal', collections));
            if (!journal?.isJournalPlugin?.()) return { kind: 'incomplete', candidates: [], error: 'Choose your Journal collection in Settings.' };
            user = this.resolveJournalOwner(journal, collections);
        } catch (error) {
            return { kind: 'incomplete', candidates: [], error: error.message };
        }
        const key = `${week}|${journal.getGuid()}|${user.guid}`;
        if (!force && this.reviewDiscovery?.key === key) return this.reviewDiscovery.discovery;
        let discovery;
        try { discovery = await this.findWeeklyReview(journal, user, week, { cached: this.workflowState.reviews[week] }); }
        catch (error) { discovery = { kind: 'incomplete', candidates: [], error: error.message }; }
        this.reviewDiscovery = { key, week, journalGuid: journal.getGuid(), userGuid: user.guid, discovery };
        return discovery;
    },

    async saveReviewSnapshot(heading, snapshot, { pending = false } = {}) {
        if (typeof heading?.setMetaProperties !== 'function') throw new Error('This Thymer build cannot save review identity.');
        const message = pending
            ? 'The review section could not be identified. Try again.'
            : 'Review saved to Journal, but its saved-review marker could not be written. Retry to finish.';
        let saved;
        try { saved = await heading.setMetaProperties({ [REVIEW_SNAPSHOT_PROPERTY]: JSON.stringify(snapshot) }); }
        catch { throw new Error(message); }
        if (saved === false) throw new Error(message);
        return true;
    },

    async writeReviewBody(record, heading, workflow, draft, week, today) {
        if (!Array.isArray(draft.priorityItems)) reconcileReviewPriorityItems(draft, draft.priorities || '');
        this.hydrateReviewPriorityLinks(draft, week, workflow.tasks || []);
        const children = await workflowChildren(heading, record);
        let body = children.find(line => extractLineText(line).startsWith(REVIEW_BODY_SUMMARY));
        const segments = [{ type: 'text', text: REVIEW_BODY_SUMMARY }];
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
            if (entry && linkedTask) {
                entry.taskGuid = linkedTask.guid;
                if (linkedTask.recordGuid) entry.recordGuid = linkedTask.recordGuid;
                if (linkedTask.projectGuid) entry.projectGuid = linkedTask.projectGuid;
                await this.ensureReviewPriorityMarker(linkedTask, week, entry);
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
        return body;
    },

    async saveReviewToJournal(workflow, draft, today = localDate()) {
        if (this.reviewSaving) return null;
        this.reviewSaving = true;
        const week = reviewWeek(today);
        try {
            const collections = await this.data.getAllCollections();
            const journal = collections.find(collection => collection.getGuid() === this.collectionGuid('Journal', collections));
            if (!journal?.isJournalPlugin?.()) throw new Error('Choose a Journal collection in Settings');
            const user = this.resolveJournalOwner(journal, collections);
            const linkedGuids = (Array.isArray(draft.priorityItems) ? draft.priorityItems : []).map(entry => entry.taskGuid).filter(Boolean);
            if (new Set(linkedGuids).size !== linkedGuids.length) throw new Error('Two priorities in this week link the same task. Choose a different task for one of them.');
            let discovery = await this.findWeeklyReview(journal, user, week, { cached: this.workflowState.reviews[week] });
            if (discovery.kind === 'incomplete') {
                this.weeklyReviewDiscovery = discovery;
                throw new Error('Saved reviews for this week could not be checked. Your draft is kept; retry before saving to avoid a duplicate.');
            }
            let target = null;
            if (discovery.kind === 'multiple') {
                target = discovery.candidates.find(candidate => this.selectedReviewWeek === week && candidate.heading.guid === this.selectedReviewHeadingGuid) || null;
                if (!target) {
                    this.weeklyReviewDiscovery = discovery;
                    throw new Error('Multiple saved reviews were found for this week. Choose the section to update before saving.');
                }
            } else if (discovery.kind === 'one') {
                target = discovery;
            }
            let freshRecord = null;
            if (!target) {
                try { freshRecord = await journal.getJournalRecord(user, journalDateTarget(today)); }
                catch { throw new Error('The Journal page for today could not be opened.'); }
                if (!freshRecord) throw new Error('The Journal page for today is unavailable.');
                // Final fresh check of the intended date before creating a second section.
                const fresh = await this.reviewCandidatesForRecord(freshRecord, user, week, today, journal.getGuid());
                if (fresh.length > 1) {
                    this.weeklyReviewDiscovery = { kind: 'multiple', candidates: fresh };
                    throw new Error('Multiple saved reviews were found for this week. Choose the section to update before saving.');
                }
                if (fresh.length === 1) target = fresh[0];
            }
            if (!target) {
                let record = freshRecord;
                if (!record) {
                    try { record = await journal.getJournalRecord(user, journalDateTarget(today)); }
                    catch { throw new Error('The Journal page for today could not be opened.'); }
                }
                if (!record) throw new Error('The Journal page for today is unavailable.');
                const heading = await record.createLineItem(null, null, 'heading', [{ type: 'text', text: reviewTitle(week) }]);
                if (!heading) throw new Error('Review heading could not be saved');
                try {
                    await this.saveReviewSnapshot(heading, reviewSnapshot({ week, userGuid: user.guid, state: 'pending' }), { pending: true });
                } catch (error) {
                    try { await heading.delete?.(); } catch { /* keep the original error */ }
                    throw error;
                }
                target = {
                    record, heading, date: today, snapshot: null, legacy: false, legacyReview: null,
                    reference: { savedAt: new Date().toISOString(), journalGuid: journal.getGuid(), journalDate: today, userGuid: user.guid, recordGuid: record.guid, headingGuid: heading.guid }
                };
            }
            try {
                await this.writeReviewBody(target.record, target.heading, workflow, draft, week, today);
                const snapshot = reviewSnapshot({
                    week, userGuid: user.guid, state: 'saved',
                    notes: draft.notes || '', priorityItems: draft.priorityItems || [],
                    savedAt: new Date().toISOString()
                });
                await this.saveReviewSnapshot(target.heading, snapshot);
                const reference = {
                    savedAt: snapshot.savedAt,
                    journalGuid: journal.getGuid(),
                    journalDate: isValidDate(target.date) ? target.date : today,
                    userGuid: user.guid,
                    recordGuid: target.record.guid,
                    headingGuid: target.heading.guid
                };
                this.workflowState.reviews[week] = reference;
                this.persistWorkflow();
                this.selectedReviewHeadingGuid = '';
                this.selectedReviewWeek = '';
                this.weeklyReviewDiscovery = null;
                this.reviewDiscovery = null;
                return reference;
            } catch (error) {
                // Keep the draft and clear the cache so a retry discovers the pending/updated section.
                this.reviewDiscovery = null;
                this.weeklyReviewDiscovery = null;
                throw error;
            }
        } finally { this.reviewSaving = false; }
    },

    async ensureReviewPriorityMarker(task, week, entry, { require = false } = {}) {
        // SDK line wrappers can outlive their metadata cache. Re-read before deciding that
        // an origin is absent, otherwise successive saves can replace an earlier week.
        if (task?.recordGuid && typeof this.data?.getRecord === 'function') {
            try {
                const record = this.data.getRecord(task.recordGuid);
                if (!record) throw new Error('The task source is unavailable.');
                const fresh = (await record.getLineItems(false)).find(line => line.guid === task.guid);
                if (!fresh) throw new Error('The task is unavailable.');
                task.lineItem = fresh;
            } catch {
                if (require) throw new Error('The task link could not be checked. Refresh and try again.');
                return false;
            }
        }
        if (!task?.lineItem || typeof task.lineItem.setMetaProperties !== 'function') {
            if (require) throw new Error('This Thymer build cannot save task links. Update Thymer and try again.');
            return false;
        }
        const marker = task.lineItem.props?.[REVIEW_PRIORITY_PROPERTY];
        // The marker is origin/recovery. A later week links through the review snapshot without
        // overwriting the task's original origin.
        if (marker) return true;
        let saved;
        try { saved = await task.lineItem.setMetaProperties({ [REVIEW_PRIORITY_PROPERTY]: reviewPriorityIdKey(week, entry.id) }); }
        catch { saved = false; }
        if (saved === false) {
            if (require) throw new Error('The task link could not be saved.');
            return false;
        }
        return true;
    },

    hydrateReviewPriorityLinks(draft, week, tasks = []) {
        if (!Array.isArray(draft.priorityItems)) reconcileReviewPriorityItems(draft, draft.priorities || '');
        for (const entry of draft.priorityItems) {
            const linked = reviewPriorityTask(entry, week, tasks);
            if (linked) {
                entry.taskGuid = linked.guid;
                if (linked.recordGuid) entry.recordGuid = linked.recordGuid;
                if (linked.projectGuid) entry.projectGuid = linked.projectGuid;
            }
        }
        return draft.priorityItems;
    },

    async linkReviewPriorityTask(workflow, week, entry, taskGuid) {
        const task = (workflow.tasks || []).find(item => item.guid === taskGuid);
        if (!task || !['in_progress', 'in_review'].includes(workflow.projects.find(project => project.guid === task.projectGuid)?.status)) throw new Error('Choose an open task in an active project.');
        if (['done', 'canceled', 'cancelled', 'blocked', 'waiting'].includes(task.status)) throw new Error('Choose an actionable task. Waiting or completed tasks cannot be linked as a priority.');
        const key = reviewPriorityIdKey(week, entry.id);
        const marker = task.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY];
        const markerWeek = typeof marker === 'string' ? marker.split('|')[0] : '';
        if (marker && markerWeek === week && marker !== key && marker !== reviewPriorityKey(week, entry.text)) throw new Error('This task is already linked to another weekly priority.');
        const draft = this.workflowState.drafts?.[week];
        const duplicate = (draft?.priorityItems || []).find(item => item.id !== entry.id && item.taskGuid === task.guid);
        if (duplicate) throw new Error('That task is already linked to another priority this week.');
        await this.ensureReviewPriorityMarker(task, week, entry, { require: true });
        entry.taskGuid = task.guid;
        entry.recordGuid = task.recordGuid || '';
        entry.projectGuid = task.projectGuid;
        this.persistWorkflow();
        return task;
    },

    async addReviewPriorityTask(workflow, week, priority, projectGuid, entry = null) {
        const text = String(priority || '').trim();
        if (!text) throw new Error('Write a priority first.');
        if (entry?.taskGuid) {
            const existingTask = (workflow.tasks || []).find(task => task.guid === entry.taskGuid);
            if (existingTask) {
                entry.taskGuid = existingTask.guid;
                entry.recordGuid = existingTask.recordGuid || entry.recordGuid;
                entry.projectGuid = existingTask.projectGuid || entry.projectGuid;
                return { task: existingTask, existing: true };
            }
            throw new Error('This priority is linked to an unavailable task. Resolve the link before creating a replacement.');
        }
        const project = workflow.projects.find(item => item.guid === projectGuid && ['in_progress', 'in_review'].includes(item.status));
        if (!project) throw new Error('Choose an active project.');
        const key = entry?.id ? reviewPriorityIdKey(week, entry.id) : reviewPriorityKey(week, text);
        const existing = (workflow.tasks || []).find(task => task.lineItem?.props?.[REVIEW_PRIORITY_PROPERTY] === key);
        if (existing) { if (entry) { entry.taskGuid = existing.guid; entry.recordGuid = existing.recordGuid; entry.projectGuid = existing.projectGuid; } return { task: existing, existing: true }; }
        const line = await project.record.createLineItem(null, null, 'task', [{ type: 'text', text }], { [REVIEW_PRIORITY_PROPERTY]: key });
        if (!line) throw new Error('Project task could not be created.');
        const task = { guid: line.guid, lineItem: line, text, projectGuid, projectName: project.name, recordGuid: project.guid, status: 'none', date: '' };
        if (entry) { entry.taskGuid = task.guid; entry.recordGuid = task.recordGuid; entry.projectGuid = projectGuid; }
        return { task, existing: false };
    },

    async resolveHistoricalPriority(entry, sourceWeek, workflow = this.workflowData || {}) {
        const text = String(entry?.text || '').trim();
        if (!entry) return { kind: 'plain', text: '', source: 'text' };
        if (entry.taskGuid) {
            const active = (workflow.tasks || []).find(task => task.guid === entry.taskGuid);
            if (active) {
                const project = (workflow.projects || []).find(item => item.guid === active.projectGuid);
                return reviewPriorityResolution({ ...active, projectStatus: project?.status || '' }, { source: 'active' });
            }
            if (entry.recordGuid) {
                try {
                    const record = this.data.getRecord?.(entry.recordGuid);
                    if (record) {
                        const lines = await record.getLineItems(false);
                        const line = lines.find(item => item.guid === entry.taskGuid);
                        if (line) {
                            const status = line.getTaskStatus?.();
                            if (status === null || status === undefined) return { kind: 'unavailable', text, taskGuid: entry.taskGuid, recordGuid: entry.recordGuid, source: 'unavailable' };
                            const ownership = resolveTaskProject(line, record, workflow.byGuid || new Map());
                            const projectGuid = entry.projectGuid || ownership.projectGuid || '';
                            const project = (workflow.projects || []).find(item => item.guid === projectGuid) || workflow.byGuid?.get(projectGuid);
                            const task = { guid: entry.taskGuid, lineItem: line, text: extractLineText(line) || text, status, recordGuid: record.guid, projectGuid, projectName: project?.name || '' };
                            return reviewPriorityResolution(task, { source: 'record', projectStatus: project?.status || '' });
                        }
                    }
                } catch { /* report unavailable below */ }
            }
            return { kind: 'unavailable', text, taskGuid: entry.taskGuid, recordGuid: entry.recordGuid, source: 'unavailable' };
        }
        const markerTask = reviewPriorityTask(entry, sourceWeek, workflow.tasks || []);
        if (markerTask) return reviewPriorityResolution(markerTask, { source: 'marker' });
        return { kind: 'plain', text, source: 'text' };
    },

    async loadPreviousReviewContext({ force = false, week = reviewWeek(), workflow = null } = {}) {
        const previousWeek = previousReviewWeek(week);
        let journal = null;
        let user = null;
        let journalWarning = '';
        try {
            const collections = await this.data.getAllCollections();
            journal = collections.find(collection => collection.getGuid() === this.collectionGuid('Journal', collections));
            if (!journal?.isJournalPlugin?.()) journalWarning = 'Choose your Journal collection in Settings.';
            else user = this.resolveJournalOwner(journal, collections);
        } catch (error) { journalWarning = error.message; }
        const key = `${previousWeek}|${journal?.getGuid?.() || ''}|${user?.guid || ''}`;
        if (!force && this.previousReviewContext?.key === key) {
            const cached = this.previousReviewContext;
            if (cached.rawItems) {
                const cachedWorkflow = workflow || this.workflowData || { tasks: [], projects: [], byGuid: new Map() };
                cached.items = [];
                for (const entry of cached.rawItems) cached.items.push({ entry, resolution: await this.resolveHistoricalPriority(entry, cached.week, cachedWorkflow) });
            }
            return cached;
        }
        let discovery = null;
        let kind = 'none';
        let warning = journalWarning;
        let items = [];
        let localDraftItems = null;
        const localItems = () => {
            if (localDraftItems) return localDraftItems;
            const draft = this.workflowState.drafts?.[previousWeek];
            if (!draft) return localDraftItems = [];
            if (!Array.isArray(draft.priorityItems) && draft.priorities) {
                reconcileReviewPriorityItems(draft, draft.priorities);
                this.persistWorkflow();
            }
            localDraftItems = (draft.priorityItems || []).filter(item => item?.text);
            return localDraftItems;
        };
        if (journal && user) {
            try {
                discovery = await this.findWeeklyReview(journal, user, previousWeek, { cached: this.workflowState.reviews[previousWeek] });
                if (discovery.kind === 'one') {
                    if (discovery.snapshot?.state === 'saved') {
                        kind = 'saved';
                        items = reviewPrioritySnapshot(discovery.snapshot.priorityItems);
                    } else if (discovery.legacy) {
                        kind = 'legacy';
                        items = discovery.legacyReview?.priorityItems || [];
                    } else {
                        kind = 'pending';
                        warning = 'Last week’s review was saved only as a pending heading.';
                    }
                } else if (discovery.kind === 'multiple') {
                    kind = 'multiple';
                    warning = 'Several saved reviews exist for last week. Choose one in Journal before carrying a task.';
                } else if (discovery.kind === 'incomplete') {
                    warning = discovery.error || 'Last week’s saved review could not be checked.';
                }
            } catch (error) { warning = error.message; }
        }
        if (kind === 'none' || kind === 'pending') {
            const draftItems = localItems();
            if (draftItems.length) { kind = 'draft'; items = draftItems; }
        } else if (kind === 'incomplete') {
            const draftItems = localItems();
            if (draftItems.length) { kind = 'draft'; items = draftItems; warning = `${warning} Showing the local draft instead.`; }
        }
        const baseWorkflow = workflow || this.workflowData || { tasks: [], projects: [], byGuid: new Map() };
        const rawItems = [...items];
        const resolved = [];
        for (const entry of rawItems) resolved.push({ entry, resolution: await this.resolveHistoricalPriority(entry, previousWeek, baseWorkflow) });
        const context = { key, week: previousWeek, kind, discovery, rawItems, items: resolved, warning };
        this.previousReviewContext = context;
        return context;
    },

    carryPreviousPriority(context, item, panel, currentWeek = reviewWeek()) {
        const draft = this.workflowState.drafts[currentWeek] ||= { notes: '', priorities: '', step: 2 };
        if (!Array.isArray(draft.priorityItems)) reconcileReviewPriorityItems(draft, draft.priorities || '');
        const source = item.entry;
        const resolution = item.resolution;
        const already = draft.priorityItems.find(entry => entry.carriedFrom?.week === context.week && entry.carriedFrom?.priorityId === source.id);
        if (already) { this.workflowMessage = 'That priority is already carried into this week.'; return already; }
        if (resolution.taskGuid && draft.priorityItems.some(entry => entry.taskGuid === resolution.taskGuid)) {
            this.workflowMessage = 'That task is already linked to another priority this week.';
            return null;
        }
        const carried = { id: nextReviewPriorityId(), text: source.text, carriedFrom: { week: context.week, priorityId: source.id } };
        if (['open', 'waiting'].includes(resolution.kind) && resolution.taskGuid) {
            carried.taskGuid = resolution.taskGuid;
            carried.recordGuid = resolution.recordGuid;
            carried.projectGuid = resolution.projectGuid;
        }
        draft.priorityItems.push(carried);
        draft.priorities = draft.priorityItems.map(entry => entry.text).join('\n');
        this.persistWorkflow();
        this.workflowMessage = resolution.kind === 'unavailable'
            ? 'Priority carried as text. The original task remains unavailable.'
            : ['open', 'waiting'].includes(resolution.kind) && resolution.taskGuid
                ? 'Priority carried forward with its existing task.'
                : 'Priority carried forward as text.';
        return carried;
    },

    async workflowAction(button, operation, panel) {
        button.disabled = true;
        this.workflowMessage = '';
        this.workflowMutationVersion = (this.workflowMutationVersion || 0) + 1;
        try {
            if (this.workflowNativeSync) await this.workflowNativeSync.catch(() => {});
            await operation();
            await this.render(panel);
        }
        catch (error) { this.workflowMessage = error.message || 'Change could not be saved. Try again.'; await this.render(panel); }
    },

    toggleFocusTask(task, button, panel) {
        this.pendingWorkflowFocus = {
            taskGuid: task.guid,
            className: button?.classList.contains('os-start-here-add') ? 'os-start-here-add' : 'os-focus-action'
        };
        return this.workflowAction(button, async () => {
            const state = this.loadWorkflowState();
            const day = localDate();
            const current = this.workflowData.model.focus.map(action => action.guid);
            if (current.includes(task.guid)) state.focus[day] = current.filter(guid => guid !== task.guid);
            else {
                if (current.length >= 3) throw new Error('Your focus list has three actions. Unpin one before adding another.');
                state.focus[day] = [...current, task.guid];
            }
            this.persistWorkflow();
        }, panel);
    },

    mountWorkflowApp(container, app) {
        const old = container.querySelector('.os-app');
        const scrollTop = old?.scrollTop || 0;
        const focused = document.activeElement;
        const pendingFocus = this.pendingWorkflowFocus;
        const focusedTask = focused?.closest('[data-task]');
        const taskGuid = focusedTask?.dataset.task || pendingFocus?.taskGuid;
        const focusKey = focused?.dataset.focusKey;
        const fieldClass = focusedTask ? focused?.classList?.[0] : pendingFocus?.className || focused?.classList?.[0];
        this.pendingWorkflowFocus = null;
        const start = focused?.selectionStart;
        const end = focused?.selectionEnd;
        const opened = new Set([...container.querySelectorAll('.os-action-edit[open]')].map(node => node.closest('[data-task]').dataset.task));
        app.querySelectorAll('[data-task]').forEach(row => { if (opened.has(row.dataset.task)) row.querySelector('details').open = true; });
        const viewport = document.createElement('div'); viewport.className = 'os-app'; viewport.appendChild(app);
        container.replaceChildren(viewport);
        viewport.scrollTop = scrollTop;
        if (taskGuid && fieldClass) {
            const taskRow = [...app.querySelectorAll('[data-task]')].find(row => row.dataset.task === taskGuid);
            const replacement = taskRow?.querySelector(`.${fieldClass}`)
                || (fieldClass === 'os-start-here-add' ? taskRow?.querySelector('.os-focus-action') : null)
                || (fieldClass === 'os-focus-action' ? taskRow?.querySelector('.os-start-here-add') : null);
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

    renderActionRow(task, panel) {
        const state = this.loadWorkflowState();
        const row = document.createElement('div');
        row.className = 'os-action-row';
        row.dataset.task = task.guid;
        const waiting = isWaitingTask(task);
        const waitingDetails = readWaitingDetails(task.lineItem, state.waiting[task.guid]);
        const editorValues = this.waitingEditorDrafts?.[task.guid] || waitingDetails.details;
        const focused = (state.focus[localDate()] || []).includes(task.guid);
        row.innerHTML = `<input type="checkbox" class="os-action-done" aria-label="Complete ${escapeHtml(task.text)}" />
            <div class="os-action-copy"><button class="os-action-title">${escapeHtml(task.text)}</button><div class="os-action-meta">${escapeHtml(task.projectName)}${task.date ? ` · <span class="${task.date < localDate() ? 'os-cash-warning' : ''}">${task.date < localDate() ? 'Overdue · ' : ''}${task.date}</span>` : ''}${task.status === 'important' ? ' · Important' : ''}${state.next[task.projectGuid] === task.guid ? ' · Next action' : ''}</div></div>
            <div class="os-action-buttons">${waiting ? '' : `<button class="os-button os-focus-action" aria-pressed="${focused}">${focused ? 'Unpin' : 'Focus'}</button><button class="os-button os-next-action">${state.next[task.projectGuid] === task.guid ? 'Unset next' : 'Set next'}</button>`}
            <details class="os-action-edit"><summary>Edit</summary><div class="os-action-editor"><label>Due date<input type="date" class="os-input os-action-date" value="${task.date}" /></label><button class="os-button os-date-save">Save date</button>
            <label>Waiting on<input class="os-input os-wait-reason" value="${escapeHtml(editorValues.reason || '')}" placeholder="Person or dependency" /></label><label>Follow-up date<input type="date" class="os-input os-wait-date" value="${escapeHtml(editorValues.followup || '')}" /></label><button class="os-button os-wait-save">${waiting ? 'Update waiting note' : 'Mark waiting'}</button>${waiting ? '<button class="os-button os-resume-action">Ready to work</button>' : ''}</div></details></div>`;
        const waitingValues = () => ({ reason: row.querySelector('.os-wait-reason').value, followup: row.querySelector('.os-wait-date').value });
        row.querySelector('.os-wait-reason').oninput = row.querySelector('.os-wait-date').oninput = () => this.rememberWaitingEditor(task.guid, waitingValues());
        row.querySelector('.os-action-title').onclick = () => this.openItem(task.guid, task.recordGuid, panel);
        row.querySelector('.os-action-done').onchange = event => this.workflowAction(event.target, () => this.setActionStatus(task, 'done'), panel);
        row.querySelector('.os-focus-action')?.addEventListener('click', event => this.toggleFocusTask(task, event.currentTarget, panel));
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
            const values = waitingValues();
            this.rememberWaitingEditor(task.guid, values);
            if (typeof task.lineItem?.setMetaProperties === 'function') {
                const details = await this.saveWaiting(task, values, waiting);
                this.workflowMessage = details.reason
                    ? 'Waiting note saved with the task.'
                    : 'Task marked waiting. Add a reason when you know what it depends on.';
            } else {
                this.saveWaitingLocal(task, values, waiting);
                await this.setActionStatus(task, 'blocked');
                this.clearWaitingEditor(task.guid, values);
                this.workflowMessage = 'Task marked waiting. The note is kept only on this device.';
            }
        }, panel);
        row.querySelector('.os-resume-action')?.addEventListener('click', event => this.workflowAction(event.target, async () => {
            const details = await this.resumeWaiting(task);
            this.workflowMessage = `Task resumed with its previous status (${details.previousStatus}).`;
        }, panel));
        if (waiting) {
            const note = document.createElement('div'); note.className = 'os-wait-note';
            const details = waitingDetails.details;
            if (details.followup && details.followup <= localDate()) note.classList.add('os-followup-due');
            const reason = details.reason || (waitingDetails.source === 'invalid' ? 'Waiting note could not be read' : 'Waiting - add a reason');
            const followup = details.followup ? `Follow up ${details.followup}` : 'No follow-up date';
            const source = waitingDetails.source === 'local' ? 'Only on this device' : waitingDetails.valid === false ? 'Waiting note needs repair' : '';
            note.textContent = [reason, followup, source].filter(Boolean).join(' · ');
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
                    if ((item.waitingTasks || []).some(candidate => candidate.guid === task.guid)) {
                        const details = waitingDetailsFor(task, this.workflowState);
                        labels.push(`Waiting${details.followup ? ` · follow up ${details.followup}` : details.reason ? ` · ${details.reason}` : ' · add a reason'}`);
                    }
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
        if (this.workflowSyncError) { const message = document.createElement('p'); message.className = 'os-workflow-message'; message.setAttribute('role', 'alert'); message.textContent = this.workflowSyncError; section.appendChild(message); }
        if (this.workflowMessage) { const message = document.createElement('p'); message.className = 'os-workflow-message'; message.setAttribute('role', 'status'); message.textContent = this.workflowMessage; section.appendChild(message); }
        if (!model.complete) { const warning = document.createElement('p'); warning.textContent = 'Some task data could not be loaded. Project gaps may be incomplete. Refresh to retry.'; warning.className = 'os-workflow-message'; section.appendChild(warning); }
        if (workflow.ownershipIssues?.ambiguous || workflow.ownershipIssues?.unresolved) {
            const skipped = (workflow.ownershipIssues.ambiguous || 0) + (workflow.ownershipIssues.unresolved || 0);
            const note = document.createElement('p'); note.className = 'os-action-meta'; note.setAttribute('role', 'status');
            note.textContent = `${skipped} task${skipped === 1 ? '' : 's'} not shown because ${skipped === 1 ? 'its project is ambiguous or unavailable' : 'their projects are ambiguous or unavailable'}.`;
            section.appendChild(note);
        }
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
                const discovery = this.weeklyReviewDiscovery;
                const selectedCandidate = discovery?.kind === 'multiple'
                    ? discovery.candidates.find(candidate => this.selectedReviewWeek === week && candidate.heading.guid === this.selectedReviewHeadingGuid)
                    : null;
                const hydrateSource = selectedCandidate || (discovery?.kind === 'one' ? discovery : null);
                if (hydrateSource && !draft.notes && !draft.priorities && !(draft.priorityItems?.length)) {
                    const savedItems = hydrateSource.snapshot?.state === 'saved' ? reviewPrioritySnapshot(hydrateSource.snapshot.priorityItems) : null;
                    const source = savedItems ? { notes: typeof hydrateSource.snapshot.notes === 'string' ? hydrateSource.snapshot.notes : '', priorityItems: savedItems } : hydrateSource.legacyReview;
                    if (source) {
                        draft.notes = source.notes || '';
                        draft.priorityItems = source.priorityItems || [];
                        draft.priorities = draft.priorityItems.map(item => item.text).join('\n');
                        this.persistWorkflow();
                    }
                }
                const discoveryBlocked = !discovery || discovery.kind === 'incomplete';
                const saveBlocked = discoveryBlocked || (discovery?.kind === 'multiple' && !selectedCandidate);
                const updateExisting = discovery?.kind === 'one' || !!selectedCandidate;
                section.appendChild(this.renderReviewDiscovery(discovery, week, panel));
                section.appendChild(this.renderPreviousPriorities(this.previousReviewContext, week, draft, panel));
                const form = document.createElement('div'); form.className = 'os-review-form';
                const saveLabel = updateExisting ? 'Update Journal review' : 'Save review to Journal';
                const saveHelp = discoveryBlocked
                    ? 'Saved-review check incomplete. Retry before saving.'
                    : discovery?.kind === 'multiple' && !selectedCandidate
                        ? 'Choose the saved review to update.'
                        : updateExisting
                            ? `Saving updates the existing review section${selectedCandidate ? ` from ${selectedCandidate.date || 'another Journal day'}` : ''}.`
                            : 'Your draft stays here until you save. A new Journal section will be created today.';
                form.innerHTML = `<label>Wins and observations<textarea class="os-review-notes" rows="3" placeholder="What moved forward? What needs to change?">${escapeHtml(draft.notes)}</textarea></label><label>Priorities for next week<textarea class="os-review-priorities" rows="3" placeholder="Choose a few concrete outcomes for the coming week.">${escapeHtml(draft.priorities)}</textarea><span class="os-action-meta">One priority per line. Turn any priority into a project task below when you’re ready.</span></label><div class="os-review-priority-bridge"><h3>Make priorities actionable</h3><p class="os-action-meta">Add a priority to an existing project. It joins the action queue without changing that project’s chosen next action; the review text stays intact.</p><div class="os-review-priority-list"></div></div><details><summary>Preview Journal summary</summary><pre class="os-review-preview"></pre></details><div class="os-review-save-row"><button class="os-button os-primary os-save-review" ${saveBlocked ? 'disabled' : ''}>${saveLabel}</button><span class="os-action-meta">${saveHelp}</span></div>`;
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
        const suggestions = startHereSuggestions(model.actions, workflow.projects || model.active, this.workflowState, localDate());
        const startHere = document.createElement('div'); startHere.className = 'os-start-here';
        startHere.innerHTML = '<div class="os-start-here-heading"><h3>Start here</h3><p class="os-action-meta">Ranked by due date; task importance and project priority break ties.</p></div>';
        if (!model.complete) {
            const note = document.createElement('p'); note.className = 'os-action-meta os-start-here-incomplete'; note.textContent = 'Task data is incomplete. These suggestions use only the actions that loaded.'; startHere.appendChild(note);
        }
        if (!suggestions.length) {
            const empty = document.createElement('p'); empty.className = 'os-workflow-empty';
            empty.textContent = model.focus.length ? 'No additional tasks to suggest. Your Focus list stays as selected.' : 'No actionable tasks are ready to suggest. Check the queues below.';
            startHere.appendChild(empty);
        } else {
            const list = document.createElement('ol'); list.className = 'os-start-here-list';
            list.setAttribute('aria-label', 'Tasks ranked to start with');
            suggestions.forEach((task, index) => {
                const item = document.createElement('li'); item.className = 'os-start-here-item'; item.dataset.task = task.guid;
                const row = document.createElement('div'); row.className = 'os-start-here-row';
                const copy = document.createElement('div'); copy.className = 'os-start-here-copy';
                const title = document.createElement('button'); title.type = 'button'; title.className = 'os-start-here-title';
                title.setAttribute('aria-label', `Open task: ${task.text}`); title.textContent = task.text;
                title.onclick = () => this.openItem(task.guid, task.recordGuid, panel);
                const project = document.createElement('p'); project.className = 'os-start-here-project'; project.textContent = task.projectName;
                const reasons = document.createElement('ul'); reasons.className = 'os-start-here-reasons'; reasons.setAttribute('aria-label', 'Why this task is suggested');
                task.suggestionReasons.forEach(text => {
                    const reason = document.createElement('li'); reason.textContent = text;
                    if (text.includes('Overdue')) reason.classList.add('os-cash-warning');
                    reasons.appendChild(reason);
                });
                copy.append(title, project, reasons);
                const add = document.createElement('button'); add.type = 'button'; add.className = 'os-button os-start-here-add'; add.textContent = 'Add to Focus';
                add.setAttribute('aria-label', `Add ${task.text} to Focus`);
                if (model.focus.length >= 3) { add.disabled = true; add.title = 'Focus already has three actions'; }
                add.onclick = event => this.toggleFocusTask(task, event.currentTarget, panel);
                row.append(copy, add); item.appendChild(row); list.appendChild(item);
            });
            startHere.appendChild(list);
        }
        section.appendChild(startHere);
        section.insertAdjacentHTML('beforeend', `<div class="os-workflow-heading"><div><h2>Today’s focus</h2><p class="os-action-meta">Choose up to three actions for ${localDate()}.</p></div><span class="os-focus-count">${model.focus.length} / 3</span></div>`);
        const focus = document.createElement('div'); focus.className = 'os-focus-list';
        model.focus.forEach(task => focus.appendChild(this.renderActionRow(task, panel)));
        if (!model.focus.length) focus.innerHTML = '<p class="os-workflow-empty">Pin actions from the queue below to give today a clear starting point.</p>';
        section.appendChild(focus);
        const key = ['next', 'attention', 'waiting', 'all'].includes(this.actionQueueTab) ? this.actionQueueTab : (model.next.length ? 'next' : 'attention');
        const queueModel = { ...model, state: this.workflowState };
        const preset = presetCompatible(key, this.actionPreset) ? this.actionPreset : 'any';
        this.actionPreset = preset;
        const today = localDate();
        const searchText = this.actionSearch || '';
        const queueCount = queue => selectQueueItems(queueModel, { queue, preset: 'any', query: searchText, projectGuid: this.actionProject, today }).count;
        const counts = { next: queueCount('next'), attention: queueCount('attention'), waiting: queueCount('waiting'), all: queueCount('all') };
        const incomplete = !model.complete;
        const countText = count => incomplete ? `${count} loaded` : String(count);
        const tabs = document.createElement('div'); tabs.className = 'os-action-tabs';
        tabs.setAttribute('role', 'group');
        tabs.setAttribute('aria-label', 'Action queue');
        tabs.innerHTML = [['next', 'Next actions'], ['attention', 'Needs attention'], ['waiting', 'Waiting'], ['all', 'All actions']].map(([id, name]) => `<button class="os-tab ${key === id ? 'active' : ''}" data-queue="${id}" data-focus-key="queue-${id}" aria-pressed="${key === id}">${name} (${countText(counts[id])})</button>`).join('');
        tabs.querySelectorAll('button').forEach(button => {
            button.onclick = () => {
                this.actionQueueTab = button.dataset.queue;
                if (!presetCompatible(this.actionQueueTab, this.actionPreset)) this.actionPreset = 'any';
                this.queueLimit = 20;
                this.render(panel);
            };
        });
        section.appendChild(tabs);
        const presets = queuePresets(key);
        if (presets.length > 1) {
            const presetBar = document.createElement('div'); presetBar.className = 'os-queue-presets'; presetBar.setAttribute('role', 'group'); presetBar.setAttribute('aria-label', 'Filter this queue');
            for (const option of presets) {
                const count = selectQueueItems(queueModel, { queue: key, preset: option.id, query: searchText, projectGuid: this.actionProject, today }).count;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `os-preset ${preset === option.id ? 'active' : ''}`;
                button.dataset.preset = option.id;
                button.dataset.focusKey = `preset-${option.id}`;
                button.setAttribute('aria-pressed', String(preset === option.id));
                button.textContent = `${option.label} (${countText(count)})`;
                button.onclick = () => {
                    this.actionPreset = option.id;
                    this.queueLimit = 20;
                    this.render(panel);
                };
                presetBar.appendChild(button);
            }
            section.appendChild(presetBar);
        }
        const controls = document.createElement('div'); controls.className = 'os-queue-controls';
        controls.innerHTML = `<input type="search" class="os-input os-queue-search" data-focus-key="queue-search" aria-label="Search project actions" placeholder="Find an action or project…" value="${escapeHtml(this.actionSearch || '')}" /><select class="os-input os-queue-project" data-focus-key="queue-project" aria-label="Filter by project"><option value="">All active projects</option>${model.active.map(project => `<option value="${project.guid}">${escapeHtml(project.name)}</option>`).join('')}</select>`;
        controls.querySelector('select').value = this.actionProject || '';
        controls.querySelector('select').onchange = event => { this.actionProject = event.target.value; this.queueLimit = 20; this.render(panel); };
        controls.querySelector('input').oninput = event => { this.actionSearch = event.target.value; this.queueLimit = 20; clearTimeout(this.workflowSearchTimer); this.workflowSearchTimer = setTimeout(() => this.render(panel), 150); };
        section.appendChild(controls);
        const filtersActive = !!searchText.trim() || !!this.actionProject || preset !== 'any';
        const result = selectQueueItems(queueModel, { queue: key, preset, query: searchText, projectGuid: this.actionProject, today });
        const limit = this.queueLimit || 20;
        const summary = document.createElement('p'); summary.className = 'os-queue-summary'; summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite');
        const criteria = [];
        if (searchText.trim()) criteria.push(`search “${searchText.trim()}”`);
        if (this.actionProject) criteria.push(`project ${model.active.find(project => project.guid === this.actionProject)?.name || 'selected'}`);
        if (preset !== 'any') criteria.push(queuePresetLabel(key, preset).toLowerCase());
        const unit = result.unit === 'projects' ? 'project' : 'action';
        summary.textContent = `${result.count} ${unit}${result.count === 1 ? '' : 's'}${criteria.length ? ` · ${criteria.join(' · ')}` : ''}${incomplete ? ' · loaded results; more may exist' : ''}${result.count > limit ? ` · showing first ${limit}` : ''}`;
        section.appendChild(summary);
        const list = document.createElement('div'); list.className = 'os-action-list';
        if (!result.items.length) {
            const empty = document.createElement('p'); empty.className = 'os-workflow-empty';
            empty.textContent = key === 'attention' && !model.active.length
                ? 'No explicitly active projects found. Check your Projects mapping and project statuses in Settings.'
                : queueEmptyMessage(key, { filtered: filtersActive, complete: model.complete });
            list.appendChild(empty);
            if (key === 'next' && !filtersActive && model.complete) { const button = document.createElement('button'); button.className = 'os-button'; button.textContent = 'Review projects'; button.onclick = () => { this.actionQueueTab = 'attention'; this.queueLimit = 20; this.render(panel); }; list.appendChild(button); }
        } else if (key === 'attention') {
            list.appendChild(this.renderProjectAttention({ ...workflow, model: { ...model, attention: result.items } }, panel));
        } else {
            result.items.slice(0, limit).forEach(task => list.appendChild(this.renderActionRow(task, panel)));
            if (result.count > limit) {
                const more = document.createElement('button'); more.className = 'os-button os-queue-more';
                more.textContent = `Show more (${result.count - limit} remaining)`;
                more.onclick = () => { this.queueLimit = limit + 20; this.render(panel); };
                list.appendChild(more);
            }
        }
        section.appendChild(list);
        if (filtersActive) {
            const clear = document.createElement('button'); clear.className = 'os-button'; clear.textContent = 'Clear filters';
            clear.onclick = () => { this.actionSearch = ''; this.actionProject = ''; this.actionPreset = 'any'; this.queueLimit = 20; this.render(panel); };
            section.appendChild(clear);
        }
        return section;
    },

    renderReviewDiscovery(discovery, week, panel) {
        const block = document.createElement('div');
        block.className = 'os-review-discovery';
        if (!discovery || discovery.kind === 'incomplete') {
            block.innerHTML = `<p class="os-action-meta os-review-discovery-warning" role="alert">${escapeHtml(discovery?.error || 'Saved reviews have not been checked yet.')}</p>`;
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'os-button os-retry-review-discovery';
            retry.textContent = 'Retry saved-review check';
            retry.onclick = event => this.workflowAction(event.currentTarget, async () => {
                this.reviewDiscovery = null;
                const next = await this.loadWeeklyReviewContext({ force: true });
                if (next.kind === 'incomplete') throw new Error(next.error || 'Saved reviews still could not be checked.');
                this.workflowMessage = 'Saved-review check complete.';
            }, panel);
            block.appendChild(retry);
            return block;
        }
        if (discovery.kind === 'none') {
            block.innerHTML = '<p class="os-action-meta">No saved Journal review found for this week. Saving creates one in today’s Journal.</p>';
            return block;
        }
        const stateLabel = candidate => candidate.snapshot?.state === 'pending'
            ? 'pending save'
            : candidate.legacy
                ? (candidate.pending ? 'empty section' : 'earlier format')
                : 'saved';
        if (discovery.kind === 'one') {
            const candidate = discovery.candidates[0];
            block.innerHTML = `<p class="os-action-meta">Saved review found: <strong>${escapeHtml(candidate.date || candidate.reference?.journalDate || 'Journal')}</strong> · ${escapeHtml(stateLabel(candidate))}. Saving updates this Journal section.</p>`;
            const open = document.createElement('button');
            open.type = 'button';
            open.className = 'os-button os-open-saved-review';
            open.textContent = 'Open saved review';
            open.onclick = () => this.openRecord(candidate.reference.recordGuid, panel);
            block.appendChild(open);
            return block;
        }
        block.innerHTML = `<p class="os-action-meta" role="status"><strong>${discovery.candidates.length} saved reviews found for this week.</strong> Choose the section to update; nothing is merged or deleted automatically.</p>`;
        const list = document.createElement('div'); list.className = 'os-review-discovery-list';
        for (const candidate of discovery.candidates) {
            const row = document.createElement('div'); row.className = 'os-review-discovery-candidate';
            const label = `${candidate.date || candidate.reference?.journalDate || 'Journal'} · ${stateLabel(candidate)}`;
            const copy = document.createElement('span'); copy.textContent = label;
            const open = document.createElement('button');
            open.type = 'button'; open.className = 'os-button os-open-saved-review'; open.textContent = 'Open';
            open.onclick = () => this.openRecord(candidate.reference.recordGuid, panel);
            const use = document.createElement('button');
            use.type = 'button';
            const selected = this.selectedReviewWeek === week && this.selectedReviewHeadingGuid === candidate.heading.guid;
            use.className = `os-button os-use-saved-review${selected ? ' os-primary' : ''}`;
            use.setAttribute('aria-pressed', String(selected));
            use.textContent = selected ? 'Selected' : 'Use this review';
            use.onclick = () => {
                this.selectedReviewWeek = week;
                this.selectedReviewHeadingGuid = candidate.heading.guid;
                this.render(panel);
            };
            row.append(copy, open, use);
            list.appendChild(row);
        }
        block.appendChild(list);
        return block;
    },

    renderPreviousPriorities(context, week, draft, panel) {
        const block = document.createElement('section');
        block.className = 'os-previous-priorities';
        const sourceLabels = {
            saved: 'Saved Journal review', legacy: 'Earlier Journal review', draft: 'Unsaved draft on this device',
            pending: 'Pending saved review', multiple: 'Several saved reviews', incomplete: 'Saved review check incomplete'
        };
        if (!context) {
            block.innerHTML = '<h3>Previous priorities</h3><p class="os-action-meta">Last week’s priorities have not been checked.</p>';
            return block;
        }
        const header = document.createElement('div'); header.className = 'os-previous-heading';
        header.innerHTML = `<h3>Previous priorities</h3><p class="os-action-meta">${escapeHtml(sourceLabels[context.kind] || 'Last week')} · week of ${escapeHtml(context.week)}</p>`;
        block.appendChild(header);
        if (context.warning) {
            const warning = document.createElement('p'); warning.className = 'os-action-meta os-review-discovery-warning'; warning.setAttribute('role', 'alert'); warning.textContent = context.warning;
            block.appendChild(warning);
        }
        if (context.discovery?.reference?.recordGuid) {
            const open = document.createElement('button'); open.type = 'button'; open.className = 'os-button os-open-previous-review'; open.textContent = 'Open previous review';
            open.onclick = () => this.openRecord(context.discovery.reference.recordGuid, panel);
            block.appendChild(open);
        }
        if (context.kind === 'multiple') {
            const list = document.createElement('div'); list.className = 'os-review-discovery-list';
            for (const candidate of context.discovery?.candidates || []) {
                const row = document.createElement('div'); row.className = 'os-review-discovery-candidate';
                const copy = document.createElement('span'); copy.textContent = candidate.date || candidate.reference?.journalDate || 'Journal';
                const open = document.createElement('button'); open.type = 'button'; open.className = 'os-button os-open-previous-review'; open.textContent = 'Open';
                open.onclick = () => this.openRecord(candidate.reference.recordGuid, panel);
                row.append(copy, open); list.appendChild(row);
            }
            block.appendChild(list);
            return block;
        }
        if (!context.items?.length) {
            const empty = document.createElement('p'); empty.className = 'os-workflow-empty';
            empty.textContent = context.kind === 'incomplete'
                ? 'Previous priorities are unavailable until the saved-review check succeeds. You can still write priorities below.'
                : 'No priorities were saved or drafted for last week. Write this week’s priorities below.';
            block.appendChild(empty);
            if (context.kind === 'incomplete') {
                const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'os-button os-retry-previous-review'; retry.textContent = 'Retry last-week check';
                retry.onclick = event => this.workflowAction(event.currentTarget, async () => {
                    this.previousReviewContext = null;
                    const next = await this.loadPreviousReviewContext({ force: true, week, workflow: this.workflowData });
                    if (next.kind === 'incomplete') throw new Error(next.warning || 'Last week’s review still could not be checked.');
                    this.workflowMessage = 'Last week’s priorities refreshed.';
                }, panel);
                block.appendChild(retry);
            }
            return block;
        }
        const currentItems = Array.isArray(draft.priorityItems) ? draft.priorityItems : [];
        const list = document.createElement('div'); list.className = 'os-previous-priority-list';
        for (const item of context.items) {
            const source = item.entry;
            const resolution = item.resolution;
            const carriedEntry = currentItems.find(entry => entry.carriedFrom?.week === context.week && entry.carriedFrom?.priorityId === source.id);
            const taskUsed = resolution.taskGuid && currentItems.some(entry => entry.taskGuid === resolution.taskGuid);
            const row = document.createElement('div'); row.className = 'os-previous-priority';
            row.dataset.sourceWeek = context.week;
            const copy = document.createElement('div'); copy.className = 'os-previous-priority-copy';
            const title = document.createElement('span'); title.className = 'os-previous-priority-title'; title.textContent = source.text;
            const state = resolution.kind === 'done' ? 'Completed'
                : resolution.kind === 'canceled' ? 'Canceled'
                    : resolution.kind === 'waiting' ? 'Waiting'
                        : resolution.kind === 'unavailable' ? 'Task unavailable'
                            : resolution.kind === 'open' ? 'Open' : 'Text only';
            const project = resolution.projectName
                ? `${resolution.projectName}${resolution.projectStatus && !['in_progress', 'in_review'].includes(resolution.projectStatus) ? ` · ${resolution.projectStatus}` : ''}`
                : '';
            const meta = document.createElement('span'); meta.className = 'os-action-meta';
            meta.textContent = [state, project, carriedEntry ? 'Already carried' : taskUsed ? 'Task already in this week' : ''].filter(Boolean).join(' · ');
            copy.append(title, meta);
            row.appendChild(copy);
            if (!carriedEntry && !taskUsed && !['done', 'canceled'].includes(resolution.kind)) {
                const carry = document.createElement('button'); carry.type = 'button';
                carry.className = 'os-button os-carry-previous-priority';
                carry.textContent = resolution.kind === 'unavailable' ? 'Carry text only' : 'Carry forward';
                carry.onclick = event => this.workflowAction(event.currentTarget, async () => { this.carryPreviousPriority(context, item, panel); }, panel);
                row.appendChild(carry);
            }
            list.appendChild(row);
        }
        block.appendChild(list);
        return block;
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
            const copy = document.createElement('div'); copy.className = 'os-review-priority-copy';
            const title = document.createElement('span'); title.textContent = priority.text; copy.appendChild(title);
            if (priority.carriedFrom?.week) {
                const cue = document.createElement('span'); cue.className = 'os-action-meta'; cue.textContent = `Carried from week of ${priority.carriedFrom.week}`;
                copy.appendChild(cue);
            }
            row.appendChild(copy);
            const linked = reviewPriorityTask(priority, week, workflow.tasks || []);
            if (priority.taskGuid && !linked && this.editingReviewPriorityId !== priority.id) {
                const status = document.createElement('span'); status.className = 'os-review-priority-linked'; status.textContent = 'Task unavailable';
                const change = document.createElement('button'); change.type = 'button'; change.className = 'os-button'; change.textContent = 'Change link';
                change.onclick = () => { this.editingReviewPriorityId = priority.id; this.render(panel); };
                row.append(status, change);
            } else if (linked && this.editingReviewPriorityId !== priority.id) {
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
                const create = document.createElement('button'); create.type = 'button'; create.className = 'os-button os-review-priority-add'; create.textContent = 'Create task'; create.disabled = !projectSelect.value || !!priority.taskGuid;
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
        section.innerHTML = '<h2>Workspace settings</h2><p>Choose the collections Freelance OS should use. Active projects use in_progress and in_review; waiting tasks use Thymer’s native waiting state.</p><p class="os-action-meta">Focus, collection mappings and unsaved review drafts are saved on this device. Project next actions, waiting details and reviews saved to Journal sync with your workspace. In a workspace with several active users, choose the Journal owner explicitly. Waiting notes saved before this version stay on this device until you save that waiting entry again. Changes from another device can arrive while this dashboard is open; refresh before resolving a conflict.</p>';
        const form = document.createElement('div'); form.className = 'os-settings-fields';

        const currencyLabel = document.createElement('label'); currencyLabel.textContent = 'Base currency';
        const currencySelect = document.createElement('select'); currencySelect.className = 'os-input'; currencySelect.dataset.role = 'baseCurrency';
        currencySelect.innerHTML = ['CHF', 'EUR', 'USD', 'GBP', 'CAD', 'AUD'].map(c => `<option value="${c}">${c}</option>`).join('');
        currencySelect.value = this.getBaseCurrency();
        currencyLabel.appendChild(currencySelect);
        form.appendChild(currencyLabel);

        for (const role of COLLECTION_ROLES) {
            const label = document.createElement('label'); label.textContent = role;
            const select = document.createElement('select'); select.className = 'os-input'; select.dataset.role = role;
            select.innerHTML = '<option value="">Choose collection…</option>' + (this.workflowCollections || []).filter(collection => role !== 'Journal' || collection.isJournalPlugin?.()).map(collection => `<option value="${collection.getGuid()}">${escapeHtml(collection.getName())}</option>`).join('');
            select.value = this.collectionGuid(role); label.appendChild(select); form.appendChild(label);
        }
        const users = typeof this.data.getActiveUsers === 'function' ? this.data.getActiveUsers() : [];
        const journalGuid = this.collectionGuid('Journal');
        let ownerSelect = null;
        if (users.length > 1 && journalGuid) {
            const label = document.createElement('label'); label.textContent = 'Journal owner';
            ownerSelect = document.createElement('select'); ownerSelect.className = 'os-input'; ownerSelect.dataset.owner = journalGuid;
            ownerSelect.innerHTML = '<option value="">Choose Journal owner…</option>' + users.map(user => `<option value="${escapeHtml(user.guid)}">${escapeHtml(user.getName?.() || user.name || user.email || user.guid)}</option>`).join('');
            ownerSelect.value = this.workflowState.journalOwners?.[journalGuid] || '';
            label.appendChild(ownerSelect); form.appendChild(label);
        } else if (users.length > 1) {
            const note = document.createElement('p'); note.className = 'os-action-meta'; note.textContent = 'Map a Journal collection first, then choose its owner.';
            form.appendChild(note);
        }
        const button = document.createElement('button'); button.className = 'os-button os-primary'; button.textContent = 'Save settings';
        button.onclick = () => {
            if (currencySelect.value) {
                this.workflowState.baseCurrency = currencySelect.value;
            }
            form.querySelectorAll('select[data-role]').forEach(select => { if (select.value) this.workflowState.mappings[select.dataset.role] = select.value; else delete this.workflowState.mappings[select.dataset.role]; });
            if (ownerSelect) {
                const selectedJournal = this.collectionGuid('Journal');
                this.workflowState.journalOwners ||= {};
                if (ownerSelect.value) this.workflowState.journalOwners[selectedJournal] = ownerSelect.value;
                else delete this.workflowState.journalOwners[selectedJournal];
            }
            this.persistWorkflow();
            this.reviewDiscovery = null;
            this.weeklyReviewDiscovery = null;
            this.previousReviewContext = null;
            this.workflowMode = 'settings';
            this.render(panel);
            if (this.ui?.addToaster) {
                this.ui.addToaster({ title: 'Settings saved', autoDestroyTime: 2000, dismissible: true });
            }
        };
        section.append(form, button);

        // Plugin Updates Section
        const updatesSection = document.createElement('div');
        updatesSection.className = 'os-settings-updates';
        updatesSection.style.cssText = 'margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border-color, #e5e7eb);';
        const updateConf = typeof this.getUpdateConfig === 'function' ? this.getUpdateConfig() : { version: '0.5.0', autoUpdate: false, repoUrl: 'https://github.com/jacoplane/thymer-freelance-os' };
        updatesSection.innerHTML = `
            <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">Plugin Updates</h3>
            <p class="os-action-meta" style="margin-bottom: 12px;">Installed version: <strong>v${escapeHtml(updateConf.version)}</strong> · Tracked repository: <code>${escapeHtml(updateConf.repoUrl)}</code></p>
            <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                <button class="os-button os-secondary os-check-updates-btn" style="cursor: pointer;">Check for updates</button>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; user-select: none;">
                <input type="checkbox" class="os-auto-update-checkbox" ${updateConf.autoUpdate ? 'checked' : ''} style="cursor: pointer;">
                <span>Automatically download and install new releases (silent background updates)</span>
            </label>
        `;

        updatesSection.querySelector('.os-check-updates-btn').onclick = (e) => {
            e.preventDefault();
            this.checkForUpdates?.({ manual: true });
        };
        updatesSection.querySelector('.os-auto-update-checkbox').onchange = (e) => {
            this.setAutoUpdate?.(e.target.checked);
            if (this.ui?.addToaster) {
                this.ui.addToaster({
                    title: e.target.checked ? 'Auto-Update Enabled' : 'Auto-Update Disabled',
                    message: e.target.checked ? 'Freelance OS will silently update when new releases are published.' : 'You will be prompted when updates are available.',
                    autoDestroyTime: 3000,
                    dismissible: true
                });
            }
        };
        section.append(updatesSection);

        // Onboarding / Guide Reset Section
        const guideSection = document.createElement('div');
        guideSection.className = 'os-settings-guide';
        guideSection.style.cssText = 'margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-color, #e5e7eb);';
        guideSection.innerHTML = `
            <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">Getting Started Guide</h3>
            <p class="os-action-meta" style="margin-bottom: 12px;">Display the onboarding checklist card on the Overview dashboard.</p>
            <button type="button" class="os-button os-secondary os-reset-guide-btn" style="cursor: pointer;">Show Getting Started guide on Overview</button>
        `;
        guideSection.querySelector('.os-reset-guide-btn').onclick = (e) => {
            e.preventDefault();
            this.workflowState.dismissedOnboarding = false;
            this.persistWorkflow();
            this.workflowMode = 'overview';
            this.render(panel);
            if (this.ui?.addToaster) {
                this.ui.addToaster({
                    title: 'Welcome guide enabled',
                    message: 'The Getting Started checklist is now visible on your Overview dashboard.',
                    autoDestroyTime: 2500,
                    dismissible: true
                });
            }
        };
        section.append(guideSection);

        return section;
    }
};
