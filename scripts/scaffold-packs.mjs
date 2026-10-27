import fs from 'node:fs';
import path from 'node:path';

const packs = [
    {
        id: 'pack-software-dev',
        name: 'Software & AI Engineering',
        icon: '💻',
        category: 'Technology',
        roles: ['Full-stack developer', 'Mobile app engineer', 'Backend engineer', 'DevOps specialist', 'AI automation consultant'],
        workflow: 'Sprints, milestone delivery, technical retainers, staging sign-offs',
        skills: [
            { id: 'scope-ticket-translator', name: 'Scope-to-Ticket Translator', description: 'Translates functional specs into discrete 30-60m engineering tasks with acceptance criteria.' },
            { id: 'scope-creep-sentinel', name: 'Scope Creep Sentinel', description: 'Detects out-of-scope requests in client comms and drafts change-order quotes.' },
            { id: 'plain-english-release-notes', name: 'Plain-English Release Generator', description: 'Converts git commits and dev tickets into client-friendly release notes.' }
        ],
        templates: {
            milestones: ['Discovery & Technical Architecture', 'Sprint 1 Core MVP', 'Staging QA & UAT', 'Production Deployment & Handoff'],
            projectType: 'Engineering Sprint'
        }
    },
    {
        id: 'pack-design-creative',
        name: 'Design & Creative Direction',
        icon: '🎨',
        category: 'Creative',
        roles: ['UI/UX designer', 'Brand identity designer', 'Product designer', 'Illustrator'],
        workflow: 'Discovery -> Wireframes -> Design systems & polished drafts -> Asset delivery',
        skills: [
            { id: 'revision-limit-tracker', name: 'Revision Limit Tracker', description: 'Enforces contractual revision rounds and flags scope creep before extra iterations.' },
            { id: 'feedback-consolidator', name: 'Feedback Consolidator', description: 'Aggregates scattered Figma/email/Slack comments into prioritized design revisions.' },
            { id: 'asset-handoff-checklist', name: 'Asset Handoff Checklist', description: 'Generates structured delivery manifests (SVG, PNG, design tokens, fonts, specs).' }
        ],
        templates: {
            milestones: ['Moodboards & Creative Concept', 'Wireframes & Information Architecture', 'High-Fidelity Components', 'Final Production Handoff'],
            projectType: 'Design Sprint'
        }
    },
    {
        id: 'pack-writing-editorial',
        name: 'Writing & Content Editorial',
        icon: '✍️',
        category: 'Creative',
        roles: ['Direct-response copywriter', 'Content strategist', 'Ghostwriter', 'Technical writer'],
        workflow: 'Editorial calendar, batch drafting, review cadences & publishing',
        skills: [
            { id: 'brief-voice-extractor', name: 'Voice & Brief Extractor', description: 'Extracts brand voice rules, target personas, and key messages from client input.' },
            { id: 'editorial-status-tracker', name: 'Editorial Status Tracker', description: 'Maintains multi-stage content pipelines from pitch through draft, review, and live.' },
            { id: 'publishing-package-builder', name: 'Publishing Package Builder', description: 'Formats final copy with SEO metadata, excerpts, OpenGraph tags, and slugs.' }
        ],
        templates: {
            milestones: ['Content Strategy & Brief Alignment', 'Batch 1 First Drafts', 'Client Editorial Review', 'Publishing & Distribution Package'],
            projectType: 'Editorial Sprint'
        }
    },
    {
        id: 'pack-growth-marketing',
        name: 'Growth Marketing & Paid Media',
        icon: '📈',
        category: 'Marketing',
        roles: ['Media buyer', 'PPC specialist', 'SEO consultant', 'Lifecycle marketer'],
        workflow: 'Monthly retainers, recurring optimization cycles, campaign launches',
        skills: [
            { id: 'client-roi-compiler', name: 'Client ROI Compiler', description: 'Synthesizes ad performance metrics into executive-ready ROI and ROAS digests.' },
            { id: 'retainer-burn-monitor', name: 'Retainer Scope & Burn Monitor', description: 'Tracks ad spend, advisory hours, and sprint budget burn rate to prevent overservicing.' },
            { id: 'campaign-preflight-checklist', name: 'Campaign Pre-Flight Checklist', description: 'Audits UTM tags, conversion pixels, landing page forms, and creative variants.' }
        ],
        templates: {
            milestones: ['Tracking & Tagging Audit', 'Campaign Architecture & Creative Testing', 'Monthly Retainer Cycle 1', 'Optimization & Performance Scaling'],
            projectType: 'Growth Retainer'
        }
    },
    {
        id: 'pack-strategy-consulting',
        name: 'Management & Strategy Consulting',
        icon: '🧭',
        category: 'Strategy & Ops',
        roles: ['Fractional executive', 'Business strategist', 'Product consultant', 'Operations advisor'],
        workflow: 'Phased advisory engagements, diagnostic audits, executive workshops',
        skills: [
            { id: 'stakeholder-insight-tagger', name: 'Stakeholder Insight Tagger', description: 'Categorizes qualitative stakeholder interview notes into key strategic themes.' },
            { id: 'slide-deck-narrative-outliner', name: 'Slide Deck Narrative Outliner', description: 'Structures executive advisory decks with pyramid-principle narrative arcs.' },
            { id: 'steering-committee-digest', name: 'Steering Committee Milestone Digest', description: 'Compiles concise governance briefs highlighting decisions, risks, and next steps.' }
        ],
        templates: {
            milestones: ['Phase 1 Discovery & Diagnostic Audit', 'Phase 2 Strategy Formulation & Roadmap', 'Phase 3 Executive Presentation', 'Advisory Retainer'],
            projectType: 'Advisory Engagement'
        }
    },
    {
        id: 'pack-accounting-cfo',
        name: 'Accounting & Fractional CFO',
        icon: '📊',
        category: 'Finance',
        roles: ['Solo bookkeeper', 'Fractional CFO', 'Financial advisor', 'Tax preparer'],
        workflow: 'Monthly reconciliation close, payroll cutoffs, tax filing cycles',
        skills: [
            { id: 'missing-document-chaser', name: 'Missing Document Chaser', description: 'Identifies unattached bank transactions and drafts friendly receipt requests.' },
            { id: 'month-end-close-tracker', name: 'Month-End Close Checklist', description: 'Enforces immutable 12-point month-end close sequences with audit trails.' },
            { id: 'financial-health-narrative', name: 'Financial Health Narrative Digest', description: 'Translates P&L and balance sheet numbers into plain-English founder summaries.' }
        ],
        templates: {
            milestones: ['Accounts Chart & Bank Integration Review', 'Month-End Close Cycle', 'Quarterly Tax Review & Projection', 'Annual Financial Pack'],
            projectType: 'Financial Engagement'
        }
    },
    {
        id: 'pack-executive-support',
        name: 'Executive & Business Support',
        icon: '🗂️',
        category: 'Strategy & Ops',
        roles: ['Executive assistant', 'Virtual assistant', 'Online business manager (OBM)', 'Operations coordinator'],
        workflow: 'Asynchronous inbox triage, calendar defragmentation, travel logistics',
        skills: [
            { id: 'travel-dossier-builder', name: 'Multi-Leg Travel Dossier Builder', description: 'Assembles chronological travel itineraries with confirmation codes, maps, and contacts.' },
            { id: 'cross-calendar-coordinator', name: 'Cross-Calendar Coordinator', description: 'Resolves multi-party timezone conflicts and preserves deep-work focus blocks.' },
            { id: 'daily-action-urgency-queue', name: 'Daily Action & Urgency Queue', description: 'Triages cross-channel incoming requests into Urgent, Important, and Delegated queues.' }
        ],
        templates: {
            milestones: ['Operations & Tool Access Onboarding', 'Weekly Support Retainer Cycle', 'Quarterly Systems Review'],
            projectType: 'Support Retainer'
        }
    },
    {
        id: 'pack-media-production',
        name: 'Media & Video Production',
        icon: '🎬',
        category: 'Creative',
        roles: ['Video editor', 'Motion designer', 'Commercial photographer', 'Audio engineer'],
        workflow: 'Pre-production -> Shoot/Record -> Post-production -> Final Master Delivery',
        skills: [
            { id: 'callsheet-schedule-assembler', name: 'Production Call-Sheet Assembler', description: 'Builds master crew call sheets with locations, talent schedules, weather, and gear.' },
            { id: 'timestamp-note-consolidator', name: 'Timestamp Review Note Consolidator', description: 'Parses Frame.io or email feedback into timestamp-indexed edit checklists.' },
            { id: 'talent-permit-tracker', name: 'Talent & License Tracker', description: 'Tracks signed release forms, music licensing rights, and location permits.' }
        ],
        templates: {
            milestones: ['Pre-Production & Storyboarding', 'Production Shoot / Asset Ingestion', 'Rough Cut & Editorial Revision', 'Master Color/Sound & Export'],
            projectType: 'Production Sprint'
        }
    },
    {
        id: 'pack-recruiting-talent',
        name: 'HR & Technical Recruiting',
        icon: '🤝',
        category: 'Strategy & Ops',
        roles: ['Solo headhunter', 'Technical recruiter', 'Talent sourcing consultant'],
        workflow: 'Job briefing -> Sourcing -> Screening -> Client interviews -> Offer & Ramp',
        skills: [
            { id: 'candidate-dossier-creator', name: 'Candidate Submission Dossier', description: 'Compiles standardized blind candidate profiles with scorecards and comp expectations.' },
            { id: 'hiring-manager-sla-tracker', name: 'Hiring Manager SLA Monitor', description: 'Flags candidates stuck in hiring manager review queues past the agreed SLA.' },
            { id: 'onboarding-ramp-checklist', name: 'New Hire Onboarding Ramp Checklist', description: 'Tracks 30-60-90 day milestone checklists and equipment/compliance provisioning.' }
        ],
        templates: {
            milestones: ['Role Calibration & Sourcing Kickoff', 'Screening & Slate Presentation', 'Interview Rounds & Debrief', 'Offer Negotiation & Placement'],
            projectType: 'Recruiting Search'
        }
    },
    {
        id: 'pack-event-production',
        name: 'Event & Wedding Coordination',
        icon: '💍',
        category: 'Services',
        roles: ['Wedding planner', 'Corporate event producer', 'Conference coordinator'],
        workflow: 'Procurement -> Vendor schedules -> Deposit milestones -> Day-of execution',
        skills: [
            { id: 'run-of-show-generator', name: 'Master Run-of-Show Generator', description: 'Generates minute-by-minute execution timelines tailored for vendors, crew, and clients.' },
            { id: 'deposit-coi-sentinel', name: 'Deposit & COI Sentinel', description: 'Tracks certificate of insurance (COI) deadlines and vendor payment deposits.' },
            { id: 'vendor-contract-terms-extractor', name: 'Vendor Terms & Window Extractor', description: 'Extracts load-in/load-out windows, overtime penalties, and power/AV requirements.' }
        ],
        templates: {
            milestones: ['Venue Sourcing & Design Concept', 'Vendor Contracting & Deposit Schedule', 'Production Week & Run-of-Show Lock', 'Day-Of Execution & Strike'],
            projectType: 'Event Production'
        }
    },
    {
        id: 'pack-interior-design',
        name: 'Interior Design & Home Staging',
        icon: '🏡',
        category: 'Services',
        roles: ['Residential interior designer', 'Commercial decorator', 'Home stager'],
        workflow: 'Spatial concept -> FF&E procurement -> Contractor coordination -> Installation',
        skills: [
            { id: 'ffe-product-spec-builder', name: 'FF&E Spec & Trade Margin Builder', description: 'Builds furniture, fixtures & equipment tear sheets with trade discounts and client pricing.' },
            { id: 'freight-leadtime-monitor', name: 'Freight Delivery & Lead-Time Monitor', description: 'Monitors custom fabrication lead times, freight arrivals, and warehousing schedules.' },
            { id: 'contractor-punchlist-organizer', name: 'Contractor Punch-List Organizer', description: 'Organizes room-by-room punch list items with photo references for general contractors.' }
        ],
        templates: {
            milestones: ['Schematic Design & Space Planning', 'Design Development & FF&E Selection', 'Procurement & Freight Tracking', 'Installation & Final Punch List'],
            projectType: 'Interior Project'
        }
    }
];

const baseDir = path.resolve('c:/dev/thymer-freelance-os/packs');
if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
}

for (const pack of packs) {
    const packDir = path.join(baseDir, pack.id);
    if (!fs.existsSync(packDir)) {
        fs.mkdirSync(packDir, { recursive: true });
    }
    const manifest = {
        id: pack.id,
        name: pack.name,
        version: '1.0.0',
        category: pack.category,
        icon: pack.icon,
        description: `${pack.name} trade pack for Freelance OS.`,
        roles: pack.roles,
        workflow: pack.workflow,
        skills: pack.skills,
        templates: pack.templates
    };
    fs.writeFileSync(path.join(packDir, 'pack.json'), JSON.stringify(manifest, null, 2), 'utf8');
    console.log('Created pack manifest:', pack.id);
}
