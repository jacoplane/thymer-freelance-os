import fs from 'node:fs';
import path from 'node:path';

const allPacksSkills = [
    {
        packId: 'pack-design-creative',
        skills: [
            {
                id: 'revision-limit-tracker',
                name: 'Revision Limit Tracker',
                description: 'Enforces contractual revision rounds and flags scope creep before extra iterations in Thymer.',
                content: `---
name: revision-limit-tracker
description: Enforces contractual revision rounds and flags scope creep before extra iterations in Thymer.
---

# Revision Limit Tracker

The **Revision Limit Tracker** safeguards design margins by strictly tracking client feedback iterations against the agreed Statement of Work (SOW) allowance (typically 2 included rounds).

## Core Directives

1. **Iteration Round Counter:**
   - Every design milestone must log which feedback cycle is currently executing:
     \`\`\`text
     - [ ] Round 1 Client Review (Completed 2026-10-15)
     - [ ] Round 2 Client Review — FINAL INCLUDED ROUND (In Progress)
     \`\`\`

2. **Scope Creep Warning at Limit:**
   - When Round 2 feedback is submitted, immediately notify the client:
     > "We have incorporated all notes for Round 2 (the final round included in our initial scope). Any subsequent rounds or fundamental layout pivots will be billed under our standard hourly revision rate (or Change Order)."

3. **Change Order Trigger:**
   - If the client requests additional modifications after Round 2 sign-off, draft an explicit Addendum or hourly Change Order before making any file changes.
`
            },
            {
                id: 'feedback-consolidator',
                name: 'Feedback Consolidator',
                description: 'Aggregates scattered Figma, email, and chat comments into prioritized, conflict-free design revisions in Thymer.',
                content: `---
name: feedback-consolidator
description: Aggregates scattered Figma, email, and chat comments into prioritized, conflict-free design revisions in Thymer.
---

# Feedback Consolidator

The **Feedback Consolidator** eliminates chaotic client feedback by ingesting comments scattered across Figma pins, email threads, and Slack messages and converting them into a single, unified, de-duplicated revision checklist in Thymer.

## Core Directives

1. **Conflict Resolution:**
   - If Stakeholder A asks for "more whitespace" and Stakeholder B asks to "fit everything above the fold", flag the contradiction explicitly and require a single internal client owner to reconcile.

2. **Actionable Checklist Hierarchy:**
   - Categorize comments into:
     - **P0 Blockers:** Broken hierarchy, accessibility/contrast failures, brand guide violations.
     - **P1 Content & Copy:** Typos, updated photography, revised headline lengths.
     - **P2 Subjective Preferences:** "Make it pop", minor aesthetic polish.

3. **Thymer Log Entry:**
   - Insert the consolidated review checklist under the project's **Client Communication & Decisions** section with timestamps.
`
            },
            {
                id: 'asset-handoff-checklist',
                name: 'Asset Handoff Checklist',
                description: 'Generates structured delivery manifests (SVG, PNG, design tokens, fonts, specs) for client sign-off in Thymer.',
                content: `---
name: asset-handoff-checklist
description: Generates structured delivery manifests (SVG, PNG, design tokens, fonts, specs) for client sign-off in Thymer.
---

# Asset Handoff Checklist

The **Asset Handoff Checklist** ensures zero-confusion file delivery, creating clear delivery manifests for engineering teams or marketing clients upon project completion.

## Core Directives

1. **Multi-Format Export Manifest:**
   - Specify exact deliverables:
     - Vectors: Optimized SVG, EPS, PDF (CMYK for print).
     - Rasters: 1x, 2x, 3x WebP/PNG with alpha transparency.
     - Typography: Webfont licenses and Google Fonts pairings.
     - Design Tokens: JSON/CSS custom properties for colors, spacing, and typography.

2. **Handoff Verification Checkpoint:**
   - Insert a native client sign-off task in Thymer:
     \`\`\`text
     - [ ] Asset Pack Handoff Verification
       - Criteria: Google Drive/Dropbox shared with view/edit access; test download verified; written acceptance received from client.
     \`\`\`
`
            }
        ]
    },
    {
        packId: 'pack-writing-editorial',
        skills: [
            {
                id: 'brief-voice-extractor',
                name: 'Voice & Brief Extractor',
                description: 'Extracts brand voice rules, target personas, and key messages from client input into Thymer.',
                content: `---
name: brief-voice-extractor
description: Extracts brand voice rules, target personas, and key messages from client input into Thymer.
---

# Voice & Brief Extractor

The **Voice & Brief Extractor** parses brand style guides, client questionnaires, and competitor examples into an operational editorial guideline.

## Core Directives

1. **Tone & Lexicon Matrix:**
   - Define the four voice dimensions:
     - Funny vs. Serious
     - Formal vs. Casual
     - Respectful vs. Irreverent
     - Matter-of-fact vs. Enthusiastic
   - Explicitly list banned buzzwords ("synergy", "paradigm", "cutting-edge") and preferred terminology.

2. **Persona Framing:**
   - Document the primary reader, their pain points, and the single core takeaway of the piece.
`
            },
            {
                id: 'editorial-status-tracker',
                name: 'Editorial Status Tracker',
                description: 'Maintains multi-stage content pipelines from pitch through draft, review, and live in Thymer.',
                content: `---
name: editorial-status-tracker
description: Maintains multi-stage content pipelines from pitch through draft, review, and live in Thymer.
---

# Editorial Status Tracker

The **Editorial Status Tracker** manages content deliverables through a strict Kanban workflow inside Thymer projects.

## Core Directives

1. **Standard Editorial Stages:**
   - \`[ ] 1. Outline & Angle Approval\`
   - \`[ ] 2. First Draft Completed\`
   - \`[ ] 3. Client Copy Review\`
   - \`[ ] 4. Revisions & Proofreading\`
   - \`[ ] 5. Final Delivery / Publication\`

2. **Bottleneck Alert:**
   - If a piece remains in "Client Copy Review" for more than 4 business days, prompt a polite follow-up to maintain the publication calendar.
`
            },
            {
                id: 'publishing-package-builder',
                name: 'Publishing Package Builder',
                description: 'Formats final copy with SEO metadata, excerpts, OpenGraph tags, and slugs in Thymer.',
                content: `---
name: publishing-package-builder
description: Formats final copy with SEO metadata, excerpts, OpenGraph tags, and slugs in Thymer.
---

# Publishing Package Builder

The **Publishing Package Builder** packages approved written copy into production-ready CMS entries.

## Core Directives

1. **Metadata Checklist:**
   - SEO Title (50–60 characters).
   - Meta Description (140–160 characters with clear call-to-action).
   - URL Slug (lowercase, hyphenated, keyword-rich).
   - Primary Keyword & Semantic LSI keywords.

2. **Visual & Social Prompts:**
   - Header image alt text and caption.
   - Social snippets formatted for LinkedIn and X/Twitter.
`
            }
        ]
    },
    {
        packId: 'pack-growth-marketing',
        skills: [
            {
                id: 'client-roi-compiler',
                name: 'Client ROI Compiler',
                description: 'Synthesizes ad performance metrics into executive-ready ROI and ROAS digests in Thymer.',
                content: `---
name: client-roi-compiler
description: Synthesizes ad performance metrics into executive-ready ROI and ROAS digests in Thymer.
---

# Client ROI Compiler

The **Client ROI Compiler** translates complex paid media metrics (CAC, ROAS, CTR, CPM, CPL) into plain-English business digests that non-technical founders understand and appreciate.

## Core Directives

1. **Executive Headline First:**
   - Always lead with blended return on ad spend and acquired revenue before showing granular platform breakdowns.
   - Example: *"This month, 4,500 CHF ad spend generated 18,200 CHF in net sales (4.04x ROAS) across Meta and Google."*

2. **What Worked vs. What We Are Adjusting:**
   - Highlight the top winning creative hooks and audiences.
   - Transparently identify underperforming ad sets paused during the cycle.
`
            },
            {
                id: 'retainer-burn-monitor',
                name: 'Retainer Scope & Burn Monitor',
                description: 'Tracks ad spend, advisory hours, and sprint budget burn rate to prevent overservicing in Thymer.',
                content: `---
name: retainer-burn-monitor
description: Tracks ad spend, advisory hours, and sprint budget burn rate to prevent overservicing in Thymer.
---

# Retainer Scope & Burn Monitor

The **Retainer Scope & Burn Monitor** guards against silent scope creep in ongoing growth marketing retainers.

## Core Directives

1. **Hours vs. Retainer Cap:**
   - Compare month-to-date logged advisory and campaign management hours against contracted retainer caps.
   - At 80% capacity reached with >10 days remaining in the month, flag the pacing to the client.

2. **Emergency Campaign Surge Protocol:**
   - If a client requests unplanned promo launches or weekend turnarounds, calculate the estimated additional hours and issue an overage quote.
`
            },
            {
                id: 'campaign-preflight-checklist',
                name: 'Campaign Pre-Flight Checklist',
                description: 'Audits UTM tags, conversion pixels, landing page forms, and creative variants in Thymer.',
                content: `---
name: campaign-preflight-checklist
description: Audits UTM tags, conversion pixels, landing page forms, and creative variants in Thymer.
---

# Campaign Pre-Flight Checklist

The **Campaign Pre-Flight Checklist** prevents costly ad spend waste by verifying every technical touchpoint before publishing paid campaigns.

## Core Directives

1. **10-Point Technical Verification:**
   - [ ] UTM parameters standardized: source, medium, campaign, content.
   - [ ] Conversion tracking pixels firing (Meta CAPI, Google Ads Tag, GA4).
   - [ ] Landing page test purchase or lead form submission confirmed in CRM.
   - [ ] Daily budget caps set with correct currency (no missing decimal errors).
   - [ ] Mobile viewport test on iOS and Android devices.
`
            }
        ]
    },
    {
        packId: 'pack-strategy-consulting',
        skills: [
            {
                id: 'stakeholder-insight-tagger',
                name: 'Stakeholder Insight Tagger',
                description: 'Categorizes qualitative stakeholder interview notes into key strategic themes in Thymer.',
                content: `---
name: stakeholder-insight-tagger
description: Categorizes qualitative stakeholder interview notes into key strategic themes in Thymer.
---

# Stakeholder Insight Tagger

The **Stakeholder Insight Tagger** synthesizes messy executive discovery interviews into structured thematic pillars.

## Core Directives

1. **Thematic Clustering:**
   - Tag quotes and observations into standard strategy dimensions:
     - Operational Friction
     - Cultural & Organizational Misalignment
     - Technology & Infrastructure Debt
     - Market & Customer Expansion Opportunities

2. **Consensus vs. Divergence Analysis:**
   - Explicitly highlight areas where executive leadership disagrees on priorities or timelines.
`
            },
            {
                id: 'slide-deck-narrative-outliner',
                name: 'Slide Deck Narrative Outliner',
                description: 'Structures executive advisory decks with pyramid-principle narrative arcs in Thymer.',
                content: `---
name: slide-deck-narrative-outliner
description: Structures executive advisory decks with pyramid-principle narrative arcs in Thymer.
---

# Slide Deck Narrative Outliner

The **Slide Deck Narrative Outliner** structures advisory presentations using Minto's Pyramid Principle (Situation → Complication → Question → Answer).

## Core Directives

1. **Action Titles:**
   - Every slide in the outline must use a complete sentence lead, never a generic topic label (e.g., *"Customer acquisition costs doubled due to paid search competition"*, not *"Marketing Analysis"*).

2. **Scannable Hierarchy:**
   - Each slide contains 1 primary takeaway, supported by 2–3 quantified data points.
`
            },
            {
                id: 'steering-committee-digest',
                name: 'Steering Committee Milestone Digest',
                description: 'Compiles concise governance briefs highlighting decisions, risks, and next steps in Thymer.',
                content: `---
name: steering-committee-digest
description: Compiles concise governance briefs highlighting decisions, risks, and next steps in Thymer.
---

# Steering Committee Milestone Digest

The **Steering Committee Milestone Digest** generates one-page executive updates for board members and enterprise steering committees.

## Core Directives

1. **Traffic Light Status:**
   - Overall Initiative: Green / Yellow / Red with brief justification.
   - Milestone schedule: On track or flagged variance.

2. **Decisions Required (The Asks):**
   - Place required executive approvals at the very top of the digest before operational notes.
`
            }
        ]
    },
    {
        packId: 'pack-accounting-cfo',
        skills: [
            {
                id: 'missing-document-chaser',
                name: 'Missing Document Chaser',
                description: 'Identifies unattached bank transactions and drafts friendly receipt requests in Thymer.',
                content: `---
name: missing-document-chaser
description: Identifies unattached bank transactions and drafts friendly receipt requests in Thymer.
---

# Missing Document Chaser

The **Missing Document Chaser** reconciles bank feeds and expense ledgers, compiling missing receipt requests with exact transaction dates, amounts, and vendor names.

## Core Directives

1. **Actionable Table:**
   - Format requests into a clean 4-column table: Date | Merchant | Amount | Receipt Status.

2. **Gentle Escalation:**
   - Provide a 1-click email draft allowing the client to simply reply with attached receipt photos or PDFs.
`
            },
            {
                id: 'month-end-close-tracker',
                name: 'Month-End Close Checklist',
                description: 'Enforces immutable 12-point month-end close sequences with audit trails in Thymer.',
                content: `---
name: month-end-close-tracker
description: Enforces immutable 12-point month-end close sequences with audit trails in Thymer.
---

# Month-End Close Checklist

The **Month-End Close Checklist** guarantees accounting accuracy and zero-defect financial statements through a standardized closing sequence.

## Core Directives

1. **Closing Sequence:**
   - [ ] Bank & credit card reconciliations cleared to zero variance.
   - [ ] Accounts receivable aging report verified against bank deposits.
   - [ ] Accounts payable bills matched to vendor invoices.
   - [ ] Depreciation & prepaid expense journal entries posted.
   - [ ] Tax liability reserves calculated.

2. **Lock Period Date:**
   - Log the final closing date into the project log to prevent retrospective ledger adjustments.
`
            },
            {
                id: 'financial-health-narrative',
                name: 'Financial Health Narrative Digest',
                description: 'Translates P&L and balance sheet numbers into plain-English founder summaries in Thymer.',
                content: `---
name: financial-health-narrative
description: Translates P&L and balance sheet numbers into plain-English founder summaries in Thymer.
---

# Financial Health Narrative Digest

The **Financial Health Narrative Digest** turns dry financial statements into clear operational guidance for founders and operators.

## Core Directives

1. **Three Core Pulse Checks:**
   - **Net Cashflow & Runway:** Available cash reserves vs. monthly net burn rate (runway in months).
   - **Gross Margin & Cost of Goods:** Trends compared to previous quarter.
   - **Working Capital & Overdue Receivables:** Impact of uncollected invoices on operating liquidity.
`
            }
        ]
    },
    {
        packId: 'pack-executive-support',
        skills: [
            {
                id: 'travel-dossier-builder',
                name: 'Multi-Leg Travel Dossier Builder',
                description: 'Assembles chronological travel itineraries with confirmation codes, maps, and contacts in Thymer.',
                content: `---
name: travel-dossier-builder
description: Assembles chronological travel itineraries with confirmation codes, maps, and contacts in Thymer.
---

# Multi-Leg Travel Dossier Builder

The **Multi-Leg Travel Dossier Builder** creates seamless, fail-proof executive travel briefs.

## Core Directives

1. **Chronological Timezone-Indexed Itinerary:**
   - List every flight, train, transfer, and hotel check-in with local departure and arrival times.
   - Include direct confirmation codes, terminal numbers, driver contact details, and Google Maps links.

2. **Offline Fallback Notes:**
   - Include passport expiration check, visa confirmation, and hotel cancellation deadlines.
`
            },
            {
                id: 'cross-calendar-coordinator',
                name: 'Cross-Calendar Coordinator',
                description: 'Resolves multi-party timezone conflicts and preserves deep-work focus blocks in Thymer.',
                content: `---
name: cross-calendar-coordinator
description: Resolves multi-party timezone conflicts and preserves deep-work focus blocks in Thymer.
---

# Cross-Calendar Coordinator

The **Cross-Calendar Coordinator** protects executive focus by defragmenting busy calendars and proposing conflict-free meeting windows across multiple timezones.

## Core Directives

1. **Buffer & Focus Protection:**
   - Enforce a 15-minute buffer between meetings and protect minimum 2-hour uninterrupted focus blocks.

2. **Clear Meeting Invitations:**
   - Propose 3 discrete times formatted in both the client and executive local timezones.
`
            },
            {
                id: 'daily-action-urgency-queue',
                name: 'Daily Action & Urgency Queue',
                description: 'Triages cross-channel incoming requests into Urgent, Important, and Delegated queues in Thymer.',
                content: `---
name: daily-action-urgency-queue
description: Triages cross-channel incoming requests into Urgent, Important, and Delegated queues in Thymer.
---

# Daily Action & Urgency Queue

The **Daily Action & Urgency Queue** scans raw email, chat, and voice notes to construct a pristine Eisenhower-matrix triage list.

## Core Directives

1. **Urgent vs. Important Filtering:**
   - Urgent & Important: Immediate executive decision required today.
   - Important (Not Urgent): Strategic work, proposals, long-term initiatives.
   - Delegated: Tasks assigned to subcontractors or waiting on external replies.
`
            }
        ]
    },
    {
        packId: 'pack-media-production',
        skills: [
            {
                id: 'callsheet-schedule-assembler',
                name: 'Production Call-Sheet Assembler',
                description: 'Builds master crew call sheets with locations, talent schedules, weather, and gear in Thymer.',
                content: `---
name: callsheet-schedule-assembler
description: Builds master crew call sheets with locations, talent schedules, weather, and gear in Thymer.
---

# Production Call-Sheet Assembler

The **Production Call-Sheet Assembler** builds production-grade call sheets for commercial film and photography shoots.

## Core Directives

1. **Essential Shoot Day Parameters:**
   - Exact location address, parking instructions, nearest hospital, weather forecast, and sunrise/sunset times.
   - Crew call times, talent arrival times, wardrobe/makeup schedule, and first shot call.

2. **Emergency Contacts:**
   - Producer, Director of Photography, and Client Lead phone numbers.
`
            },
            {
                id: 'timestamp-note-consolidator',
                name: 'Timestamp Review Note Consolidator',
                description: 'Parses Frame.io or email feedback into timestamp-indexed edit checklists in Thymer.',
                content: `---
name: timestamp-note-consolidator
description: Parses Frame.io or email feedback into timestamp-indexed edit checklists in Thymer.
---

# Timestamp Review Note Consolidator

The **Timestamp Review Note Consolidator** transforms video review comments into an exact timeline checklist for the video editor.

## Core Directives

1. **Timecode Indexing:**
   - Format: \`[ ] 01:24:12 - Lower-third graphic typo (change "VP" to "Senior Director")\`.

2. **Categorization:**
   - Distinguish visual cuts, color grading, sound mixing, and graphic adjustments.
`
            },
            {
                id: 'talent-permit-tracker',
                name: 'Talent & License Tracker',
                description: 'Tracks signed release forms, music licensing rights, and location permits in Thymer.',
                content: `---
name: talent-permit-tracker
description: Tracks signed release forms, music licensing rights, and location permits in Thymer.
---

# Talent & License Tracker

The **Talent & License Tracker** audits legal permissions and broadcast rights for video production deliverables.

## Core Directives

1. **Rights Manifest:**
   - Verify signed talent releases for all on-screen individuals.
   - Document music license IDs, usage territory (web, broadcast, global), and expiration dates.
`
            }
        ]
    },
    {
        packId: 'pack-recruiting-talent',
        skills: [
            {
                id: 'candidate-dossier-creator',
                name: 'Candidate Submission Dossier',
                description: 'Compiles standardized blind candidate profiles with scorecards and comp expectations in Thymer.',
                content: `---
name: candidate-dossier-creator
description: Compiles standardized blind candidate profiles with scorecards and comp expectations in Thymer.
---

# Candidate Submission Dossier

The **Candidate Submission Dossier** creates unbiased, standardized candidate profiles for hiring manager presentations.

## Core Directives

1. **Standard Evaluation Matrix:**
   - Technical proficiency, leadership track record, communication, and culture alignment.
   - Compensation expectations, notice period, and motivation for moving.

2. **Blind Anonymization:**
   - Strip personal identifying data when required to support blind screening protocols.
`
            },
            {
                id: 'hiring-manager-sla-tracker',
                name: 'Hiring Manager SLA Monitor',
                description: 'Flags candidates stuck in hiring manager review queues past the agreed SLA in Thymer.',
                content: `---
name: hiring-manager-sla-tracker
description: Flags candidates stuck in hiring manager review queues past the agreed SLA in Thymer.
---

# Hiring Manager SLA Monitor

The **Hiring Manager SLA Monitor** prevents candidate drop-off by tracking review turnaround times.

## Core Directives

1. **48-Hour Threshold:**
   - If a candidate profile was submitted >48 hours ago without feedback, draft a polite bump to the hiring manager.

2. **Pipeline Velocity Metric:**
   - Calculate average days per stage to identify hiring pipeline bottlenecks.
`
            },
            {
                id: 'onboarding-ramp-checklist',
                name: 'New Hire Onboarding Ramp Checklist',
                description: 'Tracks 30-60-90 day milestone checklists and equipment/compliance provisioning in Thymer.',
                content: `---
name: onboarding-ramp-checklist
description: Tracks 30-60-90 day milestone checklists and equipment/compliance provisioning in Thymer.
---

# New Hire Onboarding Ramp Checklist

The **New Hire Onboarding Ramp Checklist** ensures smooth transitions from offer acceptance to productive contribution.

## Core Directives

1. **Pre-Start Checklist:**
   - Hardware provisioning, email/Slack account creation, team introductions.

2. **30-60-90 Day Success Milestones:**
   - Explicit criteria for first month ramp, second month contribution, and third month autonomy.
`
            }
        ]
    },
    {
        packId: 'pack-event-production',
        skills: [
            {
                id: 'run-of-show-generator',
                name: 'Master Run-of-Show Generator',
                description: 'Generates minute-by-minute execution timelines tailored for vendors, crew, and clients in Thymer.',
                content: `---
name: run-of-show-generator
description: Generates minute-by-minute execution timelines tailored for vendors, crew, and clients in Thymer.
---

# Master Run-of-Show Generator

The **Master Run-of-Show Generator** builds synchronized, minute-by-minute production schedules for live events and weddings.

## Core Directives

1. **Cues & Technical Triggers:**
   - Time | Segment | Stage Activity | AV / Lighting Cue | Responsible Person.

2. **Contingency Windows:**
   - Embed realistic 10–15 minute buffer periods around speeches, transitions, and dining courses.
`
            },
            {
                id: 'deposit-coi-sentinel',
                name: 'Deposit & COI Sentinel',
                description: 'Tracks certificate of insurance (COI) deadlines and vendor payment deposits in Thymer.',
                content: `---
name: deposit-coi-sentinel
description: Tracks certificate of insurance (COI) deadlines and vendor payment deposits in Thymer.
---

# Deposit & COI Sentinel

The **Deposit & COI Sentinel** prevents venue lockouts and vendor cancellations by tracking insurance and financial milestones.

## Core Directives

1. **Venue COI Deadlines:**
   - Ensure Certificate of Insurance with the venue named as additional insured is submitted >14 days prior to load-in.

2. **Deposit Schedule:**
   - Track initial deposit, mid-point milestone, and final balance due dates across caterers, AV, and venue rentals.
`
            },
            {
                id: 'vendor-contract-terms-extractor',
                name: 'Vendor Terms & Window Extractor',
                description: 'Extracts load-in/load-out windows, overtime penalties, and power/AV requirements in Thymer.',
                content: `---
name: vendor-contract-terms-extractor
description: Extracts load-in/load-out windows, overtime penalties, and power/AV requirements in Thymer.
---

# Vendor Terms & Window Extractor

The **Vendor Terms & Window Extractor** parses venue and vendor contracts to isolate critical logistical parameters.

## Core Directives

1. **Logistics Matrix:**
   - Load-in start time, freight elevator booking, noise curfew, strike/load-out cutoff.

2. **Penalty Clauses:**
   - Flag hourly overtime penalties ($/hour) for exceeding contracted venue hours.
`
            }
        ]
    },
    {
        packId: 'pack-interior-design',
        skills: [
            {
                id: 'ffe-product-spec-builder',
                name: 'FF&E Spec & Trade Margin Builder',
                description: 'Builds furniture, fixtures & equipment tear sheets with trade discounts and client pricing in Thymer.',
                content: `---
name: ffe-product-spec-builder
description: Builds furniture, fixtures & equipment tear sheets with trade discounts and client pricing in Thymer.
---

# FF&E Spec & Trade Margin Builder

The **FF&E Spec & Trade Margin Builder** manages procurement tear sheets for interior design projects.

## Core Directives

1. **Item Specification Sheet:**
   - Room / Location | Item Name | Vendor / Trade Source | SKU | Dimensions | Finish / Fabric.

2. **Trade Discount & Margin Accounting:**
   - Net Trade Cost | Client Price (Markup / Margin %) | Freight & Delivery estimate.
`
            },
            {
                id: 'freight-leadtime-monitor',
                name: 'Freight Delivery & Lead-Time Monitor',
                description: 'Monitors custom fabrication lead times, freight arrivals, and warehousing schedules in Thymer.',
                content: `---
name: freight-leadtime-monitor
description: Monitors custom fabrication lead times, freight arrivals, and warehousing schedules in Thymer.
---

# Freight Delivery & Lead-Time Monitor

The **Freight Delivery & Lead-Time Monitor** prevents installation delays by tracking multi-week manufacturing and shipping lead times.

## Core Directives

1. **Critical Path Pacing:**
   - Flag any custom upholstery or imported tile with >8 week lead time that jeopardizes the installation deadline.

2. **Receiving Warehouse Checklist:**
   - Track items received, inspected for transit damage, and staged for final installation day.
`
            },
            {
                id: 'contractor-punchlist-organizer',
                name: 'Contractor Punch-List Organizer',
                description: 'Organizes room-by-room punch list items with photo references for general contractors in Thymer.',
                content: `---
name: contractor-punchlist-organizer
description: Organizes room-by-room punch list items with photo references for general contractors in Thymer.
---

# Contractor Punch-List Organizer

The **Contractor Punch-List Organizer** structures final walkthrough deficiency lists into clear contractor assignments.

## Core Directives

1. **Room-by-Room Organization:**
   - Location | Trade (Electrician, Painter, Plumber) | Specific Issue | Resolution Required.

2. **Sign-Off Verification:**
   - Require photographic proof of defect correction before releasing contractor retainage.
`
            }
        ]
    }
];

const packsDir = path.resolve('c:/dev/thymer-freelance-os/packs');

let totalSkillsCreated = 0;

for (const pack of allPacksSkills) {
    const packSkillsDir = path.join(packsDir, pack.packId, 'skills');
    if (!fs.existsSync(packSkillsDir)) {
        fs.mkdirSync(packSkillsDir, { recursive: true });
    }
    for (const skill of pack.skills) {
        const skillDir = path.join(packSkillsDir, skill.id);
        if (!fs.existsSync(skillDir)) {
            fs.mkdirSync(skillDir, { recursive: true });
        }
        const skillFilePath = path.join(skillDir, 'SKILL.md');
        fs.writeFileSync(skillFilePath, skill.content.trim() + '\n', 'utf8');
        console.log(`Created skill: ${pack.packId}/skills/${skill.id}/SKILL.md`);
        totalSkillsCreated++;
    }
}

console.log(`\nSuccessfully created ${totalSkillsCreated} trade skills across 10 packs!`);
