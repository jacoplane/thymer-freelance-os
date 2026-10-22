import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/workflow.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8') + '\nObject.assign(Plugin.prototype, Workflow);';
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; ({ Plugin, formatDatetime, dateDay, localDate, summarizeInvoices, invoiceMatches, clientSummary });`, { AppPlugin: class {}, console, Date, Intl });

test('Thymer date wrappers use the stored calendar date over formatted labels', () => {
    assert.equal(api.formatDatetime({ value: () => ({ d: '20260315', formatted: 'Sun Mar 15' }) }), '2026-03-15');
    assert.equal(api.dateDay('2026-02-30'), null);
    assert.equal(api.dateDay('2026-03-16') - api.dateDay('2026-03-15'), 1);
});

test('client value uses linked CHF payments and active projects only', () => {
    const result = api.clientSummary({ guid: 'client-a' }, [
        { clientGuid: 'client-a', status: 'in_progress' },
        { clientGuid: 'client-a', status: 'completed' },
        { clientGuid: 'client-b', status: 'in_progress' }
    ], [
        { clientGuid: 'client-a', currency: 'CHF', status: 'paid', amount: 200 },
        { clientGuid: 'client-a', currency: 'EUR', status: 'paid', amount: 999 },
        { clientGuid: 'client-a', currency: 'CHF', status: 'unconfirmed', amount: 50, isOutstanding: true, daysOverdue: 5 }
    ]);
    assert.equal(result.collected, 200);
    assert.equal(result.outstanding, 50);
    assert.equal(result.activeProjects, 1);
    assert.equal(result.overdueCount, 1);
});

test('capture assigns the chosen project and important priority', async () => {
    const plugin = new api.Plugin();
    let text, priority, destination;
    plugin.data = { getRecord: guid => { destination = guid; return { createLineItem: async () => ({
        setSegments: async segments => { text = segments[0].text; return true; },
        setTaskStatus: async status => { priority = status; return true; }
    }) }; } };
    const result = await plugin.captureTask('Review proposal', 'project-a', true);
    assert.equal(destination, 'project-a');
    assert.equal(text, 'Review proposal');
    assert.equal(priority, 'important');
    assert.equal(result.prioritySaved, true);
});

test('failed capture removes the empty task and reports failure', async () => {
    const plugin = new api.Plugin();
    let deleted = false;
    plugin.data = { getRecord: () => ({ createLineItem: async () => ({
        setSegments: async () => false,
        delete: async () => { deleted = true; return true; }
    }) }) };
    await assert.rejects(plugin.captureTask('Keep my draft', 'project-a', false));
    assert.equal(deleted, true);
});

test('priority failure reports an already saved task without retrying creation', async () => {
    const plugin = new api.Plugin();
    plugin.data = { getRecord: () => ({ createLineItem: async () => ({
        setSegments: async () => true,
        setTaskStatus: async () => false
    }) }) };
    assert.equal((await plugin.captureTask('Saved task', 'project-a', true)).prioritySaved, false);
});

test('cashflow separates drafts, settled, unconfirmed, currencies and aging', () => {
    const invoice = (props) => ({ amount: 100, currency: 'CHF', stage: 'sent', status: 'unpaid', isOutstanding: true, dueDate: '2026-10-01', daysOverdue: 1, ...props });
    const result = api.summarizeInvoices([
        invoice({ status: 'paid', isOutstanding: false, daysOverdue: 0 }),
        invoice({ status: 'unconfirmed', daysOverdue: 31 }),
        invoice({ daysOverdue: 61 }), invoice({}),
        invoice({ dueDate: '', daysOverdue: 0 }),
        invoice({ stage: 'draft', isOutstanding: false }),
        invoice({ currency: 'EUR' })
    ]);
    assert.equal(result.invoiced, 500);
    assert.equal(result.collected, 100);
    assert.equal(result.outstanding, 400);
    assert.equal(result.overdue, 300);
    assert.deepEqual(Array.from(result.aging), [100, 100, 100]);
    assert.equal(result.unconfirmedCount, 1);
    assert.equal(result.undated, 1);
    assert.equal(result.toSend, 1);
    assert.equal(result.excludedCurrency, 1);
    assert.equal(result.collectionRate, 20);
});

test('empty financial data stays zero and has no collection percentage', () => {
    const result = api.summarizeInvoices([]);
    assert.equal(result.invoiced, 0);
    assert.equal(result.outstanding, 0);
    assert.equal(result.collectionRate, null);
});

test('invoice filters distinguish review from overdue and drafts', () => {
    assert.equal(api.invoiceMatches({ status: 'unconfirmed' }, 'review'), true);
    assert.equal(api.invoiceMatches({ daysOverdue: 0 }, 'overdue'), false);
    assert.equal(api.invoiceMatches({ stage: 'ready' }, 'to-send'), true);
});

test('collection loading preserves zero totals and excludes prospect retainers', async () => {
    const plugin = new api.Plugin();
    const record = (status, amount) => ({ guid: status, getName: () => status, prop: k => ({ text: () => k === 'status' ? status : k === 'monthly_chf' ? String(amount) : '' }) });
    plugin.data = {
        getAllCollections: async () => ['1FD58J39X6KJ4JK5F06T7P4TSR', '1YT6YD3EYV6F06TZY5GKGVJMNR', '1B0J3X9Y8QS96C75M3QMT23DNW'].map((guid, index) => ({ getGuid: () => guid, getAllRecords: async () => index === 0 ? [record('active', 0), record('prospect', 200), record('archived', 100)] : [] })),
        searchByQuery: async () => ({ lines: [] })
    };
    const data = await plugin.loadData();
    assert.equal(data.mrr, 0);
    assert.equal(data.activeCarePlans, 0);
    assert.equal(data.activeClientsCount, 1);
    assert.equal(data.cashflow.collected, 0);
    assert.equal(data.loadError, undefined);
});
