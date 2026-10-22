/**
 * Freelance OS Dashboard Plugin for Thymer
 * Replicates the executive dashboard from Obsidian Freelance OS.
 */

const DASHBOARD_PANEL_ID = 'freelance-os-dashboard';

const COLL_GUIDS = {
    Projects: '1B0J3X9Y8QS96C75M3QMT23DNW',
    Clients: '1FD58J39X6KJ4JK5F06T7P4TSR',
    Invoices: '1YT6YD3EYV6F06TZY5GKGVJMNR',
    Library: '16YBSRJPHPAFJCRTZDWJJEF5QG',
    Journal: '16S1WSXAWSHVHJZ72G6J3JRTCP'
};

const COLLECTION_VIEWS = {
    Invoices: { all: 'Register', outstanding: 'Outstanding', overdue: 'Overdue', review: 'To confirm', 'to-send': 'To send', paid: 'Paid' },
    Projects: { all: 'Register', board: 'Board', in_progress: 'Active', overdue: 'Overdue', deadlines: 'Due dates' },
    Clients: { all: 'Directory', active: 'Active', prospects: 'Prospects', 'care-plans': 'Care plans' }
};

function collectionViewId(guid, config, key = 'all', role) {
    const collection = role || Object.keys(COLL_GUIDS).find(name => COLL_GUIDS[name] === guid);
    const label = COLLECTION_VIEWS[collection]?.[key];
    return config?.views?.find(view => view.shown !== false && view.label === label)?.id || null;
}

const BASE32_GUID = /^[0-9A-Z]{26}$/;

function cleanString(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (BASE32_GUID.test(trimmed)) return '';
        return trimmed;
    }
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (typeof val.getName === 'function') return cleanString(val.getName());
        if (typeof val.choiceLabel === 'function') return cleanString(val.choiceLabel());
        if (typeof val.text === 'function') return cleanString(val.text());
        return val.name || val.title || val.label || '';
    }
    return '';
}

const CHOICE_MAP = {
    cPDKKZ3D7FD5NXT: 'backlog',
    c8H5F6MH6W18ZYQ: 'in_progress',
    cMT7Q1FJ4WVX0ZT: 'in_review',
    cCN3TAA3V3XV10Q: 'completed',
    cTNF15963BTEJ6E: 'archived',
    cTNZG2X4GHTDVK4: 'cancelled',
    cCSF2NC75V7DRCY: 'high',
    cBEMEF25K9FYA3M: 'medium',
    cR1Y0ZVDSMAH19W: 'low'
};

function formatDatetime(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        if (val.includes('Object') || val.includes('[object')) return '';
        return val;
    }
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (Array.isArray(val)) {
        if (val[0] === 'datetime') return formatDatetime(val[1]);
        if (val[1] && typeof val[1] === 'object') return formatDatetime(val[1]);
        return formatDatetime(val[0]);
    }
    if (typeof val === 'object') {
        if (typeof val.value === 'function') return formatDatetime(val.value());
        if (typeof val.toISOString === 'function') return val.toISOString().slice(0, 10);
        if (val.value !== undefined) return formatDatetime(val.value);
        if (val.d && String(val.d).length === 8) {
            const s = String(val.d);
            return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        }
        if (val.formatted) return String(val.formatted);
        if (val.text) return String(val.text);
        if (val.date) return formatDatetime(val.date);
        if (val.year && val.month && val.day) {
            return `${val.year}-${String(val.month).padStart(2, '0')}-${String(val.day).padStart(2, '0')}`;
        }
    }
    return '';
}

function getProp(record, propName) {
    if (!record) return '';
    try {
        if (typeof record.prop === 'function') {
            const p = record.prop(propName);
            if (p !== null && p !== undefined) {
                if (typeof p.choiceLabel === 'function') {
                    const l = p.choiceLabel();
                    if (l) return cleanString(l);
                }
                if (typeof p.choiceId === 'function') {
                    const cid = p.choiceId();
                    if (cid && CHOICE_MAP[cid]) return CHOICE_MAP[cid];
                }
                if (typeof p.date === 'function') {
                    const d = p.date();
                    if (d) return formatDatetime(d);
                }
                if (typeof p.text === 'function') {
                    const t = p.text();
                    if (t) return cleanString(t);
                }
                if (typeof p.number === 'function') {
                    const n = p.number();
                    if (n !== null && n !== undefined) return n;
                }
                if (typeof p.date === 'function') {
                    const d = p.date();
                    if (d) return formatDatetime(d);
                }
                if (p.value !== undefined) {
                    if (Array.isArray(p.value)) {
                        if (p.value[0] === 'choice') return CHOICE_MAP[p.value[1]] || p.value[1];
                        if (p.value[0] === 'datetime') return formatDatetime(p.value[1]);
                        return cleanString(p.value[1]);
                    }
                    if (typeof p.value === 'object' && p.value !== null) {
                        return formatDatetime(p.value);
                    }
                    return cleanString(p.value);
                }
            }
        }
        if (typeof record.text === 'function') {
            const val = record.text(propName);
            if (val) return cleanString(val);
        }
        if (typeof record.number === 'function') {
            const val = record.number(propName);
            if (val !== null && val !== undefined) return val;
        }
        if (typeof record.linkedRecord === 'function') {
            const lr = record.linkedRecord(propName);
            if (lr) return cleanString(lr);
        }
        if (record.properties && record.properties[propName] !== undefined) {
            const raw = record.properties[propName];
            if (Array.isArray(raw)) {
                if (raw[0] === 'choice') return CHOICE_MAP[raw[1]] || raw[1];
                if (raw[0] === 'datetime') return formatDatetime(raw[1]);
                if (raw[0] === 'record') return raw[1];
                return cleanString(raw[1]);
            }
            if (typeof raw === 'object' && raw !== null) return formatDatetime(raw);
            return cleanString(raw);
        }
    } catch (e) {}
    return '';
}

function cleanGuid(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (BASE32_GUID.test(trimmed)) return trimmed;
        return '';
    }
    if (typeof val === 'object' && val !== null) {
        if (val.guid) return cleanGuid(val.guid);
    }
    return '';
}

function getParentGuid(record) {
    if (!record) return '';
    try {
        if (typeof record.getSubPageOf === 'function') {
            const sub = record.getSubPageOf();
            if (sub && sub.guid) return cleanGuid(sub.guid);
        }
        if (typeof record.linkedRecord === 'function') {
            const lr = record.linkedRecord('parent_page') || record.linkedRecord('Sub-page of');
            if (lr && lr.guid) return cleanGuid(lr.guid);
        }
        if (typeof record.prop === 'function') {
            const p = record.prop('parent_page') || record.prop('Sub-page of');
            if (p) {
                if (typeof p.linkedRecord === 'function') {
                    const lr = p.linkedRecord();
                    if (lr && lr.guid) return cleanGuid(lr.guid);
                }
                if (typeof p.values === 'function') {
                    const vals = p.values();
                    if (Array.isArray(vals) && vals.length > 0) {
                        const v = vals[0];
                        const g = cleanGuid(v);
                        if (g) return g;
                    }
                }
            }
        }
        if (typeof record.parentGuid === 'function') {
            const pg = record.parentGuid();
            if (pg && BASE32_GUID.test(pg)) return pg;
        }
        if (record.properties) {
            const sub = record.properties['Sub-page of'] || record.properties.parent_page;
            if (sub) {
                if (Array.isArray(sub) && sub[0] === 'record') return cleanGuid(sub[1]);
                if (typeof sub === 'string' && BASE32_GUID.test(sub)) return sub;
                if (sub.value && Array.isArray(sub.value) && sub.value[0] === 'record') return cleanGuid(sub.value[1]);
            }
        }
    } catch (e) {}
    return '';
}

function getClientGuid(record) {
    if (!record) return '';
    try {
        if (typeof record.linkedRecord === 'function') {
            const lr = record.linkedRecord('client');
            if (lr && lr.guid) return cleanGuid(lr.guid);
        }
        if (typeof record.prop === 'function') {
            const p = record.prop('client');
            if (p) {
                if (typeof p.linkedRecord === 'function') {
                    const lr = p.linkedRecord();
                    if (lr && lr.guid) return cleanGuid(lr.guid);
                }
                if (typeof p.values === 'function') {
                    const vals = p.values();
                    if (Array.isArray(vals) && vals.length > 0) {
                        const v = vals[0];
                        const g = cleanGuid(v);
                        if (g) return g;
                    }
                }
            }
        }
        const c1 = getProp(record, 'client');
        if (c1 && BASE32_GUID.test(c1)) return c1;
        if (record.properties && record.properties.client) {
            const c = record.properties.client;
            if (Array.isArray(c) && c[0] === 'record') return cleanGuid(c[1]);
            if (typeof c === 'string' && BASE32_GUID.test(c)) return c;
            if (c.value && Array.isArray(c.value) && c.value[0] === 'record') return cleanGuid(c.value[1]);
        }
    } catch (e) {}
    return '';
}

