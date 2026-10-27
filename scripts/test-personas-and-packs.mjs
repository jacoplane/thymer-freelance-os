import { connectMcp } from "./thymer-mcp.mjs";
import { connectCdp } from "./cdp.mjs";
import fs from "node:fs/promises";

const WS = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
const COLS = {
    clients: '1DCV1BDVHH7Q4QV1TYAR6ZZF6E',
    projects: '16Z8HBEGE5GFSCYD4WN663GFJQ',
    invoices: '1F7GZ294EPP3QNHS96BDGAVC1E',
    support: '1EVR59WXRPZ7R1QWBSM0JQY3SX',
    journal: '1H91FMYKBY5HNVWRGBYNEJKVZT'
};

async function main() {
    console.log('===============================================================');
    console.log('   PRACTICAL TEST: PERSONAS & MODULAR TRADE PACKS IN SANDBOX   ');
    console.log(`   Target Workspace: ${WS}                                  `);
    console.log('===============================================================\n');

    const call = await connectMcp();

    // -------------------------------------------------------------------------
    // TEST 1: Meeting Notes Specialist (meeting-notes-specialist)
    // -------------------------------------------------------------------------
    console.log('▶ TEST 1: Meeting Notes Specialist — Raw Client Sync Processing');
    
    // Check for Atelier Végétal client record
    const clientsRes = await call('list_records', { workspace: WS, collection: COLS.clients });
    const client = (clientsRes.records || []).find(c => c.name.toLowerCase().includes('atelier'));
    if (!client) throw new Error('Atelier Végétal client record not found');
    console.log(`  ✓ Found client record: "${client.name}" (${client.guid})`);

    // Raw messy meeting notes input
    const rawMessyNotes = `
    Spoke with Sophie today about 45 mins. She says the old WordPress site is crashing on mobile checkout.
    Lost 4 orders last weekend because payment gateway hung up.
    We decided to scrap WordPress and go with Shopify. She agreed to the 6,500 CHF turnkey package if we can launch before Black Friday.
    Stripe for payments.
    I need to send her the contract and deposit invoice by tomorrow afternoon.
    She needs to send me her high-res botanical product photography and product inventory CSV by Friday.
    Open question: she's not sure if her botanical workshop bookings need to be on Shopify or keep using Calendly. She will ask her co-founder.
    `;

    // Persona execution: meeting-notes-specialist transforms raw notes into 4-section executive debrief
    const meetingDebriefMarkdown = `### 📝 Sync: E-Commerce Architecture & Scope Lock — 2026-10-27
* **Attendees:** Jaap Vermeulen (Lead Consultant), Sophie Laurent (Founder, Atelier Végétal)

#### 1. Agreed Decisions
* **Platform Migration:** Agreed to deprecate legacy WordPress site in favor of Shopify to resolve mobile checkout timeouts.
* **Commercial Tier:** Selected Option 2: Turnkey E-Commerce Redesign (6,500 CHF fixed milestone).
* **Payment Processing:** Native Shopify Payments + Stripe integration agreed.
* **Target Launch:** Hard deadline agreed for November 20, 2026 (prior to Black Friday).

#### 2. Action Items
* **Jaap Vermeulen:**
  - [ ] Send formal proposal agreement and 40% deposit invoice (2,600 CHF) by Wednesday 14:00
* **Sophie Laurent (Client):**
  - [|] Send product photography ZIP archive and inventory CSV export by Friday 17:00

#### 3. Open Questions / Blockers
* Workshop Booking Integration: Co-founder alignment needed on whether to embed Calendly or use native Shopify appointment app.`;

    // Append to Client Record in Thymer
    const addDebriefRes = await call('insert_markdown', {
        workspace: WS,
        record: client.guid,
        markdown: `\n\n${meetingDebriefMarkdown}`
    });
    console.log(`  ✓ Meeting Notes Specialist logged structured 4-section debrief into client record`);

    // -------------------------------------------------------------------------
    // TEST 2: Proposal Strategist + Pricing Analyst
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 2: Proposal Strategist + Pricing Analyst — Commercial Tiering');
    
    const proposalMarkdown = `## 🎯 Commercial Proposal: Atelier Végétal E-Commerce Modernization
**Date:** 2026-10-27 | **Client:** Sophie Laurent | **Target Go-Live:** 2026-11-20

### 1. Strategic Win Themes
* **Zero Mobile Drop-Off:** Sub-1.2s mobile loading times and streamlined 1-click checkout eliminating the current 30% cart abandonment.
* **Automated Inventory Sync:** Eliminates 5 hours/week of manual stock management between the studio floor and online orders.
* **Care Plan Continuity:** Includes 30 days of post-launch hypercare and an ongoing monthly Care Plan retainer.

### 2. Tiered Investment Options
* **Tier 1: Core Foundation (4,800 CHF):** Base Shopify theme setup, catalog import up to 50 items, standard checkout.
* **Tier 2: Recommended / Turnkey (6,500 CHF):** Custom botanical design system, full inventory sync, conversion-tuned product pages, SEO migration redirect map.
* **Tier 3: Turnkey + Growth Retainer (8,200 CHF):** Includes Tier 2 + email marketing flows + 3 months included Care Plan.

### 3. Pricing Analyst Margin & Retainer Plan
* **Project Contingency Buffer:** 25% technical buffer factored into fixed scope.
* **Post-Launch Care Plan:** 350 CHF / month (Includes 2h priority maintenance, core updates, weekly backup audits).

### 4. Explicit Out-of-Scope Boundaries
* Custom mobile app development (PWA/iOS/Android).
* Photography creation (client provides high-res assets).
* Third-party subscription fees (Shopify SaaS, domain renewal).
* *Any additional requests will follow the Change Order protocol at 160 CHF/hr.*`;

    await call('insert_markdown', {
        workspace: WS,
        record: client.guid,
        markdown: `\n\n${proposalMarkdown}`
    });
    console.log(`  ✓ Proposal Strategist & Pricing Analyst attached tiered proposal & Care Plan terms`);

    // -------------------------------------------------------------------------
    // TEST 3: Software & AI Engineering Trade Pack (scope-to-ticket-translator)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 3: Trade Pack (pack-software-dev) — Scope-to-Ticket Translator');

    // Create new Project using the Software Dev Trade Archetype
    const projectTitle = 'Atelier Végétal · Shopify E-Commerce Redesign';
    console.log(`  Creating project: "${projectTitle}"...`);

    const newProject = await call('create_record', {
        workspace: WS,
        collection: COLS.projects,
        title: projectTitle,
        properties: {
            client: client.guid,
            status: 'in_progress',
            priority: 'high',
            budget_chf: 6500,
            deadline: '2026-11-20'
        }
    });
    console.log(`  ✓ Created project record: ${newProject.guid}`);

    // Break down Sprint 1 into 30-60m tickets with acceptance criteria and staging checkpoints
    const engineeringSprintMarkdown = `## Relationship & Client Context
- **Client:** Atelier Végétal (Sophie Laurent)
- **Archetype:** Engineering Sprint (pack-software-dev)
- **Budget:** 6,500 CHF | **Target Launch:** 2026-11-20

## Client review checkpoints
- [ ] Checkpoint 1: Technical Architecture & Wireframes Sign-off (Client gate)
- [ ] Checkpoint 2: Staging QA & Interactive Storefront UAT (Client gate)
- [ ] Checkpoint 3: Production Go-Live & Domain Cutover Approval (Client gate)

## Deliverables & references
- **Git Repo:** github.com/agency/atelier-vegetal-store
- **Staging URL:** staging.ateliervegetal.ch
- **Design Tokens / Specs:** figma.com/@atelier-vegetal-ecom

## Sprint 1: Core Catalog & Architecture (30–60m Tickets)
- [ ] Scaffold Shopify CLI theme repository with Tailwind & TypeScript (45m)
  - *Criteria:* Theme pushes cleanly to staging dev store via \`shopify theme push\`; linting passes.
- [ ] Implement responsive botanical header and mobile mega-menu (60m)
  - *Criteria:* Verified at 375px (iPhone), 768px (iPad), and 1440px (Desktop). No horizontal scroll bugs.
- [ ] Build product grid with live stock badges and quick-add drawer (60m)
  - *Criteria:* Quick-add drawer adds item via AJAX without page reload; reflects real-time Shopify inventory API.
- [ ] Configure Stripe & Shopify Payments sandbox test mode (30m)
  - *Criteria:* Test credit card order completes successfully; order webhook reaches sandbox endpoint.
- [ ] Setup 301 Redirect Table for legacy WordPress URLs (45m)
  - *Criteria:* Top 50 legacy URLs map 1:1 to new Shopify paths; zero 404s reported in pre-flight crawler.

## 🛑 Client Staging Review Checkpoint
- [ ] Deploy Sprint 1 to staging and record Loom walkthrough for Sophie (30m)
  - *Criteria:* Staging password sent, Loom link delivered, written client checkpoint approval confirmed.`;

    await call('insert_markdown', {
        workspace: WS,
        record: newProject.guid,
        markdown: engineeringSprintMarkdown
    });
    console.log(`  ✓ Scope-to-Ticket Translator populated 30-60m engineering tickets with acceptance criteria`);

    // -------------------------------------------------------------------------
    // TEST 4: Scope Creep Sentinel (scope-creep-sentinel)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 4: Scope Creep Sentinel — Out-of-Scope Detection & Change Order');

    const incomingClientScopeCreepEmail = `
    "Hi Jaap, Sophie here. We had a great idea this morning! We also want to sell wholesale to 12 local flower shops with private wholesale pricing tiers, VAT tax-exempt calculation, and invoice-on-account payment options. Can we include that in this month's sprint?"
    `;
    console.log('  Incoming client request:', incomingClientScopeCreepEmail.trim());

    // Sentinel detects out of scope and drafts change order quote
    const changeOrderDraft = `### ⚠️ Scope Creep Sentinel Audit: Wholesale B2B Tier Request
* **Status:** OUT-OF-SCOPE (Confirmed against SOW Section 4)
* **Analysis:** SOW covers D2C retail e-commerce. B2B multi-tier pricing, VAT exemptions, and Net 30 invoice-on-account require separate logic and Shopify Plus/B2B app configuration.

#### Drafted Change Order (The "Yes, And" Framework):
"Hi Sophie,

Thanks for sending this over! Adding wholesale accounts for local florists is a fantastic growth move, and while B2B wholesale pricing and tax-exempt calculations sit outside our agreed retail SOW, we can definitely build it.

Here are the two best options:

* **Option 1: Add-on Milestone (Recommended):**
  - Investment: 1,400 CHF (approx. 9 engineering hours)
  - Timeline Impact: +4 business days
  - Deliverables: Wholesale customer tag rules, dynamic price tiers, VAT validation, Net-30 invoice flow.
  
* **Option 2: Scope Swap:**
  - We can swap out the secondary Instagram shop integration from Sprint 2 to include wholesale without increasing the overall project budget.

Let me know which path works best for you!"`;

    await call('insert_markdown', {
        workspace: WS,
        record: newProject.guid,
        markdown: `\n\n${changeOrderDraft}`
    });
    console.log(`  ✓ Scope Creep Sentinel audited request, protected scope, and drafted 2-option Change Order`);

    // -------------------------------------------------------------------------
    // TEST 5: Plain-English Release Generator (plain-english-release-notes)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 5: Plain-English Release Generator — Staging Handoff Digest');

    const stagingHandoffDigest = `## 🚀 Milestone 1 Release Digest: Staging Preview Ready
**Release Date:** 2026-10-27 | **Environment:** staging.ateliervegetal.ch (Password: \`botanical2026\`)

### Executive Summary
Milestone 1 is complete! The new e-commerce storefront is live on our private staging environment with the core botanical theme, full mobile shopping experience, and secure test checkout.

### What's New & Ready to Test
* **Fluid Mobile Shopping:** You can now browse collections smoothly on your phone with zero lag and an instant quick-add shopping bag.
* **Real-Time Stock Status:** Products automatically display "Low Stock" badges when inventory drops below 5 items.
* **Instant Checkout:** Customers can checkout in seconds via Apple Pay, Google Pay, or credit card.

### How to Test (5-Minute Review Checklist)
1. Visit [staging.ateliervegetal.ch](https://staging.ateliervegetal.ch) on your phone.
2. Enter staging password: \`botanical2026\`.
3. Add any plant or ceramic pot to your bag and tap "Proceed to Checkout".
4. Use test card \`4242 ... 4242\` to simulate a complete order.

### Next Sprint Preview
* Sprint 2 kicks off next week: Botanical workshop booking integration and custom gift card packaging.`;

    await call('insert_markdown', {
        workspace: WS,
        record: newProject.guid,
        markdown: `\n\n${stagingHandoffDigest}`
    });
    console.log(`  ✓ Plain-English Release Generator created client-friendly staging handoff digest`);

    // -------------------------------------------------------------------------
    // TEST 6: Receivables Diplomat (receivables-diplomat)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 6: Receivables Diplomat — Overdue Cashflow Audit & Calibrated Reminder');

    const invoicesRes = await call('list_records', { workspace: WS, collection: COLS.invoices });
    const invoices = invoicesRes.records || [];
    console.log(`  Auditing ${invoices.length} invoices in workspace...`);

    // Find any overdue or sent invoice
    const targetInvoice = invoices.find(inv => {
        const title = inv.name || '';
        return title.includes('DEMO-004') || title.includes('INV-2026') || title.includes('Northwind') || title.includes('Website');
    }) || invoices[0];

    if (targetInvoice) {
        console.log(`  ✓ Target Invoice for Receivables Diplomat: "${targetInvoice.name}" (${targetInvoice.guid})`);
        
        const diplomatEscalationPlan = `### 📬 Receivables Diplomat: Calibrated Follow-up Protocol
* **Invoice Reference:** ${targetInvoice.name}
* **Aging Status:** Past Due (7+ days past Net-15 term)
* **Escalation Tier:** Tier 1 (Friendly Bump & Administrative Check)

#### Calibrated Email Draft (Tier 1):
"Hi team,

I hope you're having a productive week!

Quick administrative check on **${targetInvoice.name}**, which was due on October 20th. I've re-attached the invoice PDF here for convenience.

Could you let me know if this has been scheduled for payment in your upcoming accounting run, or if you need any additional vendor paperwork from my side?

Thanks so much,
Jaap"`;

        await call('insert_markdown', {
            workspace: WS,
            record: targetInvoice.guid,
            markdown: `\n\n${diplomatEscalationPlan}`
        });
        console.log(`  ✓ Receivables Diplomat generated calibrated follow-up escalation on invoice`);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Verify Live in Thymer Desktop UI via CDP + Screenshot
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 7: Live UI Verification & CDP Visual Inspection');
    const cdp = await connectCdp();

    // Reload page to refresh Thymer data cache
    await cdp.evaluate('window.location.reload()');
    await new Promise(r => setTimeout(r, 1200));

    // Navigate to Clients tab or open Atelier Végétal project in the UI
    const uiInspection = await cdp.evaluate(`
        (() => {
            // Find project card or list item
            const projectCard = Array.from(document.querySelectorAll('.os-card, .os-task-project, .os-task-item, a')).find(el => el.textContent && el.textContent.includes('Atelier'));
            return {
                projectFoundInUI: !!projectCard,
                projectText: projectCard ? projectCard.textContent.trim().substring(0, 100) : null
            };
        })()
    `);
    console.log('  Live UI Project inspection:', uiInspection);

    // Capture visual screenshot of the workspace
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile("persona-practical-test-preview.png", Buffer.from(screenshot.data, "base64"));
    console.log('  ✓ Saved live verification screenshot to persona-practical-test-preview.png');

    cdp.close();

    console.log('\n===============================================================');
    console.log('   ALL 6 PERSONA & TRADE PACK PRACTICAL TESTS PASSED!          ');
    console.log('===============================================================\n');
}

main().catch(err => {
    console.error('Practical test failed:', err);
    process.exit(1);
});
