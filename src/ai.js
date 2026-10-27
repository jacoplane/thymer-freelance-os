const CORE_AGENTS = [
    {
        id: 'proposal-strategist',
        name: 'Proposal Strategist',
        icon: '🎯',
        role: 'Commercial proposals & scopes of work',
        description: 'Transforms prospect notes into tiered, high-converting proposals with win themes, investment packages, and explicit anti-scope-creep boundaries.',
        prompt: 'Draft a 3-tier proposal for [Client] based on our qualification notes, with phased milestones, investment packages, and anti-scope-creep boundaries.'
    },
    {
        id: 'pricing-analyst',
        name: 'Pricing Analyst',
        icon: '💰',
        role: 'Margin defense & Care Plan retainers',
        description: 'Calculates minimum viable price floors with contingency buffers, protects against discounting, and converts completed projects into monthly Care Plans.',
        prompt: 'Review the project budget for [Project] and prepare a tiered post-launch Care Plan retainer pitch.'
    },
    {
        id: 'reality-checker',
        name: 'Reality Checker',
        icon: '🔍',
        role: 'Scope skepticism & pre-flight auditor',
        description: 'Evidence-obsessed skeptic that stress-tests estimates, deliverables, and acceptance criteria to prevent unbudgeted technical risks and premature sign-offs.',
        prompt: 'Stress-test this quote and project scope for [Client] before I send it to check for unbudgeted technical risks.'
    },
    {
        id: 'discovery-coach',
        name: 'Discovery Coach',
        icon: '💬',
        role: 'Sales discovery & qualification',
        description: 'Structures client discovery calls, crafts upfront contracts, and formulates high-impact situational pain and budget threshold questions.',
        prompt: 'Prep me for my discovery call with [Client]: what situational pain questions and upfront contracts should I use?'
    },
    {
        id: 'meeting-notes-specialist',
        name: 'Meeting Notes Specialist',
        icon: '📝',
        role: 'Call debriefs & decision logging',
        description: 'Converts unstructured meeting transcripts and bullet notes into a clean 4-section executive debrief (Decisions, Action Items, Open Questions) in Thymer.',
        prompt: 'Turn these call notes into a structured 4-section debrief (Decisions, Action Items, Open Questions) and update the client profile log.'
    },
    {
        id: 'project-manager-senior',
        name: 'Senior Project Manager',
        icon: '📋',
        role: 'Milestone & task breakdown',
        description: 'Converts client specifications into realistic milestones and bite-sized 30–60 minute tasks with explicit client review checkpoints in Thymer.',
        prompt: 'Break down the project brief for [Project] into 30–60 minute tasks with client review checkpoints.'
    },
    {
        id: 'contract-clause-guardian',
        name: 'Contract Clause Guardian',
        icon: '🛡️',
        role: 'MSA, SOW & legal risk auditor',
        description: 'Scans client-provided MSAs and terms for toxic clauses: unlimited liability, payment term delays (Net 60/90), and overreaching IP assignment.',
        prompt: 'Scan this client agreement for toxic clauses: unlimited liability, payment term traps (Net 60/90), and IP assignment overreach.'
    },
    {
        id: 'client-onboarding-shepherd',
        name: 'Client Onboarding Shepherd',
        icon: '🐑',
        role: '48-hour client kickoff specialist',
        description: 'Eliminates post-sale dead zones by generating welcome packets, secure credential intake checklists, asset collection protocols, and kickoff agendas.',
        prompt: 'Client accepted the proposal! Generate the 48-hour onboarding packet, secure credential intake, and kickoff agenda.'
    },
    {
        id: 'receivables-diplomat',
        name: 'Receivables Diplomat',
        icon: '📬',
        role: 'Calibrated overdue invoice recovery',
        description: 'Crafts 3-tier calibrated escalation reminders (friendly bump, firm terms reminder, work-pause notice) that recover outstanding payments professionally.',
        prompt: 'Check for overdue invoices in Thymer and draft the appropriate calibrated reminder email for each.'
    },
    {
        id: 'lead-gen-offer-architect',
        name: 'Lead Gen Offer Architect',
        icon: '🪝',
        role: 'Diagnostic entry offers & lead magnets',
        description: 'Packages low-friction diagnostic audits (performance teardowns, migration risk assessments) that attract inbound leads into the Freelance OS pipeline.',
        prompt: 'Design a low-friction diagnostic entry audit (lead magnet) that I can offer prospective clients to get my foot in the door.'
    },
    {
        id: 'outbound-strategist',
        name: 'Outbound Strategist',
        icon: '📡',
        role: 'Signal-based B2B outreach sequences',
        description: 'Identifies acute buying signals (hiring surges, platform migrations, leadership changes) and drafts hyper-personalized 3-touch outreach sequences.',
        prompt: 'Draft a 3-touch personalized outreach sequence for a company with this acute buying signal: [paste signal].'
    }
];