function extractLineText(line) {
    if (!line) return '';
    if (typeof line.text === 'string' && line.text.trim()) return line.text.trim();
    if (Array.isArray(line.segments)) {
        return line.segments.map(s => {
            if (s.type === 'ref') {
                return cleanString(s.text) || cleanString(s.title) || cleanString(s.name) || '';
            }
            if (s.type === 'datetime') return '';
            return typeof s.text === 'string' ? s.text : '';
        }).join('').trim();
    }
    return '';
}

function extractLineDate(line) {
    if (!line || !Array.isArray(line.segments)) return null;
    const dt = line.segments.find(s => s.type === 'datetime');
    if (!dt) return null;
    return formatDatetime(dt.text || dt.date);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp / 86400000 : null;
}

function money(value) {
    return new Intl.NumberFormat('en-CH', { maximumFractionDigits: 2 }).format(value);
}

function invoiceMatches(invoice, filter) {
    if (filter === 'all') return true;
    if (filter === 'overdue') return invoice.daysOverdue > 0;
    if (filter === 'outstanding') return invoice.isOutstanding;
    if (filter === 'review') return invoice.status === 'unconfirmed';
    if (filter === 'to-send') return invoice.stage === 'draft' || invoice.stage === 'ready';
    return invoice.status === filter;
}

function summarizeInvoices(invoices) {
    const summary = { invoiced: 0, collected: 0, outstanding: 0, overdue: 0, overdueCount: 0, unconfirmedCount: 0, toSend: 0, issuedCount: 0, excludedCurrency: 0, aging: [0, 0, 0], undated: 0 };
    for (const invoice of invoices) {
        if (invoice.stage === 'draft' || invoice.stage === 'ready') summary.toSend++;
        if (invoice.currency !== 'CHF') { summary.excludedCurrency++; continue; }
        if (invoice.stage !== 'sent' && invoice.status !== 'paid') continue;
        summary.invoiced += invoice.amount;
        summary.issuedCount++;
        if (invoice.status === 'paid') summary.collected += invoice.amount;
        if (invoice.status === 'unconfirmed') summary.unconfirmedCount++;
        if (invoice.isOutstanding) {
            summary.outstanding += invoice.amount;
            if (!invoice.dueDate) summary.undated++;
            if (invoice.daysOverdue > 0) {
                summary.overdue += invoice.amount;
                summary.overdueCount++;
                summary.aging[invoice.daysOverdue <= 30 ? 0 : invoice.daysOverdue <= 60 ? 1 : 2] += invoice.amount;
            }
        }
    }
    summary.collectionRate = summary.invoiced > 0 ? Math.round(summary.collected / summary.invoiced * 100) : null;
    return summary;
}

function clientSummary(client, projects, invoices) {
    const linked = invoices.filter(i => i.clientGuid === client.guid && i.currency === 'CHF');
    return {
        activeProjects: projects.filter(p => p.clientGuid === client.guid && ['in_progress', 'in_review'].includes(p.status)).length,
        collected: linked.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0),
        outstanding: linked.filter(i => i.isOutstanding).reduce((sum, i) => sum + i.amount, 0),
        overdueCount: linked.filter(i => i.daysOverdue > 0).length
    };
}

export class Plugin extends AppPlugin {
    onUnload() {
        clearTimeout(this.refreshTimer);
        clearTimeout(this.workflowSearchTimer);
        clearInterval(this.workflowDayTimer);
    }

    onLoad() {
        if (typeof window !== 'undefined') {
            window.__freelanceOs = this;
        }
        this.activePanel = null;
        this.refreshTimer = null;
        this.currentTab = 'projects';
        this.projectFilter = 'all'; // 'all', 'in_progress', 'backlog', 'completed'
        this.invoiceFilter = 'all';
        this.searchQuery = '';
        this.agendaTab = null;
        this.agendaTabSetByUser = false;
        this.expandedProjects = new Set();
        this.captureDraft = '';
        this.captureProjectGuid = '';
        this.captureImportant = false;
        this.loadWorkflowState();
        this.workflowMode = 'today';
        this.workflowDay = localDate();
        this.workflowDayTimer = setInterval(() => {
            if (this.workflowDay !== localDate()) { this.workflowDay = localDate(); this.scheduleRefresh(); }
        }, 60000);

        // 1. Inject Styles
        if (typeof STYLES !== 'undefined') {
            this.ui.injectCSS(STYLES);
        }

        // 2. Register Custom Panel
        this.ui.registerCustomPanelType(DASHBOARD_PANEL_ID, (panel) => {
            this.activePanel = panel;
            panel.setTitle('Freelance OS');
            this.render(panel);
        });

        // 3. Add Sidebar Navigation Item
        this.ui.addSidebarItem({
            label: 'Freelance OS',
            icon: 'layout-grid',
            tooltip: 'Open Freelance OS Dashboard',
            onClick: () => this.openDashboard()
        });

        // 4. Add Command Palette Command
        this.ui.addCommandPaletteCommand({
            label: 'Open Freelance OS Dashboard',
            icon: 'layout-grid',
            onSelected: () => this.openDashboard()
        });

        // 5. Reactive Workspace Listeners
        if (this.events) {
            const schedule = () => this.scheduleRefresh();
            this.events.on('lineitem.updated', schedule);
            this.events.on('lineitem.created', schedule);
            this.events.on('lineitem.deleted', schedule);
            this.events.on('record.updated', schedule);
            this.events.on('record.created', schedule);
        }
        // Desktop hot reload can retain a custom panel without invoking its new registration callback.
        const existing = this.ui.getPanels?.().find(panel => panel.getNavigation()?.type === 'custom' && String(panel.getNavigation().subId || '').endsWith(`${this.getGuid()}-${DASHBOARD_PANEL_ID}`));
        if (existing) { this.activePanel = existing; existing.setTitle('Freelance OS'); this.render(existing); }
    }

    async openDashboard() {
        let panel = this.ui.getActivePanel ? this.ui.getActivePanel() : null;
        if (!panel) {
            panel = await this.ui.createPanel();
        }
        if (panel) {
            panel.navigateToCustomType(DASHBOARD_PANEL_ID);
        }
    }

