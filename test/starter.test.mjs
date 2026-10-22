import test from 'node:test';
import assert from 'node:assert/strict';
import { starterConfig, STARTER_ROLES } from '../scripts/starter-schema.mjs';

test('starter schemas are independent of workspace IDs and every view column resolves', () => {
    for (const role of STARTER_ROLES) {
        const config = starterConfig(role,undefined,{Clients:'new-clients',Projects:'new-projects'});
        const ids = new Set(['title',...config.fields.map(field=>field.id)]);
        for (const view of config.views) for (const id of view.field_ids) assert.ok(ids.has(id),`${role}: ${id}`);
        for (const field of config.fields.filter(field=>field.label==='client')) assert.equal(field.filter_colguid,'new-clients');
        assert.deepEqual(starterConfig(role,config,{Clients:'new-clients',Projects:'new-projects'}),config);
    }
});

test('starter setup preserves existing fields, IDs, custom configuration and unrelated views', () => {
    const current = starterConfig('Clients');
    current.fields.find(field=>field.label==='status').id='existing-status';
    current.fields.push({id:'extra',label:'Notes',type:'text'}); current.custom={keep:true};
    current.views.push({id:'custom',type:'list',label:'My view'});
    const before=structuredClone(current), next=starterConfig('Clients',current);
    assert.deepEqual(current,before); assert.equal(next.fields.find(field=>field.label==='status').id,'existing-status');
    assert.deepEqual(next.custom,{keep:true}); assert.ok(next.views.some(view=>view.id==='custom'));
    assert.throws(()=>starterConfig('Invoices',{fields:[{label:'amount_chf',type:'text'}],views:[]}),/must be number/);
    assert.throws(()=>starterConfig('Projects',{fields:[{label:'status',type:'choice',choices:[]}],views:[]}),/missing required choice/);
});
