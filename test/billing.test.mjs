import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { starterConfig } from '../scripts/starter-schema.mjs';

const source = ['support-time.js', 'workflow.js', 'billing.js', 'index.js'].map(file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')).join('\n');
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; Object.assign(Plugin.prototype, Workflow, Billing); ({ Plugin, billingNextAction, billingInvoices, billingSummary, localDate });`, { AppPlugin: class {}, console, Date, Intl, DateTime: { dateOnly: (year, month, day) => ({ value: () => ({ d: `${year}${String(month + 1).padStart(2, '0')}${String(day).padStart(2, '0')}` }) }) } });
const clientGuid = '1FD58J39X6KJ4JK5F06T7P4TSR';

function fixture(overrides = {}) {
    const stored = { status: 'sent', payment_status: 'unpaid', amount_chf: 250, currency: 'CHF', client: clientGuid, issued: '2020-01-01', paid_date: '', ...overrides };
    const writes = [], config = starterConfig('Invoices');
    const read = label => (record.readSnapshot || stored)[label];
    const record = { guid: 'invoice', getName: () => 'INV-001', trash: () => { record.trashed = true; return true; }, prop: label => ({ text: () => typeof read(label) === 'string' ? read(label) : '', number: () => typeof read(label) === 'number' ? read(label) : null, date: () => typeof read(label) === 'object' ? read(label) : null, linkedRecord: () => label === 'client' ? { guid: read(label) } : null, set: value => { writes.push([label, value]); if (record.reject === label) return false; stored[label] = value; return true; }, setChoice: value => { writes.push([label, value]); if (record.reject === label) return false; stored[label] = value; return true; } }) };
    const collection = { getGuid: () => 'invoices', getName: () => 'Invoices', getAllRecords: async () => [record], getConfiguration: () => config };
    const clients = { getGuid: () => 'clients', getName: () => 'Clients', getAllRecords: async () => [{ guid: clientGuid, getName: () => 'Example client' }] };
    const plugin = new api.Plugin(); plugin.data = { getAllCollections: async () => [collection, clients] };
    const invoice = { guid: 'invoice', invoiceId: 'INV-001', name: 'INV-001', stage: stored.status, status: stored.payment_status, amount: stored.amount_chf, currency: stored.currency, clientGuid: stored.client, issuedDate: stored.issued, paidDate: stored.paid_date };
    return { plugin, stored, writes, record, collection, config, invoice };
}

test('billing actions keep sending and payment separate and never offer settlement for drafts or paid records', () => {
    assert.equal(api.billingNextAction({ stage: 'draft', status: 'unpaid' }).action, 'ready');
    assert.equal(api.billingNextAction({ stage: 'ready', status: 'unpaid' }).action, 'sent');
    assert.equal(api.billingNextAction({ stage: 'sent', status: 'unconfirmed', issuedDate: '2020-01-01' }).action, 'paid');
    assert.equal(api.billingNextAction({ stage: 'sent', status: 'unpaid' }).action, 'sent');
    assert.equal(api.billingNextAction({ stage: 'sent', status: 'paid' }), null);
    assert.equal(api.billingNextAction({ stage: 'unknown', status: 'unpaid' }), null);
});

test('currency totals stay in CHF while invoice counts cover all currencies', () => {
    const summary = api.billingSummary([{ amount: 250, currency: 'CHF', stage: 'sent', status: 'unpaid', isOutstanding: true, daysOverdue: 2 }, { amount: 500, currency: 'EUR', stage: 'sent', status: 'unconfirmed', isOutstanding: true, daysOverdue: 5 }]);
    assert.equal(summary.outstanding, 250); assert.equal(summary.overdue, 250);
    assert.equal(summary.overdueCount, 2); assert.equal(summary.unconfirmedCount, 1); assert.equal(summary.excludedCurrency, 1);
});

test('invoice search and filters operate together across reference and client', () => {
    const rows = [{ invoiceId: 'INV-001', clientName: 'Example Studio', isOutstanding: true }, { invoiceId: 'INV-002', clientName: 'Other', isOutstanding: false }];
    assert.equal(api.billingInvoices(rows, 'outstanding', 'studio').length, 1);
    assert.equal(api.billingInvoices(rows, 'outstanding', 'INV-002').length, 0);
});

test('marking ready changes only the sending stage', async () => {
    const { plugin, invoice, stored, writes } = fixture({ status: 'draft', issued: '' });
    await plugin.updateInvoiceState(invoice, 'ready');
    assert.deepEqual(writes, [['status', 'ready']]); assert.equal(stored.payment_status, 'unpaid'); assert.equal(stored.issued, '');
});

test('marking sent records the date before sending stage and does not mark payment', async () => {
    const { plugin, invoice, stored, writes } = fixture({ status: 'ready', issued: '' });
    await plugin.updateInvoiceState(invoice, 'sent', '2020-01-31');
    assert.deepEqual(writes, [['issued', { d: '20200131' }], ['status', 'sent']]); assert.equal(stored.payment_status, 'unpaid');
});

test('verification re-reads the SDK record when the original wrapper retains stale values', async () => {
    const { plugin, invoice, stored, record, collection } = fixture({ status: 'ready', issued: '' });
    record.readSnapshot = { ...stored }; let fetched = false;
    collection.getAllRecords = async () => { if (fetched) record.readSnapshot = { ...stored }; fetched = true; return [record]; };
    await plugin.updateInvoiceState(invoice, 'sent', '2020-01-31');
    assert.equal(stored.status, 'sent'); assert.deepEqual(stored.issued, { d: '20200131' });
});

test('a native board-sent invoice can record its missing issue date without touching payment', async () => {
    const { plugin, invoice, stored, writes } = fixture({ issued: '' });
    await plugin.updateInvoiceState(invoice, 'sent', '2020-01-31');
    assert.deepEqual(writes, [['issued', { d: '20200131' }]]); assert.equal(stored.payment_status, 'unpaid');
});

test('full payment records its date before paid state and retries do not duplicate writes', async () => {
    const { plugin, invoice, stored, writes } = fixture({ payment_status: 'unconfirmed' });
    await plugin.updateInvoiceState(invoice, 'paid', '2020-02-01');
    assert.deepEqual(writes, [['paid_date', { d: '20200201' }], ['payment_status', 'paid']]);
    await plugin.updateInvoiceState(invoice, 'paid', '2020-02-01');
    assert.equal(writes.length, 2); assert.equal(stored.status, 'sent');
});

test('foreign-currency full payment keeps the original amount and currency', async () => {
    const { plugin, invoice, stored } = fixture({ currency: 'EUR', amount_chf: 99 });
    await plugin.updateInvoiceState(invoice, 'paid', '2020-02-01');
    assert.equal(stored.payment_status, 'paid'); assert.equal(stored.currency, 'EUR'); assert.equal(stored.amount_chf, 99);
});

test('future or invalid dates and attempts to settle unsent invoices make no changes', async () => {
    const f = fixture();
    await assert.rejects(f.plugin.updateInvoiceState(f.invoice, 'paid', '2099-01-01'), /valid date/);
    await assert.rejects(f.plugin.updateInvoiceState(f.invoice, 'paid', '2020-02-30'), /valid date/);
    const draft = fixture({ status: 'draft' });
    await assert.rejects(draft.plugin.updateInvoiceState(draft.invoice, 'paid', '2020-01-01'), /sent, unpaid/);
    assert.equal(f.writes.length + draft.writes.length, 0);
});

test('changed amounts, payment dates, or client references block stale forms before writing', async () => {
    const f = fixture(); f.stored.amount_chf = 999;
    await assert.rejects(f.plugin.updateInvoiceState(f.invoice, 'paid', '2020-01-01'), /amount, currency, or client changed/);
    f.stored.amount_chf = 250; f.stored.paid_date = '2020-01-02';
    await assert.rejects(f.plugin.updateInvoiceState(f.invoice, 'paid', '2020-01-01'), /changed elsewhere/);
    f.stored.paid_date = ''; f.stored.client = '1B0J3X9Y8QS96C75M3QMT23DNW';
    await assert.rejects(f.plugin.updateInvoiceState(f.invoice, 'paid', '2020-01-01'), /client changed/);
    assert.equal(f.writes.length, 0);
});

test('schema validation completes before date writes', async () => {
    const { plugin, invoice, config, writes } = fixture(); config.fields.find(field => field.label === 'payment_status').read_only = true;
    await assert.rejects(plugin.updateInvoiceState(invoice, 'paid', '2020-01-01'), /Invoices.payment_status/); assert.equal(writes.length, 0);
});

test('failed paid-state writes retain unpaid state and can resume after a saved date', async () => {
    const { plugin, invoice, stored, writes, record } = fixture(); record.reject = 'payment_status';
    await assert.rejects(plugin.updateInvoiceState(invoice, 'paid', '2020-01-01'), /Some details may already be saved/);
    assert.equal(stored.payment_status, 'unpaid'); assert.deepEqual(stored.paid_date, { d: '20200101' });
    record.reject = ''; await plugin.updateInvoiceState(invoice, 'paid', '2020-01-01');
    assert.equal(stored.payment_status, 'paid'); assert.equal(writes.filter(([label]) => label === 'paid_date').length, 1);
});

test('concurrent updates to the same invoice are rejected', async () => {
    const { plugin, invoice, writes } = fixture({ status: 'draft', issued: '' });
    const first = plugin.updateInvoiceState(invoice, 'ready');
    await assert.rejects(plugin.updateInvoiceState(invoice, 'ready'), /already being saved/);
    await first; assert.equal(writes.length, 1);
});

test('duplicate invoice references stop creation even when native page titles differ', async () => {
    const { plugin, record, collection, invoice } = fixture(); record.getName = () => 'Custom page name';
    const original = record.prop; record.prop = label => label === 'invoice_id' ? { text: () => 'INV-001' } : original(label);
    let created = 0; collection.createRecord = () => { created++; };
    await assert.rejects(plugin.createConfiguredRecord('Invoices', 'INV-001', { client: clientGuid, amount_chf: invoice.amount, currency: 'CHF', status: 'draft', payment_status: 'unpaid' }), /already exists/);
    assert.equal(created, 0);
});

const paidEntry = () => ({ status: 'sent', payment_status: 'paid', issued: '2020-01-01', paid_date: '2020-01-02', client: clientGuid, amount_chf: 250, currency: 'CHF', invoice_id: 'INV-NEW' });

test('paid creation writes and verifies dates before final financial state', async () => {
    const f = fixture({ status: '', payment_status: '', issued: '', paid_date: '' });
    f.collection.createRecord = title => { f.record.getName = () => title; return f.record.guid; };
    await f.plugin.createConfiguredRecord('Invoices', 'INV-NEW', paidEntry());
    const labels = f.writes.map(([label]) => label);
    assert.ok(labels.indexOf('issued') < labels.indexOf('status'));
    assert.ok(labels.indexOf('paid_date') < labels.indexOf('payment_status'));
    assert.equal(f.stored.payment_status, 'paid'); assert.equal(f.record.trashed, undefined);
});

test('failed creation date writes never write Paid and remove the incomplete new page', async () => {
    const f = fixture({ status: '', payment_status: '', issued: '', paid_date: '' }); f.record.reject = 'paid_date';
    f.collection.createRecord = () => f.record.guid;
    await assert.rejects(f.plugin.createConfiguredRecord('Invoices', 'INV-NEW', paidEntry()), /Could not set paid_date/);
    assert.equal(f.writes.some(([label]) => label === 'payment_status'), false); assert.equal(f.record.trashed, true);
});

test('creation refuses to report success if the refreshed record does not verify', async () => {
    const f = fixture({ status: '', payment_status: '', issued: '', paid_date: '' });
    f.record.readSnapshot = { ...f.stored }; f.collection.createRecord = () => f.record.guid;
    await assert.rejects(f.plugin.createConfiguredRecord('Invoices', 'INV-NEW', paidEntry()), /could not be verified/);
    assert.equal(f.record.trashed, true);
});

test('new sent and paid entries require their actual dates before any page is created', async () => {
    const f = fixture(); let count = 0; f.collection.createRecord = () => { count++; return f.record.guid; };
    await assert.rejects(f.plugin.createConfiguredRecord('Invoices', 'INV-NEW', { ...paidEntry(), issued: '' }), /issue date/);
    await assert.rejects(f.plugin.createConfiguredRecord('Invoices', 'INV-NEW', { ...paidEntry(), paid_date: '' }), /valid payment date/);
    assert.equal(count, 0);
});


test('invoice search matches project name', () => {
    const rows = [
        { invoiceId: 'INV-001', clientName: 'Example Studio', projectName: 'Website Redesign', isOutstanding: true },
        { invoiceId: 'INV-002', clientName: 'Other', projectName: 'Brand Guide', isOutstanding: false }
    ];
    assert.equal(api.billingInvoices(rows, 'outstanding', 'redesign').length, 1);
    assert.equal(api.billingInvoices(rows, 'outstanding', 'brand').length, 0);
});

test('invoice creation validates linked project belongs to the client', async () => {
    const f = fixture({ status: '', payment_status: '', issued: '', paid_date: '' });
    const projectGuid = '1B0J3X9Y8QS96C75M3QMT23DNW';
    const projects = {
        getGuid: () => 'projects',
        getName: () => 'Projects',
        getAllRecords: async () => [{
            guid: projectGuid,
            getName: () => 'Client Project',
            prop: (label) => ({ linkedRecord: () => label === 'client' ? { guid: clientGuid } : null })
        }, {
            guid: '1B0J3X9Y8QS96C75M3QMT23DXX',
            getName: () => 'Other Project',
            prop: (label) => ({ linkedRecord: () => label === 'client' ? { guid: '1FD58J39X6KJ4JK5F06T7P4TXX' } : null })
        }]
    };
    f.plugin.data.getAllCollections = async () => [f.collection, { getGuid: () => 'clients', getName: () => 'Clients', getAllRecords: async () => [{ guid: clientGuid, getName: () => 'Example client' }] }, projects];
    f.collection.createRecord = title => { f.record.getName = () => title; return f.record.guid; };

    // Mismatched project
    await assert.rejects(
        f.plugin.createConfiguredRecord('Invoices', 'INV-ERR', { ...paidEntry(), project: '1B0J3X9Y8QS96C75M3QMT23DXX' }),
        /linked to this client/
    );

    // Matching project succeeds
    f.record.prop = label => ({
        text: () => typeof f.stored[label] === 'string' ? f.stored[label] : '',
        number: () => typeof f.stored[label] === 'number' ? f.stored[label] : null,
        date: () => typeof f.stored[label] === 'object' ? f.stored[label] : null,
        linkedRecord: () => label === 'client' ? { guid: clientGuid } : label === 'project' ? { guid: projectGuid } : null,
        set: value => { f.writes.push([label, value]); f.stored[label] = value; return true; },
        setChoice: value => { f.writes.push([label, value]); f.stored[label] = value; return true; }
    });
    await f.plugin.createConfiguredRecord('Invoices', 'INV-VALID', { ...paidEntry(), project: projectGuid });
    assert.equal(f.stored.project, projectGuid);
});

function mockPage(initial = [], failAt = Infinity) {
    const lines = [...initial]; let writes = 0;
    const record = { guid: 'rec', getLineItems: async () => lines, createLineItem: async (parent, after, type, segments, props) => {
        if (++writes === failAt) return null;
        const line = { guid: `line-${writes}`, parent_guid: parent?.guid || record.guid, type, segments, props, delete: async () => { lines.splice(lines.indexOf(line), 1); return true; } };
        lines.push(line); return line;
    }};
    return { record, lines, writes: () => writes };
}

test('initializeInvoice creates structured archetype sections with amounts and dates', async () => {
    const plugin = new api.Plugin();
    const state = mockPage();
    const result = await plugin.initializeInvoice(state.record, {
        amount_chf: 1250,
        currency: 'CHF',
        status: 'sent',
        payment_status: 'unpaid',
        issued: '2026-10-01',
        due: '2026-10-31'
    }, { clientName: 'Acme Corp', projectName: 'Branding Phase 1' });
    assert.equal(result.applied, true);
    assert.ok(state.lines.some(l => l.type === 'heading' && l.segments?.[0]?.text === 'Invoice Summary & Scope'));
    assert.ok(state.lines.some(l => l.type === 'heading' && l.segments?.[0]?.text === 'Commercial & Payment Details'));
    assert.ok(state.lines.some(l => l.segments?.[0]?.text?.includes('1250 CHF')));
    assert.ok(state.lines.some(l => l.segments?.[0]?.text?.includes('Acme Corp')));
    assert.ok(state.lines.some(l => l.segments?.[0]?.text?.includes('Branding Phase 1')));
    assert.ok(state.lines.some(l => l.type === 'heading' && l.segments?.[0]?.text === 'Delivery & Settlement Log'));
    assert.ok(state.lines.some(l => l.segments?.[0]?.text?.includes('2026-10-01')));
    assert.ok(state.lines.some(l => l.type === 'linkbtn' && l.segments?.[0]?.text === '+ Add deliverable'));
    assert.ok(state.lines.some(l => l.type === 'linkbtn' && l.segments?.[0]?.text === '+ Copy payment details'));
    assert.ok(state.lines.some(l => l.type === 'linkbtn' && l.segments?.[0]?.text === '+ Record payment'));

    // Idempotent
    const reapply = await plugin.initializeInvoice(state.record);
    assert.equal(reapply.applied, false);
    assert.equal(reapply.reason, 'already-applied');
});

test('initializeSupportSession creates log and follow-up checklist', async () => {
    const plugin = new api.Plugin();
    const state = mockPage();
    const result = await plugin.initializeSupportSession(state.record, {
        hours: 2,
        date: '2026-10-24',
        description: 'Troubleshoot database connections'
    }, { clientName: 'Beta LLC' });
    assert.equal(result.applied, true);
    assert.ok(state.lines.some(l => l.type === 'heading' && l.segments?.[0]?.text === 'Session Log & Delivered Work'));
    assert.ok(state.lines.some(l => l.segments?.[0]?.text?.includes('2 h')));
    assert.ok(state.lines.some(l => l.segments?.[0]?.text?.includes('Troubleshoot database connections')));
    assert.ok(state.lines.some(l => l.type === 'heading' && l.segments?.[0]?.text === 'Client Follow-Up'));
    assert.ok(state.lines.some(l => l.type === 'linkbtn' && l.segments?.[0]?.text === '+ Log time'));
    assert.ok(state.lines.some(l => l.type === 'linkbtn' && l.segments?.[0]?.text === '+ Add follow-up task'));
    assert.ok(state.lines.some(l => l.type === 'task' && l.segments?.[0]?.text === 'Send session summary or updates to client'));

    // Idempotent
    const reapply = await plugin.initializeSupportSession(state.record);
    assert.equal(reapply.applied, false);
    assert.equal(reapply.reason, 'already-applied');
});
