import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/workflow.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const {Plugin, projectStatusLabel} = vm.runInNewContext(source.replace('export class Plugin','class Plugin')+';Object.assign(Plugin.prototype,Workflow);({Plugin,projectStatusLabel})',{AppPlugin:class{},console,Date,Intl});

function page(initial = [], failAt = Infinity) {
    const lines = [...initial];let writes=0;
    const record = {guid:'project',getLineItems:async()=>lines,createLineItem:async(parent,after,type,segments,props)=>{
        if(++writes===failAt)return null;
        const line={guid:`line-${writes}`,parent_guid:parent?.guid||record.guid,type,segments,props,delete:async()=>{lines.splice(lines.indexOf(line),1);return true;}};
        lines.push(line);return line;
    }};
    return {record,lines,writes:()=>writes};
}

test('new projects have an editable brief, a real action and native deliverable links', async()=>{
    const plugin=new Plugin(),state=page();
    await plugin.initializeProject(state.record,{brief:'Launch the member portal',firstAction:'Agree the scope',deliverables:[{guid:'brief-page'}]});
    assert.ok(state.lines.some(l=>l.segments?.[0]?.text==='Launch the member portal'));
    assert.equal(state.lines.find(l=>l.type==='task').segments[0].text,'Agree the scope');
    assert.equal(state.lines.find(l=>l.segments?.[0]?.type==='ref').segments[0].text.guid,'brief-page');
    assert.equal((await plugin.initializeProject(state.record)).applied,false);
    assert.equal(state.lines.filter(l=>l.type==='task').length,1);
});

test('applying a project template preserves an existing working note without writing',async()=>{
    const plugin=new Plugin(),state=page([{guid:'existing',type:'heading',segments:[{type:'text',text:'Our agreed scope'}]}]);
    assert.equal((await plugin.initializeProject(state.record)).reason,'has-content');
    assert.equal(state.writes(),0);
});

test('failed template creation removes partial additions and preserves the migration placeholder',async()=>{
    const placeholder={guid:'old',type:'text',segments:[{type:'text',text:'Project workspace migrated from Obsidian.'}]};
    const plugin=new Plugin(),state=page([placeholder],4);
    await assert.rejects(plugin.initializeProject(state.record),/could not be saved/);
    assert.deepEqual(state.lines,[placeholder]);
});

test('archived and cancelled projects retain their actual status labels',()=>{
    assert.equal(projectStatusLabel('archived'),'Archived');
    assert.equal(projectStatusLabel('cancelled'),'Cancelled');
    assert.equal(projectStatusLabel('in_review'),'In Review');
});

test('a project cannot link its Client property to an arbitrary project page',async()=>{
    const plugin=new Plugin();let created=false;
    const projects={getGuid:()=> 'projects',getName:()=> 'Projects',getConfiguration:()=>({fields:[{label:'client',type:'record'}]}),createRecord:()=>{created=true;}};
    const clients={getGuid:()=> 'clients',getName:()=> 'Clients',getAllRecords:async()=>[{guid:'real-client',getName:()=> 'Example client'}]};
    plugin.data={getAllCollections:async()=>[projects,clients]};
    await assert.rejects(plugin.createConfiguredRecord('Projects','Example',{client:'other-project'}),/Choose a client/);
    assert.equal(created,false);
});
