import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = ['support-time.js', 'workflow.js', 'billing.js', 'ai.js', 'index.js'].map(file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')).join('\n');
const api = vm.runInNewContext(`${source.replace('export class Plugin', 'class Plugin')}; Object.assign(Plugin.prototype, Workflow, Billing, Ai); ({ Plugin, CORE_AGENTS, TRADE_PACKS, HARNESS_TOOLS, cloneWorkflowState, workflowDefaults, computeWatchdogAlerts });`, {
    AppPlugin: class {},
    console,
    Date,
    Intl,
    DateTime: { dateOnly: (year, month, day) => ({ value: () => ({ d: `${year}${String(month + 1).padStart(2, '0')}${String(day).padStart(2, '0')}` }) }) },
    document: {
        createElement: (tag) => {
            const el = {
                tagName: tag.toUpperCase(),
                className: '',
                style: {},
                dataset: {},
                children: [],
                setAttribute: (k, v) => { el[k] = v; },
                getAttribute: (k) => el[k],
                appendChild: (child) => { el.children.push(child); return child; },
                append: (...args) => { el.children.push(...args); },
                querySelector: (sel) => {
                    if (sel.includes('.os-ai-lang')) return { value: 'English' };
                    if (sel.includes('.os-ai-buffer')) return { value: '30' };
                    if (sel.includes('.os-ai-toggle-proposals')) return { checked: false };
                    if (sel.includes('.os-ai-toggle-invoices')) return { checked: true };
                    if (sel.includes('.os-ai-toggle-budget')) return { checked: true };
                    return { addEventListener: () => {}, classList: { add: () => {}, remove: () => {} } };
                },
                querySelectorAll: () => []
            };
            return el;
        }
    }
});

test('CORE_AGENTS contains exactly 11 core agency personas with complete metadata', () => {
    assert.equal(api.CORE_AGENTS.length, 11);
    const expectedIds = [
        'proposal-strategist',
        'pricing-analyst',
        'reality-checker',
        'discovery-coach',
        'meeting-notes-specialist',
        'project-manager-senior',
        'contract-clause-guardian',
        'client-onboarding-shepherd',
        'receivables-diplomat',
        'lead-gen-offer-architect',
        'outbound-strategist'
    ];

    for (const expectedId of expectedIds) {
        const agent = api.CORE_AGENTS.find(a => a.id === expectedId);
        assert.ok(agent, `Missing agent ${expectedId}`);
        assert.ok(agent.name, `Agent ${expectedId} missing name`);
        assert.ok(agent.icon, `Agent ${expectedId} missing icon`);
        assert.ok(agent.role, `Agent ${expectedId} missing role`);
        assert.ok(agent.description, `Agent ${expectedId} missing description`);
        assert.ok(agent.prompt && agent.prompt.length > 20, `Agent ${expectedId} missing actionable prompt`);
    }
});

test('TRADE_PACKS contains exactly 11 curated trade packs with complete specifications', () => {
    assert.equal(api.TRADE_PACKS.length, 11);
    const expectedPackIds = [
        'pack-software-dev',
        'pack-design-creative',
        'pack-writing-editorial',
        'pack-growth-marketing',
        'pack-strategy-consulting',
        'pack-accounting-cfo',
        'pack-executive-support',
        'pack-media-production',
        'pack-recruiting-talent',
        'pack-event-production',
        'pack-interior-design'
    ];

    for (const id of expectedPackIds) {
        const pack = api.TRADE_PACKS.find(p => p.id === id);
        assert.ok(pack, `Missing pack ${id}`);
        assert.ok(pack.name, `Pack ${id} missing name`);
        assert.ok(pack.icon, `Pack ${id} missing icon`);
        assert.ok(pack.category, `Pack ${id} missing category`);
        assert.ok(pack.roles, `Pack ${id} missing roles`);
        assert.ok(pack.workflow, `Pack ${id} missing workflow`);
        assert.ok(Array.isArray(pack.skills) && pack.skills.length === 3, `Pack ${id} must have exactly 3 skills`);
        for (const skill of pack.skills) {
            assert.ok(skill.id, `Skill in pack ${id} missing id`);
            assert.ok(skill.name, `Skill in pack ${id} missing name`);
            assert.ok(skill.description, `Skill in pack ${id} missing description`);
        }
        assert.ok(pack.prompt && pack.prompt.length > 20, `Pack ${id} missing actionable prompt`);
        assert.ok(pack.templates?.projectType, `Pack ${id} missing projectType template`);
        assert.ok(Array.isArray(pack.templates?.milestones) && pack.templates.milestones.length >= 3, `Pack ${id} missing milestones`);
    }
});

test('workflowDefaults and cloneWorkflowState preserve AI preferences, activePacks and onboarding dismissal', () => {
    const defaults = api.workflowDefaults();
    assert.ok(defaults.ai);
    assert.equal(defaults.ai.clientLanguage, 'French');
    assert.equal(defaults.ai.pricingBuffer, 25);
    assert.equal(defaults.ai.watchdogProposals, true);
    assert.ok(Array.isArray(defaults.activePacks));
    assert.equal(defaults.activePacks.length, 0);
    assert.equal(defaults.dismissedOnboarding, false);

    const customized = api.cloneWorkflowState({
        dismissedOnboarding: true,
        ai: {
            clientLanguage: 'German',
            pricingBuffer: 20,
            watchdogProposals: false
        },
        activePacks: ['pack-software-dev', 'pack-design-creative']
    });

    assert.equal(customized.dismissedOnboarding, true);
    assert.equal(customized.ai.clientLanguage, 'German');
    assert.equal(customized.ai.pricingBuffer, 20);
    assert.equal(customized.ai.watchdogProposals, false);
    assert.equal(customized.ai.watchdogInvoices, true); // preserved default
    assert.equal(customized.activePacks.length, 2);
    assert.equal(customized.activePacks[0], 'pack-software-dev');
    assert.equal(customized.activePacks[1], 'pack-design-creative');
});

test('Plugin Trade Pack activation toggles and state helpers', () => {
    const plugin = new api.Plugin();
    plugin.workflowState = api.workflowDefaults();
    plugin.persistWorkflow = () => {};

    assert.equal(plugin.getActivePacks().length, 0);
    assert.equal(plugin.isPackActive('pack-software-dev'), false);

    // Activate pack
    const activated = plugin.togglePack('pack-software-dev');
    assert.equal(activated, true);
    assert.equal(plugin.isPackActive('pack-software-dev'), true);
    assert.equal(plugin.getActivePacks().length, 1);
    assert.equal(plugin.getActivePacks()[0], 'pack-software-dev');

    // Deactivate pack
    const deactivated = plugin.togglePack('pack-software-dev');
    assert.equal(deactivated, false);
    assert.equal(plugin.isPackActive('pack-software-dev'), false);
    assert.equal(plugin.getActivePacks().length, 0);
});

test('HARNESS_TOOLS contains exactly 7 coding harnesses with complete setup steps', () => {
    assert.equal(api.HARNESS_TOOLS.length, 7);
    const expectedToolIds = ['antigravity', 'opencode', 'codex', 'omp', 'claude-code', 'cursor', 'other'];

    const antigravity = api.HARNESS_TOOLS.find(t => t.id === 'antigravity');
    assert.equal(antigravity.name, 'Antigravity');

    const codex = api.HARNESS_TOOLS.find(t => t.id === 'codex');
    assert.equal(codex.name, 'Codex');

    const other = api.HARNESS_TOOLS.find(t => t.id === 'other');
    assert.equal(other.name, 'Other');

    for (const id of expectedToolIds) {
        const tool = api.HARNESS_TOOLS.find(t => t.id === id);
        assert.ok(tool, `Missing harness tool ${id}`);
        assert.ok(tool.name, `Harness ${id} missing name`);
        assert.ok(tool.icon, `Harness ${id} missing icon`);
        assert.ok(tool.subtitle, `Harness ${id} missing subtitle`);
        assert.ok(Array.isArray(tool.steps) && tool.steps.length === 3, `Harness ${id} must have exactly 3 steps`);
        for (const step of tool.steps) {
            assert.ok(step.title, `Step in ${id} missing title`);
            assert.ok(step.desc, `Step in ${id} missing desc`);
            assert.ok(step.code, `Step in ${id} missing code`);
        }
        // Universal skill download step 1
        assert.ok(tool.steps[0].code.includes('npx degit jacoplane/thymer-freelance-os/.agents .agents'), `Harness ${id} step 1 must sync .agents skills`);
        // MCP port connection step 2
        assert.ok(tool.steps[1].code.includes('13100'), `Harness ${id} step 2 must connect to port 13100`);
        assert.ok(Array.isArray(tool.checklist) && tool.checklist.length >= 3, `Harness ${id} missing checklist`);
    }
});

test('renderAiTab renders section with bridge status, harness setup, directory, trade packs, and settings', () => {
    const plugin = new api.Plugin();
    plugin.workflowState = api.workflowDefaults();
    const section = plugin.renderAiTab({});
    assert.ok(section);
    assert.equal(section.className, 'os-workflow os-ai-view');
    assert.equal(section.children.length, 6);
    assert.equal(section.children[2].className, 'os-ai-harness-section');
    assert.equal(section.children[3].className, 'os-ai-directory-section');
    assert.equal(section.children[4].className, 'os-ai-packs-section');
    assert.equal(section.children[5].className, 'os-ai-config-section');
});

test('computeWatchdogAlerts triggers overdue invoice alerts when daysOverdue >= 7', () => {
    const data = {
        invoices: [
            { guid: 'inv1', invoiceId: 'INV-001', name: 'Invoice 1', clientName: 'Acme', amount: 1500, currency: 'CHF', isOutstanding: true, daysOverdue: 8 },
            { guid: 'inv2', invoiceId: 'INV-002', name: 'Invoice 2', clientName: 'Beta', amount: 800, currency: 'CHF', isOutstanding: true, daysOverdue: 4 },
            { guid: 'inv3', invoiceId: 'INV-003', name: 'Invoice 3', clientName: 'Gamma', amount: 2000, currency: 'CHF', isOutstanding: false, daysOverdue: 15 }
        ],
        projects: [],
        clients: []
    };

    const alerts = api.computeWatchdogAlerts(data, { watchdogInvoices: true }, '2026-10-27');
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'invoice');
    assert.equal(alerts[0].guid, 'inv1');
    assert.ok(alerts[0].title.includes('INV-001'));
});

