import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { VIEW_PLANS, planCollectionViews } from '../scripts/collection-view-plan.mjs';

const configFor = collection => ({
    fields: [...new Set(VIEW_PLANS[collection].flatMap(v => [...v.columns, v.sort]))].filter(label => label !== 'title').map(label => ({ id: `field-${label}`, label, type: 'text' })),
    views: [{ id: 'existing-register', label: 'Register', type: 'table', field_ids: [] }, { id: 'list', label: 'List', type: 'list' }],
    custom: { keep: true }
});

test('invoice view merge keeps existing identifiers, fields and unrelated views', () => {
    const original = configFor('Invoices');
    const before = structuredClone(original);
    const next = planCollectionViews('Invoices', original);
    assert.deepEqual(original, before);
    assert.deepEqual(next.fields, original.fields);
    assert.deepEqual(next.custom, original.custom);
    assert.equal(next.views[0].id, 'existing-register');
    assert.equal(next.views.find(v => v.id === 'list').type, 'list');
    assert.equal(next.views[0].field_ids.includes('field-payment_status'), true);
    assert.deepEqual(planCollectionViews('Invoices', next), next);
});

test('outstanding and overdue queues require sent and exclude paid invoices', () => {
    const views = planCollectionViews('Invoices', configFor('Invoices')).views;
    for (const label of ['Outstanding', 'Overdue']) {
        assert.match(views.find(v => v.label === label).query, /status = "sent"/);
        assert.match(views.find(v => v.label === label).query, /payment_status != "paid"/);
    }
    assert.match(views.find(v => v.label === 'Overdue').query, /due < "today"/);
});

test('missing required fields abort the plan', () => {
    assert.throws(() => planCollectionViews('Invoices', { fields: [], views: [] }), /Missing Invoices field/);
});

test('project views scope to top-level pages and preserve calendar and outline views', () => {
    const config = configFor('Projects');
    config.views.push({ id: 'calendar', label: 'Deadlines', type: 'calendar' }, { id: 'outline', label: 'Outline', type: 'custom' });
    const next = planCollectionViews('Projects', config);
    assert.equal(next.views.find(v => v.label === 'Board').type, 'board');
    assert.equal(next.views.find(v => v.label === 'Board').group_by_field_id, 'field-status');
    assert.match(next.views.find(v => v.label === 'Active').query, /parent_page = ""/);
    assert.match(next.views.find(v => v.label === 'Overdue').query, /status != "completed"/);
    assert.equal(next.views.find(v => v.id === 'calendar').type, 'calendar');
    assert.equal(next.views.find(v => v.id === 'outline').type, 'custom');
    assert.deepEqual(planCollectionViews('Projects', next), next);
});

test('client care plans require active status and a positive monthly fee', () => {
    const next = planCollectionViews('Clients', configFor('Clients'));
    const view = next.views.find(v => v.label === 'Care plans');
    assert.match(view.query, /status = "active"/);
    assert.match(view.query, /monthly_chf > 0/);
    assert.equal(next.views[0].label, 'Directory');
    assert.deepEqual(planCollectionViews('Clients', next), next);
});

const source = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; ({Plugin, collectionViewId, COLL_GUIDS});`, { AppPlugin: class {} });

test('dashboard routes through native overview with the saved view id', async () => {
    let navigation;
    const plugin = new api.Plugin();
    plugin.getWorkspaceGuid = () => 'workspace';
    plugin.data = { getPluginByGuid: () => ({ getConfiguration: () => ({ views: [{ id: 'native-review', label: 'To confirm', shown: true }] }) }) };
    plugin.ui = { createPanel: async () => ({ navigateTo: value => { navigation = value; } }) };
    await plugin.openCollection(api.COLL_GUIDS.Invoices, {}, 'review');
    assert.equal(navigation.type, 'overview');
    assert.equal(navigation.rootId, api.COLL_GUIDS.Invoices);
    assert.equal(navigation.subId, 'native-review');
    assert.equal(api.collectionViewId(api.COLL_GUIDS.Invoices, { views: [] }, 'review'), null);
});
