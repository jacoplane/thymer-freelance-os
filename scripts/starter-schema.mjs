import { createHash } from 'node:crypto';
import { planCollectionViews, VIEW_PLANS } from './collection-view-plan.mjs';

const definitions = {
    Clients: { icon: 'ti-users', description: 'Client relationships and recurring care plans', fields: {
        status: ['choice', ['prospect', 'active', 'archived']], plan: ['text'], monthly_chf: ['number'],
        billing_cycle: ['choice', ['Monthly', 'Annual', 'Project']], included_hours: ['number'], contact: ['text'], website: ['url']
    } },
    Projects: { icon: 'ti-stack-2', description: 'Projects, deliverables and native tasks', fields: {
        status: ['choice', ['backlog', 'in_progress', 'in_review', 'completed', 'archived', 'cancelled']],
        priority: ['choice', ['high', 'medium', 'low']], deadline: ['datetime'], completed_date: ['datetime'], client: ['record']
    } },
    Invoices: { icon: 'ti-receipt', description: 'Invoice register and payment tracking', fields: {
        invoice_id: ['text'], client: ['record'], amount_chf: ['number'], currency: ['choice', ['CHF', 'EUR', 'USD']],
        issued: ['datetime'], due: ['datetime'], paid_date: ['datetime'], status: ['choice', ['draft', 'ready', 'sent']],
        payment_status: ['choice', ['unpaid', 'unconfirmed', 'paid']], pdf: ['file']
    } },
    Library: { icon: 'ti-books', description: 'Care plan descriptions, reference notes and templates', fields: {
        type: ['choice', ['note', 'care-plan', 'template']], status: ['text'], source: ['url']
    } },
    Journal: { icon: 'ti-notebook', description: 'Daily inbox and weekly reviews', fields: {} }
};
export const STARTER_ROLES = Object.keys(definitions);
const idFor = (prefix, key) => prefix + createHash('sha256').update(`freelance-os:${key}`).digest('hex').slice(0, 14).toUpperCase();

export function starterConfig(role, current = {}, links = {}) {
    const definition = definitions[role];
    if (!definition) throw new Error(`Unknown starter collection: ${role}`);
    const config = structuredClone(current);
    config.ver ??= 1; config.name ??= role; config.icon ??= definition.icon;
    config.description ??= definition.description; config.item_name ??= 'Page';
    config.show_sidebar_items ??= true; config.show_cmdpal_items ??= true;
    config.fields ??= []; config.views ??= []; config.page_field_ids ??= [];
    if (role !== 'Journal' && !config.fields.some(field => field.id === 'parent_page')) config.fields.push({ id: 'parent_page', label: 'Sub-page of', type: 'record', icon: 'ti-list-tree', active: true, many: false, read_only: false, ...(links[role] ? {filter_colguid: links[role]} : {}) });
    for (const [label, [type, choices]] of Object.entries(definition.fields)) {
        const existing = config.fields.find(field => field.label === label);
        if (existing) {
            if (existing.type !== type) throw new Error(`${role}.${label} must be ${type}; found ${existing.type}. No existing field was replaced.`);
            if (choices?.some(choice => !existing.choices?.some(value => value.label === choice && value.active !== false))) throw new Error(`${role}.${label} is missing required choice labels. Add ${choices.join(', ')} before running setup.`);
            if (label === 'client' && links.Clients) existing.filter_colguid = links.Clients;
            continue;
        }
        const field = { id: idFor('f', `${role}.${label}`), label, type, active: true, many: false, read_only: false };
        if (choices) field.choices = choices.map((choice, index) => ({id: idFor('c', `${role}.${label}.${choice}`), label: choice, color: ['gray','blue','green','orange','purple','red'][index % 6], icon: '', active: true}));
        if (label === 'client' && links.Clients) field.filter_colguid = links.Clients;
        config.fields.push(field);
    }
    if (!config.views.length) config.views.push({id:'list',label:'List',type:'list',shown:true,read_only:false,field_ids:['title'],sort_field_id:'title',sort_dir:'asc'});
    return VIEW_PLANS[role] ? planCollectionViews(role, config) : config;
}
