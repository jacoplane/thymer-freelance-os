const invoiceColumns = ['title', 'client', 'amount_chf', 'currency', 'payment_status', 'due', 'status', 'issued'];
const sentOutstanding = '@Invoices.status = "sent" @Invoices.payment_status != "paid"';
export const VIEW_PLANS = {
    Invoices: [
        { key: 'register', label: 'Register', aliases: ['Register'], columns: invoiceColumns, query: '', sort: 'issued', direction: 'desc', icon: 'ti-table' },
        { key: 'outstanding', label: 'Outstanding', aliases: ['Unpaid'], columns: invoiceColumns, query: sentOutstanding, sort: 'due' },
        { key: 'overdue', label: 'Overdue', columns: invoiceColumns, query: `${sentOutstanding} @Invoices.due < "today"`, sort: 'due' },
        { key: 'review', label: 'To confirm', columns: invoiceColumns, query: '@Invoices.payment_status = "unconfirmed"', sort: 'due' },
        { key: 'to-send', label: 'To send', columns: invoiceColumns, query: '(@Invoices.status = "draft" OR @Invoices.status = "ready")', sort: 'issued' },
        { key: 'paid', label: 'Paid', columns: invoiceColumns, query: '@Invoices.payment_status = "paid"', sort: 'paid_date', direction: 'desc' }
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
            type: 'table', icon: definition.icon || 'ti-filter', shown: true, read_only: false,
            description: `Freelance OS: ${definition.label.toLowerCase()}.`,
            field_ids: definition.columns.map(fieldId),
            sort_field_id: fieldId(definition.sort), sort_dir: definition.direction || 'asc',
            group_by_field_id: null, query: definition.query,
            invalid_query: ''
        };
    });
    const ids = new Set(planned.map(view => view.id));
    next.views = [...planned, ...config.views.filter(view => !ids.has(view.id))];
    return next;
}