test('computeWatchdogAlerts triggers budget burn alerts when billed time >= 90%', () => {
    const data = {
        invoices: [],
        projects: [
            { guid: 'proj1', name: 'Website Redesign', status: 'in_progress', budget: 5000, totalBilledCHF: 4600 },
            { guid: 'proj2', name: 'Brand Guide', status: 'in_progress', budget: 3000, totalBilledCHF: 1200 },
            { guid: 'proj3', name: 'Archived App', status: 'completed', budget: 10000, totalBilledCHF: 10000 }
        ],
        clients: []
    };

    const alerts = api.computeWatchdogAlerts(data, { watchdogBudget: true }, '2026-10-27');
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'budget');
    assert.equal(alerts[0].guid, 'proj1');
    assert.ok(alerts[0].detail.includes('92%'));
});

test('computeWatchdogAlerts triggers stale proposal alerts when proposal sent >= 5 days', () => {
    const data = {
        invoices: [],
        projects: [],
        clients: [
            {
                guid: 'cli1',
                name: 'Solaris Energy',
                status: 'proposal_sent',
                record: { getModifiedAt: () => '2026-10-18T10:00:00Z' }
            },
            {
                guid: 'cli2',
                name: 'Fresh Bakery',
                status: 'active',
                record: { getModifiedAt: () => '2026-10-10T10:00:00Z' }
            }
        ]
    };

    const alerts = api.computeWatchdogAlerts(data, { watchdogProposals: true }, '2026-10-27');
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'proposal');
    assert.equal(alerts[0].guid, 'cli1');
    assert.ok(alerts[0].title.includes('Solaris Energy'));
});

