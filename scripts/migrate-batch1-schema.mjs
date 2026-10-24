import { connectMcp } from './thymer-mcp.mjs';

async function migrate() {
    const call = await connectMcp();
    console.log('Connected to Thymer MCP.');

    const workspaces = [
        {
            name: 'jacoplane',
            guid: 'WNN1JJG50ZQ6BE9S1T3HG85S57',
            clientsCol: '1FD58J39X6KJ4JK5F06T7P4TSR',
            projectsCol: '1B0J3X9Y8QS96C75M3QMT23DNW',
            invoicesCol: '1YT6YD3EYV6F06TZY5GKGVJMNR'
        },
        {
            name: 'Freelance OS',
            guid: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2',
            clientsCol: '1DCV1BDVHH7Q4QV1TYAR6ZZF6E',
            projectsCol: '16Z8HBEGE5GFSCYD4WN663GFJQ',
            invoicesCol: '1F7GZ294EPP3QNHS96BDGAVC1E'
        }
    ];

    for (const ws of workspaces) {
        console.log(`\n=== MIGRATING WORKSPACE: ${ws.name} (${ws.guid}) ===`);

        // 1. Clients collection
        const clientSchema = await call('get_collection_schema', { workspace: ws.guid, collection: ws.clientsCol });
        const clientProps = new Set(clientSchema.properties.map(p => p.name || p.id));

        if (!clientProps.has('estimated_value_chf')) {
            console.log('Adding estimated_value_chf to Clients...');
            await call('add_property_to_collection', {
                workspace: ws.guid,
                collection: ws.clientsCol,
                label: 'estimated_value_chf',
                type: 'number'
            });
            console.log('✓ Added estimated_value_chf to Clients');
        } else {
            console.log('- Clients already has estimated_value_chf');
        }

        if (!clientProps.has('source')) {
            console.log('Adding source to Clients...');
            await call('add_property_to_collection', {
                workspace: ws.guid,
                collection: ws.clientsCol,
                label: 'source',
                type: 'choice',
                choices: [
                    { label: 'referral' },
                    { label: 'website' },
                    { label: 'linkedin' },
                    { label: 'inbound' },
                    { label: 'outbound' },
                    { label: 'other' }
                ]
            });
            console.log('✓ Added source to Clients');
        } else {
            console.log('- Clients already has source');
        }

        // 2. Projects collection
        const projectSchema = await call('get_collection_schema', { workspace: ws.guid, collection: ws.projectsCol });
        const projectProps = new Set(projectSchema.properties.map(p => p.name || p.id));

        if (!projectProps.has('budget_chf')) {
            console.log('Adding budget_chf to Projects...');
            await call('add_property_to_collection', {
                workspace: ws.guid,
                collection: ws.projectsCol,
                label: 'budget_chf',
                type: 'number'
            });
            console.log('✓ Added budget_chf to Projects');
        } else {
            console.log('- Projects already has budget_chf');
        }

        if (!projectProps.has('fee_type')) {
            console.log('Adding fee_type to Projects...');
            await call('add_property_to_collection', {
                workspace: ws.guid,
                collection: ws.projectsCol,
                label: 'fee_type',
                type: 'choice',
                choices: [
                    { label: 'fixed' },
                    { label: 'hourly' },
                    { label: 'retainer' },
                    { label: 'non_billable' }
                ]
            });
            console.log('✓ Added fee_type to Projects');
        } else {
            console.log('- Projects already has fee_type');
        }

        // 3. Invoices collection
        const invoiceSchema = await call('get_collection_schema', { workspace: ws.guid, collection: ws.invoicesCol });
        const invoiceProps = new Set(invoiceSchema.properties.map(p => p.name || p.id));

        if (!invoiceProps.has('project')) {
            console.log('Adding project link to Invoices...');
            await call('add_property_to_collection', {
                workspace: ws.guid,
                collection: ws.invoicesCol,
                label: 'project',
                type: 'record'
            });
            console.log('✓ Added project link to Invoices');
        } else {
            console.log('- Invoices already has project');
        }
    }

    console.log('\nMigration complete across all collections and workspaces!');
}

migrate().catch(console.error);