    scheduleRefresh() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
            // Preserve focus and selection while composing a task. Blur refreshes the data.
            if (document.activeElement?.closest('.os-capture, .os-review-form, .os-action-editor, .os-settings-fields')) return;
            if (this.activePanel) this.render(this.activePanel);
        }, 200);
    }

    async openRecord(guid, sourcePanel) {
        const wsGuid = this.getWorkspaceGuid();
        try {
            // Attempt side-by-side panel creation first
            if (this.ui && typeof this.ui.createPanel === 'function') {
                const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
                if (sidePanel) {
                    sidePanel.navigateTo({
                        type: 'edit_panel',
                        rootId: guid,
                        subId: null,
                        workspaceGuid: wsGuid
                    });
                    return;
                }
            }
        } catch (e) {
            console.warn('[FreelanceOS] Side panel failed, falling back:', e);
        }

        // Fallback: navigate current panel
        if (sourcePanel) {
            sourcePanel.navigateTo({
                type: 'edit_panel',
                rootId: guid,
                subId: null,
                workspaceGuid: wsGuid
            });
        }
    }

    async openCollection(guid, sourcePanel, viewKey = 'all') {
        const wsGuid = this.getWorkspaceGuid();
        const config = this.data.getPluginByGuid?.(guid)?.getConfiguration?.();
        const role = Object.keys(COLL_GUIDS).find(name => this.collectionGuid(name) === guid);
        const subId = collectionViewId(guid, config, viewKey, role);
        try {
            if (this.ui && typeof this.ui.createPanel === 'function') {
                const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
                if (sidePanel) {
                    sidePanel.navigateTo({
                        type: 'overview',
                        rootId: guid,
                        subId,
                        workspaceGuid: wsGuid
                    });
                    return;
                }
            }
        } catch (e) {
            console.warn('[FreelanceOS] Side panel collection failed, falling back:', e);
        }

        if (sourcePanel) {
            sourcePanel.navigateTo({
                type: 'overview',
                rootId: guid,
                subId,
                workspaceGuid: wsGuid
            });
        }
    }

    async openJournal(sourcePanel) {
        const wsGuid = this.getWorkspaceGuid();
        try {
            const users = typeof this.data.getActiveUsers === 'function' ? this.data.getActiveUsers() : [];
            if (this.ui && typeof this.ui.createPanel === 'function') {
                const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
                if (sidePanel) {
                    if (users.length > 0 && typeof sidePanel.navigateToJournal === 'function') {
                        const ok = sidePanel.navigateToJournal(users[0]);
                        if (ok) return;
                    }
                    sidePanel.navigateTo({
                        type: 'overview',
                        rootId: this.collectionGuid('Journal'),
                        subId: null,
                        workspaceGuid: wsGuid
                    });
                    return;
                }
            }
        } catch (e) {
            console.warn('[FreelanceOS] Side panel journal failed:', e);
        }

        if (sourcePanel) {
            const users = typeof this.data.getActiveUsers === 'function' ? this.data.getActiveUsers() : [];
            if (users.length > 0 && typeof sourcePanel.navigateToJournal === 'function') {
                const ok = sourcePanel.navigateToJournal(users[0]);
                if (ok) return;
            }
            sourcePanel.navigateTo({
                type: 'overview',
                rootId: this.collectionGuid('Journal'),
                subId: null,
                workspaceGuid: wsGuid
            });
        }
    }

    async openItem(itemGuid, fallbackRecordGuid, sourcePanel) {
        const wsGuid = this.getWorkspaceGuid();
        const navigate = async target => {
            if (itemGuid) {
                try {
                    if (await target.navigateTo({ itemGuid, highlight: true, workspaceGuid: wsGuid }) === true) return;
                } catch {}
            }
            if (fallbackRecordGuid) target.navigateTo({ type: 'edit_panel', rootId: fallbackRecordGuid, subId: null, workspaceGuid: wsGuid });
        };
        try {
            if (this.ui && typeof this.ui.createPanel === 'function') {
                const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
                if (sidePanel) {
                    await navigate(sidePanel);
                    return;
                }
            }
        } catch (e) {}

        if (sourcePanel) {
            await navigate(sourcePanel);
        }
    }

    async loadData() {
        const data = {
            mrr: 0,
            activeCarePlans: 0,
            activeClientsCount: 0,
            prospectsCount: 0,
            projects: [],
            clients: [],
            invoices: [],
            agendaTasks: []
        };

        try {
            const collections = await this.data.getAllCollections();
            this.workflowCollections = collections;
            const readCollection = async (guid) => {
                const collection = collections.find(c => c.getGuid() === guid);
                if (!collection) throw new Error('Required collection unavailable');
                return collection.getAllRecords();
            };
            // 1. Fetch Clients
            const clientRecords = await readCollection(this.collectionGuid('Clients'));
            let mrrSum = 0;
            let activeC = 0;
            let prospects = 0;
            let carePlans = 0;

            const clientMap = new Map();
            const clientList = [];

            for (const cr of clientRecords) {
                const name = (cr.getName ? cr.getName() : cr.name) || 'Untitled Client';
                const status = (getProp(cr, 'status') || 'active').toLowerCase();
                const mrrVal = Number(getProp(cr, 'monthly_chf')) || 0;

                if (cr.guid) clientMap.set(cr.guid, name);

                if (mrrVal > 0 && status === 'active') {
                    mrrSum += mrrVal;
                    carePlans++;
                }

                if (status === 'archived' || status === 'cancelled') {
                    // skipped
                } else if (status === 'prospect' || status === 'lead') {
                    prospects++;
                } else {
                    activeC++;
                }

                clientList.push({
                    record: cr,
                    guid: cr.guid,
                    name,
                    status,
                    mrr: mrrVal,
                    plan: getProp(cr, 'plan') || (mrrVal > 0 ? `${mrrVal} CHF/mo` : 'Active')
                });
            }

            data.mrr = mrrSum;
            data.activeCarePlans = carePlans;
            data.activeClientsCount = activeC;
            data.prospectsCount = prospects;
            data.clients = clientList;

            // 2. Fetch Invoices
            const invRecords = await readCollection(this.collectionGuid('Invoices'));
            const invoiceList = [];
            const today = dateDay(localDate());

            for (const ir of invRecords) {
                const name = (ir.getName ? ir.getName() : ir.name) || 'Untitled Invoice';
                const rawAmount = Number(getProp(ir, 'amount_chf'));
                const amt = Number.isFinite(rawAmount) ? rawAmount : 0;
                const status = (getProp(ir, 'payment_status') || 'unpaid').toLowerCase();
                const stage = (getProp(ir, 'status') || 'unknown').toLowerCase();
                const currency = String(getProp(ir, 'currency') || 'CHF').toUpperCase();
                const clientGuid = getClientGuid(ir);

                let client = clientMap.get(clientGuid) || getProp(ir, 'client') || '';
                if (BASE32_GUID.test(client) && clientMap.has(client)) {
                    client = clientMap.get(client);
                }

                let due = getProp(ir, 'due') || getProp(ir, 'due_date') || '';
                if (typeof due === 'object' || String(due).includes('Object')) due = '';

                const dueDay = dateDay(due);
                const isOutstanding = stage === 'sent' && status !== 'paid';
                const daysOverdue = isOutstanding && dueDay !== null ? Math.max(0, today - dueDay) : 0;

                invoiceList.push({
                    record: ir,
                    guid: ir.guid,
                    name,
                    amount: amt,
                    status,
                    stage,
                    currency,
                    clientGuid,
                    isOutstanding,
                    daysOverdue,
                    clientName: client,
                    dueDate: dueDay !== null ? due : ''
                });
            }

            // Oldest receivables first, keeping drafts and settled invoices below them.
            invoiceList.sort((a, b) => {
                if (a.isOutstanding !== b.isOutstanding) return a.isOutstanding ? -1 : 1;
                if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
                return b.name.localeCompare(a.name);
            });

            data.invoices = invoiceList;
            data.cashflow = summarizeInvoices(invoiceList);

            // 3. Fetch Projects (Separate top-level projects from sub-pages & deliverables)
            const projRecords = await readCollection(this.collectionGuid('Projects'));
            const parentList = [];
            const subpageList = [];
            const parentMap = new Map();

            for (const pr of projRecords) {
                const name = (pr.getName ? pr.getName() : pr.name) || '';
                if (!name || name === 'New Project' || name === 'Kanban - Active Projects') continue;

                const parentGuid = getParentGuid(pr);
                const status = (getProp(pr, 'status') || 'in_progress').toLowerCase();
                const priority = (getProp(pr, 'priority') || 'medium').toLowerCase();
                
                let clientGuid = getClientGuid(pr);
                let clientName = clientMap.has(clientGuid) ? clientMap.get(clientGuid) : '';

                // Smart client name inference from title if client prop wasn't directly linked
                if (!clientName) {
                    for (const [cg, cn] of clientMap.entries()) {
                        if (cn && name.toLowerCase().includes(cn.toLowerCase())) {
                            clientName = cn;
                            clientGuid = cg;
                            break;
                        }
                    }
                }
                if (!clientName) {
                    if (name.includes('Moulin') || name.includes('EmDash')) clientName = 'Internal Product';
                    else if (name.includes('Personal')) clientName = 'Personal';
                }

                let deadline = getProp(pr, 'deadline');
                if (!deadline || typeof deadline === 'object' || String(deadline).includes('object') || String(deadline).includes('Object')) {
                    deadline = 'No deadline';
                }

                const item = {
                    record: pr,
                    guid: pr.guid,
                    name,
                    status,
                    priority,
                    clientGuid,
                    clientName,
                    parentGuid,
                    deadline: deadline || 'No deadline',
                    deliverables: []
                };

                if (parentGuid) {
                    subpageList.push(item);
                } else {
                    parentList.push(item);
                    parentMap.set(pr.guid, item);
                }
            }

            // Nest deliverables under their respective parent projects
            for (const sub of subpageList) {
                if (parentMap.has(sub.parentGuid)) {
                    parentMap.get(sub.parentGuid).deliverables.push(sub);
                }
            }

            // Sort deliverables inside each project alphabetically
            for (const p of parentList) {
                p.deliverables.sort((a, b) => a.name.localeCompare(b.name));
            }

            // Cross-reference clients with projects and invoices:
            for (const c of clientList) {
                c.projectCount = parentList.filter(p => p.clientGuid === c.guid || (p.clientName && p.clientName.toLowerCase() === c.name.toLowerCase())).length;
                c.invoiceCount = invoiceList.filter(i => i.clientName && i.clientName.toLowerCase() === c.name.toLowerCase()).length;
                c.summary = clientSummary(c, parentList, invoiceList);
            }

            // Sort: in_progress first, high priority first
            parentList.sort((a, b) => {
                if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
                if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
                if (a.priority === 'high' && b.priority !== 'high') return -1;
                if (b.priority === 'high' && a.priority !== 'high') return 1;
                return a.name.localeCompare(b.name);
            });

            data.projects = parentList;

            // 4. Fetch Tasks
            const taskRes = await this.data.searchByQuery('@task @todo', 150);
            const taskLines = taskRes?.lines || [];
            const taskList = [];
            const now = new Date();
            const todayIso = localDate(now);
            const nextDate = new Date(now);
            nextDate.setDate(nextDate.getDate() + 7);
            const nextWeek = localDate(nextDate);

            for (const line of taskLines) {
                const text = extractLineText(line);
                if (!text) continue;

                const dt = extractLineDate(line);
                let category = 'inbox'; // default for undated tasks
                if (dt) {
                    if (dt < todayIso) category = 'overdue';
                    else if (dt === todayIso) category = 'today';
                    else if (dt <= nextWeek) category = 'upcoming';
                    else category = 'later';
                }

                const rec = (typeof line.getRecord === 'function' ? line.getRecord() : line.record) || null;
                const recordGuid = rec ? (rec.guid || (rec.getGuid ? rec.getGuid() : null)) : null;

                taskList.push({
                    guid: line.guid,
                    lineItem: line,
                    text,
                    date: dt,
                    category,
                    recordGuid
                });
            }

            data.agendaTasks = taskList;

        } catch (e) {
            data.loadError = true;
            console.warn('[FreelanceOS] data query error:', e);
        }

        return data;
    }

    async captureTask(text, projectGuid, important) {
        let record;
        if (projectGuid) {
            record = this.data.getRecord(projectGuid);
        } else {
            const collections = await this.data.getAllCollections();
            const journal = collections.find(c => c.getGuid() === this.collectionGuid('Journal'));
            const user = this.data.getActiveUsers?.()[0];
            if (journal && user) record = await journal.getJournalRecord(user);
        }
        if (!record) throw new Error('Capture destination unavailable');
        const line = await record.createLineItem(null, null, 'task');
        if (!line) throw new Error('Task creation failed');
        try {
            if (await line.setSegments([{ type: 'text', text }]) === false) throw new Error('Task content was not saved');
        } catch (error) {
            await line.delete?.().catch(() => {});
            throw error;
        }
        let prioritySaved = true;
        if (important) {
            try { prioritySaved = await line.setTaskStatus('important') !== false; }
            catch { prioritySaved = false; }
        }
        return { prioritySaved };
    }

    showCreateProjectModal(panel, data) {
        const modal = document.createElement('div');
        modal.className = 'os-modal-backdrop';

        const clientOptions = data.clients.map(c => `<option value="${c.guid}">${c.name}</option>`).join('');

        modal.innerHTML = `
            <div class="os-modal-card">
                <div class="os-modal-header">
                    <h3>Create New Project</h3>
                    <button class="os-modal-close" type="button">✕</button>
                </div>
                <div class="os-modal-body">
                    <div class="os-form-group">
                        <label>Project Name *</label>
                        <input type="text" class="os-input input-title" placeholder="e.g. Website Redesign" autofocus />
                    </div>
                    <div class="os-form-group">
                        <label>Client</label>
                        <select class="os-select input-client">
                            <option value="">-- No Client / Internal --</option>
                            ${clientOptions}
                        </select>
                    </div>
                    <div style="display:flex;gap:12px;">
                        <div class="os-form-group" style="flex:1;">
                            <label>Priority</label>
                            <select class="os-select input-priority">
                                <option value="high">High</option>
                                <option value="medium" selected>Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div class="os-form-group" style="flex:1;">
                            <label>Status</label>
                            <select class="os-select input-status">
                                <option value="in_progress" selected>In Progress</option>
                                <option value="backlog">Backlog</option>
                            </select>
                        </div>
                    </div>
                    <div class="os-form-group">
                        <label>Deadline (Optional)</label>
                        <input type="date" class="os-input input-deadline" />
                    </div>
                </div>
                <div class="os-modal-footer">
                    <button class="os-button btn-cancel" type="button">Cancel</button>
                    <button class="os-button os-primary btn-submit" type="button">Create Project</button>
                </div>
            </div>
        `;

        const close = () => modal.remove();
        modal.querySelector('.os-modal-close').addEventListener('click', close);
        modal.querySelector('.btn-cancel').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        modal.querySelector('.btn-submit').addEventListener('click', async () => {
            const title = modal.querySelector('.input-title').value.trim();
            if (!title) {
                alert('Please enter a project name.');
                return;
            }

            const clientGuid = modal.querySelector('.input-client').value;
            const priority = modal.querySelector('.input-priority').value;
            const status = modal.querySelector('.input-status').value;
            const deadline = modal.querySelector('.input-deadline').value;

            try {
                const cols = await this.data.getAllCollections();
                const pCol = cols.find(c => c.getGuid() === this.collectionGuid('Projects'));
                if (pCol && typeof pCol.createRecord === 'function') {
                    const newGuid = pCol.createRecord(title);
                    if (newGuid) {
                        const rec = this.data.getRecord ? this.data.getRecord(newGuid) : null;
                        if (rec) {
                            if (clientGuid && rec.prop('client')?.setValue) await rec.prop('client').setValue(clientGuid);
                            if (priority && rec.prop('priority')?.setValue) await rec.prop('priority').setValue(priority);
                            if (status && rec.prop('status')?.setValue) await rec.prop('status').setValue(status);
                            if (deadline && rec.prop('deadline')?.setValue) await rec.prop('deadline').setValue(deadline);
                        }
                        this.ui.addToaster({ title: `✓ Created "${title}"`, autoDestroyTime: 2500, dismissible: true });
                        close();
                        this.scheduleRefresh();
                        return;
                    }
                }
            } catch (err) {
                console.error('Project create error:', err);
            }
            close();
        });

        document.body.appendChild(modal);
        modal.querySelector('.input-title').focus();
    }

    showCreateClientModal(panel) {
        const modal = document.createElement('div');
        modal.className = 'os-modal-backdrop';

        modal.innerHTML = `
            <div class="os-modal-card">
                <div class="os-modal-header">
                    <h3>Create New Client</h3>
                    <button class="os-modal-close" type="button">✕</button>
                </div>
                <div class="os-modal-body">
                    <div class="os-form-group">
                        <label>Client Name *</label>
                        <input type="text" class="os-input input-title" placeholder="e.g. Acme Corp" autofocus />
                    </div>
                    <div style="display:flex;gap:12px;">
                        <div class="os-form-group" style="flex:1;">
                            <label>Monthly Retainer (CHF)</label>
                            <input type="number" class="os-input input-mrr" placeholder="e.g. 150" />
                        </div>
                        <div class="os-form-group" style="flex:1;">
                            <label>Status</label>
                            <select class="os-select input-status">
                                <option value="active" selected>Active Client</option>
                                <option value="prospect">Prospect / Lead</option>
                            </select>
                        </div>
                    </div>
                    <div class="os-form-group">
                        <label>Plan / Retainer Service</label>
                        <input type="text" class="os-input input-plan" placeholder="e.g. Website Maintenance & SEO" />
                    </div>
                    <div class="os-form-group">
                        <label>Website URL</label>
                        <input type="url" class="os-input input-website" placeholder="https://example.com" />
                    </div>
                </div>
                <div class="os-modal-footer">
                    <button class="os-button btn-cancel" type="button">Cancel</button>
                    <button class="os-button os-primary btn-submit" type="button">Create Client</button>
                </div>
            </div>
        `;

        const close = () => modal.remove();
        modal.querySelector('.os-modal-close').addEventListener('click', close);
        modal.querySelector('.btn-cancel').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        modal.querySelector('.btn-submit').addEventListener('click', async () => {
            const title = modal.querySelector('.input-title').value.trim();
            if (!title) {
                alert('Please enter a client name.');
                return;
            }

            const mrr = Number(modal.querySelector('.input-mrr').value) || 0;
            const status = modal.querySelector('.input-status').value;
            const plan = modal.querySelector('.input-plan').value.trim();
            const website = modal.querySelector('.input-website').value.trim();

            try {
                const cols = await this.data.getAllCollections();
                const cCol = cols.find(c => c.getGuid() === this.collectionGuid('Clients'));
                if (cCol && typeof cCol.createRecord === 'function') {
                    const newGuid = cCol.createRecord(title);
                    if (newGuid) {
                        const rec = this.data.getRecord ? this.data.getRecord(newGuid) : null;
                        if (rec) {
                            if (mrr > 0 && rec.prop('monthly_chf')?.setValue) await rec.prop('monthly_chf').setValue(mrr);
                            if (status && rec.prop('status')?.setValue) await rec.prop('status').setValue(status);
                            if (plan && rec.prop('plan')?.setValue) await rec.prop('plan').setValue(plan);
                            if (website && rec.prop('website')?.setValue) await rec.prop('website').setValue(website);
                        }
                        this.ui.addToaster({ title: `✓ Created Client "${title}"`, autoDestroyTime: 2500, dismissible: true });
                        close();
                        this.currentTab = 'clients';
                        this.scheduleRefresh();
                        return;
                    }
                }
            } catch (err) {
                console.error('Client create error:', err);
            }
            close();
        });

        document.body.appendChild(modal);
        modal.querySelector('.input-title').focus();
    }

    showCreateInvoiceModal(panel, data) {
        const modal = document.createElement('div');
        modal.className = 'os-modal-backdrop';

        const clientOptions = data.clients.map(c => `<option value="${c.guid}">${c.name}</option>`).join('');
        const nextInvNum = `FAC-2026-${String(data.issuedCount + 1).padStart(3, '0')}`;

        modal.innerHTML = `
            <div class="os-modal-card">
                <div class="os-modal-header">
                    <h3>Create New Invoice</h3>
                    <button class="os-modal-close" type="button">✕</button>
                </div>
                <div class="os-modal-body">
                    <div style="display:flex;gap:12px;">
                        <div class="os-form-group" style="flex:1;">
                            <label>Invoice Number *</label>
                            <input type="text" class="os-input input-title" value="${nextInvNum}" autofocus />
                        </div>
                        <div class="os-form-group" style="flex:1;">
                            <label>Amount (CHF) *</label>
                            <input type="number" class="os-input input-amount" placeholder="e.g. 350" />
                        </div>
                    </div>
                    <div class="os-form-group">
                        <label>Client *</label>
                        <select class="os-select input-client">
                            ${clientOptions}
                        </select>
                    </div>
                    <div style="display:flex;gap:12px;">
                        <div class="os-form-group" style="flex:1;">
                            <label>Status</label>
                            <select class="os-select input-status">
                                <option value="unpaid" selected>Unpaid / Sent</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                        <div class="os-form-group" style="flex:1;">
                            <label>Due Date</label>
                            <input type="date" class="os-input input-due" />
                        </div>
                    </div>
                </div>
                <div class="os-modal-footer">
                    <button class="os-button btn-cancel" type="button">Cancel</button>
                    <button class="os-button os-primary btn-submit" type="button">Create Invoice</button>
                </div>
            </div>
        `;

        const close = () => modal.remove();
        modal.querySelector('.os-modal-close').addEventListener('click', close);
        modal.querySelector('.btn-cancel').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        modal.querySelector('.btn-submit').addEventListener('click', async () => {
            const title = modal.querySelector('.input-title').value.trim();
            const amount = Number(modal.querySelector('.input-amount').value) || 0;
            if (!title || !amount) {
                alert('Please enter an invoice number and amount.');
                return;
            }

            const clientGuid = modal.querySelector('.input-client').value;
            const status = modal.querySelector('.input-status').value;
            const due = modal.querySelector('.input-due').value;

            try {
                const cols = await this.data.getAllCollections();
                const iCol = cols.find(c => c.getGuid() === this.collectionGuid('Invoices'));
                if (iCol && typeof iCol.createRecord === 'function') {
                    const newGuid = iCol.createRecord(title);
                    if (newGuid) {
                        const rec = this.data.getRecord ? this.data.getRecord(newGuid) : null;
                        if (rec) {
                            if (amount > 0 && rec.prop('amount_chf')?.setValue) await rec.prop('amount_chf').setValue(amount);
                            if (clientGuid && rec.prop('client')?.setValue) await rec.prop('client').setValue(clientGuid);
                            if (status && rec.prop('status')?.setValue) await rec.prop('status').setValue(status);
                            if (due && rec.prop('due')?.setValue) await rec.prop('due').setValue(due);
                        }
                        this.ui.addToaster({ title: `✓ Created Invoice "${title}"`, autoDestroyTime: 2500, dismissible: true });
                        close();
                        this.currentTab = 'invoices';
                        this.scheduleRefresh();
                        return;
                    }
                }
            } catch (err) {
                console.error('Invoice create error:', err);
            }
            close();
        });

        document.body.appendChild(modal);
    }

    async render(panel) {
        const container = panel.getElement ? panel.getElement() : null;
        if (!container) return;

        // Force inner content wrappers to 100% width to break out of Thymer's reader-width constraint,
        // without touching .panel itself so Thymer's multi-panel grid remains intact
        try {
            container.style.width = '100%';
            container.style.maxWidth = '100%';
            container.style.padding = '0';
            let cur = container.parentElement;
            while (cur && cur !== document.body) {
                if (cur.classList && cur.classList.contains('panel')) break;
                cur.style.width = '100%';
                cur.style.maxWidth = '100%';
                cur = cur.parentElement;
            }
        } catch (e) {}

        const renderVersion = this.renderVersion = (this.renderVersion || 0) + 1;
        const mode = this.workflowMode || 'today';
        let workflow;
        if (mode !== 'overview') {
            try { workflow = await this.loadWorkflowData(); }
            catch { workflow = { error: 'Project tasks could not be loaded. Check collection mappings in Settings, then retry.' }; }
            this.workflowData = workflow;
        }
        const data = mode === 'overview' ? await this.loadData() : { projects: workflow?.projects || [] };
        if (renderVersion !== this.renderVersion) return;
        const cash = data.cashflow || summarizeInvoices([]);
        const wsGuid = this.getWorkspaceGuid();
        const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        const app = document.createElement('div');
        app.className = 'os-shell';
        app.tabIndex = -1;
        app.setAttribute('aria-label', 'Freelance OS dashboard');

        // 1. Header
        const header = document.createElement('header');
        header.className = 'os-header';
        header.innerHTML = `
            <div class="os-identity">
                <div class="os-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                </div>
                <div>
                    <h1>Freelance OS</h1>
                    <div class="os-subtitle">Workspace Overview · ${dateStr}</div>
                </div>
            </div>
            <div class="os-capture">
                <div class="os-capture-field">
                    <input type="text" class="os-capture-input" aria-label="Task title" placeholder="Quick capture task..." />
                    <button class="os-capture-btn" aria-label="Add task" title="Add task (Enter)">↵</button>
                </div>
                <div class="os-capture-options">
                    <select class="os-capture-project" aria-label="Task destination"><option value="">Journal inbox</option>${data.projects.filter(p => !['completed', 'archived', 'cancelled'].includes(p.status)).map(p => `<option value="${escapeHtml(p.guid)}">${escapeHtml(p.name)}</option>`).join('')}</select>
                    <label class="os-capture-priority"><input type="checkbox" /> Important</label>
                    <span class="os-capture-hint">/ to focus · Enter to save</span>
                </div>
                <div class="os-capture-feedback" role="status" aria-live="polite"></div>
            </div>
            <div class="os-header-actions">
                <button class="os-button os-btn-board" type="button">
                    <span>🗂 Open board</span>
                </button>
            </div>
        `;

        // Capture task handler
        const captureInput = header.querySelector('.os-capture-input');
        const captureProject = header.querySelector('.os-capture-project');
        const capturePriority = header.querySelector('.os-capture-priority input');
        const captureButton = header.querySelector('.os-capture-btn');
        const captureFeedback = header.querySelector('.os-capture-feedback');
        captureInput.value = this.captureDraft || '';
        captureProject.value = this.captureProjectGuid || '';
        capturePriority.checked = this.captureImportant || false;
        captureInput.oninput = () => { this.captureDraft = captureInput.value; };
        captureProject.onchange = () => { this.captureProjectGuid = captureProject.value; };
        capturePriority.onchange = () => { this.captureImportant = capturePriority.checked; };
        app.addEventListener('keydown', e => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input, select, textarea, [contenteditable="true"]')) {
                e.preventDefault();
                captureInput.focus({ preventScroll: true });
            }
        });
        header.querySelector('.os-capture').addEventListener('focusout', () => this.scheduleRefresh());
        const handleCapture = async () => {
            const txt = (captureInput.value || '').trim();
            if (!txt || this.captureBusy) return;
            this.captureBusy = true;
            captureButton.disabled = true;
            captureInput.disabled = true;
            captureProject.disabled = true;
            capturePriority.disabled = true;
            captureFeedback.textContent = 'Saving task…';
            try {
                const result = await this.captureTask(txt, captureProject.value, capturePriority.checked);
                this.captureDraft = '';
                captureInput.value = '';
                const title = result.prioritySaved ? `Task saved to ${captureProject.value ? 'project' : 'Journal'}` : 'Task saved; priority could not be set. Open the task to mark it important.';
                captureFeedback.textContent = title;
                this.ui.addToaster({ title, autoDestroyTime: 3500, dismissible: true });
            } catch (err) {
                captureFeedback.textContent = 'Task could not be saved. Your text is kept; try again.';
                console.error('[FreelanceOS] Capture failed:', err);
            } finally {
                this.captureBusy = false;
                captureButton.disabled = captureInput.disabled = captureProject.disabled = capturePriority.disabled = false;
                captureInput.focus({ preventScroll: true });
            }
        };

        header.querySelector('.os-capture-btn').addEventListener('click', handleCapture);
        captureInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); handleCapture(); }
            if (e.key === 'Escape') { e.preventDefault(); app.focus({ preventScroll: true }); }
        });

        header.querySelector('.os-btn-board').addEventListener('click', () => {
            this.openCollection(this.collectionGuid('Projects'), panel, 'board');
        });

        app.appendChild(header);

        const modes = document.createElement('nav');
        modes.className = 'os-workflow-modes';
        modes.setAttribute('aria-label', 'Dashboard sections');
        modes.innerHTML = [['today', 'Today'], ['review', 'Weekly review'], ['overview', 'Overview'], ['settings', 'Settings']].map(([key, label]) => `<button class="os-tab ${mode === key ? 'active' : ''}" data-mode="${key}" aria-pressed="${mode === key}">${label}</button>`).join('');
        modes.querySelectorAll('button').forEach(button => { button.onclick = () => { this.workflowMode = button.dataset.mode; this.workflowMessage = ''; this.render(panel); }; });
        app.appendChild(modes);
        if (mode !== 'overview') {
            app.appendChild(mode === 'settings' ? this.renderWorkflowSettings(panel) : this.renderWorkflow(workflow, panel));
            this.mountWorkflowApp(container, app);
            return;
        }

        // 2. Pulse / Metrics Bar
        const pulse = document.createElement('section');
        pulse.className = 'os-pulse';
        pulse.innerHTML = `
            <div class="os-metric metric-mrr" title="Click to view Clients & Care Plans">
                <div class="os-metric-label">Recurring revenue</div>
                <div class="os-metric-value">${money(data.mrr)} <span class="os-metric-unit">CHF / mo</span></div>
                <div class="os-metric-footnote">${data.activeCarePlans} active care plans</div>
            </div>
            <div class="os-metric metric-inv" title="Click to view Invoices">
                <div class="os-metric-label">Invoiced · all time</div>
                <div class="os-metric-value">${money(cash.invoiced)} <span class="os-metric-unit">CHF</span></div>
                <div class="os-metric-footnote">${cash.issuedCount} issued · ${cash.toSend} to send</div>
            </div>
            <div class="os-metric metric-col" title="Click to view Invoices">
                <div class="os-metric-label">Collected · all time</div>
                <div class="os-metric-value">${money(cash.collected)} <span class="os-metric-unit">CHF</span></div>
                <div class="os-metric-footnote">${cash.unconfirmedCount} awaiting payment confirmation</div>
            </div>
            <div class="os-metric metric-clients" title="Click to view Clients">
                <div class="os-metric-label">Active clients</div>
                <div class="os-metric-value">${data.activeClientsCount}</div>
                <div class="os-metric-footnote">${data.prospectsCount} prospects in pipeline</div>
            </div>
        `;

        pulse.querySelector('.metric-mrr').addEventListener('click', () => { this.currentTab = 'clients'; this.render(panel); });
        pulse.querySelector('.metric-inv').addEventListener('click', () => { this.currentTab = 'invoices'; this.render(panel); });
        pulse.querySelector('.metric-col').addEventListener('click', () => { this.currentTab = 'invoices'; this.render(panel); });
        pulse.querySelector('.metric-clients').addEventListener('click', () => { this.currentTab = 'clients'; this.render(panel); });
        pulse.querySelectorAll('.os-metric').forEach(metric => {
            metric.setAttribute('role', 'button');
            metric.tabIndex = 0;
            metric.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); metric.click(); }
            });
        });

        app.appendChild(pulse);

        if (data.loadError) {
            pulse.remove();
            const error = document.createElement('div');
            error.className = 'os-data-error';
            error.setAttribute('role', 'alert');
            error.innerHTML = 'Some workspace data could not be loaded. <button class="os-button">Retry</button>';
            error.querySelector('button').onclick = () => this.render(panel);
            app.appendChild(error);
        } else {
            const cashflow = document.createElement('section');
            cashflow.className = 'os-cashflow';
            cashflow.setAttribute('aria-label', 'Cashflow, CHF invoices, all time');
            cashflow.innerHTML = `
                <div class="os-collection-rate">
                    <div class="os-cash-heading"><h2>Cashflow</h2><span>${cash.collectionRate === null ? 'No issued invoices' : `${cash.collectionRate}% collected`}</span></div>
                    <progress max="100" value="${cash.collectionRate ?? 0}" aria-label="Invoice collection rate"></progress>
                    <div class="os-cash-note">CHF invoices · all time${cash.excludedCurrency ? ` · ${cash.excludedCurrency} in other currencies excluded` : ''}</div>
                </div>
                <button class="os-cash-action" data-invoice-filter="outstanding"><span>Outstanding</span><strong>${money(cash.outstanding)} CHF</strong><small>${cash.undated} without a due date</small></button>
                <button class="os-cash-action ${cash.overdueCount ? 'os-cash-warning' : ''}" data-invoice-filter="overdue"><span>Overdue (${cash.overdueCount})</span><strong>${money(cash.overdue)} CHF</strong><small>1–30d: ${money(cash.aging[0])} · 31–60d: ${money(cash.aging[1])} · 61+d: ${money(cash.aging[2])}</small></button>
                <button class="os-cash-action" data-invoice-filter="review"><span>Confirm payments</span><strong>${cash.unconfirmedCount} to review</strong><small>Open invoices awaiting confirmation ↗</small></button>
            `;
            cashflow.querySelectorAll('[data-invoice-filter]').forEach(button => {
                button.title = 'Open this invoice queue in the collection';
                button.onclick = () => {
                    this.openCollection(this.collectionGuid('Invoices'), panel, button.dataset.invoiceFilter);
                };
            });
            app.appendChild(cashflow);
        }

        // 3. Main Grid (3 columns)
        const grid = document.createElement('div');
        grid.className = 'os-grid';

        // Column 1: Action Rail
        const rail = document.createElement('aside');
        rail.className = 'os-rail';
        rail.innerHTML = `
            <h2>Actions</h2>
            <div class="os-rail-actions">
                <button class="os-button os-primary btn-new-task" type="button">
                    <span>+ New task</span>
                </button>
                <button class="os-button btn-new-project" type="button">
                    <span>+ New project</span>
                </button>
                <button class="os-button btn-new-client" type="button">
                    <span>+ New client</span>
                </button>
                <button class="os-button btn-new-invoice" type="button">
                    <span>+ New invoice</span>
                </button>
            </div>
            <nav class="os-navigation">
                <a class="os-nav-link nav-projects">📁 All Projects</a>
                <a class="os-nav-link nav-clients">👥 All Clients</a>
                <a class="os-nav-link nav-invoices">🧾 All Invoices</a>
                <a class="os-nav-link nav-library">📚 Care Plans</a>
            </nav>
        `;

        rail.querySelector('.btn-new-task').addEventListener('click', () => captureInput.focus());
        rail.querySelector('.btn-new-project').addEventListener('click', () => this.showCreateProjectModal(panel, data));
        rail.querySelector('.btn-new-client').addEventListener('click', () => this.showCreateClientModal(panel));
        rail.querySelector('.btn-new-invoice').addEventListener('click', () => this.showCreateInvoiceModal(panel, data));

        rail.querySelector('.nav-projects').addEventListener('click', () => this.openCollection(this.collectionGuid('Projects'), panel));
        rail.querySelector('.nav-clients').addEventListener('click', () => this.openCollection(this.collectionGuid('Clients'), panel));
        rail.querySelector('.nav-invoices').addEventListener('click', () => this.openCollection(this.collectionGuid('Invoices'), panel));
        rail.querySelector('.nav-library').addEventListener('click', () => this.openCollection(this.collectionGuid('Library'), panel));

        grid.appendChild(rail);

        // Column 2: Center Projects/Clients/Invoices Grid
        const main = document.createElement('main');
        main.className = 'os-main';

        const sectionHead = document.createElement('div');
        sectionHead.className = 'os-section-head';
        sectionHead.innerHTML = `
            <div class="os-section-toolbar">
                <div class="os-tabs">
                    <button class="os-tab ${this.currentTab === 'projects' ? 'active' : ''} tab-proj">Projects (${data.projects.length})</button>
                    <button class="os-tab ${this.currentTab === 'clients' ? 'active' : ''} tab-cli">Clients (${data.clients.length})</button>
                    <button class="os-tab ${this.currentTab === 'invoices' ? 'active' : ''} tab-inv">Invoices (${data.invoices.length})</button>
                </div>
                <div class="os-filter-search">
                    <input type="text" class="os-search-input" placeholder="🔍 Filter ${this.currentTab}..." value="${this.searchQuery}" />
                    <a class="os-view-all">View collection ↗</a>
                </div>
            </div>
        `;

        sectionHead.querySelector('.tab-proj').addEventListener('click', () => {
            this.currentTab = 'projects';
            this.render(panel);
        });
        sectionHead.querySelector('.tab-cli').addEventListener('click', () => {
            this.currentTab = 'clients';
            this.render(panel);
        });
        sectionHead.querySelector('.tab-inv').addEventListener('click', () => {
            this.currentTab = 'invoices';
            this.render(panel);
        });
        sectionHead.querySelector('.os-view-all').addEventListener('click', () => {
            let col = this.collectionGuid('Projects');
            if (this.currentTab === 'clients') col = this.collectionGuid('Clients');
            else if (this.currentTab === 'invoices') col = this.collectionGuid('Invoices');
            this.openCollection(col, panel, this.currentTab === 'invoices' ? this.invoiceFilter : 'all');
        });

        const searchInput = sectionHead.querySelector('.os-search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            this.renderCards(cardsContainer, data, panel);
        });

        main.appendChild(sectionHead);

        // Project filter pills (if on projects tab)
        if (this.currentTab === 'invoices') {
            const filters = [['all', 'All'], ['outstanding', 'Outstanding'], ['overdue', 'Overdue'], ['review', 'To confirm'], ['to-send', 'To send'], ['paid', 'Paid']];
            const filterBar = document.createElement('div');
            filterBar.className = 'os-filter-pills';
            filterBar.setAttribute('aria-label', 'Filter invoices');
            for (const [key, label] of filters) {
                const button = document.createElement('button');
                button.className = `os-filter-pill ${this.invoiceFilter === key ? 'active' : ''}`;
                button.setAttribute('aria-pressed', String(this.invoiceFilter === key));
                button.textContent = `${label} (${data.invoices.filter(i => invoiceMatches(i, key)).length})`;
                button.onclick = () => { this.invoiceFilter = key; this.render(panel); };
                filterBar.appendChild(button);
            }
            main.appendChild(filterBar);
        }
        if (this.currentTab === 'projects') {
            const inProgCount = data.projects.filter(p => p.status === 'in_progress').length;
            const backlogCount = data.projects.filter(p => p.status === 'backlog').length;
            const completedCount = data.projects.filter(p => p.status === 'completed').length;

            const filterBar = document.createElement('div');
            filterBar.className = 'os-filter-pills';
            filterBar.innerHTML = `
                <button class="os-filter-pill ${this.projectFilter === 'all' ? 'active' : ''} pill-all">All (${data.projects.length})</button>
                <button class="os-filter-pill ${this.projectFilter === 'in_progress' ? 'active' : ''} pill-prog">In Progress (${inProgCount})</button>
                <button class="os-filter-pill ${this.projectFilter === 'backlog' ? 'active' : ''} pill-back">Backlog (${backlogCount})</button>
                <button class="os-filter-pill ${this.projectFilter === 'completed' ? 'active' : ''} pill-comp">Completed (${completedCount})</button>
            `;

            filterBar.querySelector('.pill-all').addEventListener('click', () => { this.projectFilter = 'all'; this.render(panel); });
            filterBar.querySelector('.pill-prog').addEventListener('click', () => { this.projectFilter = 'in_progress'; this.render(panel); });
            filterBar.querySelector('.pill-back').addEventListener('click', () => { this.projectFilter = 'backlog'; this.render(panel); });
            filterBar.querySelector('.pill-comp').addEventListener('click', () => { this.projectFilter = 'completed'; this.render(panel); });
            main.appendChild(filterBar);
        }

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'os-cards';
        this.renderCards(cardsContainer, data, panel);
        main.appendChild(cardsContainer);
        grid.appendChild(main);

        // Column 3: Agenda
        const agenda = document.createElement('aside');
        agenda.className = 'os-agenda';

        const todayTasks = data.agendaTasks.filter(t => t.category === 'today');
        const overdueTasks = data.agendaTasks.filter(t => t.category === 'overdue');
        const upcomingTasks = data.agendaTasks.filter(t => t.category === 'upcoming');
        const inboxTasks = data.agendaTasks.filter(t => t.category === 'inbox');

        if (!this.agendaTabSetByUser) {
            if (todayTasks.length > 0) this.agendaTab = 'today';
            else if (overdueTasks.length > 0) this.agendaTab = 'overdue';
            else if (upcomingTasks.length > 0) this.agendaTab = 'upcoming';
            else this.agendaTab = 'inbox';
        }

        let shownTasks = [];
        if (this.agendaTab === 'today') shownTasks = todayTasks;
        else if (this.agendaTab === 'overdue') shownTasks = overdueTasks;
        else if (this.agendaTab === 'upcoming') shownTasks = upcomingTasks;
        else shownTasks = inboxTasks;

        agenda.innerHTML = `
            <div class="os-agenda-header">
                <h2>Agenda & Tasks</h2>
                <a class="os-view-all">All tasks ↗</a>
            </div>
            <div class="os-agenda-tabs">
                <span class="os-agenda-tab ${this.agendaTab === 'today' ? 'active' : ''} tab-today">Today (${todayTasks.length})</span>
                <span class="os-agenda-tab ${this.agendaTab === 'overdue' ? 'active' : ''} tab-overdue">Overdue (${overdueTasks.length})</span>
                <span class="os-agenda-tab ${this.agendaTab === 'upcoming' ? 'active' : ''} tab-upcoming">Next 7d (${upcomingTasks.length})</span>
                <span class="os-agenda-tab ${this.agendaTab === 'inbox' ? 'active' : ''} tab-inbox">Inbox (${inboxTasks.length})</span>
            </div>
            <div class="os-agenda-content"></div>
            <div class="os-agenda-footer">
                <a class="link-capture">+ Capture Task</a>
                <a class="link-notes">View Journal ↗</a>
            </div>
        `;

        agenda.querySelector('.os-view-all').addEventListener('click', () => {
            this.openCollection(this.collectionGuid('Projects'), panel);
        });

        const agendaContent = agenda.querySelector('.os-agenda-content');
        if (shownTasks.length === 0) {
            agendaContent.innerHTML = `
                <div class="os-empty-state">
                    <div class="os-empty-icon">✓</div>
                    <div class="os-empty-title">No tasks in this section</div>
                    <div class="os-empty-desc">You are all caught up! Use quick capture above to add new tasks.</div>
                </div>
            `;
        } else {
            for (const t of shownTasks.slice(0, 25)) {
                const item = document.createElement('div');
                item.className = 'os-task-item';
                item.innerHTML = `
                    <input type="checkbox" class="os-task-checkbox" />
                    <span class="os-task-label" title="${escapeHtml(t.text)}">${escapeHtml(t.text)}</span>
                    ${t.date ? `<span class="os-task-date">${t.date}</span>` : ''}
                `;

                const chk = item.querySelector('.os-task-checkbox');
                chk.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    chk.disabled = true;
                    item.style.opacity = '0.35';
                    item.querySelector('.os-task-label').style.textDecoration = 'line-through';
                    if (t.lineItem && typeof t.lineItem.setTaskStatus === 'function') {
                        try {
                            await t.lineItem.setTaskStatus('done');
                            this.ui.addToaster({ title: 'Task completed', autoDestroyTime: 2000, dismissible: true });
                        } catch (err) {
                            console.error('Task done error:', err);
                        }
                    }
                    this.scheduleRefresh();
                });

                item.addEventListener('click', () => {
                    this.openItem(t.guid, t.recordGuid, panel);
                });

                agendaContent.appendChild(item);
            }
        }

        agenda.querySelector('.tab-today').addEventListener('click', () => { this.agendaTab = 'today'; this.agendaTabSetByUser = true; this.render(panel); });
        agenda.querySelector('.tab-overdue').addEventListener('click', () => { this.agendaTab = 'overdue'; this.agendaTabSetByUser = true; this.render(panel); });
        agenda.querySelector('.tab-upcoming').addEventListener('click', () => { this.agendaTab = 'upcoming'; this.agendaTabSetByUser = true; this.render(panel); });
        agenda.querySelector('.tab-inbox').addEventListener('click', () => { this.agendaTab = 'inbox'; this.agendaTabSetByUser = true; this.render(panel); });
        agenda.querySelector('.link-capture').addEventListener('click', () => captureInput.focus());
        agenda.querySelector('.link-notes').addEventListener('click', () => this.openJournal(panel));

        grid.appendChild(agenda);
        app.appendChild(grid);

        container.innerHTML = '';
        const viewport = document.createElement('div');
        viewport.className = 'os-app';
        viewport.appendChild(app);
        container.appendChild(viewport);
    }

    renderCards(cardsContainer, data, panel) {
        cardsContainer.innerHTML = '';
        const q = (this.searchQuery || '').toLowerCase();

        if (this.currentTab === 'projects') {
            let list = data.projects;
            if (this.projectFilter !== 'all') {
                list = list.filter(p => p.status === this.projectFilter);
            }
            if (q) {
                list = list.filter(p => p.name.toLowerCase().includes(q) || (p.clientName && p.clientName.toLowerCase().includes(q)));
            }

            if (list.length === 0) {
                cardsContainer.innerHTML = '<div class="os-empty-placeholder">No matching projects found.</div>';
                return;
            }

            for (const proj of list.slice(0, 30)) {
                const card = document.createElement('div');
                card.className = 'os-project-card';
                const isDone = proj.status === 'completed';
                const isInProg = proj.status === 'in_progress';
                const statusLabel = isInProg ? 'In Progress' : (isDone ? 'Completed' : (proj.status === 'in_review' ? 'In Review' : 'Backlog'));
                const hasDeliverables = proj.deliverables && proj.deliverables.length > 0;
                const isExpanded = this.expandedProjects && this.expandedProjects.has(proj.guid);

                card.innerHTML = `
                    <div class="os-card-top">
                        <span class="os-badge status-${proj.status}" title="Click to cycle status">${statusLabel}</span>
                        ${proj.priority === 'high' ? '<span class="os-badge priority-high">High</span>' : ''}
                    </div>
                    <div class="os-card-title">${proj.name}</div>
                    ${proj.clientName ? `<div class="os-card-client">${proj.clientName}</div>` : ''}

                    ${hasDeliverables ? `
                        <div class="os-card-deliverables-summary">
                            <span class="os-deliverables-count" title="${proj.deliverables.length} sub-pages & deliverables">
                                📂 ${proj.deliverables.length} deliverables
                            </span>
                            <button class="os-toggle-deliverables" type="button">
                                ${isExpanded ? 'Hide ▲' : 'Show ▼'}
                            </button>
                        </div>
                        ${isExpanded ? `
                            <div class="os-deliverables-list">
                                ${proj.deliverables.map(d => `
                                    <div class="os-deliverable-item" data-guid="${d.guid}" title="${d.name}">
                                        <span class="os-deliverable-arrow">↳</span>
                                        <span class="os-deliverable-name">${d.name}</span>
                                        <span class="os-deliverable-open">↗</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    ` : ''}

                    <div class="os-card-bottom">
                        <span>📅 ${(!proj.deadline || typeof proj.deadline === 'object' || String(proj.deadline).includes('Object')) ? 'No deadline' : proj.deadline}</span>
                        <span class="os-card-open">Open note ↗</span>
                    </div>
                `;

                // Quick status toggle
                card.querySelector('.os-badge').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const nextStatus = proj.status === 'in_progress' ? 'completed' : (proj.status === 'completed' ? 'backlog' : 'in_progress');
                    try {
                        if (proj.record?.prop('status')?.setValue) {
                            await proj.record.prop('status').setValue(nextStatus);
                            this.ui.addToaster({ title: `Status: ${nextStatus}`, autoDestroyTime: 2000, dismissible: true });
                            this.scheduleRefresh();
                        }
                    } catch (err) {
                        console.error('Status change error:', err);
                    }
                });

                // Toggle deliverables expander
                if (hasDeliverables) {
                    const toggleBtn = card.querySelector('.os-toggle-deliverables');
                    if (toggleBtn) {
                        toggleBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (this.expandedProjects.has(proj.guid)) {
                                this.expandedProjects.delete(proj.guid);
                            } else {
                                this.expandedProjects.add(proj.guid);
                            }
                            this.render(panel);
                        });
                    }

                    // Click deliverable item
                    card.querySelectorAll('.os-deliverable-item').forEach(el => {
                        el.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const g = el.getAttribute('data-guid');
                            if (g) this.openRecord(g, panel);
                        });
                    });
                }

                card.querySelector('.os-card-title').addEventListener('click', () => this.openRecord(proj.guid, panel));
                card.querySelector('.os-card-open').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openRecord(proj.guid, panel);
                });

                cardsContainer.appendChild(card);
            }
        } else if (this.currentTab === 'clients') {
            let list = data.clients;
            if (q) {
                list = list.filter(c => c.name.toLowerCase().includes(q) || c.plan.toLowerCase().includes(q));
            }

            if (list.length === 0) {
                cardsContainer.innerHTML = '<div class="os-empty-placeholder">No matching clients found.</div>';
                return;
            }

            for (const cli of list) {
                const card = document.createElement('div');
                card.className = 'os-project-card';
                card.innerHTML = `
                    <div class="os-card-top">
                        <span class="os-badge status-${cli.status === 'prospect' ? 'backlog' : 'in_progress'}">${cli.status.toUpperCase()}</span>
                        ${cli.mrr > 0 && cli.status === 'active' ? '<span class="os-badge badge-care-plan">🛡 Care Plan</span>' : ''}
                    </div>
                    <div class="os-card-title">${escapeHtml(cli.name)}</div>
                    <div class="os-card-client">${escapeHtml(cli.plan)}</div>
                    <div class="os-client-meta">
                        <span class="os-meta-tag">${cli.summary.activeProjects} active projects</span>
                        <span class="os-meta-tag">🧾 ${cli.invoiceCount || 0} invoices</span>
                    </div>
                    <dl class="os-client-value">
                        <div><dt>Collected · all time</dt><dd>${money(cli.summary.collected)} CHF</dd></div>
                        <div><dt>Outstanding</dt><dd>${money(cli.summary.outstanding)} CHF${cli.summary.overdueCount ? ` · ${cli.summary.overdueCount} overdue` : ''}</dd></div>
                    </dl>
                    <div class="os-card-bottom">
                        <span>${cli.mrr > 0 ? `${cli.status === 'active' ? '' : 'Proposed · '}${money(cli.mrr)} CHF / mo` : 'No care plan'}</span>
                        <span class="os-card-open">Open profile ↗</span>
                    </div>
                `;

                card.querySelector('.os-card-title').addEventListener('click', () => this.openRecord(cli.guid, panel));
                card.querySelector('.os-card-open').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openRecord(cli.guid, panel);
                });

                cardsContainer.appendChild(card);
            }
        } else if (this.currentTab === 'invoices') {
            let list = data.invoices.filter(i => invoiceMatches(i, this.invoiceFilter));
            if (q) {
                list = list.filter(i => i.name.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q));
            }

            if (list.length === 0) {
                cardsContainer.innerHTML = '<div class="os-empty-placeholder">No invoices in this view. Choose All or clear the search to see more.</div>';
                return;
            }

            for (const inv of list) {
                const card = document.createElement('div');
                card.className = 'os-project-card os-invoice-card';
                card.innerHTML = `
                    <div class="os-card-top">
                        <span class="os-badge status-${escapeHtml(inv.status)}">${escapeHtml(inv.status.toUpperCase())}</span>
                        <span class="os-invoice-timing ${inv.daysOverdue ? 'os-cash-warning' : ''}">${inv.daysOverdue ? `${inv.daysOverdue}d overdue` : escapeHtml(inv.stage)}</span>
                    </div>
                    <div class="os-card-title">${escapeHtml(inv.name)}</div>
                    ${inv.clientName ? `<div class="os-card-client">${escapeHtml(inv.clientName)}</div>` : ''}
                    <div class="os-card-bottom">
                        <span>${money(inv.amount)} ${escapeHtml(inv.currency)} · ${inv.dueDate || 'No due date'}</span>
                        <span class="os-card-open">Open invoice ↗</span>
                    </div>
                `;

                card.querySelector('.os-card-title').addEventListener('click', () => this.openRecord(inv.guid, panel));
                card.querySelector('.os-card-open').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openRecord(inv.guid, panel);
                });

                cardsContainer.appendChild(card);
            }
        }
    }
}
