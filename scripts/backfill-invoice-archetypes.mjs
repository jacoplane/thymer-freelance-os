import { connectMcp } from './thymer-mcp.mjs';

function getProp(obj, key) {
    const val = obj?.properties?.[key];
    if (Array.isArray(val)) return val[1];
    return val;
}

/**
 * Idempotent backfill script for Invoice Archetypes:
 * 1. Invoice Summary & Scope (with [+ Add deliverable])
 * 2. Commercial & Payment Details (with QR-IBAN & [+ Copy payment details])
 * 3. Delivery & Settlement Log (with [+ Record payment] or [+ Mark sent])
 *
 * Strictly preserves all existing files, notes, PDF attachments, and amounts.
 */
async function backfillInvoiceArchetypes() {
    const call = await connectMcp();
    console.log('Connected to Thymer MCP.');

    const workspaces = [
        { guid: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2', name: 'Freelance OS' },
        { guid: 'WNN1JJG50ZQ6BE9S1T3HG85S57', name: 'jacoplane' }
    ];

    for (const ws of workspaces) {
        console.log(`\n======================================================`);
        console.log(`Auditing & Upgrading Invoices in: ${ws.name} (${ws.guid})`);
        console.log(`======================================================`);

        const cols = await call('list_collections', { workspace: ws.guid });
        const invCol = cols.collections.find(c => c.name.toLowerCase().includes('invoice'));
        if (!invCol) {
            console.log('No Invoices collection found in', ws.name);
            continue;
        }

        const records = await call('list_records', { workspace: ws.guid, collection: invCol.guid });
        console.log(`Found ${records.records?.length || 0} invoices.`);

        for (const invoice of records.records || []) {
            let rec = await call('get_record', { workspace: ws.guid, record: invoice.guid, format: 'structured' });
            const title = rec.name || invoice.name || invoice.guid;
            let items = rec.items || [];
            let updated = false;

            const stageProp = (getProp(invoice, 'status') || '').toLowerCase();
            const paymentProp = (getProp(invoice, 'payment_status') || '').toLowerCase();

            // Detect payment state from property or document text
            const fullDocText = items.map(i => i.text || '').join(' ').toLowerCase();
            const isPaid = paymentProp === 'paid' || fullDocText.includes('payment confirmed received and settled') || fullDocText.includes('settled in full');
            const isSent = stageProp === 'sent' || (!isPaid && (fullDocText.includes('invoice sent') || fullDocText.includes('awaiting payment') || fullDocText.includes('payment sent')));

            // 1. Check Invoice Summary & Scope
            const scopeHeading = items.find(i => i.type === 'heading' && (
                i.text?.toLowerCase().includes('summary') ||
                i.text?.toLowerCase().includes('scope') ||
                i.text?.toLowerCase().includes('deliverable')
            ));

            if (scopeHeading) {
                const hasAddDeliverable = items.some(i => i.type === 'linkbtn' && (
                    i.text?.includes('Add deliverable') ||
                    i.text?.includes('deliverable')
                ));
                if (!hasAddDeliverable) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: invoice.guid,
                        parent: scopeHeading.guid,
                        type: 'linkbtn',
                        content: '+ Add deliverable'
                    });
                    console.log(`  ✓ Inserted [+ Add deliverable] into [${title}]`);
                    updated = true;
                }
            }

            // Refresh items if updated
            if (updated) {
                rec = await call('get_record', { workspace: ws.guid, record: invoice.guid, format: 'structured' });
                items = rec.items || [];
                updated = false;
            }

            // 2. Check Commercial & Payment Details
            const commHeading = items.find(i => i.type === 'heading' && (
                i.text?.toLowerCase().includes('commercial') ||
                i.text?.toLowerCase().includes('payment')
            ));

            if (commHeading) {
                const hasQrIban = items.some(i => (i.text || '').includes('QR-IBAN') || (i.text || '').includes('CH44 0076'));
                if (!hasQrIban) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: invoice.guid,
                        parent: commHeading.guid,
                        type: 'ulist',
                        content: 'QR-IBAN: CH44 0076 2011 6238 5295 8'
                    });
                    console.log(`  ✓ Inserted QR-IBAN into [${title}]`);
                    updated = true;
                }

                const hasCopyBtn = items.some(i => i.type === 'linkbtn' && (
                    i.text?.includes('Copy payment') ||
                    i.text?.includes('copy payment')
                ));
                if (!hasCopyBtn) {
                    await call('create_line_item', {
                        workspace: ws.guid,
                        record: invoice.guid,
                        parent: commHeading.guid,
                        type: 'linkbtn',
                        content: '+ Copy payment details'
                    });
                    console.log(`  ✓ Inserted [+ Copy payment details] into [${title}]`);
                    updated = true;
                }
            }

            // Refresh items if updated
            if (updated) {
                rec = await call('get_record', { workspace: ws.guid, record: invoice.guid, format: 'structured' });
                items = rec.items || [];
                updated = false;
            }

            // 3. Check Delivery & Settlement Log
            const deliveryHeading = items.find(i => i.type === 'heading' && (
                i.text?.toLowerCase().includes('delivery') ||
                i.text?.toLowerCase().includes('settlement') ||
                i.text?.toLowerCase().includes('status')
            ));

            if (deliveryHeading) {
                if (isPaid) {
                    // Paid: Ensure clean settled status, no pending buttons
                    const actionBtns = items.filter(i => i.type === 'linkbtn' && (
                        i.text?.includes('Record payment') ||
                        i.text?.includes('Mark sent')
                    ));
                    for (const btn of actionBtns) {
                        await call('trash_line_item', {
                            workspace: ws.guid,
                            line_item: btn.guid
                        });
                        console.log(`  ✓ Removed obsolete action button from settled invoice [${title}]`);
                    }
                } else if (isSent) {
                    // Sent & Unpaid: Ensure [+ Record payment] exists, remove any stray [+ Mark sent]
                    const markSentBtns = items.filter(i => i.type === 'linkbtn' && i.text?.includes('Mark sent'));
                    for (const btn of markSentBtns) {
                        await call('trash_line_item', {
                            workspace: ws.guid,
                            line_item: btn.guid
                        });
                        console.log(`  ✓ Removed stray [+ Mark sent] from sent invoice [${title}]`);
                    }

                    const hasRecordPaymentBtn = items.some(i => i.type === 'linkbtn' && i.text?.includes('Record payment'));
                    if (!hasRecordPaymentBtn) {
                        await call('create_line_item', {
                            workspace: ws.guid,
                            record: invoice.guid,
                            parent: deliveryHeading.guid,
                            type: 'linkbtn',
                            content: '+ Record payment'
                        });
                        console.log(`  ✓ Inserted [+ Record payment] into [${title}]`);
                    }
                } else {
                    // Draft / Ready: Ensure [+ Mark sent] exists
                    const hasMarkSentBtn = items.some(i => i.type === 'linkbtn' && i.text?.includes('Mark sent'));
                    if (!hasMarkSentBtn) {
                        await call('create_line_item', {
                            workspace: ws.guid,
                            record: invoice.guid,
                            parent: deliveryHeading.guid,
                            type: 'linkbtn',
                            content: '+ Mark sent'
                        });
                        console.log(`  ✓ Inserted [+ Mark sent] into [${title}]`);
                    }
                }
            }
        }
    }

    console.log('\nInvoice Archetype Backfill Completed Successfully!');
}

backfillInvoiceArchetypes().catch(err => {
    console.error('Fatal backfill error:', err);
    process.exit(1);
});