const TRADE_PACKS = [
    {
        id: 'pack-software-dev',
        name: 'Software & AI Engineering',
        icon: '💻',
        category: 'Technology',
        roles: 'Full-stack, mobile, backend & AI automation engineers',
        workflow: 'Sprints, milestone delivery, technical retainers, staging sign-offs',
        prompt: 'Break down the technical scope for [Project] into 30-60m engineering tickets with acceptance criteria, and check for out-of-scope creep.',
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
        roles: 'UI/UX designers, brand identity designers, product designers',
        workflow: 'Discovery → Wireframes → Design systems & polished drafts → Asset delivery',
        prompt: 'Audit client feedback against our agreed revision rounds for [Project], and build the asset delivery manifest.',
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
        roles: 'Copywriters, content strategists, ghostwriters, technical writers',
        workflow: 'Editorial calendar, batch drafting, review cadences & publishing',
        prompt: 'Extract brand voice rules from this client brief, set up the editorial review cadence, and format the publishing package.',
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
        roles: 'Media buyers, PPC specialists, SEO consultants, lifecycle marketers',
        workflow: 'Monthly retainers, recurring optimization cycles, campaign launches',
        prompt: 'Compile the monthly client ROI report for [Client] and audit our campaign pre-flight tagging checklist.',
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
        roles: 'Fractional executives, business strategists, product consultants, operations advisors',
        workflow: 'Phased advisory engagements, diagnostic audits, executive workshops',
        prompt: 'Synthesize these stakeholder interview notes into key strategic themes and outline the executive presentation narrative.',
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
        roles: 'Solo bookkeepers, fractional CFOs, financial advisors, tax preparers',
        workflow: 'Monthly reconciliation close, payroll cutoffs, tax filing cycles',
        prompt: 'Run the 12-point month-end close checklist for [Client] and generate a plain-English financial health summary.',
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
        roles: 'Executive assistants, virtual assistants, online business managers (OBMs)',
        workflow: 'Asynchronous inbox triage, calendar defragmentation, travel logistics',
        prompt: 'Triage incoming requests into urgency queues and compile the multi-leg travel dossier for [Client].',
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
        roles: 'Video editors, motion designers, commercial photographers, audio engineers',
        workflow: 'Pre-production → Shoot/Record → Post-production → Final Master Delivery',
        prompt: 'Assemble the production call sheet for next week shoot and consolidate timestamp feedback from the rough cut.',
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
        roles: 'Solo headhunters, technical recruiters, talent sourcing consultants',
        workflow: 'Job briefing → Sourcing → Screening → Client interviews → Offer & Ramp',
        prompt: 'Compile a standardized blind candidate submission dossier for [Role] and check our hiring manager review SLA.',
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
        roles: 'Wedding planners, corporate event producers, conference coordinators',
        workflow: 'Procurement → Vendor schedules → Deposit milestones → Day-of execution',
        prompt: 'Generate the vendor-specific minute-by-minute Run of Show and verify insurance (COI) deadlines for [Event].',
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
        roles: 'Residential interior designers, commercial decorators, home stagers',
        workflow: 'Spatial concept → FF&E procurement → Contractor coordination → Installation',
        prompt: 'Build the FF&E spec sheet with trade margins for [Project] and create the contractor punch list.',
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

const HARNESS_TOOLS = [
    {
        id: 'antigravity',
        name: 'Google Antigravity',
        icon: '⚡',
        subtitle: 'Agentic IDE',
        steps: [
            {
                title: 'Sync Agent Skills',
                desc: 'Download the 11 Core personas and modular trade skills into your project root:',
                code: 'npx degit jacoplane/thymer-freelance-os/.agents .agents'
            },
            {
                title: 'Connect Thymer MCP',
                desc: 'Add Thymer MCP to ~/.gemini/antigravity/mcp_config.json or workspace mcp_config.json:',
                code: '{\n  "mcpServers": {\n    "thymer": {\n      "url": "http://127.0.0.1:13100/mcp"\n    }\n  }\n}'
            },
            {
                title: 'Trigger Agent Workflow',
                desc: 'Ask Antigravity to run your morning briefing or audit client projects:',
                code: 'Run my Freelance OS morning briefing and check overdue tasks'
            }
        ],
        checklist: [
            '✓ Native MCP at http://127.0.0.1:13100/mcp',
            '✓ Discovers .agents/skills/ automatically',
            '✓ Remote UI debugging on port 9444'
        ]
    },
    {
        id: 'opencode',
        name: 'OpenCode',
        icon: '💻',
        subtitle: 'Terminal Agent CLI',
        steps: [
            {
                title: 'Sync Agent Skills',
                desc: 'Download the agency skills into your workspace root:',
                code: 'npx degit jacoplane/thymer-freelance-os/.agents .agents'
            },
            {
                title: 'Connect Thymer MCP',
                desc: 'Add the Thymer MCP endpoint directly via the OpenCode CLI:',
                code: 'opencode mcp add thymer http://127.0.0.1:13100/mcp'
            },
            {
                title: 'Run Autonomous Command',
                desc: 'Invoke OpenCode to review your active pipeline or draft proposals:',
                code: 'opencode "Review my Freelance OS pipeline and check for stale proposals"'
            }
        ],
        checklist: [
            '✓ Discovers skills in .agents/skills/',
            '✓ Zero-config CLI connection',
            '✓ Full tool-calling & schema support'
        ]
    },
    {
        id: 'codex',
        name: 'Codex CLI',
        icon: '🤖',
        subtitle: 'OpenAI Terminal Agent',
        steps: [
            {
                title: 'Sync Agent Skills',
                desc: 'Download the agency skills into your workspace root:',
                code: 'npx degit jacoplane/thymer-freelance-os/.agents .agents'
            },
            {
                title: 'Register Thymer MCP',
                desc: 'Register the Thymer MCP server in Codex via CLI or ~/.codex/config.json:',
                code: 'codex mcp add thymer http://127.0.0.1:13100/mcp'
            },
            {
                title: 'Audit Project Status',
                desc: 'Ask Codex to check budget burn and task progress in Thymer:',
                code: 'codex "Check project budget burn in Thymer and flag any project over 90%"'
            }
        ],
        checklist: [
            '✓ Native remote MCP support',
            '✓ Standard .agents/skills/ discovery',
            '✓ Persistent session logging'
        ]
    },
    {
        id: 'omp',
        name: 'OMP',
        icon: '🔮',
        subtitle: 'Multi-Model Agent Platform',
        steps: [
            {
                title: 'Sync Agent Skills',
                desc: 'Pull the complete 11-persona agency bench and trade skills:',
                code: 'npx degit jacoplane/thymer-freelance-os/.agents .agents'
            },
            {
                title: 'Connect Thymer MCP',
                desc: 'Add Thymer MCP to your omp.json or via OMP CLI:',
                code: 'omp mcp add thymer http://127.0.0.1:13100/mcp'
            },
            {
                title: 'Run Specialist Skill',
                desc: 'Run receivables recovery or proposal drafting in OMP:',
                code: 'omp "Run receivables-diplomat skill: check overdue invoices in Thymer"'
            }
        ],
        checklist: [
            '✓ Universal .agents skill support',
            '✓ Multi-model switching',
            '✓ Streaming MCP tool execution'
        ]
    },
    {
        id: 'claude-code',
        name: 'Claude Code',
        icon: '🪄',
        subtitle: 'Anthropic Agent CLI',
        steps: [
            {
                title: 'Sync Agent Skills',
                desc: 'Download the agency skills into your workspace root:',
                code: 'npx degit jacoplane/thymer-freelance-os/.agents .agents'
            },
            {
                title: 'Add MCP Server via CLI',
                desc: 'Register Thymer as an SSE transport MCP endpoint in Claude Code:',
                code: 'claude mcp add --transport sse thymer http://127.0.0.1:13100/mcp'
            },
            {
                title: 'Start Autonomous Session',
                desc: 'Launch Claude Code in your project directory and trigger workflows:',
                code: 'claude "Look at my Freelance OS projects in Thymer and create an engineering sprint for our new client"'
            }
        ],
        checklist: [
            '✓ SSE MCP transport supported',
            '✓ Discovers .agents/skills/ in workspace',
            '✓ Inspect connected tools with /mcp'
        ]
    },
    {
        id: 'cursor',
        name: 'Cursor',
        icon: '🖱️',
        subtitle: 'AI Code Editor',
        steps: [
            {
                title: 'Sync Agent Skills',
                desc: 'Download the skills directory into your workspace root:',
                code: 'npx degit jacoplane/thymer-freelance-os/.agents .agents'
            },
            {
                title: 'Configure MCP Server',
                desc: 'Settings > Features > MCP > "Add New MCP Server". Set Type to "sse" (or http) and URL:',
                code: 'http://127.0.0.1:13100/mcp'
            },
            {
                title: 'Reference Skills in Composer',
                desc: 'Use @ to invoke skills directly or instruct Composer to use Thymer tools:',
                code: '@.agents/skills/proposal-strategist/SKILL.md Draft a proposal for Acme Corp'
            }
        ],
        checklist: [
            '✓ MCP SSE endpoint: http://127.0.0.1:13100/mcp',
            '✓ Project config support via .cursor/mcp.json',
            '✓ @-mention skill integration in chat & Composer'
        ]
    }
];

function computeWatchdogAlerts(data, prefs = {}, today = localDate()) {
    const alerts = [];
    if (!data || typeof data !== 'object') return alerts;
    const todayDay = dateDay(today);
    if (todayDay === null) return alerts;

    // 1. Overdue Receivables Watchdog
    if (prefs.watchdogInvoices !== false && Array.isArray(data.invoices)) {
        for (const inv of data.invoices) {
            if (inv.isOutstanding && inv.daysOverdue >= 7) {
                alerts.push({
                    type: 'invoice',
                    severity: inv.daysOverdue >= 14 ? 'danger' : 'warning',
                    icon: '📬',
                    title: `Overdue Invoice: ${inv.invoiceId || inv.name}`,
                    detail: `${inv.clientName || 'Client'} · ${inv.daysOverdue} days past due (${money(inv.amount)} ${inv.currency})`,
                    guid: inv.guid,
                    action: 'Open Invoice'
                });
            }
        }
    }

    // 2. Project Budget Burn Watchdog
    if (prefs.watchdogBudget !== false && Array.isArray(data.projects)) {
        for (const proj of data.projects) {
            if (proj.budget > 0 && !['completed', 'archived', 'cancelled', 'canceled'].includes(proj.status)) {
                const burnPct = Math.round((proj.totalBilledCHF / proj.budget) * 100);
                if (burnPct >= 90) {
                    alerts.push({
                        type: 'budget',
                        severity: burnPct >= 100 ? 'danger' : 'warning',
                        icon: '⚠️',
                        title: `Budget Burn: ${proj.name}`,
                        detail: `${burnPct}% of ${money(proj.budget)} budget invoiced (${money(proj.totalBilledCHF)} billed)`,
                        guid: proj.guid,
                        action: 'Open Project'
                    });
                }
            }
        }
    }

    // 3. Stale Proposal Watchdog
    if (prefs.watchdogProposals !== false && Array.isArray(data.clients)) {
        for (const cli of data.clients) {
            if (['proposal_sent', 'proposal'].includes(cli.status) || cli.leadStage === 'proposal_sent') {
                const modDate = cli.record?.getModifiedAt?.() || cli.record?.modifiedAt || cli.record?.getCreatedAt?.() || cli.record?.createdAt;
                let daysStale = null;
                if (modDate) {
                    const modDay = dateDay(typeof modDate === 'string' ? modDate.slice(0, 10) : (modDate instanceof Date ? modDate.toISOString().slice(0, 10) : ''));
                    if (modDay !== null) {
                        daysStale = Math.max(0, todayDay - modDay);
                    }
                }
                if (daysStale === null || daysStale >= 5) {
                    alerts.push({
                        type: 'proposal',
                        severity: 'warning',
                        icon: '🎯',
                        title: `Stale Proposal: ${cli.name}`,
                        detail: daysStale !== null ? `Proposal sent ${daysStale} days ago without status update` : 'Proposal sent without recent update',
                        guid: cli.guid,
                        action: 'Open Client'
                    });
                }
            }
        }
    }

    return alerts;
}

const Ai = {
    getActivePacks() {
        if (!Array.isArray(this.workflowState?.activePacks)) {
            return [];
        }
        return this.workflowState.activePacks;
    },

    isPackActive(packId) {
        return this.getActivePacks().includes(packId);
    },

    togglePack(packId) {
        if (!this.workflowState) return false;
        if (!Array.isArray(this.workflowState.activePacks)) {
            this.workflowState.activePacks = [];
        }
        const index = this.workflowState.activePacks.indexOf(packId);
        let activated = false;
        if (index >= 0) {
            this.workflowState.activePacks.splice(index, 1);
            activated = false;
        } else {
            this.workflowState.activePacks.push(packId);
            activated = true;
        }
        this.persistWorkflow();
        return activated;
    },

    getAiPreferences() {
        return {
            clientLanguage: this.workflowState?.ai?.clientLanguage || 'French',
            pricingBuffer: Number.isFinite(this.workflowState?.ai?.pricingBuffer) ? this.workflowState.ai.pricingBuffer : 25,
            watchdogProposals: this.workflowState?.ai?.watchdogProposals !== false,
            watchdogInvoices: this.workflowState?.ai?.watchdogInvoices !== false,
            watchdogBudget: this.workflowState?.ai?.watchdogBudget !== false
        };
    },

    async copyAiSnippet(text, message = 'Copied to clipboard') {
        let copied = false;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                copied = true;
            }
        } catch {}

        if (!copied && typeof document !== 'undefined') {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                copied = document.execCommand('copy');
                ta.remove();
            } catch {}
        }

        if (copied) {
            this.ui?.addToaster?.({ title: message, autoDestroyTime: 2000, dismissible: true });
        }
    },

    renderAiTab(panel, data) {
        const prefs = this.getAiPreferences();
        const activePacks = this.getActivePacks();
        const section = document.createElement('section');
        section.className = 'os-workflow os-ai-view';

        // 1. Heading & Overview
        const heading = document.createElement('div');
        heading.className = 'os-ai-heading';
        heading.innerHTML = `
            <h2>🤖 AI Agents & MCP Bridge</h2>
            <p>Supercharge Freelance OS with autonomous agent workflows and modular Trade Packs. Connect your favorite coding assistant (Antigravity, Claude Code, Cursor, OpenCode, Codex) to manage proposals, time tracking, clients, and invoicing.</p>
        `;
        section.appendChild(heading);

        // 2. Status & Bridge Grid
        const statusGrid = document.createElement('div');
        statusGrid.className = 'os-ai-status-grid';
        statusGrid.innerHTML = `
            <div class="os-ai-status-card">
                <div class="os-ai-status-top">
                    <span class="os-ai-status-icon">🔌</span>
                    <span class="os-badge status-in_progress">Port 13100</span>
                </div>
                <h4>Thymer MCP Server</h4>
                <p>Native Model Context Protocol endpoint for reading/writing records, collections, line items, and journal.</p>
                <code>http://127.0.0.1:13100/mcp</code>
                <div style="margin-top: 8px;">
                    <a href="https://thymer.com/mcp" target="_blank" rel="noopener noreferrer" class="os-card-open">Setup guide & client docs ↗</a>
                </div>
            </div>
            <div class="os-ai-status-card">
                <div class="os-ai-status-top">
                    <span class="os-ai-status-icon">👥</span>
                    <span class="os-badge badge-care-plan">11 Core Agents</span>
                </div>
                <h4>Workspace Agent Skills</h4>
                <p>Auto-discovered in <code>.agents/skills/</code> by Antigravity, OpenCode, Codex, OMP & native agent harnesses.</p>
                <code>.agents/skills/</code>
            </div>
            <div class="os-ai-status-card">
                <div class="os-ai-status-top">
                    <span class="os-ai-status-icon">📦</span>
                    <span class="os-badge os-ai-active-packs-badge ${activePacks.length ? 'badge-care-plan' : 'status-waiting'}">${activePacks.length} Active Pack${activePacks.length === 1 ? '' : 's'}</span>
                </div>
                <h4>Modular Trade Packs</h4>
                <p>11 specialized craft overlays adding domain project templates, acceptance criteria, and agent skills.</p>
                <code>packs/</code>
            </div>
            <div class="os-ai-status-card">
                <div class="os-ai-status-top">
                    <span class="os-ai-status-icon">🔍</span>
                    <span class="os-badge status-in_progress">Port 9444</span>
                </div>
                <h4>Remote Debugging (CDP)</h4>
                <p>Chrome DevTools Protocol port for live UI testing, panel navigation, and automated verification.</p>
                <code>--remote-debugging-port=9444</code>
            </div>
        `;
        section.appendChild(statusGrid);

        // 2b. Local AI Harness Setup (Path A) - Tabbed Tool Switcher
        const harnessSection = document.createElement('div');
        harnessSection.className = 'os-ai-harness-section';
        harnessSection.innerHTML = `
            <div class="os-ai-harness-header">
                <h3>⚡ Connect Your AI Coding Harness</h3>
                <p class="os-action-meta">External users: connect your local AI coding harness to Thymer in 60 seconds. All tools share the universal <code>.agents/skills/</code> directory and connect to Thymer's native local MCP server.</p>
            </div>
            <div class="os-ai-tool-tabs">
                ${HARNESS_TOOLS.map((tool, idx) => `
                    <button type="button" class="os-ai-tool-tab ${idx === 0 ? 'active' : ''}" data-tool-id="${escapeHtml(tool.id)}">
                        <span>${tool.icon}</span>
                        <span>${escapeHtml(tool.name)}</span>
                    </button>
                `).join('')}
            </div>
            <div class="os-ai-tool-panes">
                ${HARNESS_TOOLS.map((tool, idx) => `
                    <div class="os-ai-tool-pane" data-tool-pane="${escapeHtml(tool.id)}" style="${idx === 0 ? '' : 'display: none;'}">
                        <div class="os-ai-tool-header">
                            <div class="os-ai-tool-title-group">
                                <span style="font-size: 18px;">${tool.icon}</span>
                                <h4>${escapeHtml(tool.name)} <span style="font-size: 13px; font-weight: normal; color: var(--os-muted);">— ${escapeHtml(tool.subtitle || '')}</span></h4>
                            </div>
                        </div>
                        <div class="os-ai-tool-steps-grid">
                            ${tool.steps.map((step, sIdx) => `
                                <div class="os-ai-step-card">
                                    <div class="os-ai-step-header">
                                        <span class="os-badge badge-care-plan" style="font-size: 10px; padding: 1px 6px;">Step ${sIdx + 1}</span>
                                        <strong class="os-ai-step-title">${escapeHtml(step.title)}</strong>
                                        <span class="os-ai-step-desc">— ${escapeHtml(step.desc)}</span>
                                    </div>
                                    <div class="os-ai-step-code-box">
                                        <code>${escapeHtml(step.code)}</code>
                                        <button type="button" class="os-card-action-btn os-ai-copy-btn" data-snippet="${escapeHtml(step.code)}" title="Copy to clipboard">Copy</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="os-ai-checklist">
                            ${tool.checklist.map(item => `
                                <div class="os-ai-check-item">
                                    <span>${escapeHtml(item)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        harnessSection.querySelectorAll('.os-ai-tool-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const toolId = tab.getAttribute('data-tool-id');
                harnessSection.querySelectorAll('.os-ai-tool-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                harnessSection.querySelectorAll('.os-ai-tool-pane').forEach(pane => {
                    if (pane.getAttribute('data-tool-pane') === toolId) {
                        pane.style.display = '';
                    } else {
                        pane.style.display = 'none';
                    }
                });
            });
        });

        harnessSection.querySelectorAll('.os-ai-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const snippet = btn.getAttribute('data-snippet');
                if (snippet) {
                    this.copyAiSnippet(snippet, 'Command copied to clipboard');
                    const orig = btn.textContent;
                    btn.textContent = '✓ Copied';
                    setTimeout(() => { btn.textContent = orig; }, 1800);
                }
            });
        });
        section.appendChild(harnessSection);

        // 3. Core Universal Operations Bench (Placed above packs)
        const agentsSection = document.createElement('div');
        agentsSection.className = 'os-ai-directory-section';
        agentsSection.innerHTML = `
            <h3>Universal Operations Bench (${CORE_AGENTS.length} Core Personas)</h3>
            <p class="os-action-meta">Trade-agnostic business specialists covering the entire client lifecycle: lead generation, discovery, pricing, proposals, kickoff, project management, and collections. Click "Copy prompt" to try one.</p>
            <div class="os-ai-agents-grid">
                ${CORE_AGENTS.map(agent => `
                    <div class="os-ai-agent-card" data-agent-id="${escapeHtml(agent.id)}">
                        <div class="os-ai-agent-top">
                            <span class="os-ai-agent-icon">${agent.icon}</span>
                            <div>
                                <h4 class="os-ai-agent-name">${escapeHtml(agent.name)}</h4>
                                <span class="os-ai-agent-role">${escapeHtml(agent.role)}</span>
                            </div>
                        </div>
                        <p class="os-ai-agent-desc">${escapeHtml(agent.description)}</p>
                        <div class="os-ai-prompt-box">
                            <span class="os-ai-prompt-label">Example prompt:</span>
                            <div class="os-ai-prompt-text">"${escapeHtml(agent.prompt)}"</div>
                            <button type="button" class="os-card-action-btn os-ai-copy-prompt" data-prompt="${escapeHtml(agent.prompt)}">Copy prompt</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        agentsSection.querySelectorAll('.os-ai-copy-prompt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const prompt = btn.getAttribute('data-prompt');
                if (prompt) {
                    this.copyAiSnippet(prompt, 'Agent prompt copied');
                    const orig = btn.textContent;
                    btn.textContent = '✓ Copied';
                    setTimeout(() => { btn.textContent = orig; }, 1800);
                }
            });
        });
        section.appendChild(agentsSection);

        // 4. Modular Trade Packs Catalog
        const packsSection = document.createElement('div');
        packsSection.className = 'os-ai-packs-section';
        packsSection.innerHTML = `
            <div class="os-ai-packs-header">
                <div>
                    <h3>Modular Trade Packs (${TRADE_PACKS.length} Specialized Archetypes)</h3>
                    <p class="os-action-meta">Activate trade packs to customize Freelance OS for your craft. Each pack equips your workspace with domain project templates, milestones, and dedicated agent skills.</p>
                </div>
            </div>
            <div class="os-ai-filter-bar">
                <button type="button" class="os-ai-filter-btn active" data-category="all">All Packs (${TRADE_PACKS.length})</button>
                <button type="button" class="os-ai-filter-btn" data-category="Technology">Technology</button>
                <button type="button" class="os-ai-filter-btn" data-category="Creative">Creative</button>
                <button type="button" class="os-ai-filter-btn" data-category="Marketing">Marketing</button>
                <button type="button" class="os-ai-filter-btn" data-category="Finance">Finance</button>
                <button type="button" class="os-ai-filter-btn" data-category="Strategy & Ops">Strategy & Ops</button>
                <button type="button" class="os-ai-filter-btn" data-category="Services">Services</button>
            </div>
            <div class="os-ai-packs-grid">
                ${TRADE_PACKS.map(pack => {
                    const isActive = this.isPackActive(pack.id);
                    return `
                        <div class="os-ai-pack-card ${isActive ? 'os-ai-pack-active' : ''}" data-pack-id="${escapeHtml(pack.id)}" data-category="${escapeHtml(pack.category)}">
                            <div class="os-ai-pack-top">
                                <div class="os-ai-pack-title-group">
                                    <span class="os-ai-pack-icon">${pack.icon}</span>
                                    <div>
                                        <h4 class="os-ai-pack-name">${escapeHtml(pack.name)}</h4>
                                        <span class="os-badge os-ai-cat-badge">${escapeHtml(pack.category)}</span>
                                    </div>
                                </div>
                                <div class="os-ai-pack-actions">
                                    <button type="button" class="os-card-action-btn os-ai-pack-toggle ${isActive ? 'active' : ''}" data-pack-id="${escapeHtml(pack.id)}">
                                        ${isActive ? '✓ Active' : '+ Activate Pack'}
                                    </button>
                                    <button type="button" class="os-card-action-btn os-ai-pack-create-proj" data-pack-id="${escapeHtml(pack.id)}" style="${isActive ? '' : 'display: none;'}">
                                        + New ${escapeHtml(pack.templates.projectType)}
                                    </button>
                                </div>
                            </div>
                            <div class="os-ai-pack-roles">
                                <strong>Target roles:</strong> ${escapeHtml(pack.roles)}
                            </div>
                            <div class="os-ai-pack-workflow">
                                <strong>Workflow:</strong> ${escapeHtml(pack.workflow)}
                            </div>
                            <div class="os-ai-pack-skills">
                                <span class="os-ai-pack-skills-heading">Dedicated Skills (${pack.skills.length}):</span>
                                <ul class="os-ai-skills-list">
                                    ${pack.skills.map(s => `
                                        <li><strong>${escapeHtml(s.name)}:</strong> ${escapeHtml(s.description)}</li>
                                    `).join('')}
                                </ul>
                            </div>
                            <div class="os-ai-pack-templates">
                                <span class="os-ai-pack-skills-heading">Project Archetype: <em>${escapeHtml(pack.templates.projectType)}</em></span>
                                <div class="os-ai-milestones-flow">
                                    ${pack.templates.milestones.map((m, i) => `
                                        <span class="os-ai-milestone-pill">${i + 1}. ${escapeHtml(m)}</span>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="os-ai-prompt-box">
                                <span class="os-ai-prompt-label">Example trade prompt:</span>
                                <div class="os-ai-prompt-text">"${escapeHtml(pack.prompt)}"</div>
                                <button type="button" class="os-card-action-btn os-ai-copy-prompt" data-prompt="${escapeHtml(pack.prompt)}">Copy prompt</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Filter button handlers
        packsSection.querySelectorAll('.os-ai-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                packsSection.querySelectorAll('.os-ai-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const cat = btn.getAttribute('data-category');
                packsSection.querySelectorAll('.os-ai-pack-card').forEach(card => {
                    const cardCat = card.getAttribute('data-category');
                    if (cat === 'all' || cardCat === cat) {
                        card.style.display = '';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });

        // Pack copy prompt button handlers
        packsSection.querySelectorAll('.os-ai-copy-prompt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const prompt = btn.getAttribute('data-prompt');
                if (prompt) {
                    this.copyAiSnippet(prompt, 'Trade pack prompt copied');
                    const orig = btn.textContent;
                    btn.textContent = '✓ Copied';
                    setTimeout(() => { btn.textContent = orig; }, 1800);
                }
            });
        });

        // Pack create project button handlers
        packsSection.querySelectorAll('.os-ai-pack-create-proj').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const packId = btn.getAttribute('data-pack-id');
                if (typeof this.showCreateProjectModal === 'function') {
                    this.showCreateProjectModal(panel, data || { clients: [], baseCurrency: this.getBaseCurrency() }, '', packId);
                }
            });
        });

        // Pack toggle button handlers
        packsSection.querySelectorAll('.os-ai-pack-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const packId = btn.getAttribute('data-pack-id');
                const activated = this.togglePack(packId);
                const packCard = packsSection.querySelector(`.os-ai-pack-card[data-pack-id="${packId}"]`);
                if (packCard) {
                    const createBtn = packCard.querySelector('.os-ai-pack-create-proj');
                    if (activated) {
                        packCard.classList.add('os-ai-pack-active');
                        btn.classList.add('active');
                        btn.textContent = '✓ Active';
                        if (createBtn) createBtn.style.display = '';
                    } else {
                        packCard.classList.remove('os-ai-pack-active');
                        btn.classList.remove('active');
                        btn.textContent = '+ Activate Pack';
                        if (createBtn) createBtn.style.display = 'none';
                    }
                }
                const activeBadge = statusGrid.querySelector('.os-ai-active-packs-badge');
                if (activeBadge) {
                    const count = this.getActivePacks().length;
                    activeBadge.textContent = `${count} Active Pack${count === 1 ? '' : 's'}`;
                    activeBadge.className = `os-badge os-ai-active-packs-badge ${count ? 'badge-care-plan' : 'status-waiting'}`;
                }
                const pack = TRADE_PACKS.find(p => p.id === packId);
                const packName = pack ? pack.name : packId;
                this.ui?.addToaster?.({
                    title: activated ? `${packName} activated` : `${packName} deactivated`,
                    autoDestroyTime: 2000,
                    dismissible: true
                });
            });
        });
        section.appendChild(packsSection);

        // 5. Agent Behavioral Settings Form
        const configSection = document.createElement('div');
        configSection.className = 'os-ai-config-section';
        configSection.innerHTML = `
            <h3>Agent Preferences & Safeguards</h3>
            <p class="os-action-meta">Customize how autonomous agents interact with clients and financial estimates in this workspace.</p>
            <div class="os-settings-fields">
                <label>
                    Default client communication language
                    <select class="os-input os-ai-lang">
                        <option value="French" ${prefs.clientLanguage === 'French' ? 'selected' : ''}>French (Français)</option>
                        <option value="English" ${prefs.clientLanguage === 'English' ? 'selected' : ''}>English</option>
                        <option value="German" ${prefs.clientLanguage === 'German' ? 'selected' : ''}>German (Deutsch)</option>
                        <option value="Italian" ${prefs.clientLanguage === 'Italian' ? 'selected' : ''}>Italian (Italiano)</option>
                        <option value="Spanish" ${prefs.clientLanguage === 'Spanish' ? 'selected' : ''}>Spanish (Español)</option>
                    </select>
                </label>
                <label>
                    Pricing margin / contingency buffer (%)
                    <input type="number" min="0" max="100" step="5" class="os-input os-ai-buffer" value="${prefs.pricingBuffer}" />
                </label>
            </div>
            <div class="os-ai-toggles">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; margin-bottom: 8px;">
                    <input type="checkbox" class="os-ai-toggle-proposals" ${prefs.watchdogProposals ? 'checked' : ''} />
                    <span><strong>Stale proposal watchdog:</strong> Alert when proposals have no updates after 5+ days</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; margin-bottom: 8px;">
                    <input type="checkbox" class="os-ai-toggle-invoices" ${prefs.watchdogInvoices ? 'checked' : ''} />
                    <span><strong>Overdue receivables watchdog:</strong> Alert when sent invoices are past due by 7+ days</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; margin-bottom: 8px;">
                    <input type="checkbox" class="os-ai-toggle-budget" ${prefs.watchdogBudget ? 'checked' : ''} />
                    <span><strong>Project budget burn watchdog:</strong> Warn when billed time exceeds 90% of project budget</span>
                </label>
            </div>
            <div style="margin-top: 16px;">
                <button type="button" class="os-button os-primary os-ai-save-btn">Save AI preferences</button>
            </div>
        `;

        configSection.querySelector('.os-ai-save-btn')?.addEventListener('click', () => {
            const lang = configSection.querySelector('.os-ai-lang')?.value || 'French';
            const buffer = Number(configSection.querySelector('.os-ai-buffer')?.value) || 0;
            const wProp = !!configSection.querySelector('.os-ai-toggle-proposals')?.checked;
            const wInv = !!configSection.querySelector('.os-ai-toggle-invoices')?.checked;
            const wBud = !!configSection.querySelector('.os-ai-toggle-budget')?.checked;

            this.workflowState.ai = {
                clientLanguage: lang,
                pricingBuffer: buffer,
                watchdogProposals: wProp,
                watchdogInvoices: wInv,
                watchdogBudget: wBud
            };

            this.persistWorkflow();
            this.ui?.addToaster?.({ title: 'AI preferences saved', autoDestroyTime: 2000, dismissible: true });
        });
        section.appendChild(configSection);

        return section;
    }
};
