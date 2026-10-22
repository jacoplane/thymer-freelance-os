import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9444',defaultViewport:null});
const marker=`Community verification ${Date.now()}`;
const workspace=process.env.THYMER_WORKSPACE;
if(!workspace)throw new Error('Set THYMER_WORKSPACE to the explicit target workspace GUID before running live creation checks.');
try{const p=(await b.pages()).find(p=>p.url().includes('thymer.com'));const c=await p.createCDPSession();await c.send('Emulation.clearDeviceMetricsOverride');await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
try{
 await p.evaluate(async ({marker,workspace})=>{const plugin=window.__freelanceOs;if(plugin.getWorkspaceGuid()!==workspace)throw Error('Wrong workspace');plugin.workflowMode='overview';await plugin.render(plugin.activePanel);plugin.showCreateClientModal(plugin.activePanel,await plugin.loadData());document.querySelector('.input-title').value=marker+' client';document.querySelector('.input-mrr').value='85';document.querySelector('.input-status').value='active';document.querySelector('.input-plan').value='Support';document.querySelector('.btn-submit').click();},{marker,workspace});
 await p.waitForFunction(()=>!document.querySelector('.os-modal-backdrop'),{polling:100,timeout:5000});
 const client=await p.evaluate(async marker=>(await window.__freelanceOs.loadData()).clients.find(item=>item.name===marker+' client'),marker);
 assert.ok(client);assert.equal(client.mrr,85);assert.equal(client.status,'active');
 await p.evaluate(async ({marker,guid})=>{const plugin=window.__freelanceOs;plugin.showCreateProjectModal(plugin.activePanel,await plugin.loadData());document.querySelector('.input-title').value=marker+' project';document.querySelector('.input-client').value=guid;document.querySelector('.input-priority').value='high';document.querySelector('.input-deadline').value='2030-01-12';document.querySelector('.btn-submit').click();},{marker,guid:client.guid});
 await p.waitForFunction(()=>!document.querySelector('.os-modal-backdrop'),{polling:100,timeout:5000});
 const project=await p.evaluate(async marker=>{const {record,...project}=(await window.__freelanceOs.loadData()).projects.find(item=>item.name===marker+' project');return project;},marker);
 assert.ok(project);assert.equal(project.priority,'high');assert.equal(project.status,'in_progress');assert.equal(project.deadline,'2030-01-12');assert.equal(project.clientGuid,client.guid);
 await p.evaluate(async marker=>{const plugin=window.__freelanceOs;plugin.currentTab='projects';plugin.projectFilter='all';await plugin.render(plugin.activePanel);[...document.querySelectorAll('.os-project-card')].find(card=>card.querySelector('.os-card-title')?.textContent===marker+' project').querySelector('.os-badge').click();},marker);
 await p.waitForFunction(async marker=>(await window.__freelanceOs.loadData()).projects.find(item=>item.name===marker+' project')?.status==='completed',{polling:100,timeout:5000},marker);
 await p.evaluate(async ({marker,guid})=>{const plugin=window.__freelanceOs;plugin.showCreateInvoiceModal(plugin.activePanel,await plugin.loadData());document.querySelector('.input-title').value=marker+' invoice';document.querySelector('.input-client').value=guid;document.querySelector('.input-amount').value='2450';document.querySelector('.input-status').value='paid';document.querySelector('.input-due').value='2030-01-31';document.querySelector('.btn-submit').click();},{marker,guid:client.guid});
 await p.waitForFunction(()=>!document.querySelector('.os-modal-backdrop'),{polling:100,timeout:5000});
 const invoice=await p.evaluate(async marker=>{const {record,...invoice}=(await window.__freelanceOs.loadData()).invoices.find(item=>item.name===marker+' invoice');return invoice;},marker);
 assert.equal(invoice.stage,'sent');assert.equal(invoice.status,'paid');assert.equal(invoice.currency,'CHF');assert.equal(invoice.amount,2450);assert.equal(invoice.clientGuid,client.guid);assert.equal(invoice.dueDate,'2030-01-31');
 console.log(JSON.stringify({client:'created with recurring value and status',project:'created with linked client, priority, status and deadline',invoice:'created with sent stage, paid state, CHF currency, linked client and due date'}));
}finally{
 await p.evaluate(async marker=>{const plugin=window.__freelanceOs;document.querySelector('.os-modal-backdrop')?.remove();for(const collection of await plugin.data.getAllCollections())for(const record of await collection.getAllRecords())if(record.getName().startsWith(marker))record.trash();plugin.workflowMode='overview';await plugin.render(plugin.activePanel);},marker);
 await c.send('Emulation.setFocusEmulationEnabled',{enabled:false});
}
}finally{await b.disconnect();}
