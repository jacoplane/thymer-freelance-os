import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { connectMcp } from './thymer-mcp.mjs';
import { demoData } from './demo-data.mjs';

const args=process.argv.slice(2), index=args.indexOf('--workspace');
const workspace=index>=0?args[index+1]:'';
if(!/^W[0-9A-Z]{25}$/.test(workspace)) throw new Error('Pass an explicit empty demo workspace: --workspace W… [--apply]');
const call=await connectMcp(process.env.THYMER_MCP_ENDPOINT);
const target=(await call('list_workspaces',{})).workspaces.find(item=>item.guid===workspace);
if(!target||target.mcp_access!=='readwrite') throw new Error('The target workspace needs read/write MCP access.');
const collections=(await call('list_collections',{workspace})).collections;
const links={};
for(const role of ['Clients','Projects','Invoices','Library','Journal']){
    const collection=collections.find(item=>item.name===role);
    if(!collection)throw new Error(`Missing ${role}; run setup-workspace.mjs first.`);
    links[role]=collection.guid;
    const records=await call('list_records',{workspace,collection:collection.guid});
    if(records.records?.length)throw new Error(`${role} contains records. This seed command only runs against empty starter collections; it never merges sample content into existing work.`);
}
const demo=demoData();
console.log(`Target: ${target.name} (${workspace}). Fictional demo: ${demo.clients.length} clients, ${demo.projects.length} projects, ${demo.invoices.length} invoices.`);
if(!args.includes('--apply')){console.log('No changes made. Add --apply to seed this empty workspace.');process.exit(0);}
const manifest={workspace,collections:links,clients:{},projects:{},tasks:[],invoices:[],date:demo.today,review:demo.review,waiting:demo.waiting};
const directory=process.env.OS_DEMO_STATE_DIR||path.join(os.tmpdir(),'freelance-os-demo');
await fs.mkdir(directory,{recursive:true});
const manifestPath=path.join(directory,`${workspace}.json`);
const save=()=>fs.writeFile(manifestPath,JSON.stringify(manifest,null,2));
await save();
async function create(collection,title,properties){
    const result=await call('create_record',{workspace,collection:links[collection],title,properties});
    const guid=result.guid||result.record?.guid;
    if(!guid)throw new Error(`No record GUID returned for ${title}: ${JSON.stringify(result)}`);
    return guid;
}
for(const [title,status,plan,monthly_chf,billing_cycle,contact]of demo.clients){
    manifest.clients[title]=await create('Clients',title,{status,plan,monthly_chf,billing_cycle,contact,included_hours:monthly_chf?2:0});await save();
}
for(const project of demo.projects){
    const guid=manifest.projects[project.title]=await create('Projects',project.title,{client:manifest.clients[project.client],status:project.status,priority:project.priority,deadline:project.deadline});await save();
    await call('create_line_item',{workspace,record:guid,type:'text',content:'Fictional demo project for Freelance OS screenshots and onboarding.'});
    for(const [text,status,date,flag,focus]of project.tasks){
        const result=await call('create_line_item',{workspace,record:guid,type:'task',segments:[{type:'text',text},...(date?[{type:'datetime',text:date}]:[])]});
        const taskGuid=result.guid||result.line_item?.guid;
        if(!taskGuid)throw new Error(`No task GUID returned: ${JSON.stringify(result)}`);
        manifest.tasks.push({guid:taskGuid,recordGuid:guid,projectGuid:guid,text,status,date,flag,focus});await save();
        if(status!=='none')await call('set_task_status',{workspace,line_item:taskGuid,status});
    }
}
for(const [title,client,amount_chf,status,payment_status,issued,due]of demo.invoices){
    manifest.invoices.push(await create('Invoices',title,{invoice_id:title.split(' · ')[0],client:manifest.clients[client],amount_chf,currency:'CHF',status,payment_status,issued,due,...(payment_status==='paid'?{paid_date:demo.today}:{})}));await save();
}
const note=await create('Library','Care plans · Service guide',{type:'care-plan',status:'active'});
await call('insert_markdown',{workspace,record:note,markdown:'# Care plans\nFictional service menu for the demo workspace.\n\n- Essential: updates, backups and a monthly health check.\n- Studio: essential care plus small website improvements.\n- Commerce: storefront monitoring and checkout checks.'});
console.log(`Demo created. Local manifest for UI focus/review setup: ${manifestPath}`);