test('computeWatchdogAlerts respects disabled watchdog preferences', () => {
    const data = {
        invoices: [{ guid: 'inv1', invoiceId: 'INV-001', name: 'Invoice 1', clientName: 'Acme', amount: 1500, currency: 'CHF', isOutstanding: true, daysOverdue: 20 }],
        projects: [{ guid: 'proj1', name: 'Over Budget', status: 'in_progress', budget: 1000, totalBilledCHF: 1200 }],
        clients: [{ guid: 'cli1', name: 'Stale Co', status: 'proposal_sent', record: { getModifiedAt: () => '2026-10-01' } }]
    };

    const alerts = api.computeWatchdogAlerts(data, {
        watchdogInvoices: false,
        watchdogBudget: false,
        watchdogProposals: false
    }, '2026-10-27');

    assert.equal(alerts.length, 0);
});

test('All 11 Trade Packs have complete SKILL.md files on disk', () => {
    const packsDir = new URL('../packs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
    assert.ok(fs.existsSync(packsDir));
    const packDirs = fs.readdirSync(packsDir);
    assert.equal(packDirs.length, 11);

    for (const pack of api.TRADE_PACKS) {
        const packPath = `${packsDir}/${pack.id}`;
        assert.ok(fs.existsSync(packPath), `Missing pack directory: ${pack.id}`);
        assert.ok(fs.existsSync(`${packPath}/pack.json`), `Missing pack.json for ${pack.id}`);

        const skillsDir = `${packPath}/skills`;
        assert.ok(fs.existsSync(skillsDir), `Missing skills dir for ${pack.id}`);
        const skillsOnDisk = fs.readdirSync(skillsDir);
        assert.equal(skillsOnDisk.length, 3, `Pack ${pack.id} must have exactly 3 skills on disk`);

        for (const skill of pack.skills) {
            const skillFilePath = `${skillsDir}/${skill.id}/SKILL.md`;
            assert.ok(fs.existsSync(skillFilePath), `Missing SKILL.md: ${skillFilePath}`);
            const content = fs.readFileSync(skillFilePath, 'utf8');
            assert.ok(content.startsWith('---'), `Skill ${skill.id} missing frontmatter`);
            assert.ok(content.includes(`name: ${skill.id}`), `Skill ${skill.id} missing name in frontmatter`);
            assert.ok(content.includes('Core Directives') || content.includes('Operational Workflow') || content.includes('Core Rules'), `Skill ${skill.id} missing directives/workflow/rules`);
        }
    }
});

