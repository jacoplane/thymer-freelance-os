const invoiceColumns = ['title', 'amount_chf', 'payment_status', 'due', 'client', 'currency', 'status', 'issued'];
const sentOutstanding = '@Invoices.status = "sent" @Invoices.payment_status != "paid"';
const topLevel = '@Projects.parent_page = ""';
const openProjects = '@Projects.status != "completed" @Projects.status != "archived" @Projects.status != "cancelled"';
const projectColumns = ['title', 'status', 'priority', 'deadline', 'client'];
const clientColumns = ['title', 'status', 'lead_stage', 'contact', 'email', 'phone', 'website', 'plan', 'monthly_chf', 'billing_cycle'];
export const VIEW_PLANS = {
    Invoices: [
        { key: 'register', label: 'Register', aliases: ['Register'], columns: invoiceColumns, query: '', sort: 'issued', direction: 'desc', icon: 'ti-table' },
        { key: 'outstanding', label: 'Outstanding', aliases: ['Unpaid'], columns: invoiceColumns, query: sentOutstanding, sort: 'due' },
        { key: 'overdue', label: 'Overdue', columns: invoiceColumns, query: `${sentOutstanding} @Invoices.due < "today"`, sort: 'due' },
        { key: 'review', label: 'To confirm', columns: invoiceColumns, query: '@Invoices.payment_status = "unconfirmed"', sort: 'due' },
        { key: 'to-send', label: 'To send', columns: invoiceColumns, query: '(@Invoices.status = "draft" OR @Invoices.status = "ready")', sort: 'issued' },
        { key: 'paid', label: 'Paid', columns: invoiceColumns, query: '@Invoices.payment_status = "paid"', sort: 'paid_date', direction: 'desc' }
    ],
    Projects: [
        { key: 'register', label: 'Register', aliases: ['Table'], columns: projectColumns, query: topLevel, sort: 'title', icon: 'ti-table' },
        { key: 'board', label: 'Board', type: 'board', columns: ['title', 'priority', 'deadline', 'client'], group: 'status', query: `${topLevel} ${openProjects}`, sort: 'priority', icon: 'ti-layout-kanban' },
        { key: 'active', label: 'Active', columns: projectColumns, query: `${topLevel} (@Projects.status = "in_progress" OR @Projects.status = "in_review")`, sort: 'deadline' },
        { key: 'deadlines', label: 'Due dates', columns: ['title', 'deadline', 'status', 'priority', 'client'], query: `${topLevel} ${openProjects} @Projects.deadline != ""`, sort: 'deadline', icon: 'ti-calendar-event' },
        { key: 'overdue', label: 'Overdue', columns: projectColumns, query: `${topLevel} ${openProjects} @Projects.deadline < "today"`, sort: 'deadline' }
    ],
    Clients: [
        { key: 'directory', label: 'Directory', columns: clientColumns, query: '', sort: 'title', icon: 'ti-table' },
        { key: 'active', label: 'Active', columns: clientColumns, query: '@Clients.status = "active"', sort: 'title' },
        { key: 'prospects', label: 'Leads', aliases: ['Prospects'], columns: ['title', 'lead_stage', 'contact', 'email', 'phone', 'website'], query: '@Clients.status = "prospect"', sort: 'title' },
        { key: 'archived', label: 'Archived', columns: clientColumns, query: '@Clients.status = "archived"', sort: 'title' },
        { key: 'care-plans', label: 'Care plans', columns: ['title', 'monthly_chf', 'plan', 'billing_cycle', 'included_hours'], query: '@Clients.status = "active" @Clients.monthly_chf > 0', sort: 'monthly_chf', direction: 'desc' }
    ],
    'Support Sessions': [
        { key: 'register', label: 'Register', columns: ['title', 'date', 'client', 'project', 'hours', 'description'], query: '', sort: 'date', direction: 'desc', icon: 'ti-table' }
    ]
};

// Merge only view presentation. Field definitions, formulas and unrelated views stay intact.
export function planCollectionViews(collection, config) {
    if (!VIEW_PLANS[collection]) throw new Error(`No view plan for ${collection}`);
    const next = structuredClone(config);
    const fields = new Map(config.fields.map(field => [field.label, field.id]));
    fields.set('title', 'title');
    const fieldId = label => {
        if (!fields.has(label)) throw new Error(`Missing ${collection} field: ${label}`);
        return fields.get(label);
    };
    const planned = VIEW_PLANS[collection].map(definition => {
        const id = `fos${collection.toLowerCase()}${definition.key.replace(/[^a-z0-9]/g, '')}`;
        const existing = config.views.find(view => view.id === id || view.label === definition.label || definition.aliases?.includes(view.label));
        return {
            ...existing,
            id: existing?.id || id,
            label: definition.label,
            type: definition.type || 'table', icon: definition.icon || 'ti-filter', shown: true, read_only: false,
            description: `Freelance OS: ${definition.label.toLowerCase()}.`,
            field_ids: definition.columns.map(fieldId),
            sort_field_id: fieldId(definition.sort), sort_dir: definition.direction || 'asc',
            group_by_field_id: definition.group ? fieldId(definition.group) : null, query: definition.query,
            invalid_query: ''
        };
    });
    const ids = new Set(planned.map(view => view.id));
    next.views = [...planned, ...config.views.filter(view => !ids.has(view.id))];
    return next;
}
