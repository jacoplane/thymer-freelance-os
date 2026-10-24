import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { starterConfig } from '../scripts/starter-schema.mjs';
import { planClientLifecycleMigration } from '../scripts/client-lifecycle-plan.mjs';

const source = ['support-time.js', 'workflow.js', 'index.js'].map(file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')).join('\n');
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; Object.assign(Plugin.prototype, Workflow); ({ Plugin, clientMatches, clientSearchText, clientStatus, isRevenueClient, summarizeSupportTime });`, { AppPlugin: class {}, Date, Intl, console });

function fixture(values = {}) {
    const stored = { status: 'prospect', contact: 'Alex Martin', email: 'alex@example.test', phone: '', website: '', lead_stage: 'contacted', plan: '', monthly_chf: 0, ...values };
    const writes = [];
    const config = starterConfig('Clients');
    const record = { guid: 'client', getName: () => 'Example Studio', prop: label => ({ text: () => typeof stored[label] === 'string' ? stored[label] : '', number: () => typeof stored[label] === 'number' ? stored[label] : null, set: value => { writes.push([label, value]); stored[label] = value; return true; }, setChoice: value => { writes.push([label, value]); stored[label] = value; return true; } }) };
    const collection = { getGuid: () => 'clients', getName: () => 'Clients', getAllRecords: async () => [record], getConfiguration: () => config };
    const plugin = new api.Plugin(); plugin.data = { getAllCollections: async () => [collection] };
    const client = { guid: 'client', name: 'Example Studio', status: stored.status, contact: stored.contact, email: stored.email, phone: stored.phone, website: stored.website, leadStage: stored.lead_stage, plan: 'Active', planValue: stored.plan, mrr: Number(stored.monthly_chf) || 0 };
    return { plugin, client, stored, writes, config, collection };
}

test('lead filters include legacy leads and keep archived relationships out of the open lead register', () => {
    assert.equal(api.clientMatches({ status: 'prospect' }, 'leads'), true);
    assert.equal(api.clientMatches({ status: 'lead' }, 'leads'), true);
    assert.equal(api.clientMatches({ status: 'active' }, 'leads'), false);
    assert.equal(api.clientMatches({ status: 'archived' }, 'leads'), false);
    assert.equal(api.clientMatches({ status: 'archived' }, 'archived'), true);
    assert.match(api.clientSearchText({ name: 'Example', status: 'proposal_sent', contact: 'Alex', email: 'alex@example.test', phone: '+41 22', source: 'referral' }), /alex@example.test.*\+41 22.*referral.*proposal sent/);
});

test('client edits update estimated_value_chf and source fields', async () => {
    const { plugin, client, stored, writes } = fixture({ estimated_value_chf: 5000, source: 'referral' });
    client.estimatedValue = 5000;
    client.source = 'referral';
    await plugin.updateClientDetails(client, { estimated_value_chf: 7500, source: 'linkedin' });
    assert.deepEqual(writes, [['estimated_value_chf', 7500], ['source', 'linkedin']]);
    assert.equal(stored.estimated_value_chf, 7500);
    assert.equal(stored.source, 'linkedin');
});

test('client setup adds CRM fields without replacing existing contact values, field IDs, or the Prospects view ID', () => {
    const old = starterConfig('Clients');
    old.fields = old.fields.filter(field => !['email', 'phone', 'lead_stage'].includes(field.label));
    const contact = old.fields.find(field => field.label === 'contact'); contact.id = 'existing-contact';
    const leads = old.views.find(view => view.label === 'Leads'); leads.id = 'existing-prospects'; leads.label = 'Prospects';
    const next = starterConfig('Clients', old);
    assert.equal(next.fields.find(field => field.label === 'contact').id, 'existing-contact');
    assert.equal(next.views.find(view => view.label === 'Leads').id, 'existing-prospects');
    assert.equal(old.fields.some(field => field.label === 'email'), false);
    assert.deepEqual(starterConfig('Clients', next), next);
});

test('lifecycle schema extends and reorders existing choices while preserving IDs, custom choices and the Status board', () => {
    const old = starterConfig('Clients');
    const status = old.fields.find(field => field.label === 'status');
    status.choices = status.choices.filter(choice => ['prospect', 'active', 'archived'].includes(choice.label));
    status.choices.push({ id: 'custom-choice', label: 'custom', active: true });
    old.fields.push({ id: 'old-stage', label: 'lead_stage', type: 'choice', choices: [{ id: 'old-contacted', label: 'contacted' }] });
    old.views.find(view => view.label === 'Status').id = 'existing-status-board';
    old.views.find(view => view.label === 'Status').sort_field_id = null;
    const next = starterConfig('Clients', old);
    for (const choice of status.choices) assert.deepEqual(next.fields.find(field => field.id === status.id).choices.find(item => item.id === choice.id), choice);
    assert.equal(next.fields.find(field => field.id === 'old-stage').choices[0].id, 'old-contacted');
    assert.equal(next.views.find(view => view.label === 'Status').id, 'existing-status-board');
    assert.equal(next.views.find(view => view.label === 'Status').sort_field_id, null);
    assert.deepEqual(next.fields.find(field => field.id === status.id).choices.slice(0, 8).map(choice => choice.label), ['prospect', 'contacted', 'discussing', 'proposal_sent', 'proposal_accepted', 'active', 'maintenance', 'archived']);
    assert.deepEqual(starterConfig('Clients', next), next);
});

test('migration consolidates only prospect stages and never downgrades acquired or archived clients', () => {
    const config = { fields: [{ label: 'status', choices: ['prospect', 'active', 'archived'].map(label => ({ id: `s-${label}`, label })) }, { label: 'lead_stage', choices: [{ id: 'l-sent', label: 'proposal_sent' }] }] };
    const records = ['prospect', 'active', 'archived'].map(status => ({ guid: status, properties: { status: ['choice', `s-${status}`], lead_stage: ['choice', 'l-sent'] } }));
    assert.deepEqual(planClientLifecycleMigration(records, config), [{ guid: 'prospect', from: 'prospect', to: 'proposal_sent', stage: 'proposal_sent' }]);
    assert.deepEqual(planClientLifecycleMigration([{ guid: 'already-migrated', properties: { status: ['choice', 'proposal_sent'], lead_stage: ['choice', 'l-sent'] } }], config), []);
    assert.equal(api.clientStatus({ status: 'active', leadStage: 'proposal_sent' }), 'active');
    assert.equal(api.clientStatus({ status: 'prospect', leadStage: 'proposal_sent' }), 'prospect');
    config.fields.find(field => field.label === 'lead_stage').active = false;
    assert.deepEqual(planClientLifecycleMigration(records, config), []);
});

test('acquired statuses count as clients; maintenance contributes revenue and support allowance without counting prospects', () => {
    for (const status of ['proposal_accepted', 'active', 'maintenance']) assert.equal(api.clientMatches({ status }, 'active'), true);
    for (const status of ['prospect', 'contacted', 'discussing', 'proposal_sent']) assert.equal(api.clientMatches({ status }, 'leads'), true);
    assert.equal(api.isRevenueClient({ status: 'maintenance' }), true);
    assert.equal(api.isRevenueClient({ status: 'proposal_accepted' }), false);
    const summary = api.summarizeSupportTime([{ guid: 'maintenance', status: 'maintenance', includedHours: 3 }, { guid: 'accepted', status: 'proposal_accepted', includedHours: 10 }], [], new Date(2026, 9, 24));
    assert.equal(summary.allowance, 3);
});

test('client edits update only changed native fields and can clear optional contact details', async () => {
    const { plugin, client, stored, writes } = fixture();
    await plugin.updateClientDetails(client, { status: 'prospect', contact: 'Alex Martin', email: '', phone: '+41 22 123 45 67', plan: '', monthly_chf: 0 });
    assert.deepEqual(writes, [['email', ''], ['phone', '+41 22 123 45 67']]);
    assert.equal(stored.lead_stage, 'contacted');
});

test('converting a lead reuses its client record and preserves history and commercial fields', async () => {
    const { plugin, client, stored, writes } = fixture({ monthly_chf: 120, plan: 'Care plan' });
    await plugin.updateClientDetails(client, { status: 'active' });
    assert.deepEqual(writes, [['status', 'active']]);
    assert.equal(stored.lead_stage, 'contacted'); assert.equal(stored.monthly_chf, 120);
});

test('client edits validate all schema and conflict conditions before making any writes', async () => {
    const { plugin, client, stored, writes } = fixture();
    await assert.rejects(plugin.updateClientDetails(client, { phone: '+41', lead_stage: 'invented' }), /Check the Clients.lead_stage/);
    assert.equal(writes.length, 0);
    stored.email = 'changed-elsewhere@example.test';
    await assert.rejects(plugin.updateClientDetails(client, { phone: '+41', email: 'new@example.test' }), /changed elsewhere/);
    assert.equal(writes.length, 0);
});

test('a blank native monthly amount can be edited without a false conflict', async () => {
    const { plugin, client, stored } = fixture({ monthly_chf: '' });
    await plugin.updateClientDetails(client, { monthly_chf: 150 });
    assert.equal(stored.monthly_chf, 150);
});

test('duplicate client creation stops before creating or writing another record', async () => {
    const { plugin, collection } = fixture();
    let created = 0; collection.createRecord = () => { created++; };
    await assert.rejects(plugin.createConfiguredRecord('Clients', ' example studio ', { status: 'contacted' }), /already exists/);
    assert.equal(created, 0);
});

function mockPage(initial = [], failAt = Infinity) {
    const lines = [...initial]; let writes = 0;
    const record = { guid: 'client-rec', getLineItems: async () => lines, createLineItem: async (parent, after, type, segments, props) => {
        if (++writes === failAt) return null;
        const line = { guid: `line-${writes}`, parent_guid: parent?.guid || record.guid, type, segments, props, delete: async () => { lines.splice(lines.indexOf(line), 1); return true; } };
        lines.push(line); return line;
    }};
    return { record, lines, writes: () => writes };
}

test('initializeClient populates client template sections with relationship and actions', async () => {
    const plugin = new api.Plugin();
    const state = mockPage();
    const result = await plugin.initializeClient(state.record, { context: 'Fintech startup based in Geneva' });
    assert.equal(result.applied, true);
    assert.ok(state.lines.some(l => l.type === 'heading' && l.segments?.[0]?.text === 'Relationship & Context'));
    assert.ok(state.lines.some(l => l.segments?.[0]?.text === 'Fintech startup based in Geneva'));
    assert.ok(state.lines.some(l => l.type === 'heading' && l.segments?.[0]?.text === '📋 Open Tasks & Actions'));
    assert.ok(state.lines.some(l => l.type === 'task' && l.segments?.[0]?.text === 'Initial client kickoff / follow-up'));

    // Idempotent
    const reapply = await plugin.initializeClient(state.record);
    assert.equal(reapply.applied, false);
    assert.equal(reapply.reason, 'already-applied');
});
