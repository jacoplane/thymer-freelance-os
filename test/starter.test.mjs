import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('existing client fields are restricted to the configured Clients collection',()=>{
    const current=starterConfig('Projects');
    current.fields.find(field=>field.label==='client').filter_colguid='unrelated-collection';
    const next=starterConfig('Projects',current,{Clients:'clients'});
    assert.equal(next.fields.find(field=>field.label==='client').filter_colguid,'clients');
    assert.equal(current.fields.find(field=>field.label==='client').filter_colguid,'unrelated-collection');
});

test('support session links are restricted to Clients and Projects and the register exposes logged fields',()=>{
    const config=starterConfig('Support Sessions',undefined,{Clients:'clients',Projects:'projects'});
    assert.equal(config.fields.find(field=>field.label==='client').filter_colguid,'clients');
    assert.equal(config.fields.find(field=>field.label==='project').filter_colguid,'projects');
    assert.deepEqual(config.views[0].field_ids,['title',...['date','client','project','hours','description'].map(label=>config.fields.find(field=>field.label===label).id)]);
});

test('Plugins Manager starter import keeps support client and project links targeted by collection name',()=>{
    const starter=JSON.parse(fs.readFileSync(new URL('../dist/freelance-os-starter.json',import.meta.url),'utf8'));
    const sessions=starter.items.find(item=>item.name==='Support Sessions');
    assert.equal(sessions.json.fields.find(field=>field.label==='client').filter_colname,'Clients');
    assert.equal(sessions.json.fields.find(field=>field.label==='project').filter_colname,'Projects');
});
