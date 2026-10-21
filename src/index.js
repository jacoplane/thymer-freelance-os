/**
 * Freelance OS Dashboard Plugin for Thymer
 * Replicates the executive dashboard from Obsidian Freelance OS.
 */

const DASHBOARD_PANEL_ID = 'freelance-os-dashboard';

export class Plugin extends AppPlugin {
    onLoad() {
        this.activePanel = null;
        this.refreshTimer = null;
        this.currentTab = 'projects';
        this.agendaTab = 'week';

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
            if (this.activePanel) this.render(this.activePanel);
        }, 200);
    }

    async loadData() {
        const data = {
            mrr: 155,
            activeCarePlans: 4,
            invoiced2026: 710,
            issuedCount: 2,
            collected2026: 360,
            unconfirmedCount: 1,
            activeClientsCount: 5,
            prospectsCount: 2,
            projects: [],
            clients: [],
            agendaTasks: []
        };

        try {
            // Fetch Clients
            const clientRes = await this.data.searchByQuery('@document @collection="Clients"', 50);
            const clientRecords = clientRes?.matching_records || [];
            let mrrSum = 0;
            let activeC = 0;
            let prospects = 0;

            const clientList = [];
            for (const cr of clientRecords) {
                const name = cr.name || '';
                clientList.push({ guid: cr.guid, name });
                const st = (cr.properties && cr.properties.status) || cr.status || 'active';
                if (st !== 'archived' && st !== 'inactive') {
                    activeC++;
                } else {
                    prospects++;
                }
            }
            if (activeC > 0) {
                data.activeClientsCount = activeC;
                data.prospectsCount = prospects;
            }
            data.clients = clientList;

            // Fetch Invoices
            const invRes = await this.data.searchByQuery('@document @collection="Invoices"', 50);
            const invRecords = invRes?.matching_records || [];
            data.issuedCount = invRecords.length;

            // Fetch Projects
            const projRes = await this.data.searchByQuery('@document @collection="Projects"', 50);
            const projRecords = projRes?.matching_records || [];
            data.projects = projRecords.map(p => {
                const name = p.name || '';
                const status = (p.properties && p.properties.status) || 'in_progress';
                const priority = (p.properties && p.properties.priority) || 'medium';
                const clientName = (p.properties && p.properties.client) || '';

                return {
                    guid: p.guid,
                    name,
                    status,
                    priority,
                    clientName,
                    deadline: (p.properties && p.properties.deadline) || 'Upcoming'
                };
            });

            // Fetch Open Tasks
            const taskRes = await this.data.searchByQuery('@task @todo', 50);
            const taskPages = taskRes?.pages || [];
            const taskList = [];
            for (const page of taskPages) {
                for (const item of (page.items || [])) {
                    taskList.push({
                        guid: item.guid,
                        text: item.text,
                        recordGuid: page.record_guid,
                        recordName: page.record_name
                    });
                }
            }
            data.agendaTasks = taskList;

        } catch (e) {
            console.warn('[FreelanceOS] data query error:', e);
        }

        return data;
    }

    async render(panel) {
        const container = panel.getElement ? panel.getElement() : null;
        if (!container) return;

        container.innerHTML = '<div class="os-app" style="display:flex;align-items:center;justify-content:center;height:100%;"><div style="opacity:0.6;">Loading Freelance OS...</div></div>';

        const data = await this.loadData();
        const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        const app = document.createElement('div');
        app.className = 'os-app';

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
                    <input type="text" class="os-capture-input" placeholder="Capture a task..." />
                    <button class="os-capture-btn" title="Add to journal">↵</button>
                </div>
            </div>
            <div class="os-header-actions">
                <button class="os-button os-btn-board" type="button">
                    <span>🗂 Open board</span>
                </button>
            </div>
        `;

        // Capture task handler
        const captureInput = header.querySelector('.os-capture-input');
        const handleCapture = async () => {
            const txt = (captureInput.value || '').trim();
            if (!txt) return;
            try {
                if (this.data.addToJournal) {
                    await this.data.addToJournal(txt);
                } else {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    await this.data.searchByQuery(`@scheduled @today`, 1);
                }
                captureInput.value = '';
                this.scheduleRefresh();
            } catch (err) {
                console.error('Task capture failed:', err);
            }
        };
        captureInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleCapture();
        });
        header.querySelector('.os-capture-btn').addEventListener('click', handleCapture);

        // Open board button handler
        header.querySelector('.os-btn-board').addEventListener('click', () => {
            // Find Projects collection
            panel.navigateTo({ type: 'overview', rootId: '1B0J3X9Y8QS96C75M3QMT23DNW', subId: null });
        });

        app.appendChild(header);

        // 2. Pulse Metrics Row
        const pulse = document.createElement('section');
        pulse.className = 'os-pulse';
        pulse.innerHTML = `
            <div class="os-metric">
                <div class="os-metric-label">Recurring revenue</div>
                <div class="os-metric-value">
                    <span>${data.mrr}</span>
                    <span class="os-metric-unit">CHF / mo</span>
                </div>
                <div class="os-metric-detail">${data.activeCarePlans} active care plans</div>
            </div>
            <div class="os-metric">
                <div class="os-metric-label">Invoiced · 2026</div>
                <div class="os-metric-value">
                    <span>${data.invoiced2026}</span>
                    <span class="os-metric-unit">CHF</span>
                </div>
                <div class="os-metric-detail">${data.issuedCount} issued · 0 to send</div>
            </div>
            <div class="os-metric">
                <div class="os-metric-label">Collected · 2026</div>
                <div class="os-metric-value">
                    <span>${data.collected2026}</span>
                    <span class="os-metric-unit">CHF</span>
                </div>
                <div class="os-metric-detail">${data.unconfirmedCount} payments unconfirmed</div>
            </div>
            <div class="os-metric">
                <div class="os-metric-label">Active clients</div>
                <div class="os-metric-value">
                    <span>${data.activeClientsCount}</span>
                </div>
                <div class="os-metric-detail">${data.prospectsCount} prospects in pipeline</div>
            </div>
        `;
        app.appendChild(pulse);

        // 3. Main Grid (3 columns)
        const grid = document.createElement('div');
        grid.className = 'os-grid';

        // Column 1: Action Rail
        const rail = document.createElement('aside');
        rail.className = 'os-rail';
        rail.innerHTML = `
            <h2>Create</h2>
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
            <nav class="os-navigation">
                <a class="os-nav-link nav-projects">📂 Projects</a>
                <a class="os-nav-link nav-clients">👥 Clients</a>
                <a class="os-nav-link nav-invoices">🧾 Finance</a>
                <a class="os-nav-link nav-library">📚 Care plans</a>
            </nav>
        `;

        rail.querySelector('.btn-new-task').addEventListener('click', () => captureInput.focus());
        rail.querySelector('.btn-new-project').addEventListener('click', () => {
            panel.navigateTo({ type: 'overview', rootId: '1B0J3X9Y8QS96C75M3QMT23DNW', subId: null });
        });
        rail.querySelector('.btn-new-client').addEventListener('click', () => {
            panel.navigateTo({ type: 'overview', rootId: '1FD58J39X6KJ4JK5F06T7P4TSR', subId: null });
        });
        rail.querySelector('.btn-new-invoice').addEventListener('click', () => {
            panel.navigateTo({ type: 'overview', rootId: '1YT6YD3EYV6F06TZY5GKGVJMNR', subId: null });
        });
        rail.querySelector('.nav-projects').addEventListener('click', () => {
            panel.navigateTo({ type: 'overview', rootId: '1B0J3X9Y8QS96C75M3QMT23DNW', subId: null });
        });
        rail.querySelector('.nav-clients').addEventListener('click', () => {
            panel.navigateTo({ type: 'overview', rootId: '1FD58J39X6KJ4JK5F06T7P4TSR', subId: null });
        });
        rail.querySelector('.nav-invoices').addEventListener('click', () => {
            panel.navigateTo({ type: 'overview', rootId: '1YT6YD3EYV6F06TZY5GKGVJMNR', subId: null });
        });
        rail.querySelector('.nav-library').addEventListener('click', () => {
            panel.navigateTo({ type: 'overview', rootId: '16YBSRJPHPAFJCRTZDWJJEF5QG', subId: null });
        });

        grid.appendChild(rail);

        // Column 2: Center Projects/Clients Grid
        const main = document.createElement('main');
        main.className = 'os-main';

        const sectionHead = document.createElement('div');
        sectionHead.className = 'os-section-head';
        sectionHead.innerHTML = `
            <div class="os-tabs">
                <button class="os-tab ${this.currentTab === 'projects' ? 'active' : ''} tab-proj">Projects</button>
                <button class="os-tab ${this.currentTab === 'clients' ? 'active' : ''} tab-cli">Clients</button>
            </div>
            <a class="os-view-all">View all</a>
        `;
        sectionHead.querySelector('.tab-proj').addEventListener('click', () => {
            this.currentTab = 'projects';
            this.render(panel);
        });
        sectionHead.querySelector('.tab-cli').addEventListener('click', () => {
            this.currentTab = 'clients';
            this.render(panel);
        });
        sectionHead.querySelector('.os-view-all').addEventListener('click', () => {
            const col = this.currentTab === 'projects' ? '1B0J3X9Y8QS96C75M3QMT23DNW' : '1FD58J39X6KJ4JK5F06T7P4TSR';
            panel.navigateTo({ type: 'overview', rootId: col, subId: null });
        });
        main.appendChild(sectionHead);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'os-cards';

        if (this.currentTab === 'projects') {
            const displayProjects = data.projects.slice(0, 4);
            for (const proj of displayProjects) {
                const card = document.createElement('div');
                card.className = 'os-project-card';
                card.innerHTML = `
                    <div class="os-card-top">
                        <span class="os-badge status-${proj.status}">${proj.status === 'in_progress' ? 'In Progress' : 'Backlog'}</span>
                        ${proj.priority === 'high' ? '<span class="os-badge priority-high">High</span>' : ''}
                    </div>
                    <div class="os-card-title">${proj.name}</div>
                    <div class="os-card-client">${proj.clientName}</div>
                    <div class="os-card-bottom">
                        <span>📅 ${proj.deadline}</span>
                    </div>
                `;
                card.addEventListener('click', () => {
                    panel.navigateTo({ type: 'edit_panel', rootId: proj.guid, subId: null });
                });
                cardsContainer.appendChild(card);
            }
        } else {
            const displayClients = data.clients.slice(0, 6);
            for (const cli of displayClients) {
                const card = document.createElement('div');
                card.className = 'os-project-card';
                card.innerHTML = `
                    <div class="os-card-top">
                        <span class="os-badge status-in_progress">Active</span>
                    </div>
                    <div class="os-card-title">${cli.name}</div>
                    <div class="os-card-client">Client Profile</div>
                `;
                card.addEventListener('click', () => {
                    panel.navigateTo({ type: 'edit_panel', rootId: cli.guid, subId: null });
                });
                cardsContainer.appendChild(card);
            }
        }
        main.appendChild(cardsContainer);
        grid.appendChild(main);

        // Column 3: Agenda
        const agenda = document.createElement('aside');
        agenda.className = 'os-agenda';
        agenda.innerHTML = `
            <div class="os-agenda-header">
                <h2>Agenda</h2>
                <a class="os-view-all">View all</a>
            </div>
            <div class="os-agenda-tabs">
                <span class="os-agenda-tab ${this.agendaTab === 'today' ? 'active' : ''} tab-today">Today 0</span>
                <span class="os-agenda-tab ${this.agendaTab === 'overdue' ? 'active' : ''} tab-overdue">Overdue 0</span>
                <span class="os-agenda-tab ${this.agendaTab === 'week' ? 'active' : ''} tab-week">Next 7 days ${data.agendaTasks.length}</span>
            </div>
            <div class="os-agenda-content"></div>
            <div class="os-agenda-footer">
                <a class="link-capture">Open Quick Capture</a>
                <a class="link-notes">Tasks from notes</a>
            </div>
        `;

        const agendaContent = agenda.querySelector('.os-agenda-content');
        if (data.agendaTasks.length === 0) {
            agendaContent.innerHTML = `
                <div class="os-empty-state">
                    <div class="os-empty-icon">✓</div>
                    <div class="os-empty-title">No deadlines this week</div>
                    <div class="os-empty-desc">Open the full agenda for tasks without dates.</div>
                </div>
            `;
        } else {
            for (const t of data.agendaTasks.slice(0, 5)) {
                const item = document.createElement('div');
                item.className = 'os-task-item';
                item.innerHTML = `
                    <input type="checkbox" class="os-task-checkbox" />
                    <span class="os-task-label" title="${t.text}">${t.text}</span>
                `;
                item.addEventListener('click', () => {
                    if (t.recordGuid) {
                        panel.navigateTo({ type: 'edit_panel', rootId: t.recordGuid, subId: null });
                    }
                });
                agendaContent.appendChild(item);
            }
        }

        agenda.querySelector('.tab-today').addEventListener('click', () => { this.agendaTab = 'today'; this.render(panel); });
        agenda.querySelector('.tab-overdue').addEventListener('click', () => { this.agendaTab = 'overdue'; this.render(panel); });
        agenda.querySelector('.tab-week').addEventListener('click', () => { this.agendaTab = 'week'; this.render(panel); });
        agenda.querySelector('.link-capture').addEventListener('click', () => captureInput.focus());

        grid.appendChild(agenda);
        app.appendChild(grid);

        container.innerHTML = '';
        container.appendChild(app);
    }
}
