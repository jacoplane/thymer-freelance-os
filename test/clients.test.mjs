import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { starterConfig } from '../scripts/starter-schema.mjs';

const source = ['support-time.js', 'workflow.js', 'index.js'].map(file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')).join('\n');
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; Object.assign(Plugin.prototype, Workflow); ({ Plugin, clientMatches, clientSearchText });`, { AppPlugin: class {}, Date, Intl, console });

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
    assert.match(api.clientSearchText({ name: 'Example', contact: 'Alex', email: 'alex@example.test', phone: '+41 22', leadStage: 'proposal_sent' }), /alex@example.test.*\+41 22.*proposal sent/);
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
    await assert.rejects(plugin.createConfiguredRecord('Clients', ' example studio ', { status: 'prospect', lead_stage: 'contacted' }), /already exists/);
    assert.equal(created, 0);
});
