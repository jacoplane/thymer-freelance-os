import { connectMcp } from './thymer-mcp.mjs';

async function main() {
  const call = await connectMcp();

  console.log('--- 1. Backfilling Invoices in Freelance OS ---');
  const freelanceInvoices = [
    {
      guid: '1GPTNEF9DBB5NNSTQ3P7VXRXPT',
      id: 'DEMO-001',
      client: 'Northwind Studio',
      project: 'Website refresh',
      amount: '3200 CHF',
      due: '2026-10-12',
      issued: '2026-09-28',
      paid: '2026-10-22',
      summary: 'Deposit invoice (50%) for the website refresh project covering discovery, sitemap, and initial wireframes.'
    },
    {
      guid: '1KKRZJ420EZHM43H6DA8Q262M2',
      id: 'DEMO-002',
      client: 'Maple & Moss',
      project: 'Online shop launch',
      amount: '4200 CHF',
      due: '2026-10-17',
      issued: '2026-10-03',
      paid: '2026-10-22',
      summary: 'Storefront implementation, payment gateway configuration, and inventory sync.'
    },
    {
      guid: '1W8M8PAKAD21KEEQNQHFGFHWWZ',
      id: 'DEMO-003',
      client: 'Orbit Coffee',
      project: 'Care plan · Q4',
      amount: '1200 CHF',
      due: '2026-10-20',
      issued: '2026-10-10',
      paid: '2026-10-22',
      summary: 'Monthly care plan covering updates, backups, performance monitoring, and support sessions.'
    },
    {
      guid: '1KEJEE8CA8T08HKXZ1DTJQR64S',
      id: 'DEMO-004',
      client: 'Northwind Studio',
      project: 'Website refresh',
      amount: '1200 CHF',
      due: '2026-10-15',
      issued: '2026-10-01',
      status: 'unpaid',
      summary: 'Design milestone deliverable approved on staging environment.'
    },
    {
      guid: '1EWRM7NGZEGH4855GFC3E20984',
      id: 'DEMO-005',
      client: 'Maple & Moss',
      project: 'Online shop launch',
      amount: '1800 CHF',
      due: '2026-10-26',
      issued: '2026-10-15',
      status: 'unconfirmed',
      summary: 'Final shop launch deployment, DNS migration, and QA sign-off.'
    },
    {
      guid: '1NDAR17NSTZRG1JHA1R7ETJK7E',
      id: 'DEMO-006',
      client: 'Cedarworks Co.',
      project: 'Member portal discovery',
      amount: '900 CHF',
      due: '2026-11-02',
      issued: '2026-10-19',
      status: 'unpaid',
      summary: 'Discovery sprint and architectural blueprint for the customer portal.'
    },
    {
      guid: '1J13TA0NR3PE9WD8GHMPF7H1PY',
      id: 'DEMO-007',
      client: 'Paper Lantern Books',
      project: 'Brand workshop',
      amount: '1600 CHF',
      due: '2026-11-12',
      issued: '2026-10-22',
      status: 'draft',
      summary: 'Brand identity workshop and typography system definition.'
    }
  ];

  for (const inv of freelanceInvoices) {
    const md = `## Invoice Summary & Scope
${inv.summary}

## Commercial & Payment Details
- **Client:** ${inv.client}
- **Project:** ${inv.project}
- **Amount & Currency:** ${inv.amount}
- **Payment Terms:** Net due ${inv.due}
- **Payment Method:** Swiss QR-bill / Bank Wire Transfer (Vermeulen Solutions)

## Delivery & Settlement Log
- **${inv.issued}**: Invoice generated (${inv.paid ? 'sent' : inv.status || 'sent'}).
${inv.paid ? `- **${inv.paid}**: Payment confirmed received and settled.` : `- **Status**: ${inv.status === 'unconfirmed' ? 'Payment sent / pending confirmation' : inv.status === 'draft' ? 'Draft' : 'Awaiting payment'}.`}`;

    await call('insert_markdown', {
      workspace: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2',
      record: inv.guid,
      markdown: md
    });
    console.log(`Backfilled ${inv.id} in Freelance OS`);
  }

  console.log('--- 2. Backfilling Support Sessions in Freelance OS ---');
  const supportSessions = [
    {
      guid: '1M452EHDCC71G93V6V5B2ZKZ7K',
      client: 'Northwind Studio',
      project: 'Website refresh',
      date: '2026-10-23',
      hours: '1.5',
      summary: 'Reviewed mobile navigation and agreed the next prototype changes.'
    },
    {
      guid: '1QPETPV014RREDZ3T5TQQPCDH4',
      client: 'Orbit Coffee',
      project: 'Care plan · Q4',
      date: '2026-10-23',
      hours: '1',
      summary: 'Reviewed updates and completed the monthly site health check.'
    },
    {
      guid: '1EZMXWQMA6JR2PAS45DDG78RNA',
      client: 'Maple & Moss',
      project: 'Online shop launch',
      date: '2026-10-23',
      hours: '0.75',
      summary: 'Checked checkout feedback and answered launch questions.'
    },
    {
      guid: '1KB4NMYW4Z4RF86K5HWEGQ9MX8',
      client: 'Northwind Studio',
      project: 'Website refresh',
      date: '2026-10-23',
      hours: '0.5',
      summary: 'Follow-up validation session'
    }
  ];

  for (const sess of supportSessions) {
    const md = `## Session Log & Delivered Work
- **Date & Duration:** ${sess.date} (${sess.hours} h)
- **Client & Project:** ${sess.client} / ${sess.project}
- **Summary:** ${sess.summary}

## Client Follow-Up
- [ ] Send session summary or updates to client`;

    await call('insert_markdown', {
      workspace: 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2',
      record: sess.guid,
      markdown: md
    });
    console.log(`Backfilled Support Session (${sess.client}) in Freelance OS`);
  }

  console.log('--- 3. Backfilling Invoices in jacoplane (Preserving existing notes) ---');
  const fac001Md = `## Commercial & Payment Details
- **Client:** Asseo Sculptures
- **Project:** Maintenance & Hosting
- **Amount & Currency:** 360 CHF
- **Payment Terms:** Net due 2026-11-08
- **Payment Method:** Swiss QR-bill / Bank Wire Transfer (Vermeulen Solutions)

## Delivery & Settlement Log
- **2026-10-09**: Invoice sent to client.
- **2026-10-12**: Payment confirmed received and settled.`;

  await call('insert_markdown', {
    workspace: 'WNN1JJG50ZQ6BE9S1T3HG85S57',
    record: '1QA2197GBC5GMWKWVGN9YQA14B',
    markdown: fac001Md
  });
  console.log('Appended archetype sections to FAC-2026-001 in jacoplane');

  const fac002Md = `## Commercial & Payment Details
- **Client:** Association Genevoise de Hockey sur Gazon
- **Project:** Maintenance March–December 2026
- **Amount & Currency:** 350 CHF
- **Payment Terms:** Net due 2026-11-08
- **Payment Method:** Swiss QR-bill / Bank Wire Transfer (Vermeulen Solutions)

## Delivery & Settlement Log
- **2026-10-09**: Invoice sent to client.
- **Status**: Payment sent / awaiting confirmation.`;

  await call('insert_markdown', {
    workspace: 'WNN1JJG50ZQ6BE9S1T3HG85S57',
    record: '1HDNG62PFWJHN1N9C32MWJ8NZD',
    markdown: fac002Md
  });
  console.log('Appended archetype sections to FAC-2026-002 in jacoplane');
}

main().catch(console.error);
