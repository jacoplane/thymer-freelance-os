/**
 * Freelance OS Dashboard Plugin for Thymer
 * Replicates the executive dashboard from Obsidian Freelance OS.
 */

const DASHBOARD_PANEL_ID = 'freelance-os-dashboard';

const COLLECTION_ROLES = ['Projects', 'Clients', 'Invoices', 'Library', 'Journal', 'Support Sessions'];

const COLLECTION_VIEWS = {
    Invoices: { all: 'Register', board: 'Preparation', outstanding: 'Outstanding', overdue: 'Overdue', review: 'To confirm', 'to-send': 'To send', paid: 'Paid' },
    Projects: { all: 'Register', board: 'Board', in_progress: 'Active', overdue: 'Overdue', deadlines: 'Due dates' },
    Clients: { all: 'Directory', status: 'Status', active: 'Active', prospects: 'Leads', leads: 'Leads', archived: 'Archived', 'care-plans': 'Care plans' },
    'Support Sessions': { all: 'Register' }
};

function collectionViewId(guid, config, key = 'all', role) {
    const label = COLLECTION_VIEWS[role]?.[key];
    return config?.views?.find(view => view.shown !== false && view.label === label)?.id || null;
}

const BASE32_GUID = /^[0-9A-Z]{26}$/;

function cleanString(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (BASE32_GUID.test(trimmed)) return '';
        return trimmed;
    }
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (typeof val.getName === 'function') return cleanString(val.getName());
        if (typeof val.choiceLabel === 'function') return cleanString(val.choiceLabel());
        if (typeof val.text === 'function') return cleanString(val.text());
        return val.name || val.title || val.label || '';
    }
    return '';
}

function formatDatetime(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        if (val.includes('Object') || val.includes('[object')) return '';
        return val;
    }
    if (val instanceof Date) return localDate(val);
    if (Array.isArray(val)) {
        if (val[0] === 'datetime') return formatDatetime(val[1]);
        if (val[1] && typeof val[1] === 'object') return formatDatetime(val[1]);
        return formatDatetime(val[0]);
    }
    if (typeof val === 'object') {
        if (typeof val.value === 'function') return formatDatetime(val.value());
        if (typeof val.toISOString === 'function') return val.toISOString().slice(0, 10);
        if (val.value !== undefined) return formatDatetime(val.value);
        if (val.d && String(val.d).length === 8) {
            const s = String(val.d);
            return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        }
        if (val.formatted) return String(val.formatted);
        if (val.text) return String(val.text);
        if (val.date) return formatDatetime(val.date);
        if (val.year && val.month && val.day) {
            return `${val.year}-${String(val.month).padStart(2, '0')}-${String(val.day).padStart(2, '0')}`;
        }
    }
    return '';
}

function getProp(record, propName) {
    if (!record) return '';
    try {
        if (typeof record.prop === 'function') {
            const p = record.prop(propName);
            if (p !== null && p !== undefined) {
                if (typeof p.choiceLabel === 'function') {
                    const l = p.choiceLabel();
                    if (l) return cleanString(l);
                }
                if (typeof p.date === 'function') {
                    const d = p.date();
                    if (d) return formatDatetime(d);
                }
                if (typeof p.text === 'function') {
                    const t = p.text();
                    if (t) return cleanString(t);
                }
                if (typeof p.number === 'function') {
                    const n = p.number();
                    if (n !== null && n !== undefined) return n;
                }
                if (typeof p.date === 'function') {
                    const d = p.date();
                    if (d) return formatDatetime(d);
                }
                if (p.value !== undefined) {
                    if (Array.isArray(p.value)) {
                        if (p.value[0] === 'choice') return p.value[1];
                        if (p.value[0] === 'datetime') return formatDatetime(p.value[1]);
                        return cleanString(p.value[1]);
                    }
                    if (typeof p.value === 'object' && p.value !== null) {
                        return formatDatetime(p.value);
                    }
                    return cleanString(p.value);
                }
            }
        }
        if (typeof record.text === 'function') {
            const val = record.text(propName);
            if (val) return cleanString(val);
        }
        if (typeof record.number === 'function') {
            const val = record.number(propName);
            if (val !== null && val !== undefined) return val;
        }
        if (typeof record.linkedRecord === 'function') {
            const lr = record.linkedRecord(propName);
            if (lr) return cleanString(lr);
        }
        if (record.properties && record.properties[propName] !== undefined) {
            const raw = record.properties[propName];
            if (Array.isArray(raw)) {
                if (raw[0] === 'choice') return raw[1];
                if (raw[0] === 'datetime') return formatDatetime(raw[1]);
                if (raw[0] === 'record') return raw[1];
                return cleanString(raw[1]);
            }
            if (typeof raw === 'object' && raw !== null) return formatDatetime(raw);
            return cleanString(raw);
        }
    } catch (e) {}
    return '';
}

function cleanGuid(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (BASE32_GUID.test(trimmed)) return trimmed;
        return '';
    }
    if (typeof val === 'object' && val !== null) {
        if (val.guid) return cleanGuid(val.guid);
    }
    return '';
}

function getParentGuid(record) {
    if (!record) return '';
    try {
        if (typeof record.getSubPageOf === 'function') {
            const sub = record.getSubPageOf();
            if (sub && sub.guid) return cleanGuid(sub.guid);
        }
        if (typeof record.linkedRecord === 'function') {
            const lr = record.linkedRecord('parent_page') || record.linkedRecord('Sub-page of');
            if (lr && lr.guid) return cleanGuid(lr.guid);
        }
        if (typeof record.prop === 'function') {
            const p = record.prop('parent_page') || record.prop('Sub-page of');
            if (p) {
                if (typeof p.linkedRecord === 'function') {
                    const lr = p.linkedRecord();
                    if (lr && lr.guid) return cleanGuid(lr.guid);
                }
                if (typeof p.values === 'function') {
                    const vals = p.values();
                    if (Array.isArray(vals) && vals.length > 0) {
                        const v = vals[0];
                        const g = cleanGuid(v);
                        if (g) return g;
                    }
                }
            }
        }
        if (typeof record.parentGuid === 'function') {
            const pg = record.parentGuid();
            if (pg && BASE32_GUID.test(pg)) return pg;
        }
        if (record.properties) {
            const sub = record.properties['Sub-page of'] || record.properties.parent_page;
            if (sub) {
                if (Array.isArray(sub) && sub[0] === 'record') return cleanGuid(sub[1]);
                if (typeof sub === 'string' && BASE32_GUID.test(sub)) return sub;
                if (sub.value && Array.isArray(sub.value) && sub.value[0] === 'record') return cleanGuid(sub.value[1]);
            }
        }
    } catch (e) {}
    return '';
}

function getLinkedRecordGuid(record, fieldName) {
    if (!record) return '';
    try {
        if (typeof record.linkedRecord === 'function') {
            const lr = record.linkedRecord(fieldName);
            if (lr && lr.guid) return cleanGuid(lr.guid);
        }
        if (typeof record.prop === 'function') {
            const p = record.prop(fieldName);
            if (p) {
                if (typeof p.linkedRecord === 'function') {
                    const lr = p.linkedRecord();
                    if (lr && lr.guid) return cleanGuid(lr.guid);
                }
                if (typeof p.values === 'function') {
                    const vals = p.values();
                    if (Array.isArray(vals) && vals.length > 0) {
                        const v = vals[0];
                        const g = cleanGuid(v);
                        if (g) return g;
                    }
                }
            }
        }
        const val = getProp(record, fieldName);
        if (val && BASE32_GUID.test(val)) return val;
        if (record.properties && record.properties[fieldName]) {
            const prop = record.properties[fieldName];
            if (Array.isArray(prop) && prop[0] === 'record') return cleanGuid(prop[1]);
            if (typeof prop === 'string' && BASE32_GUID.test(prop)) return prop;
            if (prop.value && Array.isArray(prop.value) && prop.value[0] === 'record') return cleanGuid(prop.value[1]);
        }
    } catch (e) {}
    return '';
}

function getClientGuid(record) {
    return getLinkedRecordGuid(record, 'client');
}

function getProjectGuid(record) {
    return getLinkedRecordGuid(record, 'project');
}

function extractLineText(line) {
    if (!line) return '';
    if (typeof line.text === 'string' && line.text.trim()) return line.text.trim();
    if (Array.isArray(line.segments)) {
        return line.segments.map(s => {
            if (s.type === 'ref') {
                return cleanString(s.text) || cleanString(s.title) || cleanString(s.name) || '';
            }
            if (s.type === 'datetime') return '';
            return typeof s.text === 'string' ? s.text : '';
        }).join('').trim();
    }
    return '';
}

function extractLineDate(line) {
    if (!line || !Array.isArray(line.segments)) return null;
    const dt = line.segments.find(s => s.type === 'datetime');
    if (!dt) return null;
    return formatDatetime(dt.text || dt.date);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp / 86400000 : null;
}

function money(value) {
    return new Intl.NumberFormat('en-CH', { maximumFractionDigits: 2 }).format(value);
}

function invoiceMatches(invoice, filter) {
    if (filter === 'all') return true;
    if (filter === 'overdue') return invoice.daysOverdue > 0;
    if (filter === 'outstanding') return invoice.isOutstanding;
    if (filter === 'review') return invoice.status === 'unconfirmed';
    if (filter === 'to-send') return invoice.stage === 'draft' || invoice.stage === 'ready';
    return invoice.status === filter;
}

function summarizeInvoices(invoices, baseCurrency = 'CHF') {
    const summary = { invoiced: 0, collected: 0, outstanding: 0, overdue: 0, overdueCount: 0, unconfirmedCount: 0, toSend: 0, issuedCount: 0, excludedCurrency: 0, aging: [0, 0, 0], undated: 0, baseCurrency };
    for (const invoice of invoices) {
        if (invoice.stage === 'draft' || invoice.stage === 'ready') summary.toSend++;
        const curr = (invoice.currency || baseCurrency).toUpperCase();
        if (curr !== baseCurrency.toUpperCase()) { summary.excludedCurrency++; continue; }
        if (invoice.stage !== 'sent' && invoice.status !== 'paid') continue;
        summary.invoiced += invoice.amount;
        summary.issuedCount++;
        if (invoice.status === 'paid') summary.collected += invoice.amount;
        if (invoice.status === 'unconfirmed') summary.unconfirmedCount++;
        if (invoice.isOutstanding) {
            summary.outstanding += invoice.amount;
            if (!invoice.dueDate) summary.undated++;
            if (invoice.daysOverdue > 0) {
                summary.overdue += invoice.amount;
                summary.overdueCount++;
                summary.aging[invoice.daysOverdue <= 30 ? 0 : invoice.daysOverdue <= 60 ? 1 : 2] += invoice.amount;
            }
        }
    }
    summary.collectionRate = summary.invoiced > 0 ? Math.round(summary.collected / summary.invoiced * 100) : null;
    return summary;
}

const CLIENT_STATUSES = { prospect: 'New lead', contacted: 'Contacted', discussing: 'Discussing', proposal_sent: 'Proposal sent', proposal_accepted: 'Proposal accepted', active: 'Active client', maintenance: 'On maintenance', archived: 'Archived' };
function clientStatus(client) {
    if (client.status === 'lead') return 'prospect';
    return client.status === 'cancelled' ? 'archived' : client.status;
}
function isLeadClient(client) { return ['prospect', 'contacted', 'discussing', 'proposal_sent'].includes(clientStatus(client)); }
function isRevenueClient(client) { return ['active', 'maintenance'].includes(clientStatus(client)); }
function clientMatches(client, filter = 'all') {
    if (filter === 'leads') return isLeadClient(client);
    if (filter === 'active') return ['proposal_accepted', 'active', 'maintenance'].includes(clientStatus(client));
    if (filter === 'archived') return ['archived', 'cancelled'].includes(client.status);
    return true;
}
function clientSearchText(client) {
    return [client.name, client.contact, client.email, client.phone, client.website, client.plan, client.source, CLIENT_STATUSES[clientStatus(client)]].filter(Boolean).join(' ').toLowerCase();
}

function clientSummary(client, projects, invoices, baseCurrency = 'CHF') {
    const linked = invoices.filter(i => i.clientGuid === client.guid && (i.currency || baseCurrency).toUpperCase() === baseCurrency.toUpperCase());
    return {
        activeProjects: projects.filter(p => p.clientGuid === client.guid && ['in_progress', 'in_review'].includes(p.status)).length,
        collected: linked.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0),
        outstanding: linked.filter(i => i.isOutstanding).reduce((sum, i) => sum + i.amount, 0),
        overdueCount: linked.filter(i => i.daysOverdue > 0).length
    };
}

function isTemplateRecord(record) {
    return String(getProp(record, 'type')).toLowerCase() === 'template' || /^New (Client|Project) Template$/i.test(record.getName?.() || record.name || '');
}

function projectStatusLabel(status) {
    return ({ in_progress: 'In Progress', in_review: 'In Review', backlog: 'Backlog', completed: 'Completed', archived: 'Archived', cancelled: 'Cancelled' })[status] || 'No status';
}

function getPackDeliverables(packId, { repoUrl = '', figmaUrl = '', liveUrl = '' } = {}) {
    const text = value => ({ type: 'text', segments: [{ type: 'text', text: value }] });
    const ulist = value => ({ type: 'ulist', segments: [{ type: 'text', text: value }] });
    switch (packId) {
        case 'pack-software-dev':
            return [
                text('### 💻 Engineering Repositories & Environments'),
                ulist(`Repository / Code: ${repoUrl || '[GitHub / GitLab repo ↗]'}`),
                ulist(`Staging QA Environment: ${liveUrl || '[Staging preview URL ↗]'}`),
                ulist('API Contracts & Documentation: [Postman / Swagger ↗]'),
                ulist('Production URL: [Live site / app ↗]')
            ];
        case 'pack-design-creative':
            return [
                text('### 🎨 Design Canvas & Asset Links'),
                ulist(`Figma Workspace: ${figmaUrl || '[Figma design file ↗]'}`),
                ulist('Moodboard & Concept Board: [Miro / FigJam ↗]'),
                ulist('Design Tokens & Brand Specs: [Style guide ↗]'),
                ulist('Final Production Assets: [Vector SVG / PNG Export folder ↗]')
            ];
        case 'pack-writing-editorial':
            return [
                text('### ✍️ Editorial Queue & Copy Assets'),
                ulist('Working Draft: [Google Doc / Notion ↗]'),
                ulist('Content & Editorial Calendar: [Calendar view ↗]'),
                ulist('Brand Voice Spec: [Tone of Voice guidelines ↗]'),
                ulist('Publishing Package: [Final copy, slugs, meta descriptions ↗]')
            ];
        case 'pack-growth-marketing':
            return [
                text('### 📈 Campaign Portals & Dashboards'),
                ulist('Performance Dashboard: [GA4 / Looker Studio ↗]'),
                ulist('Ad Accounts & Audiences: [Meta / Google Ads Manager ↗]'),
                ulist('Tracking Tags & Pixels: [Google Tag Manager container ↗]'),
                ulist('Creative Asset Bank: [Drive / Figma ad creatives ↗]')
            ];
        case 'pack-strategy-consulting':
            return [
                text('### 🧭 Advisory Artifacts & Evidence'),
                ulist('Stakeholder Interview Notes: [Interview synthesis ↗]'),
                ulist('Diagnostic Findings Memo: [Executive brief ↗]'),
                ulist('Advisory Deck Draft: [Keynote / Google Slides ↗]'),
                ulist('Steering Committee Digest: [Milestone governance brief ↗]')
            ];
        case 'pack-accounting-cfo':
            return [
                text('### 📊 Financial Portals & Workbooks'),
                ulist('Accounting System & Feeds: [Xero / QuickBooks / Bexio ↗]'),
                ulist('Month-End Close Workbook: [Reconciliation sheet ↗]'),
                ulist('Financial Health Digest: [P&L / Cashflow report ↗]'),
                ulist('Tax & Compliance Vault: [Tax filings folder ↗]')
            ];
        case 'pack-executive-support':
            return [
                text('### 🗂️ Operations & Travel Dossiers'),
                ulist('Master Travel Dossier: [Chronological itinerary & passes ↗]'),
                ulist('Executive Calendar: [Timezone focus blocks ↗]'),
                ulist('Daily Action Queue: [Triage board ↗]'),
                ulist('Vendor & Access Contacts: [Secure 1Password share ↗]')
            ];
        case 'pack-media-production':
            return [
                text('### 🎬 Production & Review Hub'),
                ulist('Video Review Portal: [Frame.io / Review link ↗]'),
                ulist('Production Call Sheet: [Crew schedule & locations ↗]'),
                ulist('Talent & Location Releases: [Signed release forms ↗]'),
                ulist('Master Delivery Folder: [ProRes / High-res master ↗]')
            ];
        case 'pack-recruiting-talent':
            return [
                text('### 🤝 Talent Pipeline & Dossiers'),
                ulist('Role Calibration Brief: [Job spec & scorecard ↗]'),
                ulist('Candidate Submission Dossiers: [Blind profile slate ↗]'),
                ulist('Hiring Manager Review Tracker: [SLA review log ↗]'),
                ulist('New Hire Onboarding Plan: [30-60-90 ramp checklist ↗]')
            ];
        case 'pack-event-production':
            return [
                text('### 💍 Event Coordination & Vendor Hub'),
                ulist('Master Run of Show: [Minute-by-minute execution timeline ↗]'),
                ulist('Vendor Contract & Deposit Log: [Vendor SOWs ↗]'),
                ulist('Insurance & COI Vault: [Certificates of Insurance ↗]'),
                ulist('Floor Plan & Load-In Brief: [Venue access window ↗]')
            ];
        case 'pack-interior-design':
            return [
                text('### 🏡 Spatial Specs & Procurement Hub'),
                ulist('FF&E Product Spec Sheet: [Trade margin & tear sheets ↗]'),
                ulist('Floor Plans & Elevations: [CAD / Space plans ↗]'),
                ulist('Freight & Lead-Time Tracker: [Shipping schedule ↗]'),
                ulist('Contractor Punch List: [On-site room punch checklist ↗]')
            ];
        default:
            return [
                text('### 🔗 Key Links & Repositories'),
                ulist(`Repository / Code: ${repoUrl || '[GitHub / GitLab repo ↗]'}`),
                ulist(`Design & Figma: ${figmaUrl || '[Figma / Design link ↗]'}`),
                ulist(`Live / Staging: ${liveUrl || '[Preview site ↗]'}`),
                ulist('Shared Drive / Assets: [Folder link ↗]')
            ];
    }
}

function projectTemplateSections({ brief = '', firstAction = '', deliverables = [], repoUrl = '', figmaUrl = '', liveUrl = '', baseCurrency = 'CHF', packId = '', projectType = '', milestones = [] } = {}) {
    const text = value => ({ type: 'text', segments: [{ type: 'text', text: value }] });
    const ulist = value => ({ type: 'ulist', segments: [{ type: 'text', text: value }] });
    const btn = value => ({ type: 'linkbtn', segments: [{ type: 'text', text: value }] });

    const reviewLines = [
        btn('+ Add review checkpoint'),
        text('Add one task per review. Name the deliverable, set the feedback due date, and mark it complete when the client replies.')
    ];

    if (Array.isArray(milestones) && milestones.length) {
        for (const m of milestones) {
            reviewLines.push({
                type: 'task',
                segments: [{ type: 'text', text: String(m) }],
                props: { [CLIENT_REVIEW_CHECKPOINT_PROPERTY]: 'checkpoint-v1' }
            });
        }
    } else {
        reviewLines.push({ type: 'task', segments: [], props: { [CLIENT_REVIEW_CHECKPOINT_PROPERTY]: 'checkpoint-v1' } });
    }

    const defaultBrief = projectType
        ? `Describe the outcome this ${projectType.toLowerCase()} should achieve.`
        : 'Describe the outcome this project should achieve.';

    return [
        {
            title: 'Project brief',
            lines: [
                text(brief || defaultBrief),
                text('Scope and success criteria: add what is included and how you will know it is done.')
            ]
        },
        {
            title: 'Next actions',
            lines: [
                btn('+ Add task'),
                { type: 'task', segments: firstAction ? [{ type: 'text', text: firstAction }] : [] },
                text('*(Tasks added here automatically sync to the Freelance OS Today queue and Client dashboard rollup)*')
            ]
        },
        {
            title: 'Deliverables & references',
            lines: deliverables.length
                ? deliverables.map(item => ({ type: 'text', segments: [{ type: 'ref', text: { guid: item.guid } }] }))
                : getPackDeliverables(packId, { repoUrl, figmaUrl, liveUrl })
        },
        {
            title: 'Activity & time log',
            lines: [
                btn('+ Log time'),
                text('*(Click above to log a work session, use + Time in the header, or tell your agent: "Logged 2h on this project".)*')
            ]
        },
        {
            title: '💳 Billing & Invoices',
            lines: [
                btn('+ Create invoice'),
                text('*(Click above, use + Invoice in the header, or press Ctrl/Cmd+K → "Create Freelance OS invoice".)*'),
                ulist('Billing Schedule: Milestone deposit (50%) / Final delivery (50%)'),
                ulist(`Payment Method: Bank Transfer${baseCurrency === 'CHF' ? ' / QR-bill (CHF)' : ` (${baseCurrency})`}`)
            ]
        },
        {
            title: 'Client review checkpoints',
            lines: reviewLines
        },
        {
            title: 'Decisions & updates',
            lines: [
                text(`- **${localDate()}**: Project initialized${projectType ? ` (${projectType})` : ''}.`),
                text('*(Tip: record client feedback, scope modifications, and architectural decisions below)*')
            ]
        }
    ];
}

function clientTemplateSections({ context = '', initialTask = '', plan = '', monthlyChf = 0, website = '', contactName = '', email = '', isLead = false, status = '', leadStage = '', estimatedValue = 0, baseCurrency = 'CHF' } = {}) {
    const text = value => ({ type: 'text', segments: [{ type: 'text', text: value }] });
    const ulist = value => ({ type: 'ulist', segments: [{ type: 'text', text: value }] });
    const btn = value => ({ type: 'linkbtn', segments: [{ type: 'text', text: value }] });

    const isLeadClient = isLead || ['prospect', 'contacted', 'discussing', 'proposal_sent'].includes(status);

    if (isLeadClient) {
        const stageLabel = leadStage || (status ? status.replace(/_/g, ' ') : 'Prospect');
        const estStr = estimatedValue > 0 ? `${estimatedValue} ${baseCurrency}` : 'TBD';
        return [
            {
                title: 'Relationship & Context',
                lines: [
                    text(context || 'Record prospect background, initial inquiry, and commercial context.'),
                    text('### 🔗 Key Links & References'),
                    ulist(`Website: ${website || 'https://...'}`),
                    ulist('Pitch Deck / Scope Brief: [Shared link ↗]'),
                    text('### 👥 Stakeholders & Roles'),
                    ulist(`Primary Contact: ${contactName || 'Lead contact'} (${email || 'email@...'}) — Prospect`),
                    ulist('Decision Maker: Same / Commercial sponsor')
                ]
            },
            {
                title: '🎯 Deal Qualification & Next Steps',
                lines: [
                    btn('+ Add task'),
                    { type: 'task', segments: [{ type: 'text', text: 'Discovery call: understand project goals and scope' }] },
                    { type: 'task', segments: [{ type: 'text', text: 'Validate budget range and decision timeline' }] },
                    { type: 'task', segments: [{ type: 'text', text: 'Prepare and deliver proposal / estimate' }] }
                ]
            },
            {
                title: '📄 Commercial Estimate & Proposals',
                lines: [
                    btn('+ Create project'),
                    btn('+ Create invoice'),
                    ulist(`Estimated Pipeline Value: ${estStr}`),
                    ulist(`Current Stage: ${stageLabel}`),
                    text('*(Once the proposal is accepted, click "+ Create project" above to launch delivery or "+ Create invoice" to bill deposit)*')
                ]
            },
            {
                title: '📝 Communication & Meeting Debrief',
                lines: [
                    text(`- **${localDate()}**: Lead record created.`),
                    text('*(Tip: log qualification calls, objection notes, and follow-up emails below)*')
                ]
            }
        ];
    }

    const planLabel = plan || (monthlyChf > 0 ? `${monthlyChf} ${baseCurrency} / month care plan` : 'Ad-hoc / on-demand support');
    const includedHours = monthlyChf >= 100 ? '4h / month included' : monthlyChf > 0 ? '2h / month included' : 'Billed hourly';

    return [
        {
            title: 'Relationship & Context',
            lines: [
                text(context || 'Record organization background, commercial agreements, and communication preferences.'),
                text('### 🔗 Key Links & Deliverables'),
                ulist(`Website: ${website || 'https://...'}`),
                ulist('Shared Drive / Assets: [Folder link ↗]'),
                ulist('Design & Mockups: [Figma / Design link ↗]'),
                text('### 👥 Stakeholders & Roles'),
                ulist(`Primary Contact: ${contactName || 'Contact name'} (${email || 'email@...'}) — Decision maker`),
                ulist('Billing Contact: factures@... (Net 30)')
            ]
        },
        {
            title: 'Active Projects & Engagements',
            lines: [
                btn('+ Create project'),
                text('*(No active projects in flight. Click above, use + Project in the top header, or press Ctrl/Cmd+K → "Create Freelance OS project for active client".)*')
            ]
        },
        {
            title: '💳 Invoices & Billing',
            lines: [
                btn('+ Create invoice'),
                text('*(No invoices issued yet. Click above, use + Invoice in the top header, or press Ctrl/Cmd+K → "Create Freelance OS invoice".)*'),
                ulist('Billing Terms: Monthly (1er du mois) / Net 30'),
                ulist(`Payment Method: Bank Transfer${baseCurrency === 'CHF' ? ' / QR-bill (CHF)' : ` (${baseCurrency})`}`)
            ]
        },
        {
            title: '⏱️ Support & Care Plan',
            lines: [
                btn('+ Log support time'),
                ulist(`Active Plan: ${planLabel}`),
                ulist(`Monthly Support Allowance: ${includedHours}`),
                ulist('Support Window: Mon–Fri, 09:00–18:00 CET')
            ]
        },
        {
            title: '📋 Open Tasks & Actions',
            lines: [
                text('### Account & Relationship Tasks'),
                { type: 'task', segments: initialTask ? [{ type: 'text', text: initialTask }] : [{ type: 'text', text: 'Initial client kickoff / follow-up' }] },
                text('### Active Project Tasks'),
                text('*(No active project tasks. Tasks added to linked projects will automatically roll up here.)*')
            ]
        },
        {
            title: '📝 Communication & Decisions Log',
            lines: [
                text(`- **${localDate()}**: Client profile created.`),
                text('*(Tip: log key meetings, calls, and milestone decisions below)*')
            ]
        }
    ];
}

function invoiceTemplateSections(values = {}, { clientName = '', projectName = '', summary = '', baseCurrency = 'CHF' } = {}) {
    const text = value => ({ type: 'text', segments: [{ type: 'text', text: value }] });
    const btn = value => ({ type: 'linkbtn', segments: [{ type: 'text', text: value }] });
    const amountStr = values.amount_chf ? `${values.amount_chf} ${values.currency || baseCurrency || 'CHF'}` : 'Amount TBD';
    const clientStr = clientName || 'Client';
    const projectStr = projectName || 'General engagement';
    const issuedStr = values.issued || localDate();
    const dueStr = values.due || '30 days net';
    const paymentStatus = values.payment_status || 'unpaid';
    const isPaid = paymentStatus === 'paid';
    const isSent = values.status === 'sent';

    return [
        {
            title: 'Invoice Summary & Scope',
            lines: [
                btn('+ Add deliverable'),
                text(summary || `Scope of work, deliverables, and services covered under this invoice for ${clientStr}.`)
            ]
        },
        {
            title: 'Commercial & Payment Details',
            lines: [
                text(`- **Client:** ${clientStr}`),
                text(`- **Project:** ${projectStr}`),
                text(`- **Amount & Currency:** ${amountStr}`),
                text(`- **Payment Terms:** Net due ${dueStr}`),
                text('- **Payment Method:** Swiss QR-bill / Bank Wire Transfer (Vermeulen Solutions)'),
                text('- **QR-IBAN:** CH44 0076 2011 6238 5295 8'),
                btn('+ Copy payment details')
            ]
        },
        {
            title: 'Delivery & Settlement Log',
            lines: [
                text(`- **${issuedStr}**: Invoice record generated (${values.status || 'draft'}).`),
                ...(isPaid
                    ? [text(`- **${values.paid_date || localDate()}**: ✓ Payment confirmed received and settled in full.`)]
                    : isSent
                        ? [
                            btn('+ Record payment'),
                            text(`- **Status**: Payment sent / awaiting settlement.`)
                        ]
                        : [
                            btn('+ Mark sent'),
                            text(`- **Status**: Draft invoice.`)
                        ])
            ]
        }
    ];
}

function supportSessionTemplateSections(values = {}, { clientName = '', projectName = '', summary = '' } = {}) {
    const text = value => ({ type: 'text', segments: [{ type: 'text', text: value }] });
    const btn = value => ({ type: 'linkbtn', segments: [{ type: 'text', text: value }] });
    const hours = values.hours ?? '1';
    const date = values.date || localDate();
    const desc = values.description || summary || 'Delivered support session.';
    const clientStr = clientName || 'Client';
    const projectStr = projectName || 'General retainer / maintenance';

    return [
        {
            title: 'Session Log & Delivered Work',
            lines: [
                btn('+ Log time'),
                text(`- **Date & Duration:** ${date} (${hours} h)`),
                text(`- **Client & Project:** ${clientStr} / ${projectStr}`),
                text(`- **Summary:** ${desc}`)
            ]
        },
        {
            title: 'Client Follow-Up',
            lines: [
                btn('+ Add follow-up task'),
                { type: 'task', segments: [{ type: 'text', text: 'Send session summary or updates to client' }] },
                text('*(Mark complete once communicated. Hours automatically contribute to monthly care plan retainers.)*')
            ]
        }
    ];
}

export class Plugin extends AppPlugin {
    onUnload() {
        clearTimeout(this.refreshTimer);
        clearTimeout(this.workflowSearchTimer);
        clearInterval(this.workflowDayTimer);
        if (this.workflowEventHandlers?.length && typeof this.events?.off === 'function') {
            for (const handlerId of this.workflowEventHandlers) this.events.off(handlerId);
        }
        this.workflowEventHandlers = [];
        this.workflowRefreshPending = false;
        if (typeof document !== 'undefined') {
            if (this.docActionHandler) {
                document.removeEventListener('click', this.docActionHandler, true);
                delete this.docActionHandler;
            }
            document.querySelectorAll('.os-client-header-actions').forEach(el => el.remove());
        }
        if (typeof window !== 'undefined' && window.__freelanceOs === this) delete window.__freelanceOs;
    }

    onLoad() {
        if (typeof window !== 'undefined') {
            window.__freelanceOs = this;
        }
        if (typeof document !== 'undefined') {
            if (this.docActionHandler) {
                document.removeEventListener('click', this.docActionHandler, true);
            }
            this.docActionHandler = async (e) => {
                const linkbtn = e.target.closest?.('.listitem-linkbtn, [data-doc-action]');
                if (!linkbtn) return;
                if (linkbtn.closest?.('.os-modal, .os-dialog, .os-freelance-app, .os-panel-actions')) return;
                const text = (linkbtn.innerText || linkbtn.textContent || '').trim();
                const panelEl = linkbtn.closest('.panel');
                const targetPanel = this.ui.getPanels?.().find(pan => pan.getElement?.().closest('.panel') === panelEl) || this.ui.getActivePanel?.();
                const listview = linkbtn.closest('.listview-items');
                const pageGuid = listview?.getAttribute('data-guid') || targetPanel?.getActiveRecord?.()?.guid;

                const { isClient, isProject, isInvoice, isSupportSession, clientGuid, projectGuid, invoiceGuid, supportSessionGuid } = await this.resolveRecordContext(targetPanel, pageGuid);

                if (text.includes('Create project') || text.includes('+ Project')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateProjectModal(targetPanel, data, clientGuid);
                } else if (text.includes('Create invoice') || text.includes('+ Invoice')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateInvoiceModal(targetPanel, data, clientGuid, projectGuid);
                } else if (text.includes('Log time') || text.includes('support time') || text.includes('+ Time')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateSupportSessionModal(targetPanel, data, clientGuid, projectGuid);
                } else if (text.includes('Add task') || text.includes('+ Task')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showAddTaskModal(targetPanel, data, projectGuid);
                } else if (text.includes('Add review checkpoint') || text.includes('+ Checkpoint') || text.includes('review checkpoint')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.addReviewCheckpointForActiveProject(projectGuid, targetPanel);
                } else if (text.includes('Record payment') || text.includes('+ Record payment')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = await this.loadData();
                    const inv = data.invoices.find(i => i.guid === (invoiceGuid || pageGuid));
                    if (inv) {
                        this.showBillingStateModal(inv, 'paid', targetPanel);
                    } else {
                        this.ui.addToaster({ title: 'Invoice record not found', dismissible: true });
                    }
                } else if (text.includes('Mark sent') || text.includes('+ Mark sent')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = await this.loadData();
                    const inv = data.invoices.find(i => i.guid === (invoiceGuid || pageGuid));
                    if (inv) {
                        this.showBillingStateModal(inv, 'sent', targetPanel);
                    } else {
                        this.ui.addToaster({ title: 'Invoice record not found', dismissible: true });
                    }
                } else if (text.includes('Copy payment') || text.includes('copy payment') || text.includes('QR-bill')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const data = await this.loadData();
                    const inv = data.invoices.find(i => i.guid === (invoiceGuid || pageGuid)) || {
                        guid: invoiceGuid || pageGuid,
                        invoiceId: 'Invoice',
                        amount: 0,
                        currency: this.getBaseCurrency?.() || 'CHF'
                    };
                    await this.copyInvoiceDetails(inv);
                } else if (text.includes('Add deliverable') || text.includes('+ Deliverable')) {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.addDeliverableForActiveInvoice(invoiceGuid || pageGuid, targetPanel);
                } else if (text.includes('Add follow-up task') || text.includes('+ Follow-up') || text.includes('follow-up task') || text.includes('Follow-up task')) {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.addFollowUpTaskForActiveSession(supportSessionGuid || pageGuid, targetPanel);
                }
            };
            document.addEventListener('click', this.docActionHandler, true);
        }
        this.activePanel = null;
        clearInterval(this.workflowDayTimer);
        clearTimeout(this.refreshTimer);
        if (this.workflowEventHandlers?.length && typeof this.events?.off === 'function') {
            for (const handlerId of this.workflowEventHandlers) this.events.off(handlerId);
        }
        this.refreshTimer = null;
        this.workflowRefreshPending = false;
        this.workflowEventHandlers = [];
        this.workflowMutationVersion = 0;
        this.weeklyReviewDiscovery = null;
        this.reviewDiscovery = null;
        this.selectedReviewHeadingGuid = '';
        this.selectedReviewWeek = '';
        this.currentTab = 'projects';
        this.projectFilter = 'all'; // 'all', 'in_progress', 'backlog', 'completed'
        this.clientProjectGuid = '';
        this.clientFilter = 'all';
        this.invoiceFilter = 'all';
        this.billingTab = 'invoices'; this.billingSearch = ''; this.billingMessage = '';
        this.searchQuery = '';
        this.agendaTab = null;
        this.agendaTabSetByUser = false;
        this.agendaLimit = 25;
        this.actionPreset = 'any';
        this.expandedProjects = new Set();
        this.captureDraft = '';
        this.captureProjectGuid = '';
        this.captureDestinationSource = 'default';
        this.captureContext = null;
        this.captureImportant = false;
        this.waitingEditorDrafts = {};
        this.dismissedProjectSuggestions = new Set();
        this.loadWorkflowState();
        this.workflowMode = 'overview';
        this.workflowDay = localDate();
        this.workflowDayTimer = setInterval(() => {
            if (this.workflowDay !== localDate()) { this.workflowDay = localDate(); this.scheduleRefresh(); }
        }, 60000);

        // 1. Inject Styles
        if (typeof STYLES !== 'undefined') {
            this.ui.injectCSS(STYLES);
        }

        // 2. Register Custom Panel
        this.ui.registerCustomPanelType(DASHBOARD_PANEL_ID, (panel) => {
            this.activePanel = panel;
            panel.setTitle('Freelance OS');
            this.render(panel);
        });

        // 3. Add Sidebar Navigation Item
        this.ui.addSidebarItem({
            label: 'Freelance OS',
            icon: 'layout-grid',
            tooltip: 'Open Freelance OS Dashboard',
            onClick: () => this.openDashboard()
        });

        // 4. Add Command Palette Command
        this.ui.addCommandPaletteCommand({
            label: 'Open Freelance OS Dashboard',
            icon: 'layout-grid',
            onSelected: () => this.openDashboard()
        });
        this.ui.addCommandPaletteCommand({
            label: 'Create Freelance OS project for active client',
            icon: 'ti-folder-plus',
            onSelected: () => this.createProjectForActiveClient()
        });
        this.ui.addCommandPaletteCommand({
            label: 'Create Freelance OS invoice for active client / project',
            icon: 'ti-receipt',
            onSelected: () => this.createInvoiceForActiveRecord()
        });
        this.ui.addCommandPaletteCommand({
            label: 'Log Freelance OS support time for active client / project',
            icon: 'ti-clock',
            onSelected: () => this.logSupportSessionForActiveRecord()
        });
        this.ui.addCommandPaletteCommand({
            label: 'Capture Freelance OS task for this project',
            icon: 'ti-checklist',
            onSelected: () => this.captureTaskForActiveProject()
        });
        this.ui.addCommandPaletteCommand({
            label: 'Apply Freelance OS project template',
            icon: 'ti-template',
            onSelected: () => this.applyProjectTemplateToActiveRecord()
        });
        this.ui.addCommandPaletteCommand({
            label: 'Apply Freelance OS client template',
            icon: 'ti-template',
            onSelected: () => this.applyClientTemplateToActiveRecord()
        });
        this.ui.addCommandPaletteCommand({
            label: 'Apply Freelance OS invoice template',
            icon: 'ti-template',
            onSelected: () => this.applyInvoiceTemplateToActiveRecord()
        });
        this.ui.addCommandPaletteCommand({
            label: 'Freelance OS: Check for updates',
            icon: 'ti-refresh',
            onSelected: () => this.checkForUpdates({ manual: true })
        });
        this.ui.addCommandPaletteCommand({
            label: 'Freelance OS: Toggle automatic updates',
            icon: 'ti-settings',
            onSelected: () => {
                const current = this.getUpdateConfig().autoUpdate;
                this.setAutoUpdate(!current);
                if (this.ui?.addToaster) {
                    this.ui.addToaster({
                        title: 'Auto-Update ' + (!current ? 'Enabled' : 'Disabled'),
                        message: !current ? 'Freelance OS will now automatically update when new releases are published.' : 'Automatic updates disabled. You will be prompted when updates are available.',
                        autoDestroyTime: 4000,
                        dismissible: true
                    });
                }
            }
        });

        // Background update check (non-blocking, deferred by 5s)
        setTimeout(() => {
            this.checkForUpdates?.({ manual: false });
        }, 5000);

        // 5. Reactive Workspace Listeners
        if (this.events) {
            const schedule = () => this.scheduleRefresh();
            const updateActions = () => this.updatePanelHeaderActions();
            const subscriptions = [
                ['lineitem.updated', schedule],
                ['lineitem.created', schedule],
                ['lineitem.deleted', schedule],
                ['lineitem.moved', schedule],
                ['lineitem.undeleted', schedule],
                ['record.updated', schedule],
                ['record.created', schedule],
                ['record.moved', schedule],
                ['collection.updated', schedule],
                ['panel.navigated', updateActions],
                ['panel.focused', updateActions],
                ['panel.closed', updateActions]
            ];
            this.workflowEventHandlers = subscriptions.map(([event, handler]) => this.events.on(event, handler)).filter(id => typeof id === 'string' && id);
        }
        // Desktop hot reload can retain a custom panel without invoking its new registration callback.
        const existing = this.ui.getPanels?.().find(panel => panel.getNavigation()?.type === 'custom' && String(panel.getNavigation().subId || '').endsWith(`${this.getGuid()}-${DASHBOARD_PANEL_ID}`));
        if (existing) { this.activePanel = existing; existing.setTitle('Freelance OS'); this.render(existing); }
        this.updatePanelHeaderActions();
    }

    async openDashboard() {
        let panel = this.ui.getActivePanel ? this.ui.getActivePanel() : null;
        if (!panel) {
            panel = await this.ui.createPanel();
        }
        if (panel) {
            panel.navigateToCustomType(DASHBOARD_PANEL_ID);
        }
    }

    scheduleRefresh() {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
            // Preserve focus and selection while composing. Blur flushes the deferred refresh.
            if (document.activeElement?.closest('.os-capture, .os-review-form, .os-action-editor, .os-settings-fields, .os-client-form, .os-client-status, .os-billing-dialog')) {
                this.workflowRefreshPending = true;
                return;
            }
            this.workflowRefreshPending = false;
            if (this.activePanel) this.render(this.activePanel);
            this.updatePanelHeaderActions();
        }, 200);
    }

    flushRefresh() {
        if (!this.workflowRefreshPending) return;
        if (document.activeElement?.closest('.os-capture, .os-review-form, .os-action-editor, .os-settings-fields, .os-client-form, .os-client-status, .os-billing-dialog')) return;
        this.workflowRefreshPending = false;
        this.scheduleRefresh();
    }

    async openRecord(guid, sourcePanel) {
        const wsGuid = this.getWorkspaceGuid();
        try {
            // Attempt side-by-side panel creation first
            if (this.ui && typeof this.ui.createPanel === 'function') {
                const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
                if (sidePanel) {
                    sidePanel.navigateTo({
                        type: 'edit_panel',
                        rootId: guid,
                        subId: null,
                        workspaceGuid: wsGuid
                    });
                    return;
                }
            }
        } catch (e) {
            console.warn('[FreelanceOS] Side panel failed, falling back:', e);
        }

        // Fallback: navigate current panel
        if (sourcePanel) {
            sourcePanel.navigateTo({
                type: 'edit_panel',
                rootId: guid,
                subId: null,
                workspaceGuid: wsGuid
            });
        }
    }

    async openCollection(guid, sourcePanel, viewKey = 'all') {
        if (!guid) { this.workflowMode = 'settings'; await this.render(sourcePanel); return; }
        const wsGuid = this.getWorkspaceGuid();
        const config = this.data.getPluginByGuid?.(guid)?.getConfiguration?.();
        const role = COLLECTION_ROLES.find(name => this.collectionGuid(name) === guid);
        const subId = collectionViewId(guid, config, viewKey, role);
        try {
            if (this.ui && typeof this.ui.createPanel === 'function') {
                const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
                if (sidePanel) {
                    sidePanel.navigateTo({
                        type: 'overview',
                        rootId: guid,
                        subId,
                        workspaceGuid: wsGuid
                    });
                    return;
                }
            }
        } catch (e) {
            console.warn('[FreelanceOS] Side panel collection failed, falling back:', e);
        }

        if (sourcePanel) {
            sourcePanel.navigateTo({
                type: 'overview',
                rootId: guid,
                subId,
                workspaceGuid: wsGuid
            });
        }
    }

    async openJournal(sourcePanel) {
        const wsGuid = this.getWorkspaceGuid();
        let journal = null;
        let user = null;
        try {
            const collections = await this.data.getAllCollections();
            journal = collections.find(collection => collection.getGuid() === this.collectionGuid('Journal', collections));
            user = this.resolveJournalOwner(journal, collections);
        } catch (error) {
            this.ui?.addToaster?.({ title: error.message, autoDestroyTime: 5000, dismissible: true });
        }
        const openCollection = panel => panel.navigateTo({
            type: 'overview',
            rootId: journal?.getGuid?.() || this.collectionGuid('Journal'),
            subId: null,
            workspaceGuid: wsGuid
        });
        try {
            if (this.ui && typeof this.ui.createPanel === 'function') {
                const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
                if (sidePanel) {
                    if (user && typeof sidePanel.navigateToJournal === 'function') {
                        const ok = sidePanel.navigateToJournal(user);
                        if (ok) return;
                    }
                    openCollection(sidePanel);
                    return;
                }
            }
        } catch (e) {
            console.warn('[FreelanceOS] Side panel journal failed:', e);
        }

        if (sourcePanel) {
            if (user && typeof sourcePanel.navigateToJournal === 'function') {
                const ok = sourcePanel.navigateToJournal(user);
                if (ok) return;
            }
            openCollection(sourcePanel);
        }
    }

    async openItem(itemGuid, fallbackRecordGuid, sourcePanel) {
        const wsGuid = this.getWorkspaceGuid();
        const navigate = async target => {
            if (itemGuid) {
                try {
                    if (await target.navigateTo({ itemGuid, highlight: true, workspaceGuid: wsGuid }) === true) return;
                } catch {}
            }
            if (fallbackRecordGuid) target.navigateTo({ type: 'edit_panel', rootId: fallbackRecordGuid, subId: null, workspaceGuid: wsGuid });
        };
        try {
            if (this.ui && typeof this.ui.createPanel === 'function') {
                const sidePanel = await this.ui.createPanel({ afterPanel: sourcePanel });
                if (sidePanel) {
                    await navigate(sidePanel);
                    return;
                }
            }
        } catch (e) {}

        if (sourcePanel) {
            await navigate(sourcePanel);
        }
    }

    showProjectSuggestions(task, item, panel) {
        const existing = item.parentElement?.querySelector(`[data-suggestions="${task.guid}"]`);
        const trigger = item.querySelector('.os-suggest-project');
        if (existing) {
            existing.remove();
            trigger?.setAttribute('aria-expanded', 'false');
            return;
        }
        const suggestion = document.createElement('div');
        suggestion.className = 'os-project-suggestions';
        suggestion.dataset.suggestions = task.guid;
        const evidence = task.clientEvidence === 'client-page'
            ? `This task is on ${task.clientName}’s page.`
            : `This task references ${task.clientName}.`;
        const head = document.createElement('div'); head.className = 'os-project-suggestions-head';
        head.innerHTML = `<strong>Link this task to a project</strong><span class="os-action-meta">${escapeHtml(evidence)}</span>`;
        suggestion.appendChild(head);
        const list = document.createElement('div'); list.className = 'os-project-suggestion-list';
        for (const candidate of task.projectCandidates) {
            const row = document.createElement('div'); row.className = 'os-project-suggestion';
            const copy = document.createElement('div'); copy.className = 'os-project-suggestion-copy';
            const name = document.createElement('span'); name.className = 'os-project-suggestion-name'; name.textContent = candidate.name;
            const meta = document.createElement('span'); meta.className = 'os-action-meta';
            meta.textContent = `${projectStatusLabel(candidate.status)} · ${task.clientEvidence === 'client-page' ? 'on this client’s page' : 'linked to the client referenced in this task'}`;
            copy.append(name, meta);
            const open = document.createElement('button'); open.type = 'button'; open.className = 'os-button'; open.textContent = 'Open project';
            open.onclick = event => { event.stopPropagation(); this.openRecord(candidate.guid, panel); };
            const link = document.createElement('button'); link.type = 'button'; link.className = 'os-button os-link-suggested-project'; link.textContent = 'Link project';
            link.onclick = async event => {
                event.stopPropagation();
                link.disabled = true;
                try {
                    const linked = await this.linkTaskToSuggestedProject(task, candidate.guid);
                    suggestion.remove();
                    this.ui.addToaster({ title: `Linked to ${linked.name}`, autoDestroyTime: 3000, dismissible: true });
                    this.scheduleRefresh();
                } catch (error) {
                    link.disabled = false;
                    this.ui.addToaster({ title: error.message || 'Project link could not be saved.', dismissible: true });
                    if (error.code === 'ambiguous' || error.code === 'unresolved') this.openItem(task.guid, task.recordGuid, panel);
                    if (error.code === 'already-linked') this.scheduleRefresh();
                }
            };
            row.append(copy, open, link);
            list.appendChild(row);
        }
        suggestion.appendChild(list);
        const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'os-button os-dismiss-project-suggestions'; dismiss.textContent = 'Not now';
        dismiss.onclick = event => {
            event.stopPropagation();
            this.dismissedProjectSuggestions.add(task.guid);
            suggestion.remove();
            trigger?.remove();
        };
        suggestion.appendChild(dismiss);
        trigger?.setAttribute('aria-expanded', 'true');
        item.after(suggestion);
    }

    async linkTaskToSuggestedProject(task, projectGuid) {
        const collections = await this.data.getAllCollections();
        const projects = collections.find(collection => collection.getGuid() === this.collectionGuid('Projects', collections));
        const clients = collections.find(collection => collection.getGuid() === this.collectionGuid('Clients', collections));
        if (!projects || !clients) throw new Error('Choose your Projects and Clients collections in Settings.');
        const projectRecords = await projects.getAllRecords();
        const clientRecords = await clients.getAllRecords();
        const clientByGuid = new Map(clientRecords.map(record => [record.guid, record]));
        const projectIndex = new Map(projectRecords.map(record => [record.guid, { guid: record.guid, name: record.getName?.() || '', parentGuid: getParentGuid(record), status: String(getProp(record, 'status') || '').toLowerCase() }]));
        const sourceRecord = this.data.getRecord?.(task.recordGuid);
        if (!sourceRecord) throw new Error('The task source page is no longer available.');
        const lines = await sourceRecord.getLineItems(false);
        const line = lines.find(item => item.guid === task.guid);
        if (!line) throw new Error('That task is no longer available.');
        const ownership = resolveTaskProject(line, sourceRecord, projectIndex);
        if (ownership.kind === 'owned' || ownership.kind === 'referenced') {
            const linkedProject = projectIndex.get(ownership.projectGuid);
            const error = new Error(`This task is already linked to ${linkedProject?.name || 'a project'}. No project reference was added.`);
            error.code = 'already-linked';
            throw error;
        }
        if (ownership.kind === 'ambiguous') {
            const error = new Error('This task references several projects. Open the task and keep one project reference.');
            error.code = 'ambiguous';
            throw error;
        }
        if (ownership.kind === 'unresolved' || ownership.kind === 'excluded') {
            const error = new Error('This task’s project context is unresolved. Open the task to correct it.');
            error.code = 'unresolved';
            throw error;
        }
        const sourceClientGuid = clientByGuid.has(sourceRecord.guid) ? sourceRecord.guid : '';
        const clientRefs = new Set();
        if (!sourceClientGuid) for (const segment of line.segments || []) {
            if (segment.type !== 'ref') continue;
            const guid = typeof segment.text === 'object' ? segment.text?.guid : segment.text;
            if (guid && clientByGuid.has(guid)) clientRefs.add(guid);
        }
        if (clientRefs.size > 1) {
            const error = new Error('This task references several clients. Open the task and keep one client reference.');
            error.code = 'ambiguous';
            throw error;
        }
        const clientGuid = sourceClientGuid || [...clientRefs][0] || '';
        if (!clientGuid) throw new Error('This task no longer references a client, so there are no project suggestions.');
        const projectRecord = projectRecords.find(record => record.guid === projectGuid);
        if (!projectRecord || isTemplateRecord(projectRecord)) throw new Error('That project is no longer available.');
        const status = String(getProp(projectRecord, 'status') || '').toLowerCase();
        if (!isActiveProject({ status })) throw new Error('That project is no longer active.');
        if (getClientGuid(projectRecord) !== clientGuid) throw new Error('That project no longer belongs to this client.');
        const title = projectRecord.getName?.() || '';
        const segments = [...(line.segments || []), { type: 'ref', text: { guid: projectGuid, title } }];
        if (await line.setSegments(segments) === false) throw new Error('The project reference could not be saved.');
        return { guid: projectGuid, name: title };
    }

    async loadData() {
        const data = {
            mrr: 0,
            activeCarePlans: 0,
            activeClientsCount: 0,
            prospectsCount: 0,
            projects: [],
            clients: [],
            invoices: [],
            agendaTasks: [],
            taskCoverage: { complete: true, failed: false, truncated: false, loaded: 0 },
            supportTime: null
        };

        try {
            const collections = await this.data.getAllCollections();
            this.workflowCollections = collections;
            data.missingCollections = ['Clients', 'Invoices', 'Projects'].filter(role => !this.collectionGuid(role, collections));
            if (data.missingCollections.length) { data.loadError = true; return data; }
            const readCollection = async (guid) => {
                const collection = collections.find(c => c.getGuid() === guid);
                if (!collection) throw new Error('Required collection unavailable');
                return collection.getAllRecords();
            };
            // 1. Fetch Clients
            const clientRecords = await readCollection(this.collectionGuid('Clients'));
            const baseCurrency = typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (this.workflowState?.baseCurrency || 'CHF');
            data.baseCurrency = baseCurrency;
            let mrrSum = 0;
            let activeC = 0;
            let prospects = 0;
            let carePlans = 0;

            const clientMap = new Map();
            const clientList = [];

            for (const cr of clientRecords) {
                if (isTemplateRecord(cr)) continue;
                const name = (cr.getName ? cr.getName() : cr.name) || 'Untitled Client';
                const status = (getProp(cr, 'status') || 'active').toLowerCase();
                const mrrVal = Number(getProp(cr, 'monthly_chf')) || 0;

                if (cr.guid) clientMap.set(cr.guid, name);

                if (mrrVal > 0 && isRevenueClient({ status })) {
                    mrrSum += mrrVal;
                    carePlans++;
                }

                if (status === 'archived' || status === 'cancelled') {
                    // skipped
                } else if (isLeadClient({ status })) {
                    prospects++;
                } else {
                    activeC++;
                }

                clientList.push({
                    record: cr,
                    guid: cr.guid,
                    name,
                    status,
                    mrr: mrrVal,
                    plan: getProp(cr, 'plan') || (mrrVal > 0 ? `${mrrVal} ${baseCurrency}/mo` : 'Active'),
                    planValue: getProp(cr, 'plan') || '',
                    billingCycle: getProp(cr, 'billing_cycle') || '',
                    includedHours: Math.max(0, Number(getProp(cr, 'included_hours')) || 0),
                    contact: getProp(cr, 'contact') || '', email: getProp(cr, 'email') || '', phone: getProp(cr, 'phone') || '', website: getProp(cr, 'website') || '',
                    leadStage: getProp(cr, 'lead_stage') || '',
                    estimatedValue: Number(getProp(cr, 'estimated_value_chf')) || 0,
                    source: getProp(cr, 'source') || ''
                });
            }

            data.mrr = mrrSum;
            data.activeCarePlans = carePlans;
            data.activeClientsCount = activeC;
            data.prospectsCount = prospects;
            data.clients = clientList;
            data.pipelineValueCHF = clientList
                .filter(c => isLeadClient(c) && c.status !== 'archived')
                .reduce((sum, c) => sum + (c.estimatedValue || 0), 0);

            // 2. Fetch Invoices
            const invRecords = await readCollection(this.collectionGuid('Invoices'));
            data.invoiceCurrencies = collections.find(collection => collection.getGuid() === this.collectionGuid('Invoices', collections))?.getConfiguration?.()?.fields?.find(field => field.label === 'currency')?.choices?.filter(choice => choice.active !== false).map(choice => choice.label) || ['CHF', 'EUR', 'USD'];
            const invoiceList = [];
            const today = dateDay(localDate());

            for (const ir of invRecords) {
                const name = (ir.getName ? ir.getName() : ir.name) || 'Untitled Invoice';
                const rawAmount = Number(getProp(ir, 'amount_chf'));
                const amt = Number.isFinite(rawAmount) ? rawAmount : 0;
                const status = (getProp(ir, 'payment_status') || 'unpaid').toLowerCase();
                const stage = (getProp(ir, 'status') || 'unknown').toLowerCase();
                const currency = String(getProp(ir, 'currency') || baseCurrency).toUpperCase();
                const clientGuid = getClientGuid(ir);

                let client = clientMap.get(clientGuid) || getProp(ir, 'client') || '';
                if (BASE32_GUID.test(client) && clientMap.has(client)) {
                    client = clientMap.get(client);
                }

                let due = getProp(ir, 'due') || getProp(ir, 'due_date') || '';
                if (typeof due === 'object' || String(due).includes('Object')) due = '';

                const dueDay = dateDay(due);
                const isOutstanding = stage === 'sent' && status !== 'paid';
                const daysOverdue = isOutstanding && dueDay !== null ? Math.max(0, today - dueDay) : 0;

                invoiceList.push({
                    record: ir,
                    guid: ir.guid,
                    name,
                    invoiceId: getProp(ir, 'invoice_id') || name,
                    amount: amt,
                    status,
                    stage,
                    currency,
                    clientGuid,
                    projectGuid: getProjectGuid(ir),
                    projectName: '',
                    isOutstanding,
                    daysOverdue,
                    clientName: client,
                    dueDate: dueDay !== null ? due : '',
                    issuedDate: getProp(ir, 'issued') || '', paidDate: getProp(ir, 'paid_date') || ''
                });
            }

            // Oldest receivables first, keeping drafts and settled invoices below them.
            invoiceList.sort((a, b) => {
                if (a.isOutstanding !== b.isOutstanding) return a.isOutstanding ? -1 : 1;
                if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
                return b.name.localeCompare(a.name);
            });

            data.invoices = invoiceList;
            data.cashflow = summarizeInvoices(invoiceList, baseCurrency);

            // 3. Fetch Projects (Separate top-level projects from sub-pages & deliverables)
            const projRecords = await readCollection(this.collectionGuid('Projects'));
            const parentList = [];
            const subpageList = [];
            const parentMap = new Map();

            for (const pr of projRecords) {
                const name = (pr.getName ? pr.getName() : pr.name) || '';
                if (!name || name === 'New Project' || name === 'Kanban - Active Projects' || isTemplateRecord(pr)) continue;

                const parentGuid = getParentGuid(pr);
                const status = (getProp(pr, 'status') || 'unknown').toLowerCase();
                const priority = (getProp(pr, 'priority') || 'medium').toLowerCase();
                
                const linkedClient = getClientGuid(pr);
                const clientGuid = clientMap.has(linkedClient) ? linkedClient : '';
                const clientName = clientMap.get(clientGuid) || '';
                let deadline = getProp(pr, 'deadline');
                if (!deadline || typeof deadline === 'object' || String(deadline).includes('object') || String(deadline).includes('Object')) {
                    deadline = 'No deadline';
                }
                const rawBudget = Number(getProp(pr, 'budget_chf'));
                const budget = Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : 0;
                const feeType = (getProp(pr, 'fee_type') || '').toLowerCase();

                const item = {
                    record: pr,
                    guid: pr.guid,
                    name,
                    status,
                    priority,
                    clientGuid,
                    clientName,
                    parentGuid,
                    deadline: deadline || 'No deadline',
                    budget,
                    feeType,
                    totalBilledCHF: 0,
                    totalPaidCHF: 0,
                    invoiceCount: 0,
                    deliverables: []
                };

                if (parentGuid) {
                    subpageList.push(item);
                } else {
                    parentList.push(item);
                    parentMap.set(pr.guid, item);
                }
            }

            // Nest deliverables under their respective parent projects
            for (const sub of subpageList) {
                if (parentMap.has(sub.parentGuid)) {
                    parentMap.get(sub.parentGuid).deliverables.push(sub);
                }
            }

            // Sort deliverables inside each project alphabetically
            for (const p of parentList) {
                p.deliverables.sort((a, b) => a.name.localeCompare(b.name));
            }

            // Cross-reference invoices with projects and calculate project financials:
            for (const inv of invoiceList) {
                if (inv.projectGuid && parentMap.has(inv.projectGuid)) {
                    inv.projectName = parentMap.get(inv.projectGuid).name;
                }
            }
            for (const p of parentList) {
                const projectInvoices = invoiceList.filter(i => i.projectGuid === p.guid);
                p.invoiceCount = projectInvoices.length;
                p.totalBilledCHF = projectInvoices
                    .filter(i => (i.currency || baseCurrency).toUpperCase() === baseCurrency.toUpperCase() && (i.stage === 'sent' || i.status === 'paid'))
                    .reduce((sum, i) => sum + i.amount, 0);
                p.totalPaidCHF = projectInvoices
                    .filter(i => (i.currency || baseCurrency).toUpperCase() === baseCurrency.toUpperCase() && i.status === 'paid')
                    .reduce((sum, i) => sum + i.amount, 0);
            }

            // Cross-reference clients with projects and invoices:
            for (const c of clientList) {
                c.projectCount = parentList.filter(p => p.clientGuid === c.guid).length;
                c.invoiceCount = invoiceList.filter(i => i.clientGuid === c.guid).length;
                c.summary = clientSummary(c, parentList, invoiceList, baseCurrency);
            }

            // Sort: in_progress first, high priority first
            parentList.sort((a, b) => {
                if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
                if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
                if (a.priority === 'high' && b.priority !== 'high') return -1;
                if (b.priority === 'high' && a.priority !== 'high') return 1;
                return a.name.localeCompare(b.name);
            });

            data.projects = parentList;
            const projectIndex = new Map(projRecords.map(record => [record.guid, { guid: record.guid, name: record.getName?.() || '', parentGuid: getParentGuid(record), status: String(getProp(record, 'status') || '').toLowerCase() }]));
            const clientByGuid = new Map(clientList.map(client => [client.guid, client]));

            const supportGuid = this.collectionGuid('Support Sessions', collections);
            if (supportGuid) {
                try {
                    const sessions = await readCollection(supportGuid);
                    data.supportTime = summarizeSupportTime(clientList, sessions);
                } catch (error) {
                    console.warn('[FreelanceOS] Support sessions could not be loaded:', error);
                }
            }

            // 4. Fetch Tasks
            let taskLines = [];
            try {
                const taskRes = await this.data.searchByQuery('@task @todo', 150);
                if (taskRes?.error) throw new Error(taskRes.error);
                if (!taskRes || !Array.isArray(taskRes.lines)) throw new Error('Task search returned an invalid result');
                taskLines = taskRes.lines;
                if (taskLines.length >= 150) {
                    data.taskCoverage.truncated = true;
                    data.taskCoverage.complete = false;
                }
            } catch (error) {
                data.taskCoverage.failed = true;
                data.taskCoverage.complete = false;
                console.warn('[FreelanceOS] Task search failed:', error);
            }
            const taskList = [];
            const now = new Date();
            const todayIso = localDate(now);
            const nextDate = new Date(now);
            nextDate.setDate(nextDate.getDate() + 7);
            const nextWeek = localDate(nextDate);

            for (const line of taskLines) {
                const rec = (typeof line.getRecord === 'function' ? line.getRecord() : line.record) || null;
                // Reusable checklists are intentionally made of native tasks so they
                // become actionable when copied into a real client or project page.
                // Keep their source templates out of the live task inbox.
                if (isTemplateRecord(rec)) continue;
                const text = extractLineText(line);
                if (!text) continue;
                const status = typeof line.getTaskStatus === 'function' ? line.getTaskStatus() : 'none';
                if (status === null || status === undefined) continue;

                const dt = validDateValue(extractLineDate(line));
                let category = 'inbox'; // default for undated tasks
                if (dt) {
                    if (dt < todayIso) category = 'overdue';
                    else if (dt === todayIso) category = 'today';
                    else if (dt <= nextWeek) category = 'upcoming';
                    else category = 'later';
                }

                const recordGuid = rec ? (rec.guid || (rec.getGuid ? rec.getGuid() : null)) : null;
                const ownership = resolveTaskProject(line, rec, projectIndex);
                const sourceClientGuid = rec && clientByGuid.has(rec.guid) ? rec.guid : '';
                const clientRefs = new Set();
                if (!sourceClientGuid) for (const segment of line.segments || []) {
                    if (segment.type !== 'ref') continue;
                    const guid = typeof segment.text === 'object' ? segment.text?.guid : segment.text;
                    if (guid && clientByGuid.has(guid)) clientRefs.add(guid);
                }
                const clientGuid = sourceClientGuid || (clientRefs.size === 1 ? [...clientRefs][0] : '');
                const clientAmbiguous = !sourceClientGuid && clientRefs.size > 1;
                const projectCandidates = ownership.kind === 'none' && clientGuid && !clientAmbiguous
                    ? parentList.filter(project => project.clientGuid === clientGuid && isActiveProject(project)).map(project => ({ guid: project.guid, name: project.name, status: project.status, clientGuid: project.clientGuid }))
                    : [];

                taskList.push({
                    guid: line.guid,
                    lineItem: line,
                    text,
                    date: dt,
                    category,
                    status,
                    waiting: isWaitingTask(status),
                    important: status === 'important',
                    recordGuid,
                    ownershipKind: ownership.kind,
                    projectGuid: ownership.projectGuid || '',
                    projectName: ownership.projectGuid ? (projectIndex.get(ownership.projectGuid)?.name || '') : '',
                    clientGuid,
                    clientName: clientGuid ? (clientByGuid.get(clientGuid)?.name || '') : '',
                    clientAmbiguous,
                    clientEvidence: sourceClientGuid ? 'client-page' : clientGuid ? 'client-reference' : '',
                    projectCandidates
                });
            }

            data.agendaTasks = taskList;
            data.taskCoverage.loaded = taskList.length;

        } catch (e) {
            data.loadError = true;
            console.warn('[FreelanceOS] data query error:', e);
        }

        return data;
    }

    async captureTask(text, projectGuid, important) {
        let record;
        const collections = await this.data.getAllCollections();
        if (projectGuid) {
            const projects = collections.find(collection => collection.getGuid() === this.collectionGuid('Projects', collections));
            if (!projects) throw new Error('Choose your Projects collection in Settings.');
            const destination = (await projects.getAllRecords()).find(item => item.guid === projectGuid);
            if (!destination || isTemplateRecord(destination)) throw new Error('That project is no longer available as a capture destination.');
            const status = String(getProp(destination, 'status') || '').toLowerCase();
            if (['completed', 'archived', 'cancelled', 'canceled'].includes(status)) throw new Error('That project is closed. Choose another destination.');
            record = destination;
        } else {
            const journal = collections.find(c => c.getGuid() === this.collectionGuid('Journal', collections));
            const user = journal ? this.resolveJournalOwner(journal, collections) : null;
            if (journal && user) record = await journal.getJournalRecord(user);
            if (!journal) throw new Error('Choose your Journal collection in Settings, or select a project.');
        }
        if (!record) throw new Error('Capture destination unavailable');
        let heading = null;
        let lastChild = null;
        if (projectGuid && typeof record.getLineItems === 'function') {
            try {
                const lines = await record.getLineItems(false);
                heading = lines.find(l => l.type === 'heading' && (extractLineText(l).includes('Next actions') || extractLineText(l).includes('Tasks')));
                lastChild = heading ? lines.filter(l => l.parent_guid === heading.guid).at(-1) : null;
            } catch {}
        }
        const line = await record.createLineItem(heading || null, lastChild || null, 'task');
        if (!line) throw new Error('Task creation failed');
        try {
            if (await line.setSegments([{ type: 'text', text }]) === false) throw new Error('Task content was not saved');
        } catch (error) {
            try { await line.delete?.(); } catch { /* keep the original failure */ }
            throw error;
        }
        let prioritySaved = true;
        if (important) {
            try { prioritySaved = await line.setTaskStatus('important') !== false; }
            catch { prioritySaved = false; }
        }
        return { prioritySaved };
    }

    async initializeProject(record, options = {}) {
        const lines = await record.getLineItems(false);
        const hasTemplate = lines.some(line => line.props?.freelance_os_template === 'project-v1');
        const checkpoint = projectTemplateSections().find(section => section.title === 'Client review checkpoints');
        if (hasTemplate) {
            if (lines.some(line => line.type === 'heading' && extractLineText(line) === checkpoint.title)) return { applied: false, reason: 'already-applied' };
            const created = [];
            try {
                const previous = lines.filter(line => line.parent_guid === record.guid).at(-1) || null;
                const heading = await record.createLineItem(null, previous, 'heading', [{ type: 'text', text: checkpoint.title }], { hsize: 2, freelance_os_template: 'project-v1' });
                if (!heading) throw new Error('The client review checkpoint section could not be saved');
                created.push(heading);
                let priorLine = null;
                for (const item of checkpoint.lines) {
                    const line = await record.createLineItem(heading, priorLine, item.type, item.segments, item.props || null);
                    if (!line) throw new Error('The client review checkpoint section could not be saved');
                    created.push(line); priorLine = line;
                }
                return { applied: true, reason: 'checkpoint-added' };
            } catch (error) {
                for (const line of created.reverse()) await line.delete();
                throw error;
            }
        }
        const content = lines.filter(line => !['document', 'br'].includes(line.type) && (extractLineText(line) || line.segments?.length || line.type !== 'text'));
        const placeholders = content.filter(line => line.type === 'text' && /^Project workspace migrated from Obsidian\.?$/i.test(extractLineText(line)));
        if (content.length !== placeholders.length) return { applied: false, reason: 'has-content' };
        const baseCurrency = options.baseCurrency || (typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (this.workflowState?.baseCurrency || 'CHF'));
        const created = [];
        try {
            let previous = null;
            for (const section of projectTemplateSections({ ...options, baseCurrency })) {
                const heading = await record.createLineItem(null, previous, 'heading', [{ type: 'text', text: section.title }], { hsize: 2, freelance_os_template: 'project-v1' });
                if (!heading) throw new Error('The project template could not be saved');
                created.push(heading); previous = heading;
                let priorLine = null;
                for (const item of section.lines) {
                    const line = await record.createLineItem(heading, priorLine, item.type, item.segments, item.props || null);
                    if (!line) throw new Error('The project template could not be saved');
                    created.push(line); priorLine = line;
                }
            }
            for (const placeholder of placeholders) if (await placeholder.delete() === false) throw new Error('The migration placeholder could not be removed');
            return { applied: true };
        } catch (error) {
            for (const line of created.reverse()) await line.delete();
            throw error;
        }
    }

    async initializeClient(record, options = {}) {
        if (typeof record?.getLineItems !== 'function' || typeof record?.createLineItem !== 'function') {
            return { applied: false, reason: 'unsupported' };
        }
        const lines = await record.getLineItems(false);
        const hasTemplate = lines.some(line => line.props?.freelance_os_template === 'client-v1');
        if (hasTemplate) return { applied: false, reason: 'already-applied' };
        const content = lines.filter(line => !['document', 'br'].includes(line.type) && (extractLineText(line) || line.segments?.length || line.type !== 'text'));
        if (content.length > 0) return { applied: false, reason: 'has-content' };
        const status = options.status || getProp(record, 'status') || '';
        const leadStage = options.leadStage || getProp(record, 'lead_stage') || '';
        const estimatedValue = options.estimatedValue ?? (Number(getProp(record, 'estimated_value_chf')) || 0);
        const isLead = options.isLead ?? isLeadClient({ status });
        const baseCurrency = options.baseCurrency || (typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (this.workflowState?.baseCurrency || 'CHF'));
        const opts = { ...options, status, leadStage, estimatedValue, isLead, baseCurrency };
        const created = [];
        try {
            let previous = null;
            for (const section of clientTemplateSections(opts)) {
                const heading = await record.createLineItem(null, previous, 'heading', [{ type: 'text', text: section.title }], { hsize: 2, freelance_os_template: 'client-v1' });
                if (!heading) throw new Error('The client template could not be saved');
                created.push(heading); previous = heading;
                let priorLine = null;
                for (const item of section.lines) {
                    const line = await record.createLineItem(heading, priorLine, item.type, item.segments, item.props || null);
                    if (!line) throw new Error('The client template could not be saved');
                    created.push(line); priorLine = line;
                }
            }
            return { applied: true };
        } catch (error) {
            for (const line of created.reverse()) await line.delete();
            throw error;
        }
    }

    async initializeInvoice(record, values = {}, options = {}) {
        if (typeof record?.getLineItems !== 'function' || typeof record?.createLineItem !== 'function') {
            return { applied: false, reason: 'unsupported' };
        }
        const lines = await record.getLineItems(false);
        const hasTemplate = lines.some(line => line.props?.freelance_os_template === 'invoice-v1');
        if (hasTemplate) return { applied: false, reason: 'already-applied' };
        const content = lines.filter(line => !['document', 'br'].includes(line.type) && (extractLineText(line) || line.segments?.length || line.type !== 'text'));
        if (content.length > 0) return { applied: false, reason: 'has-content' };

        let clientName = options.clientName || '';
        let projectName = options.projectName || '';
        try {
            const collections = this.workflowCollections || (typeof this.data?.getAllCollections === 'function' ? await this.data.getAllCollections() : null);
            if (collections) {
                if (!clientName) {
                    const clientGuid = values.client || getLinkedRecordGuid(record, 'client');
                    if (clientGuid) {
                        const clients = collections.find(c => c.getGuid() === this.collectionGuid('Clients', collections));
                        if (clients) {
                            const clientRec = (await clients.getAllRecords()).find(r => r.guid === clientGuid);
                            if (clientRec) clientName = clientRec.getName?.() || clientRec.name || '';
                        }
                    }
                }
                if (!projectName) {
                    const projectGuid = values.project || getLinkedRecordGuid(record, 'project');
                    if (projectGuid) {
                        const projects = collections.find(c => c.getGuid() === this.collectionGuid('Projects', collections));
                        if (projects) {
                            const projRec = (await projects.getAllRecords()).find(r => r.guid === projectGuid);
                            if (projRec) projectName = projRec.getName?.() || projRec.name || '';
                        }
                    }
                }
            }
        } catch { /* ignore name lookup errors */ }

        const baseCurrency = options.baseCurrency || (typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (this.workflowState?.baseCurrency || 'CHF'));
        const invoiceValues = {
            amount_chf: values.amount_chf ?? getProp(record, 'amount_chf'),
            currency: values.currency || getProp(record, 'currency') || baseCurrency,
            status: values.status || getProp(record, 'status') || 'draft',
            payment_status: values.payment_status || getProp(record, 'payment_status') || 'unpaid',
            issued: values.issued || (getProp(record, 'issued') ? String(getProp(record, 'issued')) : ''),
            due: values.due || (getProp(record, 'due') ? String(getProp(record, 'due')) : ''),
            paid_date: values.paid_date || (getProp(record, 'paid_date') ? String(getProp(record, 'paid_date')) : '')
        };

        const created = [];
        try {
            let previous = null;
            for (const section of invoiceTemplateSections(invoiceValues, { ...options, clientName, projectName, baseCurrency })) {
                const heading = await record.createLineItem(null, previous, 'heading', [{ type: 'text', text: section.title }], { hsize: 2, freelance_os_template: 'invoice-v1' });
                if (!heading) throw new Error('The invoice template could not be saved');
                created.push(heading); previous = heading;
                let priorLine = null;
                for (const item of section.lines) {
                    const line = await record.createLineItem(heading, priorLine, item.type, item.segments, item.props || null);
                    if (!line) throw new Error('The invoice template could not be saved');
                    created.push(line); priorLine = line;
                }
            }
            return { applied: true };
        } catch (error) {
            for (const line of created.reverse()) await line.delete();
            throw error;
        }
    }

    async initializeSupportSession(record, values = {}, options = {}) {
        if (typeof record?.getLineItems !== 'function' || typeof record?.createLineItem !== 'function') {
            return { applied: false, reason: 'unsupported' };
        }
        const lines = await record.getLineItems(false);
        const hasTemplate = lines.some(line => line.props?.freelance_os_template === 'support-session-v1');
        if (hasTemplate) return { applied: false, reason: 'already-applied' };
        const content = lines.filter(line => !['document', 'br'].includes(line.type) && (extractLineText(line) || line.segments?.length || line.type !== 'text'));
        if (content.length > 0) return { applied: false, reason: 'has-content' };

        let clientName = options.clientName || '';
        let projectName = options.projectName || '';
        try {
            const collections = this.workflowCollections || (typeof this.data?.getAllCollections === 'function' ? await this.data.getAllCollections() : null);
            if (collections) {
                if (!clientName) {
                    const clientGuid = values.client || getLinkedRecordGuid(record, 'client');
                    if (clientGuid) {
                        const clients = collections.find(c => c.getGuid() === this.collectionGuid('Clients', collections));
                        if (clients) {
                            const clientRec = (await clients.getAllRecords()).find(r => r.guid === clientGuid);
                            if (clientRec) clientName = clientRec.getName?.() || clientRec.name || '';
                        }
                    }
                }
                if (!projectName) {
                    const projectGuid = values.project || getLinkedRecordGuid(record, 'project');
                    if (projectGuid) {
                        const projects = collections.find(c => c.getGuid() === this.collectionGuid('Projects', collections));
                        if (projects) {
                            const projRec = (await projects.getAllRecords()).find(r => r.guid === projectGuid);
                            if (projRec) projectName = projRec.getName?.() || projRec.name || '';
                        }
                    }
                }
            }
        } catch { /* ignore name lookup errors */ }

        const sessionValues = {
            hours: values.hours ?? getProp(record, 'hours'),
            date: values.date || (getProp(record, 'date') ? String(getProp(record, 'date')) : ''),
            description: values.description || getProp(record, 'description') || ''
        };

        const created = [];
        try {
            let previous = null;
            for (const section of supportSessionTemplateSections(sessionValues, { ...options, clientName, projectName })) {
                const heading = await record.createLineItem(null, previous, 'heading', [{ type: 'text', text: section.title }], { hsize: 2, freelance_os_template: 'support-session-v1' });
                if (!heading) throw new Error('The support session template could not be saved');
                created.push(heading); previous = heading;
                let priorLine = null;
                for (const item of section.lines) {
                    const line = await record.createLineItem(heading, priorLine, item.type, item.segments, item.props || null);
                    if (!line) throw new Error('The support session template could not be saved');
                    created.push(line); priorLine = line;
                }
            }
            return { applied: true };
        } catch (error) {
            for (const line of created.reverse()) await line.delete();
            throw error;
        }
    }

    async applyClientTemplateToActiveRecord() {
        try {
            const panel = this.ui.getActivePanel();
            const record = panel?.getActiveRecord?.();
            const collections = this.workflowCollections = await this.data.getAllCollections();
            const clients = collections.find(c => c.getGuid() === this.collectionGuid('Clients', collections));
            const records = clients ? await clients.getAllRecords() : [];
            if (!record || !records.some(item => item.guid === record.guid)) throw new Error('Open a client page before applying the template');
            const result = await this.initializeClient(record);
            this.ui.addToaster({ title: result.applied ? 'Client template added' : result.reason === 'already-applied' ? 'This client already has the template' : 'This client already has content. Its notes were kept.', dismissible: true });
        } catch (error) { this.ui.addToaster({ title: error.message || 'Client template could not be added', dismissible: true }); }
    }

    async applyInvoiceTemplateToActiveRecord() {
        try {
            const panel = this.ui.getActivePanel();
            const record = panel?.getActiveRecord?.();
            const collections = this.workflowCollections = await this.data.getAllCollections();
            const invoices = collections.find(c => c.getGuid() === this.collectionGuid('Invoices', collections));
            const records = invoices ? await invoices.getAllRecords() : [];
            if (!record || !records.some(item => item.guid === record.guid)) throw new Error('Open an invoice page before applying the template');
            const result = await this.initializeInvoice(record);
            this.ui.addToaster({ title: result.applied ? 'Invoice template added' : result.reason === 'already-applied' ? 'This invoice already has the template' : 'This invoice already has content. Its notes were kept.', dismissible: true });
        } catch (error) { this.ui.addToaster({ title: error.message || 'Invoice template could not be added', dismissible: true }); }
    }

    async applyProjectTemplateToActiveRecord() {
        try {
            const panel = this.ui.getActivePanel();
            const record = panel?.getActiveRecord?.();
            const collections = this.workflowCollections = await this.data.getAllCollections();
            const projects = collections.find(c => c.getGuid() === this.collectionGuid('Projects', collections));
            const records = projects ? await projects.getAllRecords() : [];
            if (!record || !records.some(item => item.guid === record.guid)) throw new Error('Open a project page before applying the template');
            const deliverables = records.filter(item => getParentGuid(item) === record.guid);
            const result = await this.initializeProject(record, { deliverables });
            this.ui.addToaster({ title: result.applied ? result.reason === 'checkpoint-added' ? 'Client review checkpoints added' : 'Project template added' : result.reason === 'already-applied' ? 'This project already has the template' : 'This project already has content. Its notes were kept.', dismissible: true });
        } catch (error) { this.ui.addToaster({ title: error.message || 'Project template could not be added', dismissible: true }); }
    }

    async captureTaskForActiveProject() {
        const sourcePanel = this.ui.getActivePanel?.();
        const sourceNavigation = sourcePanel?.getNavigation?.();
        const sourceRecord = sourcePanel?.getActiveRecord?.();
        try {
            if (!sourcePanel || sourceNavigation?.type !== 'edit_panel' || !sourceRecord) throw new Error('Open a native project page before capturing a project task.');
            const collections = this.workflowCollections = await this.data.getAllCollections();
            const projects = collections.find(collection => collection.getGuid() === this.collectionGuid('Projects', collections));
            if (!projects) throw new Error('Choose your Projects collection in Settings.');
            const records = await projects.getAllRecords();
            const source = records.find(record => record.guid === sourceRecord.guid);
            if (!source || isTemplateRecord(source)) throw new Error('This page is not a native project in the configured Projects collection.');
            const byGuid = new Map(records.map(record => [record.guid, { record, guid: record.guid, name: record.getName?.() || '', parentGuid: getParentGuid(record), status: String(getProp(record, 'status')).toLowerCase() }]));
            const rootGuid = projectRoot(source.guid, byGuid);
            const root = rootGuid ? byGuid.get(rootGuid) : null;
            if (!root) throw new Error('This project page has an unresolved or cyclic parent. Open the root project page instead.');
            if (!isActiveProject({ status: root.status })) throw new Error('Only in-progress or in-review projects can provide capture context.');
            let clientName = '';
            const clientGuid = getClientGuid(root.record);
            if (clientGuid) {
                const clients = collections.find(collection => collection.getGuid() === this.collectionGuid('Clients', collections));
                const client = clients && (await clients.getAllRecords()).find(record => record.guid === clientGuid);
                clientName = client?.getName?.() || '';
            }
            let notice = '';
            if (this.captureDestinationSource === 'user') {
                notice = `Kept your existing destination (${this.captureProjectGuid ? 'selected project' : 'Journal inbox'}).`;
            } else {
                this.captureProjectGuid = root.guid;
                this.captureDestinationSource = 'context';
                this.captureContext = { projectGuid: root.guid, projectName: root.name, clientName };
                if (this.captureDraft.trim()) notice = `Existing draft kept; destination set to ${root.name}.`;
            }
            await this.openDashboard();
            if (typeof setTimeout === 'function') await new Promise(resolve => setTimeout(resolve, 50));
            else await Promise.resolve();
            const dashboard = this.ui.getActivePanel?.();
            if (!dashboard) throw new Error('Freelance OS could not be opened.');
            this.activePanel = dashboard;
            await this.render(dashboard);
            const element = dashboard.getElement?.();
            const input = element?.querySelector('.os-capture-input');
            input?.focus({ preventScroll: true });
            const feedback = element?.querySelector('.os-capture-feedback');
            if (feedback) feedback.textContent = notice || `Capturing for ${root.name}${clientName ? ` · ${clientName}` : ''}.`;
            this.ui.addToaster({ title: notice || `Capture destination: ${root.name}${clientName ? ` · ${clientName}` : ''}`, autoDestroyTime: 3500, dismissible: true });
        } catch (error) {
            this.ui.addToaster({ title: error.message || 'Project capture context is unavailable.', dismissible: true });
        }
    }

    async resolveRecordContext(targetPanel, explicitGuid = '') {
        let collections = this.workflowCollections;
        if (!collections && this.data?.getAllCollections) {
            try { collections = this.workflowCollections = await this.data.getAllCollections(); } catch {}
        }
        const clientsCol = collections ? collections.find(c => c.getGuid() === this.collectionGuid('Clients', collections)) : null;
        const projectsCol = collections ? collections.find(c => c.getGuid() === this.collectionGuid('Projects', collections)) : null;
        const invoicesCol = collections ? collections.find(c => c.getGuid() === this.collectionGuid('Invoices', collections)) : null;
        const supportSessionsCol = collections ? collections.find(c => c.getGuid() === this.collectionGuid('Support Sessions', collections)) : null;
        const activeRecord = targetPanel?.getActiveRecord?.();
        const guid = explicitGuid || activeRecord?.guid || '';

        let isClient = false;
        let isProject = false;
        let isInvoice = false;
        let isSupportSession = false;
        let clientGuid = '';
        let projectGuid = '';
        let invoiceGuid = '';
        let supportSessionGuid = '';

        if (guid) {
            if (clientsCol) {
                const clientRec = (await clientsCol.getAllRecords()).find(r => r.guid === guid && !isTemplateRecord(r));
                if (clientRec) {
                    isClient = true;
                    clientGuid = guid;
                }
            }
            if (!isClient && projectsCol) {
                const projectRec = (await projectsCol.getAllRecords()).find(r => r.guid === guid && !isTemplateRecord(r));
                if (projectRec) {
                    isProject = true;
                    projectGuid = guid;
                    clientGuid = getClientGuid(projectRec) || '';
                }
            }
            if (!isClient && !isProject && invoicesCol) {
                const invRec = (await invoicesCol.getAllRecords()).find(r => r.guid === guid && !isTemplateRecord(r));
                if (invRec) {
                    isInvoice = true;
                    invoiceGuid = guid;
                    clientGuid = getClientGuid(invRec) || '';
                    projectGuid = getProjectGuid(invRec) || '';
                }
            }
            if (!isClient && !isProject && !isInvoice && supportSessionsCol) {
                const ssRec = (await supportSessionsCol.getAllRecords()).find(r => r.guid === guid && !isTemplateRecord(r));
                if (ssRec) {
                    isSupportSession = true;
                    supportSessionGuid = guid;
                    clientGuid = getClientGuid(ssRec) || '';
                    projectGuid = getProjectGuid(ssRec) || '';
                }
            }
        }
        return { isClient, isProject, isInvoice, isSupportSession, clientGuid, projectGuid, invoiceGuid, supportSessionGuid };
    }

    showAddTaskModal(panel, data, defaultProjectGuid = '') {
        const modal = document.createElement('div');
        modal.className = 'os-modal-backdrop';
        const initialProject = defaultProjectGuid || '';
        const projects = (data.projects || []).filter(p => !['completed', 'archived', 'cancelled'].includes(p.status));

        modal.innerHTML = `
            <div class="os-modal-card" role="dialog" aria-modal="true" aria-labelledby="os-task-dialog-title">
                <div class="os-modal-header">
                    <h3 id="os-task-dialog-title">Add project task</h3>
                    <button class="os-modal-close" type="button" aria-label="Close task form">✕</button>
                </div>
                <div class="os-modal-body">
                    <div class="os-form-group">
                        <label for="os-task-project">Project *</label>
                        <select id="os-task-project" class="os-select input-project" required>
                            <option value="">Select project…</option>
                            ${projects.map(p => `<option value="${p.guid}" ${p.guid === initialProject ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="os-form-group">
                        <label for="os-task-description">Task description *</label>
                        <input id="os-task-description" type="text" class="os-input input-task-text" placeholder="e.g. Finish mobile responsive navigation" required />
                    </div>
                    <div class="os-form-group">
                        <label class="os-checkbox-label" style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="os-task-important" class="input-task-important" />
                            <span>Mark as high priority / important</span>
                        </label>
                    </div>
                </div>
                <div class="os-modal-footer">
                    <button class="os-button btn-cancel" type="button">Cancel</button>
                    <button class="os-button os-primary btn-submit" type="button">Add task</button>
                </div>
            </div>
        `;

        const priorFocus = document.activeElement;
        const close = () => { modal.remove(); priorFocus?.focus(); };
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
                const controls = [...modal.querySelectorAll('button:not(:disabled), input, select')];
                if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
                else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
            }
        });
        modal.querySelector('.os-modal-close').onclick = close;
        modal.querySelector('.btn-cancel').onclick = close;
        modal.addEventListener('click', event => { if (event.target === modal) close(); });

        const projectSelect = modal.querySelector('.input-project');
        const textInput = modal.querySelector('.input-task-text');
        const importantCheck = modal.querySelector('.input-task-important');
        const submitBtn = modal.querySelector('.btn-submit');

        textInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitBtn.click();
            }
        });

        submitBtn.onclick = async () => {
            const project = projectSelect.value;
            const text = textInput.value.trim();
            const important = importantCheck.checked;
            if (!project) { this.ui.addToaster({ title: 'Please select a project', dismissible: true }); return; }
            if (!text) { this.ui.addToaster({ title: 'Please enter a task description', dismissible: true }); textInput.focus(); return; }

            submitBtn.disabled = true;
            try {
                await this.captureTask(text, project, important);
                this.ui.addToaster({ title: 'Task added to project', autoDestroyTime: 2500, dismissible: true });
                close();
                this.scheduleRefresh();
            } catch (err) {
                submitBtn.disabled = false;
                this.ui.addToaster({ title: err.message || 'Task could not be saved', dismissible: true });
            }
        };

        document.body.appendChild(modal);
        if (initialProject) textInput.focus();
        else projectSelect.focus();
    }

    async addReviewCheckpointForActiveProject(projectGuid, targetPanel = null) {
        try {
            const collections = this.workflowCollections || await this.data.getAllCollections();
            const projects = collections.find(c => c.getGuid() === this.collectionGuid('Projects', collections));
            if (!projects) throw new Error('Projects collection not found.');
            const record = (await projects.getAllRecords()).find(r => r.guid === projectGuid);
            if (!record) throw new Error('Project record not found.');

            const lines = await record.getLineItems(false);
            const heading = lines.find(l => l.type === 'heading' && extractLineText(l).toLowerCase().includes('checkpoint'));
            const lastChild = heading ? lines.filter(l => l.parent_guid === heading.guid).at(-1) : null;

            const line = await record.createLineItem(heading || null, lastChild || null, 'task', [{ type: 'text', text: 'Client review checkpoint' }], { [CLIENT_REVIEW_CHECKPOINT_PROPERTY]: 'checkpoint-v1' });
            if (!line) throw new Error('Could not create checkpoint task.');
            this.ui.addToaster({ title: 'Review checkpoint added to project', autoDestroyTime: 2500, dismissible: true });
            this.scheduleRefresh();
        } catch (err) {
            this.ui.addToaster({ title: err.message || 'Could not add review checkpoint', dismissible: true });
        }
    }

    async copyInvoiceDetails(invoice) {
        const baseCurrency = typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (this.workflowState?.baseCurrency || 'CHF');
        const text = [
            `Invoice: ${invoice.invoiceId || invoice.name}`,
            invoice.clientName ? `Client: ${invoice.clientName}` : '',
            `Amount: ${invoice.amount} ${invoice.currency || baseCurrency}`,
            invoice.dueDate ? `Due: ${invoice.dueDate}` : '',
            `Status: ${invoice.status === 'paid' ? 'Paid' : invoice.stage === 'sent' ? 'Sent (Unpaid)' : 'Draft'}`,
            '',
            'Payment Details:',
            'Creditor: Vermeulen Solutions · Chemin des Vignes 12, 1299 Crans (VD)',
            'QR-IBAN: CH44 0076 2011 6238 5295 8',
            `Reference: ${invoice.invoiceId || invoice.name}`
        ].filter(Boolean).join('\n');

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
            this.ui?.addToaster?.({ title: 'Invoice & QR-bill details copied to clipboard', autoDestroyTime: 2500, dismissible: true });
        } else {
            this.ui?.addToaster?.({ title: 'Unable to copy to clipboard', dismissible: true });
        }
    }

    async addDeliverableForActiveInvoice(invoiceGuid, targetPanel = null) {
        try {
            const collections = this.workflowCollections || await this.data.getAllCollections();
            const invoices = collections.find(c => c.getGuid() === this.collectionGuid('Invoices', collections));
            if (!invoices) throw new Error('Invoices collection not found.');
            const record = (await invoices.getAllRecords()).find(r => r.guid === invoiceGuid);
            if (!record) throw new Error('Invoice record not found.');

            const lines = await record.getLineItems(false);
            const heading = lines.find(l => l.type === 'heading' && (extractLineText(l).toLowerCase().includes('summary') || extractLineText(l).toLowerCase().includes('scope') || extractLineText(l).toLowerCase().includes('deliverable')));
            const lastChild = heading ? lines.filter(l => l.parent_guid === heading.guid).at(-1) : null;

            const line = await record.createLineItem(heading || null, lastChild || null, 'task', [{ type: 'text', text: 'Deliverable item' }]);
            if (!line) throw new Error('Could not add deliverable item.');
            this.ui?.addToaster?.({ title: 'Deliverable item added to invoice', autoDestroyTime: 2500, dismissible: true });
            this.scheduleRefresh();
        } catch (err) {
            this.ui?.addToaster?.({ title: err.message || 'Could not add deliverable item', dismissible: true });
        }
    }

    async addFollowUpTaskForActiveSession(sessionGuid, targetPanel = null) {
        try {
            const collections = this.workflowCollections || await this.data.getAllCollections();
            const sessions = collections.find(c => c.getGuid() === this.collectionGuid('Support Sessions', collections));
            if (!sessions) throw new Error('Support Sessions collection not found.');
            const record = (await sessions.getAllRecords()).find(r => r.guid === sessionGuid);
            if (!record) throw new Error('Support session record not found.');

            const lines = await record.getLineItems(false);
            const heading = lines.find(l => l.type === 'heading' && (extractLineText(l).toLowerCase().includes('follow-up') || extractLineText(l).toLowerCase().includes('action')));
            const lastChild = heading ? lines.filter(l => l.parent_guid === heading.guid).at(-1) : null;

            const line = await record.createLineItem(heading || null, lastChild || null, 'task', [{ type: 'text', text: 'Client follow-up action' }]);
            if (!line) throw new Error('Could not create follow-up task.');
            this.ui?.addToaster?.({ title: 'Follow-up task added to session', autoDestroyTime: 2500, dismissible: true });
            this.scheduleRefresh();
        } catch (err) {
            this.ui?.addToaster?.({ title: err.message || 'Could not add follow-up task', dismissible: true });
        }
    }

    async updatePanelHeaderActions() {
        if (!this.ui?.getPanels || typeof document === 'undefined') return;
        const panels = this.ui.getPanels();
        let collections = this.workflowCollections;
        if (!collections && this.data?.getAllCollections) {
            try { collections = this.workflowCollections = await this.data.getAllCollections(); } catch {}
        }
        const clientsColGuid = this.collectionGuid('Clients', collections);
        const projectsColGuid = this.collectionGuid('Projects', collections);
        const invoicesColGuid = this.collectionGuid('Invoices', collections);
        const supportSessionsColGuid = this.collectionGuid('Support Sessions', collections);
        if (!clientsColGuid && !projectsColGuid && !invoicesColGuid && !supportSessionsColGuid) return;

        for (const panel of panels) {
            const panelEl = panel.getElement?.();
            if (!panelEl) continue;

            const col = panel.getActiveCollection?.();
            const rec = panel.getActiveRecord?.();
            const isClientPanel = col && col.getGuid() === clientsColGuid && rec && !isTemplateRecord(rec);
            const isProjectPanel = col && col.getGuid() === projectsColGuid && rec && !isTemplateRecord(rec);
            const isInvoicePanel = col && col.getGuid() === invoicesColGuid && rec && !isTemplateRecord(rec);
            const isSupportPanel = col && col.getGuid() === supportSessionsColGuid && rec && !isTemplateRecord(rec);

            const outerPanel = panelEl.closest?.('.panel') || panelEl;
            const menubar = outerPanel.querySelector('.panel-menubar-buttons');
            if (!menubar) continue;

            let container = menubar.querySelector('.os-client-header-actions');

            if (!isClientPanel && !isProjectPanel && !isInvoicePanel && !isSupportPanel) {
                if (container) container.remove();
                continue;
            }

            if (!container) {
                container = document.createElement('div');
                container.className = 'os-client-header-actions';
                menubar.appendChild(container);
            }

            if (container.dataset.recordGuid === rec.guid) continue;
            container.dataset.recordGuid = rec.guid;

            if (isClientPanel) {
                const clientName = rec.name || 'this client';
                container.innerHTML = `
                    <button type="button" class="os-header-action-btn os-header-btn-project" title="Create a new project for ${escapeHtml(clientName)}">
                        <span class="ti ti-folder"></span>
                        <span>+ Project</span>
                    </button>
                    <button type="button" class="os-header-action-btn os-header-btn-invoice" title="Create an invoice for ${escapeHtml(clientName)}">
                        <span class="ti ti-receipt"></span>
                        <span>+ Invoice</span>
                    </button>
                    <button type="button" class="os-header-action-btn os-header-btn-time" title="Log support time for ${escapeHtml(clientName)}">
                        <span class="ti ti-clock"></span>
                        <span>+ Time</span>
                    </button>
                `;

                container.querySelector('.os-header-btn-project').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateProjectModal(panel, data, rec.guid);
                };

                container.querySelector('.os-header-btn-invoice').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateInvoiceModal(panel, data, rec.guid, '');
                };

                container.querySelector('.os-header-btn-time').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateSupportSessionModal(panel, data, rec.guid, '');
                };
            } else if (isProjectPanel) {
                const projectName = rec.name || 'this project';
                const clientGuid = getClientGuid(rec) || '';
                container.innerHTML = `
                    <button type="button" class="os-header-action-btn os-header-btn-task" title="Add a task to ${escapeHtml(projectName)}">
                        <span class="ti ti-checkbox"></span>
                        <span>+ Task</span>
                    </button>
                    <button type="button" class="os-header-action-btn os-header-btn-invoice" title="Create an invoice for ${escapeHtml(projectName)}">
                        <span class="ti ti-receipt"></span>
                        <span>+ Invoice</span>
                    </button>
                    <button type="button" class="os-header-action-btn os-header-btn-time" title="Log time for ${escapeHtml(projectName)}">
                        <span class="ti ti-clock"></span>
                        <span>+ Time</span>
                    </button>
                `;

                container.querySelector('.os-header-btn-task').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showAddTaskModal(panel, data, rec.guid);
                };

                container.querySelector('.os-header-btn-invoice').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateInvoiceModal(panel, data, clientGuid, rec.guid);
                };

                container.querySelector('.os-header-btn-time').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateSupportSessionModal(panel, data, clientGuid, rec.guid);
                };
            } else if (isInvoicePanel) {
                const stage = (getProp(rec, 'status') || 'draft').toLowerCase();
                const paymentStatus = (getProp(rec, 'payment_status') || 'unpaid').toLowerCase();
                const isPaid = paymentStatus === 'paid';
                const isSent = stage === 'sent';
                const invoiceId = getProp(rec, 'invoice_id') || rec.name || 'Invoice';

                if (isPaid) {
                    container.innerHTML = `
                        <div class="os-header-badge-paid" title="Payment confirmed and settled">
                            <span class="ti ti-check"></span>
                            <span>Settled</span>
                        </div>
                        <button type="button" class="os-header-action-btn os-header-btn-copy" title="Copy payment details to clipboard">
                            <span class="ti ti-copy"></span>
                            <span>Copy details</span>
                        </button>
                    `;
                } else if (isSent) {
                    container.innerHTML = `
                        <button type="button" class="os-header-action-btn os-header-btn-paid" title="Record payment for ${escapeHtml(invoiceId)}">
                            <span class="ti ti-check"></span>
                            <span>+ Record payment</span>
                        </button>
                        <button type="button" class="os-header-action-btn os-header-btn-copy" title="Copy payment details to clipboard">
                            <span class="ti ti-copy"></span>
                            <span>Copy details</span>
                        </button>
                    `;
                } else {
                    container.innerHTML = `
                        <button type="button" class="os-header-action-btn os-header-btn-sent" title="Mark ${escapeHtml(invoiceId)} as sent">
                            <span class="ti ti-send"></span>
                            <span>+ Mark sent</span>
                        </button>
                        <button type="button" class="os-header-action-btn os-header-btn-paid" title="Record direct payment for ${escapeHtml(invoiceId)}">
                            <span class="ti ti-check"></span>
                            <span>+ Record payment</span>
                        </button>
                        <button type="button" class="os-header-action-btn os-header-btn-copy" title="Copy payment details to clipboard">
                            <span class="ti ti-copy"></span>
                            <span>Copy details</span>
                        </button>
                    `;
                }

                const baseCurrency = typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (this.workflowState?.baseCurrency || 'CHF');

                container.querySelector('.os-header-btn-paid')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    const inv = data.invoices.find(i => i.guid === rec.guid) || {
                        guid: rec.guid,
                        name: rec.name || invoiceId,
                        invoiceId,
                        amount: Number(getProp(rec, 'amount_chf')) || 0,
                        currency: String(getProp(rec, 'currency') || baseCurrency).toUpperCase(),
                        status: paymentStatus,
                        stage,
                        issuedDate: getProp(rec, 'issued') || '',
                        paidDate: getProp(rec, 'paid_date') || ''
                    };
                    this.showBillingStateModal(inv, 'paid', panel);
                });

                container.querySelector('.os-header-btn-sent')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    const inv = data.invoices.find(i => i.guid === rec.guid) || {
                        guid: rec.guid,
                        name: rec.name || invoiceId,
                        invoiceId,
                        amount: Number(getProp(rec, 'amount_chf')) || 0,
                        currency: String(getProp(rec, 'currency') || baseCurrency).toUpperCase(),
                        status: paymentStatus,
                        stage,
                        issuedDate: getProp(rec, 'issued') || '',
                        paidDate: getProp(rec, 'paid_date') || ''
                    };
                    this.showBillingStateModal(inv, 'sent', panel);
                });

                container.querySelector('.os-header-btn-copy')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    const inv = data.invoices.find(i => i.guid === rec.guid) || {
                        guid: rec.guid,
                        name: rec.name || invoiceId,
                        invoiceId,
                        amount: Number(getProp(rec, 'amount_chf')) || 0,
                        currency: String(getProp(rec, 'currency') || baseCurrency).toUpperCase(),
                        dueDate: getProp(rec, 'due') || '',
                        status: paymentStatus,
                        stage,
                        clientName: ''
                    };
                    await this.copyInvoiceDetails(inv);
                });
            } else if (isSupportPanel) {
                const clientGuid = getClientGuid(rec) || '';
                const projectGuid = getProjectGuid(rec) || '';
                container.innerHTML = `
                    <button type="button" class="os-header-action-btn os-header-btn-time" title="Log support time">
                        <span class="ti ti-clock"></span>
                        <span>+ Time</span>
                    </button>
                    <button type="button" class="os-header-action-btn os-header-btn-task" title="Add a task">
                        <span class="ti ti-checkbox"></span>
                        <span>+ Task</span>
                    </button>
                    <button type="button" class="os-header-action-btn os-header-btn-invoice" title="Create an invoice">
                        <span class="ti ti-receipt"></span>
                        <span>+ Invoice</span>
                    </button>
                `;

                container.querySelector('.os-header-btn-time').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateSupportSessionModal(panel, data, clientGuid, projectGuid);
                };

                container.querySelector('.os-header-btn-task').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showAddTaskModal(panel, data, projectGuid);
                };

                container.querySelector('.os-header-btn-invoice').onclick = async (e) => {
                    e.stopPropagation();
                    const data = await this.loadData();
                    this.showCreateInvoiceModal(panel, data, clientGuid, projectGuid);
                };
            }
        }
    }

    async createProjectForActiveClient() {
        const sourcePanel = this.ui.getActivePanel?.();
        const sourceRecord = sourcePanel?.getActiveRecord?.();
        try {
            if (!sourceRecord) throw new Error('Open a client page before creating a project.');
            const collections = this.workflowCollections = await this.data.getAllCollections();
            const clients = collections.find(collection => collection.getGuid() === this.collectionGuid('Clients', collections));
            if (!clients) throw new Error('Choose your Clients collection in Settings.');
            const records = await clients.getAllRecords();
            const client = records.find(record => record.guid === sourceRecord.guid);
            if (!client || isTemplateRecord(client)) throw new Error('This page is not a valid client in the configured Clients collection.');
            const data = await this.loadData();
            this.showCreateProjectModal(sourcePanel, data, client.guid);
        } catch (error) {
            this.ui.addToaster({ title: error.message || 'Could not create project for active client.', dismissible: true });
        }
    }

    async createInvoiceForActiveRecord() {
        const sourcePanel = this.ui.getActivePanel?.();
        const sourceRecord = sourcePanel?.getActiveRecord?.();
        try {
            if (!sourceRecord) throw new Error('Open a client or project page before creating an invoice.');
            const collections = this.workflowCollections = await this.data.getAllCollections();
            const clientsCol = collections.find(c => c.getGuid() === this.collectionGuid('Clients', collections));
            const projectsCol = collections.find(c => c.getGuid() === this.collectionGuid('Projects', collections));

            const isClient = clientsCol && (await clientsCol.getAllRecords()).some(r => r.guid === sourceRecord.guid && !isTemplateRecord(r));
            const isProject = projectsCol && (await projectsCol.getAllRecords()).some(r => r.guid === sourceRecord.guid && !isTemplateRecord(r));

            if (!isClient && !isProject) throw new Error('Open a client or project page before creating an invoice.');

            let clientGuid = '';
            let projectGuid = '';
            if (isClient) {
                clientGuid = sourceRecord.guid;
            } else if (isProject) {
                projectGuid = sourceRecord.guid;
                clientGuid = getClientGuid(sourceRecord) || '';
            }

            const data = await this.loadData();
            this.showCreateInvoiceModal(sourcePanel, data, clientGuid, projectGuid);
        } catch (error) {
            this.ui.addToaster({ title: error.message || 'Could not create invoice for active page.', dismissible: true });
        }
    }

    async logSupportSessionForActiveRecord(explicitClientGuid = '', targetPanel = null) {
        const sourcePanel = targetPanel || this.ui.getActivePanel?.();
        const sourceRecord = sourcePanel?.getActiveRecord?.();
        try {
            const collections = this.workflowCollections = await this.data.getAllCollections();
            const clientsCol = collections.find(c => c.getGuid() === this.collectionGuid('Clients', collections));
            const projectsCol = collections.find(c => c.getGuid() === this.collectionGuid('Projects', collections));

            let clientGuid = explicitClientGuid || '';
            let projectGuid = '';

            if (!clientGuid && sourceRecord) {
                const isClient = clientsCol && (await clientsCol.getAllRecords()).some(r => r.guid === sourceRecord.guid && !isTemplateRecord(r));
                const isProject = projectsCol && (await projectsCol.getAllRecords()).some(r => r.guid === sourceRecord.guid && !isTemplateRecord(r));
                if (isClient) clientGuid = sourceRecord.guid;
                else if (isProject) {
                    projectGuid = sourceRecord.guid;
                    clientGuid = getClientGuid(sourceRecord) || '';
                }
            }

            if (!clientGuid && !sourceRecord) throw new Error('Open a client or project page before logging support time.');

            const data = await this.loadData();
            this.showCreateSupportSessionModal(sourcePanel, data, clientGuid, projectGuid);
        } catch (error) {
            this.ui.addToaster({ title: error.message || 'Could not log support time for active page.', dismissible: true });
        }
    }

    async createConfiguredRecord(role, title, values, options = {}) {
        const collections = this.workflowCollections = await this.data.getAllCollections();
        const collection = collections.find(item => item.getGuid() === this.collectionGuid(role, collections));
        if (!collection) throw new Error(`Choose your ${role} collection in Settings`);
        const fields = collection.getConfiguration().fields;
        // Validate the schema before creating a page; choice IDs are workspace-specific.
        for (const [label, value] of Object.entries(values)) {
            if (value === '' || value === null || value === undefined) continue;
            const field = fields.find(item => item.label === label || item.id === label);
            if (!field && value === 0 && ['estimated_value_chf', 'budget_chf'].includes(label)) continue;
            if (!field || field.active === false || field.read_only || (field.type === 'choice' && !field.choices?.some(choice => choice.label === value && choice.active !== false))) throw new Error(`Check the ${role}.${label} field in your collection setup`);
            if (role === 'Invoices') {
                const expected = { invoice_id: 'text', client: 'record', project: 'record', amount_chf: 'number', currency: 'choice', status: 'choice', payment_status: 'choice', issued: 'datetime', due: 'datetime', paid_date: 'datetime' };
                if (expected[label] && field.type !== expected[label]) throw new Error(`Check the Invoices.${label} field type in your collection setup`);
            }
            if (role === 'Projects') {
                const expected = { client: 'record', status: 'choice', priority: 'choice', deadline: 'datetime', completed_date: 'datetime', budget_chf: 'number', fee_type: 'choice' };
                if (expected[label] && field.type !== expected[label]) throw new Error(`Check the Projects.${label} field type in your collection setup`);
            }
            if (role === 'Clients') {
                const expected = { status: 'choice', plan: 'text', monthly_chf: 'number', billing_cycle: 'choice', included_hours: 'number', contact: 'text', email: 'text', phone: 'text', website: 'url', estimated_value_chf: 'number', source: 'choice' };
                if (expected[label] && field.type !== expected[label]) throw new Error(`Check the Clients.${label} field type in your collection setup`);
            }
        }
        if (['Projects', 'Invoices'].includes(role) && values.client) {
            const clients = collections.find(item => item.getGuid() === this.collectionGuid('Clients', collections));
            if (!clients || !(await clients.getAllRecords()).some(item => item.guid === values.client && !isTemplateRecord(item))) throw new Error('Choose a client from your Clients collection');
        }
        if (role === 'Invoices' && values.project) {
            const projects = collections.find(item => item.getGuid() === this.collectionGuid('Projects', collections));
            const projectRecord = projects && (await projects.getAllRecords()).find(item => item.guid === values.project && !isTemplateRecord(item));
            if (!projectRecord || (getClientGuid(projectRecord) && getClientGuid(projectRecord) !== values.client)) throw new Error('Choose a project linked to this client');
        }
        if (role === 'Clients' && (await collection.getAllRecords()).some(item => !isTemplateRecord(item) && (item.getName?.() || item.name || '').trim().toLowerCase() === title.trim().toLowerCase())) throw new Error('A client or lead with this name already exists. Open its profile to update it.');
        if (role === 'Invoices') {
            if (!title.trim() || !Number.isFinite(Number(values.amount_chf)) || !(Number(values.amount_chf) > 0) || !values.client) throw new Error('Enter an invoice reference, positive amount, and client.');
            if (!['draft', 'ready', 'sent'].includes(values.status) || !['unpaid', 'unconfirmed', 'paid'].includes(values.payment_status) || !values.currency) throw new Error('Choose the invoice sending stage, payment state, and currency.');
            for (const label of ['issued', 'due', 'paid_date']) if (values[label] && (dateDay(values[label]) === null || (label !== 'due' && values[label] > localDate()))) throw new Error('Choose valid invoice dates; issue and payment dates cannot be in the future.');
            if (values.status === 'sent' && dateDay(values.issued) === null) throw new Error('A sent invoice needs its valid issue date.');
            if (values.payment_status === 'paid' && (values.status !== 'sent' || dateDay(values.paid_date) === null || values.paid_date > localDate())) throw new Error('Paid invoices need Sent stage and a valid payment date no later than today.');
            if ((await collection.getAllRecords()).some(item => [item.getName?.() || item.name || '', getProp(item, 'invoice_id')].some(reference => String(reference).trim().toLowerCase() === title.trim().toLowerCase()))) throw new Error('This invoice reference already exists. Open the existing invoice to update it.');
        }
        if (role === 'Support Sessions') {
            if (!values.client) throw new Error('Choose a client for this support session');
            const clients = collections.find(item => item.getGuid() === this.collectionGuid('Clients', collections));
            const clientRecord = clients && (await clients.getAllRecords()).find(item => item.guid === values.client && !isTemplateRecord(item));
            if (!clientRecord) throw new Error('Choose a client from your Clients collection');
            if (values.project) {
                const projects = collections.find(item => item.getGuid() === this.collectionGuid('Projects', collections));
                const projectRecord = projects && (await projects.getAllRecords()).find(item => item.guid === values.project && !isTemplateRecord(item));
                if (!projectRecord || (getClientGuid(projectRecord) && getClientGuid(projectRecord) !== values.client)) throw new Error('Choose a project linked to this client');
            }
            if (!(Number(values.hours) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(values.date || '') || !values.description?.trim()) throw new Error('Enter a date, a positive number of hours, and a short description');
        }
        const guid = collection.createRecord(title);
        if (!guid) throw new Error('The page could not be created');
        let record;
        for (let attempt = 0; attempt < 20 && !record; attempt++) {
            record = (await collection.getAllRecords()).find(item => item.guid === guid);
            if (!record) await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (!record) throw new Error('The page was created but could not be loaded. Open its collection before retrying.');
        try {
            const writes = Object.entries(values);
            if (role === 'Invoices') {
                const order = label => label === 'payment_status' ? 3 : label === 'status' ? 2 : ['issued', 'due', 'paid_date'].includes(label) ? 1 : 0;
                writes.sort(([a], [b]) => order(a) - order(b));
            }
            for (const [label, value] of writes) {
                if (value === '' || value === null || value === undefined) continue;
                const field = fields.find(item => item.label === label || item.id === label);
                const property = record.prop(label);
                if (field.type === 'choice') { if (!property.setChoice(value)) throw new Error(`Could not set ${label}`); }
                else if (field.type === 'datetime') {
                    const parts = value.split('-').map(Number);
                    if (property.set(DateTime.dateOnly(parts[0], parts[1] - 1, parts[2]).value()) === false) throw new Error(`Could not set ${label}`);
                } else if (property.set(value) === false) throw new Error(`Could not set ${label}`);
            }
            if (role === 'Projects') await this.initializeProject(record, options);
            if (role === 'Clients') await this.initializeClient(record, options);
            if (role === 'Invoices') {
                await this.initializeInvoice(record, values, options);
                const verified = (await collection.getAllRecords()).find(item => item.guid === guid);
                for (const [label, value] of writes) {
                    if (value === '' || value === null || value === undefined) continue;
                    const actual = label === 'client' || label === 'project' ? getLinkedRecordGuid(verified, label) : getProp(verified, label);
                    if (!verified || String(actual) !== String(value)) throw new Error(`The new invoice's ${label} could not be verified.`);
                }
                record = verified;
            }
            if (role === 'Support Sessions') {
                await this.initializeSupportSession(record, values, options);
            }
        } catch (error) {
            try { if (await record.trash() === false) throw new Error('Removal failed'); }
            catch { throw new Error(`The new page could not be fully saved or removed. Open its collection before retrying. ${error.message}`); }
            throw error;
        }
        return record;
    }

    showCreateSupportSessionModal(panel, data, defaultClientGuid = '', defaultProjectGuid = '') {
        if (!this.collectionGuid('Support Sessions')) {
            this.ui.addToaster({ title: 'Add the Support Sessions collection with the starter setup to enable time tracking', dismissible: true });
            return;
        }
        const clients = data.clients.filter(client => client.status !== 'archived' && client.status !== 'cancelled');
        const initialClient = defaultClientGuid || '';
        const initialProject = defaultProjectGuid || '';
        const modal = document.createElement('div'); modal.className = 'os-modal-backdrop';
        modal.innerHTML = `
            <div class="os-modal-card" role="dialog" aria-modal="true" aria-labelledby="os-support-dialog-title">
                <div class="os-modal-header"><h3 id="os-support-dialog-title">Log support time</h3><button class="os-modal-close" type="button" aria-label="Close support time form">✕</button></div>
                <div class="os-modal-body">
                    <div class="os-form-group"><label for="os-support-client">Client *</label><select id="os-support-client" class="os-select input-client" required><option value="">Choose a client…</option>${clients.map(client => `<option value="${client.guid}" ${client.guid === initialClient ? 'selected' : ''}>${escapeHtml(client.name)}</option>`).join('')}</select></div>
                    <div class="os-form-group"><label for="os-support-project">Project (optional)</label><select id="os-support-project" class="os-select input-project"><option value="">No project linked</option></select></div>
                    <div class="os-form-pair">
                        <div class="os-form-group"><label for="os-support-date">Date *</label><input id="os-support-date" type="date" class="os-input input-date" value="${localDate()}" required /></div>
                        <div class="os-form-group"><label for="os-support-hours">Hours *</label><input id="os-support-hours" type="number" class="os-input input-hours" min="0.25" step="0.25" placeholder="1.5" required /></div>
                    </div>
                    <div class="os-form-group"><label for="os-support-description">What did you work on? *</label><textarea id="os-support-description" class="os-input input-description" rows="3" placeholder="e.g. Reviewed the mobile layout and agreed next changes" required></textarea></div>
                    <p class="os-form-hint">The dashboard includes this session in the selected month’s support total.</p>
                </div>
                <div class="os-modal-footer"><button class="os-button btn-cancel" type="button">Cancel</button><button class="os-button os-primary btn-submit" type="button">Save session</button></div>
            </div>`;
        const priorFocus = document.activeElement;
        const close = () => { modal.remove(); priorFocus?.focus(); };
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
                const controls = [...modal.querySelectorAll('button:not(:disabled), input, select, textarea')];
                if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
                else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
            }
        });
        modal.querySelector('.os-modal-close').onclick = close; modal.querySelector('.btn-cancel').onclick = close;
        modal.addEventListener('click', event => { if (event.target === modal) close(); });
        const clientSelect = modal.querySelector('.input-client'); const projectSelect = modal.querySelector('.input-project');
        const refreshProjects = () => {
            const selectedClient = clientSelect.value;
            projectSelect.innerHTML = '<option value="">No project linked</option>' + (data.projects || []).filter(project => !project.clientGuid || project.clientGuid === selectedClient).map(project => `<option value="${project.guid}" ${project.guid === initialProject ? 'selected' : ''}>${escapeHtml(project.name)}</option>`).join('');
        };
        clientSelect.onchange = refreshProjects;
        refreshProjects();
        modal.querySelectorAll('.input-date, .input-hours').forEach(input => {
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    modal.querySelector('.btn-submit').click();
                }
            });
        });
        modal.querySelector('.btn-submit').onclick = async () => {
            const client = clientSelect.value, project = projectSelect.value, date = modal.querySelector('.input-date').value;
            const hours = Number(modal.querySelector('.input-hours').value), description = modal.querySelector('.input-description').value.trim();
            if (!client || !date || !(hours > 0) || !description) { this.ui.addToaster({ title: 'Choose a client and enter a date, positive hours, and description', dismissible: true }); return; }
            const submit = modal.querySelector('.btn-submit'); submit.disabled = true;
            const clientName = clients.find(item => item.guid === client)?.name || 'Client';
            const title = `${clientName} · ${hours} h · ${description}`;
            try {
                await this.createConfiguredRecord('Support Sessions', title, { client, project, date, hours, description });
                this.ui.addToaster({ title: 'Support session saved', autoDestroyTime: 2500, dismissible: true });
                close(); this.scheduleRefresh();
            } catch (error) { submit.disabled = false; this.ui.addToaster({ title: error.message || 'Support session could not be saved', dismissible: true }); }
        };
        document.body.appendChild(modal); refreshProjects(); clientSelect.focus();
    }

    showCreateProjectModal(panel, data, defaultClientGuid = '', defaultPackId = '') {
        const modal = document.createElement('div');
        modal.className = 'os-modal-backdrop';

        const baseCurrency = typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (data?.baseCurrency || this.workflowState?.baseCurrency || 'CHF');
        const initialClient = defaultClientGuid || this.clientProjectGuid || '';
        const clientOptions = data.clients.map(c => `<option value="${c.guid}" ${c.guid === initialClient ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

        const activePackIds = typeof this.getActivePacks === 'function' ? this.getActivePacks() : (this.workflowState?.activePacks || []);
        const activePacksList = (typeof TRADE_PACKS !== 'undefined' ? TRADE_PACKS : []).filter(p => activePackIds.includes(p.id));
        const chosenPackId = defaultPackId || (activePacksList[0]?.id || '');
        const chosenPack = activePacksList.find(p => p.id === chosenPackId);
        const initialMilestones = chosenPack ? chosenPack.templates.milestones.join(' → ') : 'General review checkpoint';

        modal.innerHTML = `
            <div class="os-modal-card" role="dialog" aria-modal="true" aria-labelledby="os-project-dialog-title">
                <div class="os-modal-header">
                    <h3 id="os-project-dialog-title">Create project</h3>
                    <button class="os-modal-close" type="button" aria-label="Close project form">✕</button>
                </div>
                <div class="os-modal-body">
                    <div class="os-form-group">
                        <label for="os-project-name">Project name *</label>
                        <input id="os-project-name" type="text" class="os-input input-title" placeholder="e.g. Website redesign" required autofocus />
                    </div>
                    ${activePacksList.length ? `
                        <div class="os-form-group">
                            <label for="os-project-template">Project Archetype / Template</label>
                            <select id="os-project-template" class="os-select input-template">
                                ${activePacksList.map(pack => `
                                    <option value="${escapeHtml(pack.id)}" ${pack.id === chosenPackId ? 'selected' : ''}>${pack.icon} ${escapeHtml(pack.name)} (${escapeHtml(pack.templates.projectType)})</option>
                                `).join('')}
                                <option value="" ${!chosenPackId ? 'selected' : ''}>Standard Project (General milestones)</option>
                            </select>
                            <div class="os-template-milestones-preview" style="font-size: 11px; color: var(--os-muted); margin-top: 4px;">
                                Initial milestones: ${escapeHtml(initialMilestones)}
                            </div>
                        </div>
                    ` : `
                        <p class="os-form-hint" style="margin-top: -6px; margin-bottom: 12px;">Tip: Activate Trade Packs in the AI tab to unlock specialized project templates (e.g. Engineering Sprints, Design Sprints, Retainers).</p>
                    `}
                    <div class="os-form-group">
                        <label for="os-project-client">Client</label>
                        <select id="os-project-client" class="os-select input-client">
                            <option value="">-- No Client / Internal --</option>
                            ${clientOptions}
                        </select>
                    </div>
                    <div class="os-form-pair">
                        <div class="os-form-group">
                            <label for="os-project-priority">Priority</label>
                            <select id="os-project-priority" class="os-select input-priority">
                                <option value="high">High</option>
                                <option value="medium" selected>Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div class="os-form-group">
                            <label for="os-project-status">Status</label>
                            <select id="os-project-status" class="os-select input-status">
                                <option value="in_progress" selected>In Progress</option>
                                <option value="backlog">Backlog</option>
                            </select>
                        </div>
                    </div>
                    <div class="os-form-pair">
                        <div class="os-form-group">
                            <label for="os-project-fee-type">Fee type</label>
                            <select id="os-project-fee-type" class="os-select input-fee-type">
                                <option value="fixed" selected>Fixed price</option>
                                <option value="hourly">Hourly</option>
                                <option value="retainer">Retainer</option>
                                <option value="non_billable">Non-billable</option>
                            </select>
                        </div>
                        <div class="os-form-group">
                            <label for="os-project-budget">Budget (${escapeHtml(baseCurrency)})</label>
                            <input id="os-project-budget" type="number" min="0" step="100" class="os-input input-budget" placeholder="e.g. 5000" />
                        </div>
                    </div>
                    <div class="os-form-group">
                        <label for="os-project-deadline">Deadline (optional)</label>
                        <input id="os-project-deadline" type="date" class="os-input input-deadline" />
                    </div>
                    <div class="os-form-group">
                        <label for="os-project-brief">Project brief (optional)</label>
                        <textarea id="os-project-brief" class="os-input input-brief" rows="2" placeholder="What outcome are you working towards?"></textarea>
                    </div>
                    <div class="os-form-group">
                        <label for="os-project-action">First action (optional)</label>
                        <input id="os-project-action" class="os-input input-first-action" placeholder="e.g. Agree the launch scope with the client" />
                    </div>
                    <p class="os-form-hint">Starts with a brief, native tasks, deliverables and a decision log. The Client field links this project to its client profile.</p>
                </div>
                <div class="os-modal-footer">
                    <button class="os-button btn-cancel" type="button">Cancel</button>
                    <button class="os-button os-primary btn-submit" type="button">Create Project</button>
                </div>
            </div>
        `;

        const priorFocus = document.activeElement;
        const close = () => { modal.remove(); priorFocus?.focus(); };
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
                const controls = [...modal.querySelectorAll('button:not(:disabled), input, select, textarea')];
                if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
                else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
            }
        });
        modal.querySelector('.os-modal-close').addEventListener('click', close);
        modal.querySelector('.btn-cancel').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        modal.querySelectorAll('.input-title, .input-deadline, .input-budget, .input-first-action').forEach(input => {
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    modal.querySelector('.btn-submit').click();
                }
            });
        });

        modal.querySelector('.btn-submit').addEventListener('click', async () => {
            const titleInput = modal.querySelector('.input-title');
            const title = titleInput.value.trim();
            if (!title) {
                this.ui.addToaster({ title: 'Please enter a project name', dismissible: true });
                titleInput.focus();
                return;
            }

            const clientGuid = modal.querySelector('.input-client').value;
            const priority = modal.querySelector('.input-priority').value;
            const status = modal.querySelector('.input-status').value;
            const deadline = modal.querySelector('.input-deadline').value;
            const rawBudget = Number(modal.querySelector('.input-budget')?.value);
            const budget = Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : '';
            const feeType = modal.querySelector('.input-fee-type')?.value || 'fixed';
            const submit = modal.querySelector('.btn-submit'); submit.disabled = true;
            try {
                const templateSelect = modal.querySelector('.input-template');
                const selectedPackId = templateSelect ? templateSelect.value : '';
                const selectedPack = (typeof TRADE_PACKS !== 'undefined' ? TRADE_PACKS : []).find(p => p.id === selectedPackId);
                const templateOptions = {
                    brief: modal.querySelector('.input-brief').value.trim(),
                    firstAction: modal.querySelector('.input-first-action').value.trim(),
                    packId: selectedPack?.id || '',
                    projectType: selectedPack?.templates?.projectType || '',
                    milestones: selectedPack?.templates?.milestones || []
                };
                const record = await this.createConfiguredRecord('Projects', title, { client: clientGuid, priority, status, deadline, ...(budget ? { budget_chf: budget } : {}), fee_type: feeType }, templateOptions);
                this.ui.addToaster({ title: `✓ Created "${title}"`, autoDestroyTime: 2500, dismissible: true });
                close();
                this.scheduleRefresh();
                await this.openRecord(record.guid, panel);
            } catch (err) {
                submit.disabled = false;
                this.ui.addToaster({ title: err.message || 'Project could not be created', dismissible: true });
            }
        });

        document.body.appendChild(modal);
        const templateSelect = modal.querySelector('.input-template');
        const preview = modal.querySelector('.os-template-milestones-preview');
        if (templateSelect && preview) {
            templateSelect.addEventListener('change', () => {
                const chosen = (typeof TRADE_PACKS !== 'undefined' ? TRADE_PACKS : []).find(p => p.id === templateSelect.value);
                if (chosen) {
                    preview.textContent = `Initial milestones: ${chosen.templates.milestones.join(' → ')}`;
                } else {
                    preview.textContent = 'Initial milestones: General review checkpoint';
                }
            });
        }
        if (initialClient) modal.querySelector('.input-client').value = initialClient;
        modal.querySelector('.input-title').focus();
    }

    async updateClientDetails(client, values) {
        const collections = await this.data.getAllCollections();
        const collection = collections.find(item => item.getGuid() === this.collectionGuid('Clients', collections));
        if (!collection) throw new Error('Choose your Clients collection in Settings.');
        const record = (await collection.getAllRecords()).find(item => item.guid === client.guid);
        if (!record || isTemplateRecord(record)) throw new Error('This client could not be found. Refresh and try again.');
        const fields = collection.getConfiguration().fields;
        const properties = [];
        for (const [label, value] of Object.entries(values)) {
            const field = fields.find(item => item.label === label);
            if (!field && (value === '' || (value === 0 && ['estimated_value_chf', 'budget_chf'].includes(label)))) continue;
            if (!field || field.active === false || field.read_only || (field.type === 'choice' && !field.choices?.some(choice => choice.label === value && choice.active !== false))) throw new Error(`Check the Clients.${label} field in your collection setup.`);
            const current = label === 'monthly_chf' || label === 'estimated_value_chf' ? Number(getProp(record, label)) || 0 : getProp(record, label);
            const previous = label === 'monthly_chf' ? client.mrr : label === 'estimated_value_chf' ? client.estimatedValue : label === 'lead_stage' ? client.leadStage : label === 'plan' ? client.planValue ?? client.plan : client[label];
            if (String(value) === String(previous ?? '')) continue;
            if (String(current) !== String(previous ?? '') && String(current) !== String(value)) throw new Error(`${label} changed elsewhere. Close this form and refresh before editing it again.`);
            const property = record.prop(label);
            if (!property) throw new Error(`The ${label} field could not be loaded.`);
            properties.push({ field, property, value });
        }
        for (const { field, property, value } of properties) {
            const saved = field.type === 'choice' ? property.setChoice(value) : property.set(value);
            if (saved === false) throw new Error(`${field.label} could not be saved. Check the profile before retrying.`);
        }
    }

    showCreateClientModal(panel, client = null, initialStatus = 'active') {
        const editing = !!client;
        const status = client ? clientStatus(client) : initialStatus;
        const launchControl = document.activeElement;
        const baseCurrency = typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (this.workflowState?.baseCurrency || 'CHF');
        let saving = false;
        const modal = document.createElement('div');
        modal.className = 'os-modal-backdrop';
        modal.innerHTML = `
            <form class="os-modal-card os-client-form" role="dialog" aria-modal="true" aria-labelledby="os-client-form-title">
                <div class="os-modal-header">
                    <h3 id="os-client-form-title">${editing ? 'Edit details' : status === 'prospect' ? 'Add lead' : 'Add client'}</h3>
                    <button class="os-modal-close" type="button" aria-label="Close">✕</button>
                </div>
                <div class="os-modal-body">
                    <div class="os-form-group">
                        <label for="os-client-name">Client or company name *</label>
                        <input id="os-client-name" type="text" class="os-input input-title" value="${escapeHtml(client?.name || '')}" placeholder="e.g. Acme Studio" required ${editing ? 'readonly' : ''} />
                    </div>
                    <div class="os-client-form-grid">
                        <div class="os-form-group">
                            <label for="os-client-status">Status</label>
                            <select id="os-client-status" class="os-select input-status">
                                ${Object.entries(CLIENT_STATUSES).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="os-form-group"><label for="os-client-contact">Contact</label><input id="os-client-contact" class="os-input input-contact" value="${escapeHtml(client?.contact || '')}" autocomplete="name" placeholder="e.g. Alex Martin" /></div>
                        <div class="os-form-group"><label for="os-client-email">Email</label><input id="os-client-email" type="email" class="os-input input-email" value="${escapeHtml(client?.email || '')}" autocomplete="email" placeholder="alex@example.com" /></div>
                        <div class="os-form-group"><label for="os-client-phone">Phone</label><input id="os-client-phone" type="tel" class="os-input input-phone" value="${escapeHtml(client?.phone || '')}" autocomplete="tel" /></div>
                        <div class="os-form-group"><label for="os-client-website">Website</label><input id="os-client-website" type="url" class="os-input input-website" value="${escapeHtml(client?.website || '')}" placeholder="https://example.com" /></div>
                    </div>
                    <details class="os-client-care-plan"><summary>Care plan (optional)</summary><div class="os-client-form-grid">
                        <div class="os-form-group"><label for="os-client-plan">Service</label><input id="os-client-plan" class="os-input input-plan" value="${escapeHtml(client?.planValue ?? (client?.plan === 'Active' ? '' : client?.plan || ''))}" placeholder="e.g. Website maintenance" /></div>
                        <div class="os-form-group"><label for="os-client-mrr">Monthly retainer (${escapeHtml(baseCurrency)})</label><input id="os-client-mrr" type="number" min="0" step="any" class="os-input input-mrr" value="${Number(client?.mrr) || ''}" /></div>
                    </div></details>
                    <details class="os-client-lead-details" ${status === 'prospect' || isLeadClient({ status }) ? 'open' : ''}><summary>Deal & source (for leads)</summary><div class="os-client-form-grid">
                        <div class="os-form-group"><label for="os-client-deal">Estimated deal (${escapeHtml(baseCurrency)})</label><input id="os-client-deal" type="number" min="0" step="100" class="os-input input-deal" value="${Number(client?.estimatedValue) || ''}" placeholder="e.g. 5000" /></div>
                        <div class="os-form-group"><label for="os-client-source">Lead source</label><select id="os-client-source" class="os-select input-source">
                            <option value="">-- Not specified --</option>
                            ${['referral', 'website', 'linkedin', 'inbound', 'outbound', 'other'].map(src => `<option value="${src}" ${client?.source === src ? 'selected' : ''}>${src.charAt(0).toUpperCase() + src.slice(1)}</option>`).join('')}
                        </select></div>
                    </div></details>
                    <p class="os-form-help">Keep short notes on the native profile. Projects and tasks stay in their existing Thymer pages.</p>
                    <p class="os-client-form-error" role="alert" hidden></p>
                </div>
                <div class="os-modal-footer">
                    <button class="os-button btn-cancel" type="button">Cancel</button>
                    <button class="os-button os-primary btn-submit" type="submit">${editing ? 'Save details' : 'Add ' + (status === 'prospect' ? 'lead' : 'client')}</button>
                </div>
            </form>
        `;
        const form = modal.querySelector('form');
        const statusInput = modal.querySelector('.input-status'); statusInput.value = status;
        statusInput.onchange = () => {
            if (!editing) modal.querySelector('.btn-submit').textContent = isLeadClient({ status: statusInput.value }) ? 'Add lead' : 'Add client';
        };
        const close = () => { if (saving) return; modal.remove(); if (launchControl?.isConnected) launchControl.focus(); this.flushRefresh(); };
        modal.querySelector('.os-modal-close').addEventListener('click', close);
        modal.querySelector('.btn-cancel').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
                const controls = [...modal.querySelectorAll('button, input, select, summary')].filter(el => !el.disabled && el.getClientRects().length);
                const first = controls[0], last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (saving || !form.reportValidity()) return;
            const title = modal.querySelector('.input-title').value.trim();
            const error = modal.querySelector('.os-client-form-error'); error.hidden = true;
            if (!title) { error.textContent = 'Enter a client or company name.'; error.hidden = false; return; }
            const values = { monthly_chf: Number(modal.querySelector('.input-mrr').value) || 0, status: statusInput.value,
                plan: modal.querySelector('.input-plan').value.trim(), website: modal.querySelector('.input-website').value.trim(),
                contact: modal.querySelector('.input-contact').value.trim(), email: modal.querySelector('.input-email').value.trim(), phone: modal.querySelector('.input-phone').value.trim(),
                estimated_value_chf: Number(modal.querySelector('.input-deal')?.value) || 0,
                source: modal.querySelector('.input-source')?.value || '' };
            const submit = modal.querySelector('.btn-submit'); submit.disabled = true;
            saving = true; form.setAttribute('aria-busy', 'true'); submit.textContent = 'Saving…';
            try {
                if (editing) await this.updateClientDetails(client, values);
                else await this.createConfiguredRecord('Clients', title, values);
                saving = false; close(); this.currentTab = 'clients'; this.clientFilter = isLeadClient(values) ? 'leads' : values.status === 'archived' ? 'archived' : 'active';
                this.scheduleRefresh();
            } catch (err) {
                saving = false; form.removeAttribute('aria-busy'); submit.disabled = false; submit.textContent = editing ? 'Save details' : 'Add ' + (isLeadClient(values) ? 'lead' : 'client');
                error.textContent = err.message || 'Details could not be saved. Your entries are still here.'; error.hidden = false; error.tabIndex = -1; error.focus();
            }
        });
        document.body.appendChild(modal);
        modal.querySelector(editing ? '.input-contact' : '.input-title').focus();
    }

    showCreateInvoiceModal(panel, data, defaultClientGuid = '', defaultProjectGuid = '') {
        return this.showBillingInvoiceModal(panel, data, defaultClientGuid, defaultProjectGuid);
    }

    enableTablistKeyboardNav(tablist) {
        if (!tablist || typeof tablist.querySelectorAll !== 'function') return;
        let tabs = [];
        try { tabs = Array.from(tablist.querySelectorAll('[role="tab"], button') || []); } catch (e) { return; }
        if (!tabs.length) return;
        tabs.forEach((tab, index) => {
            if (!tab || typeof tab.addEventListener !== 'function') return;
            tab.addEventListener('keydown', (e) => {
                let nextIndex = null;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    nextIndex = (index + 1) % tabs.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    nextIndex = (index - 1 + tabs.length) % tabs.length;
                } else if (e.key === 'Home') {
                    nextIndex = 0;
                } else if (e.key === 'End') {
                    nextIndex = tabs.length - 1;
                }
                if (nextIndex !== null && tabs[nextIndex]) {
                    e.preventDefault();
                    if (typeof tabs[nextIndex].focus === 'function') tabs[nextIndex].focus();
                    if (typeof tabs[nextIndex].click === 'function') tabs[nextIndex].click();
                }
            });
        });
    }

    async render(panel) {
        const container = panel.getElement ? panel.getElement() : null;
        if (!container) return;

        // Force inner content wrappers to 100% width to break out of Thymer's reader-width constraint,
        // without touching .panel itself so Thymer's multi-panel grid remains intact
        try {
            container.style.width = '100%';
            container.style.maxWidth = '100%';
            container.style.padding = '0';
            let cur = container.parentElement;
            while (cur && cur !== document.body) {
                if (cur.classList && cur.classList.contains('panel')) break;
                cur.style.width = '100%';
                cur.style.maxWidth = '100%';
                cur = cur.parentElement;
            }
        } catch (e) {}

        const renderVersion = this.renderVersion = (this.renderVersion || 0) + 1;
        const mode = this.workflowMode || 'overview';
        const needsWorkflow = !['overview', 'billing', 'ai', 'settings'].includes(mode);
        let workflow;
        if (needsWorkflow) {
            try { workflow = await this.loadWorkflowData({ expectedVersion: renderVersion, deferApply: true }); }
            catch { workflow = { error: 'Project tasks could not be loaded. Check collection mappings in Settings, then retry.' }; }
            this.workflowData = workflow;
        }
        const data = !needsWorkflow ? await this.loadData() : { projects: workflow?.projects || [] };
        if (renderVersion !== this.renderVersion) return;
        if (needsWorkflow && !workflow?.error) {
            const applied = await this.applyWorkflowSnapshot(workflow, { expectedVersion: renderVersion });
            if (!applied && workflow.stale) return;
            if (renderVersion !== this.renderVersion) return;
        }
        if (mode === 'review' && !workflow?.error) {
            const week = reviewWeek();
            if (this.workflowState.drafts[week]?.step === 2) {
                this.weeklyReviewDiscovery = await this.loadWeeklyReviewContext();
                try { this.previousReviewContext = await this.loadPreviousReviewContext({ week, workflow }); }
                catch (error) { this.previousReviewContext = { kind: 'incomplete', week: previousReviewWeek(week), items: [], warning: error.message }; }
                if (renderVersion !== this.renderVersion) return;
            }
        }
        const cash = data.cashflow || summarizeInvoices([]);
        const wsGuid = this.getWorkspaceGuid();
        const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        const app = document.createElement('div');
        app.className = 'os-shell';
        app.tabIndex = -1;
        app.setAttribute('aria-label', 'Freelance OS dashboard');

        // 1. Header
        const header = document.createElement('header');
        header.className = 'os-header';
        header.innerHTML = `
            <div class="os-identity">
                <div class="os-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                </div>
                <div>
                    <h1>Freelance OS</h1>
                    <div class="os-subtitle">${mode === 'billing' ? 'Billing' : 'Workspace Overview'} · ${dateStr}</div>
                </div>
            </div>
            <div class="os-capture">
                <div class="os-capture-field">
                    <input type="text" class="os-capture-input" aria-label="Task title" placeholder="Quick capture task..." />
                    <button class="os-capture-btn" aria-label="Add task" title="Add task (Enter)">↵</button>
                </div>
                <div class="os-capture-options">
                    <select class="os-capture-project" aria-label="Task destination"><option value="">Journal inbox</option>${data.projects.filter(p => !['completed', 'archived', 'cancelled', 'canceled'].includes(p.status)).map(p => `<option value="${escapeHtml(p.guid)}">${escapeHtml(p.name)}</option>`).join('')}</select>
                    <label class="os-capture-priority"><input type="checkbox" /> Important</label>
                    <span class="os-capture-context" role="status">${this.captureDestinationSource === 'context' && this.captureContext ? `For ${escapeHtml(this.captureContext.projectName)}${this.captureContext.clientName ? ` · ${escapeHtml(this.captureContext.clientName)}` : ''}` : ''}</span>
                    <span class="os-capture-hint">/ to focus · Enter to save</span>
                </div>
                <div class="os-capture-feedback" role="status" aria-live="polite"></div>
            </div>
            <div class="os-header-actions">
                <button class="os-button os-btn-board" type="button">
                    <span>${mode === 'billing' ? 'Preparation board' : '🗂 Open board'}</span>
                </button>
            </div>
        `;

        // Capture task handler
        const captureInput = header.querySelector('.os-capture-input');
        const captureProject = header.querySelector('.os-capture-project');
        const capturePriority = header.querySelector('.os-capture-priority input');
        const captureButton = header.querySelector('.os-capture-btn');
        const captureFeedback = header.querySelector('.os-capture-feedback');
        captureInput.value = this.captureDraft || '';
        if (this.captureProjectGuid && ![...captureProject.options].some(option => option.value === this.captureProjectGuid)) {
            const unavailable = document.createElement('option');
            unavailable.value = this.captureProjectGuid;
            unavailable.textContent = 'Project unavailable — choose another destination';
            unavailable.disabled = true;
            captureProject.appendChild(unavailable);
            captureProject.setAttribute('aria-invalid', 'true');
            captureFeedback.textContent = 'Your selected project is unavailable. Choose another destination; your task text is kept.';
        }
        captureProject.value = this.captureProjectGuid || '';
        capturePriority.checked = this.captureImportant || false;
        captureInput.oninput = () => { this.captureDraft = captureInput.value; };
        captureProject.onchange = () => { this.captureProjectGuid = captureProject.value; this.captureDestinationSource = 'user'; this.captureContext = null; captureProject.removeAttribute('aria-invalid'); captureFeedback.textContent = ''; };
        capturePriority.onchange = () => { this.captureImportant = capturePriority.checked; };
        app.addEventListener('keydown', e => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input, select, textarea, [contenteditable="true"]')) {
                e.preventDefault();
                captureInput.focus({ preventScroll: true });
            }
        });
        app.addEventListener('focusout', () => this.flushRefresh());
        header.querySelector('.os-capture').addEventListener('focusout', () => this.scheduleRefresh());
        const handleCapture = async () => {
            const txt = (captureInput.value || '').trim();
            if (!txt || this.captureBusy) return;
            this.captureBusy = true;
            captureButton.disabled = true;
            captureInput.disabled = true;
            captureProject.disabled = true;
            capturePriority.disabled = true;
            captureFeedback.textContent = 'Saving task…';
            try {
                const destination = this.captureProjectGuid || '';
                if (![...captureProject.options].some(option => option.value === destination && !option.disabled)) throw new Error('Your selected project is unavailable. Choose another destination.');
                const result = await this.captureTask(txt, destination, capturePriority.checked);
                this.captureDraft = '';
                captureInput.value = '';
                const title = result.prioritySaved ? `Task saved to ${destination ? 'project' : 'Journal'}` : 'Task saved; priority could not be set. Open the task to mark it important.';
                captureFeedback.textContent = title;
                this.ui.addToaster({ title, autoDestroyTime: 3500, dismissible: true });
            } catch (err) {
                captureFeedback.textContent = `${err.message || 'Task could not be saved.'} Your text is kept; try again.`;
                console.error('[FreelanceOS] Capture failed:', err);
            } finally {
                this.captureBusy = false;
                captureButton.disabled = captureInput.disabled = captureProject.disabled = capturePriority.disabled = false;
                captureInput.focus({ preventScroll: true });
            }
        };

        header.querySelector('.os-capture-btn').addEventListener('click', handleCapture);
        captureInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); handleCapture(); }
            if (e.key === 'Escape') { e.preventDefault(); app.focus({ preventScroll: true }); }
        });

        header.querySelector('.os-btn-board').addEventListener('click', () => {
            this.openCollection(this.collectionGuid(mode === 'billing' ? 'Invoices' : 'Projects'), panel, 'board');
        });

        app.appendChild(header);

        const modes = document.createElement('nav');
        modes.className = 'os-workflow-modes';
        modes.setAttribute('role', 'tablist');
        modes.setAttribute('aria-label', 'Dashboard sections');
        modes.innerHTML = [['overview', 'Overview'], ['today', 'Today'], ['billing', 'Billing'], ['review', 'Weekly review'], ['ai', 'AI Agents'], ['settings', 'Settings']].map(([key, label]) => `<button type="button" role="tab" class="os-tab ${mode === key ? 'active' : ''}" data-mode="${key}" data-focus-key="mode-${key}" aria-selected="${mode === key ? 'true' : 'false'}">${label}</button>`).join('');
        modes.querySelectorAll('button').forEach(button => { button.onclick = () => { this.workflowMode = button.dataset.mode; this.workflowMessage = ''; this.render(panel); }; });
        this.enableTablistKeyboardNav(modes);
        app.appendChild(modes);
        if (this.workflowStorageError) {
            const storageWarning = document.createElement('p');
            storageWarning.className = 'os-workflow-message';
            storageWarning.setAttribute('role', 'alert');
            storageWarning.textContent = this.workflowStorageError;
            app.appendChild(storageWarning);
        }
        if (!needsWorkflow && data.missingCollections?.length) {
            const setup = document.createElement('section'); setup.className = 'os-workflow os-workflow-settings';
            setup.innerHTML = `<h2>Set up your workspace</h2><p>Freelance OS needs Clients, Projects and Invoices collections with its starter fields.</p><p>Missing collections: ${data.missingCollections.map(escapeHtml).join(', ')}. Create them using the setup guide, or map your existing collections in Settings.</p><button class="os-button os-primary">Choose collections</button>`;
            setup.querySelector('button').onclick = () => { this.workflowMode = 'settings'; this.render(panel); };
            app.appendChild(setup); this.mountWorkflowApp(container, app); return;
        }
        if (mode === 'billing') { app.appendChild(this.renderBilling(data, panel)); this.mountWorkflowApp(container, app); return; }
        if (mode === 'ai') { app.appendChild(this.renderAiTab(panel, data)); this.mountWorkflowApp(container, app); return; }
        if (mode !== 'overview') {
            app.appendChild(mode === 'settings' ? this.renderWorkflowSettings(panel) : this.renderWorkflow(workflow, panel));
            this.mountWorkflowApp(container, app);
            return;
        }

        // 1b. Getting Started / Onboarding Card (Shown until dismissed)
        if (!data.loadError && this.workflowState?.dismissedOnboarding !== true) {
            const missingCore = ['Clients', 'Projects', 'Invoices'].filter(role => !this.collectionGuid(role));
            const hasClients = (data.clients?.length || 0) > 0;
            const activePacksCount = typeof this.getActivePacks === 'function' ? this.getActivePacks().length : 0;
            const onboarding = document.createElement('section');
            onboarding.className = 'os-onboarding-card';
            onboarding.innerHTML = `
                <div class="os-onboarding-top">
                    <div class="os-onboarding-title-group">
                        <span class="os-onboarding-icon">👋</span>
                        <div>
                            <h3>Welcome to Freelance OS</h3>
                            <p class="os-action-meta">Your autonomous business cockpit in Thymer. Quick steps to get up and running:</p>
                        </div>
                    </div>
                    <button type="button" class="os-card-action-btn os-onboarding-dismiss" aria-label="Dismiss welcome guide">Dismiss ✕</button>
                </div>
                <div class="os-onboarding-steps">
                    <div class="os-onboarding-step">
                        <div class="os-onboarding-step-num">1</div>
                        <div class="os-onboarding-step-body">
                            <div class="os-onboarding-step-header">
                                <strong>Workspace Collections</strong>
                                ${missingCore.length === 0 ? `
                                    <span class="os-badge status-done">✓ Ready (Clients, Projects & Invoices)</span>
                                ` : `
                                    <span class="os-badge status-alert">⚠️ Missing: ${missingCore.join(', ')}</span>
                                `}
                            </div>
                            <p class="os-action-meta">Stores your clients, project deliveries, and billing records in native collections.</p>
                            ${missingCore.length > 0 ? `
                                <button type="button" class="os-card-action-btn os-onboarding-btn-settings">Configure collections →</button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="os-onboarding-step">
                        <div class="os-onboarding-step-num">2</div>
                        <div class="os-onboarding-step-body">
                            <div class="os-onboarding-step-header">
                                <strong>Connect AI Assistant (MCP)</strong>
                                <span class="os-badge badge-care-plan">Port 13100</span>
                            </div>
                            <p class="os-action-meta">Link Antigravity, Claude Code, Cursor, OpenCode, Codex or OMP to run autonomous briefings, proposals and reviews.</p>
                            <button type="button" class="os-card-action-btn os-onboarding-btn-ai">View AI setup commands →</button>
                        </div>
                    </div>

                    <div class="os-onboarding-step">
                        <div class="os-onboarding-step-num">3</div>
                        <div class="os-onboarding-step-body">
                            <div class="os-onboarding-step-header">
                                <strong>Modular Trade Packs</strong>
                                <span class="os-badge ${activePacksCount ? 'badge-care-plan' : 'status-waiting'}">${activePacksCount ? `${activePacksCount} Active` : '11 Available'}</span>
                            </div>
                            <p class="os-action-meta">Activate craft overlays for Software Dev, Design, Marketing, Consulting, Accounting, and more.</p>
                            <button type="button" class="os-card-action-btn os-onboarding-btn-packs">Browse trade packs →</button>
                        </div>
                    </div>

                    <div class="os-onboarding-step">
                        <div class="os-onboarding-step-num">4</div>
                        <div class="os-onboarding-step-body">
                            <div class="os-onboarding-step-header">
                                <strong>Add Your First Client or Lead</strong>
                                <span class="os-badge ${hasClients ? 'badge-care-plan' : 'status-waiting'}">${hasClients ? `${data.clients.length} Clients` : '0 Clients'}</span>
                            </div>
                            <p class="os-action-meta">Capture prospect deals, client relationships, and recurring Care Plan retainers.</p>
                            <button type="button" class="os-card-action-btn os-primary os-onboarding-btn-client">+ Add Client</button>
                        </div>
                    </div>
                </div>
            `;

            onboarding.querySelector('.os-onboarding-dismiss')?.addEventListener('click', () => {
                this.workflowState.dismissedOnboarding = true;
                this.persistWorkflow();
                onboarding.remove();
                this.ui?.addToaster?.({ title: 'Welcome guide dismissed (can be reopened from Settings)', autoDestroyTime: 2500, dismissible: true });
            });

            onboarding.querySelector('.os-onboarding-btn-settings')?.addEventListener('click', () => {
                this.workflowMode = 'settings';
                this.render(panel);
            });

            onboarding.querySelector('.os-onboarding-btn-ai')?.addEventListener('click', () => {
                this.workflowMode = 'ai';
                this.render(panel);
            });

            onboarding.querySelector('.os-onboarding-btn-packs')?.addEventListener('click', () => {
                this.workflowMode = 'ai';
                this.render(panel);
            });

            onboarding.querySelector('.os-onboarding-btn-client')?.addEventListener('click', () => {
                this.showCreateClientModal(panel);
            });

            app.appendChild(onboarding);
        }

        // 2. Pulse / Metrics Bar
        const baseCurrency = data.baseCurrency || (typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (this.workflowState?.baseCurrency || 'CHF'));
        const pulse = document.createElement('section');
        pulse.className = 'os-pulse';
        pulse.innerHTML = `
            <div class="os-metric metric-mrr" title="Click to view Clients & Care Plans">
                <div class="os-metric-label">Recurring revenue</div>
                <div class="os-metric-value">${money(data.mrr)} <span class="os-metric-unit">${escapeHtml(baseCurrency)} / mo</span></div>
                <div class="os-metric-footnote">${data.activeCarePlans} active care plans</div>
            </div>
            <div class="os-metric metric-inv" title="Click to view Invoices">
                <div class="os-metric-label">Invoiced · all time</div>
                <div class="os-metric-value">${money(cash.invoiced)} <span class="os-metric-unit">${escapeHtml(baseCurrency)}</span></div>
                <div class="os-metric-footnote">${cash.issuedCount} issued · ${cash.toSend} to send</div>
            </div>
            <div class="os-metric metric-col" title="Click to view Invoices">
                <div class="os-metric-label">Collected · all time</div>
                <div class="os-metric-value">${money(cash.collected)} <span class="os-metric-unit">${escapeHtml(baseCurrency)}</span></div>
                <div class="os-metric-footnote">${cash.unconfirmedCount} awaiting payment confirmation</div>
            </div>
            <div class="os-metric metric-clients" title="Click to view Clients">
                <div class="os-metric-label">Active clients</div>
                <div class="os-metric-value">${data.activeClientsCount}</div>
                <div class="os-metric-footnote">${data.prospectsCount} leads</div>
            </div>
        `;

        pulse.querySelector('.metric-mrr').addEventListener('click', () => { this.currentTab = 'clients'; this.render(panel); });
        pulse.querySelector('.metric-inv').addEventListener('click', () => { this.currentTab = 'invoices'; this.render(panel); });
        pulse.querySelector('.metric-col').addEventListener('click', () => { this.currentTab = 'invoices'; this.render(panel); });
        pulse.querySelector('.metric-clients').addEventListener('click', () => { this.currentTab = 'clients'; this.render(panel); });
        pulse.querySelectorAll('.os-metric').forEach(metric => {
            metric.setAttribute('role', 'button');
            metric.tabIndex = 0;
            metric.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); metric.click(); }
            });
        });

        app.appendChild(pulse);

        if (!data.loadError) {
            const prefs = typeof this.getAiPreferences === 'function' ? this.getAiPreferences() : (this.workflowState?.ai || {});
            const alerts = typeof computeWatchdogAlerts === 'function' ? computeWatchdogAlerts(data, prefs, localDate()) : [];
            if (alerts.length > 0) {
                const watchdogBar = document.createElement('section');
                watchdogBar.className = 'os-ai-watchdog-bar';
                watchdogBar.innerHTML = `
                    <div class="os-ai-watchdog-header">
                        <span class="os-ai-watchdog-badge">🛡️ AI Watchdogs (${alerts.length})</span>
                        <span class="os-action-meta">Autonomous safeguards active</span>
                    </div>
                    <div class="os-ai-watchdog-list">
                        ${alerts.map(a => `
                            <div class="os-ai-watchdog-item ${a.severity}">
                                <span class="os-ai-watchdog-icon">${a.icon}</span>
                                <div class="os-ai-watchdog-content">
                                    <strong>${escapeHtml(a.title)}:</strong>
                                    <span>${escapeHtml(a.detail)}</span>
                                </div>
                                <button type="button" class="os-card-action-btn os-ai-watchdog-open" data-guid="${escapeHtml(a.guid)}">${escapeHtml(a.action)} ↗</button>
                            </div>
                        `).join('')}
                    </div>
                `;
                watchdogBar.querySelectorAll('.os-ai-watchdog-open').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const guid = btn.getAttribute('data-guid');
                        if (guid) this.openRecord(guid, panel);
                    });
                });
                app.appendChild(watchdogBar);
            }
        }

        if (data.loadError) {
            pulse.remove();
            const error = document.createElement('div');
            error.className = 'os-data-error';
            error.setAttribute('role', 'alert');
            error.innerHTML = 'Some workspace data could not be loaded. <button class="os-button">Retry</button>';
            error.querySelector('button').onclick = () => this.render(panel);
            app.appendChild(error);
        } else {
            const cashflow = document.createElement('section');
            cashflow.className = 'os-cashflow';
            cashflow.setAttribute('aria-label', `Cashflow, ${escapeHtml(baseCurrency)} invoices, all time`);
            cashflow.innerHTML = `
                <div class="os-collection-rate">
                    <div class="os-cash-heading"><h2>Cashflow</h2><span>${cash.collectionRate === null ? 'No issued invoices' : `${cash.collectionRate}% collected`}</span></div>
                    <progress max="100" value="${cash.collectionRate ?? 0}" aria-label="Invoice collection rate"></progress>
                    <div class="os-cash-note">${escapeHtml(baseCurrency)} invoices · all time${cash.excludedCurrency ? ` · ${cash.excludedCurrency} in other currencies excluded` : ''}</div>
                </div>
                <button class="os-cash-action" data-invoice-filter="outstanding"><span>Outstanding</span><strong>${money(cash.outstanding)} ${escapeHtml(baseCurrency)}</strong><small>${cash.undated} without a due date</small></button>
                <button class="os-cash-action ${cash.overdueCount ? 'os-cash-warning' : ''}" data-invoice-filter="overdue"><span>Overdue (${cash.overdueCount})</span><strong>${money(cash.overdue)} ${escapeHtml(baseCurrency)}</strong><small>1–30d: ${money(cash.aging[0])} · 31–60d: ${money(cash.aging[1])} · 61+d: ${money(cash.aging[2])}</small></button>
                <button class="os-cash-action" data-invoice-filter="review"><span>Confirm payments</span><strong>${cash.unconfirmedCount} to review</strong><small>Open invoices awaiting confirmation ↗</small></button>
            `;
            cashflow.querySelectorAll('[data-invoice-filter]').forEach(button => {
                button.title = 'Open this invoice queue in the collection';
                button.onclick = () => {
                    this.openCollection(this.collectionGuid('Invoices'), panel, button.dataset.invoiceFilter);
                };
            });
            app.appendChild(cashflow);
        }

        if (!data.loadError) {
            const support = document.createElement('section');
            support.className = 'os-support-time';
            if (data.supportTime) {
                const report = data.supportTime;
                const monthLabel = new Date(`${report.month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                const used = report.hours.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
                const included = report.allowance.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
                const percent = report.allowance > 0 ? Math.min(100, Math.round(report.hours / report.allowance * 100)) : 0;
                support.innerHTML = `
                    <div class="os-support-copy">
                        <div class="os-cash-heading"><h2>Support time</h2><span>${escapeHtml(monthLabel)}</span></div>
                        <strong class="os-support-total">${used} <small>h logged</small><span>/</span>${included} <small>h included</small></strong>
                        <progress max="100" value="${percent}" aria-label="Included support hours used"></progress>
                        <div class="os-cash-note">${report.clients.length ? `${report.clients.length} active client${report.clients.length === 1 ? '' : 's'} with included monthly hours` : 'Set included_hours on active clients to track plan allowances'} · ${report.sessions.length} session${report.sessions.length === 1 ? '' : 's'} this month${report.hours > report.allowance && report.allowance > 0 ? ' · allowance exceeded' : ''}</div>
                    </div>
                    <div class="os-support-actions"><button class="os-button os-primary btn-log-support" type="button">+ Log support time</button><button class="os-button btn-support-register" type="button">Open register ↗</button></div>`;
                support.querySelector('.btn-log-support').onclick = () => this.showCreateSupportSessionModal(panel, data);
                support.querySelector('.btn-support-register').onclick = () => this.openCollection(this.collectionGuid('Support Sessions'), panel);
            } else {
                support.innerHTML = `<div><div class="os-cash-heading"><h2>Support time</h2><span>Optional</span></div><p class="os-cash-note">Add the Support Sessions collection using the starter setup to log client hours and see monthly totals here.</p></div>`;
            }
            app.appendChild(support);
        }

        // 3. Main Grid (3 columns)
        const grid = document.createElement('div');
        grid.className = 'os-grid';

        // Column 1: Action Rail
        const rail = document.createElement('aside');
        rail.className = 'os-rail';
        rail.innerHTML = `
            <h2>Actions</h2>
            <div class="os-rail-actions">
                <button class="os-button os-primary btn-new-task" type="button">
                    <span>+ New task</span>
                </button>
                <button class="os-button btn-new-project" type="button">
                    <span>+ New project</span>
                </button>
                <button class="os-button btn-new-client" type="button">
                    <span>+ New client</span>
                </button>
                <button class="os-button btn-new-lead" type="button"><span>+ New lead</span></button>
                <button class="os-button btn-new-invoice" type="button">
                    <span>+ New invoice</span>
                </button>
                <button class="os-button btn-log-support" type="button">
                    <span>+ Log support time</span>
                </button>
            </div>
            <nav class="os-navigation">
                <button type="button" class="os-nav-link nav-projects">📁 All Projects</button>
                <button type="button" class="os-nav-link nav-clients">👥 All Clients</button>
                <button type="button" class="os-nav-link nav-invoices">🧾 All Invoices</button>
                <button type="button" class="os-nav-link nav-library">📚 Care Plans</button>
                <button type="button" class="os-nav-link nav-support">⏱ Support Sessions</button>
            </nav>
        `;

        rail.querySelector('.btn-new-task').addEventListener('click', () => captureInput.focus());
        rail.querySelector('.btn-new-project').addEventListener('click', () => this.showCreateProjectModal(panel, data));
        rail.querySelector('.btn-new-client').addEventListener('click', () => this.showCreateClientModal(panel));
        rail.querySelector('.btn-new-lead').addEventListener('click', () => this.showCreateClientModal(panel, null, 'prospect'));
        rail.querySelector('.btn-new-invoice').addEventListener('click', () => this.showCreateInvoiceModal(panel, data));
        rail.querySelector('.btn-log-support').addEventListener('click', () => this.showCreateSupportSessionModal(panel, data));

        rail.querySelector('.nav-projects').addEventListener('click', () => this.openCollection(this.collectionGuid('Projects'), panel));
        rail.querySelector('.nav-clients').addEventListener('click', () => this.openCollection(this.collectionGuid('Clients'), panel));
        rail.querySelector('.nav-invoices').addEventListener('click', () => this.openCollection(this.collectionGuid('Invoices'), panel));
        rail.querySelector('.nav-library').addEventListener('click', () => this.openCollection(this.collectionGuid('Library'), panel));
        rail.querySelector('.nav-support').addEventListener('click', () => this.openCollection(this.collectionGuid('Support Sessions'), panel));

        grid.appendChild(rail);

        // Column 2: Center Projects/Clients/Invoices Grid
        const main = document.createElement('main');
        main.className = 'os-main';

        const sectionHead = document.createElement('div');
        sectionHead.className = 'os-section-head';
        sectionHead.innerHTML = `
            <div class="os-section-toolbar">
                <div class="os-tabs" role="tablist" aria-label="Portfolio collections">
                    <button type="button" role="tab" aria-selected="${this.currentTab === 'projects' ? 'true' : 'false'}" class="os-tab ${this.currentTab === 'projects' ? 'active' : ''} tab-proj">Projects (${data.projects.length})</button>
                    <button type="button" role="tab" aria-selected="${this.currentTab === 'clients' ? 'true' : 'false'}" class="os-tab ${this.currentTab === 'clients' ? 'active' : ''} tab-cli">Clients & leads (${data.clients.length})</button>
                    <button type="button" role="tab" aria-selected="${this.currentTab === 'invoices' ? 'true' : 'false'}" class="os-tab ${this.currentTab === 'invoices' ? 'active' : ''} tab-inv">Invoices (${data.invoices.length})</button>
                </div>
                <div class="os-filter-search">
                    <input type="text" class="os-search-input" aria-label="Filter ${this.currentTab}" placeholder="Filter ${this.currentTab}..." value="${escapeHtml(this.searchQuery)}" />
                    ${this.currentTab === 'clients' ? '<button type="button" class="os-card-open os-client-board-link">Status board ↗</button>' : ''}
                    <button type="button" class="os-view-all">View collection ↗</button>
                </div>
            </div>
        `;

        sectionHead.querySelector('.tab-proj').addEventListener('click', () => {
            this.currentTab = 'projects';
            this.clientProjectGuid = '';
            this.render(panel);
        });
        sectionHead.querySelector('.tab-cli').addEventListener('click', () => {
            this.currentTab = 'clients';
            this.render(panel);
        });
        sectionHead.querySelector('.tab-inv').addEventListener('click', () => {
            this.currentTab = 'invoices';
            this.render(panel);
        });
        this.enableTablistKeyboardNav(sectionHead.querySelector('.os-tabs'));
        sectionHead.querySelector('.os-view-all').addEventListener('click', () => {
            let col = this.collectionGuid('Projects');
            if (this.currentTab === 'clients') col = this.collectionGuid('Clients');
            else if (this.currentTab === 'invoices') col = this.collectionGuid('Invoices');
            this.openCollection(col, panel, this.currentTab === 'invoices' ? this.invoiceFilter : this.currentTab === 'clients' ? this.clientFilter : 'all');
        });
        sectionHead.querySelector('.os-client-board-link')?.addEventListener('click', () => this.openCollection(this.collectionGuid('Clients'), panel, 'status'));

        const searchInput = sectionHead.querySelector('.os-search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            this.renderCards(cardsContainer, data, panel);
        });

        main.appendChild(sectionHead);

        if (this.currentTab === 'projects' && this.clientProjectGuid) {
            const client = data.clients.find(item => item.guid === this.clientProjectGuid);
            const context = document.createElement('div');
            context.className = 'os-client-project-filter';
            context.innerHTML = `<span>Projects for <strong>${escapeHtml(client?.name || 'this client')}</strong></span><button type="button" class="os-card-open">Show all projects</button>`;
            context.querySelector('button').onclick = () => { this.clientProjectGuid = ''; this.render(panel); };
            main.appendChild(context);
        }

        // Project filter pills (if on projects tab)
        if (this.currentTab === 'clients') {
            const filterBar = document.createElement('div'); filterBar.className = 'os-filter-pills';
            filterBar.setAttribute('role', 'toolbar');
            filterBar.setAttribute('aria-label', 'Filter clients and leads');
            for (const [key, label] of [['all', 'All'], ['active', 'Clients'], ['leads', 'Leads'], ['archived', 'Archived']]) {
                const button = document.createElement('button'); button.type = 'button';
                button.className = `os-filter-pill ${this.clientFilter === key ? 'active' : ''}`;
                button.setAttribute('aria-pressed', String(this.clientFilter === key));
                button.textContent = `${label} (${data.clients.filter(client => clientMatches(client, key)).length})`;
                button.onclick = () => { this.clientFilter = key; this.render(panel); };
                filterBar.appendChild(button);
            }
            main.appendChild(filterBar);
            if (this.clientFilter === 'leads' && data.pipelineValueCHF > 0) {
                const pipelineBanner = document.createElement('div');
                pipelineBanner.className = 'os-lead-pipeline-banner';
                pipelineBanner.innerHTML = `<span>Estimated pipeline: <strong>${money(data.pipelineValueCHF)} ${escapeHtml(baseCurrency)}</strong></span><span>${data.clients.filter(c => isLeadClient(c) && c.status !== 'archived').length} active proposals & leads</span>`;
                main.appendChild(pipelineBanner);
            }
        }
        if (this.currentTab === 'invoices') {
            const filters = [['all', 'All'], ['outstanding', 'Outstanding'], ['overdue', 'Overdue'], ['review', 'To confirm'], ['to-send', 'To send'], ['paid', 'Paid']];
            const filterBar = document.createElement('div');
            filterBar.className = 'os-filter-pills';
            filterBar.setAttribute('role', 'toolbar');
            filterBar.setAttribute('aria-label', 'Filter invoices');
            for (const [key, label] of filters) {
                const button = document.createElement('button');
                button.className = `os-filter-pill ${this.invoiceFilter === key ? 'active' : ''}`;
                button.setAttribute('aria-pressed', String(this.invoiceFilter === key));
                button.textContent = `${label} (${data.invoices.filter(i => invoiceMatches(i, key)).length})`;
                button.onclick = () => { this.invoiceFilter = key; this.render(panel); };
                filterBar.appendChild(button);
            }
            main.appendChild(filterBar);
        }
        if (this.currentTab === 'projects') {
            const scopedProjects = this.clientProjectGuid ? data.projects.filter(p => p.clientGuid === this.clientProjectGuid) : data.projects;
            const inProgCount = scopedProjects.filter(p => p.status === 'in_progress').length;
            const backlogCount = scopedProjects.filter(p => p.status === 'backlog').length;
            const completedCount = scopedProjects.filter(p => p.status === 'completed').length;

            const filterBar = document.createElement('div');
            filterBar.className = 'os-filter-pills';
            filterBar.setAttribute('role', 'toolbar');
            filterBar.setAttribute('aria-label', 'Filter projects');
            filterBar.innerHTML = `
                <button type="button" class="os-filter-pill ${this.projectFilter === 'all' ? 'active' : ''} pill-all" aria-pressed="${this.projectFilter === 'all'}">All (${scopedProjects.length})</button>
                <button type="button" class="os-filter-pill ${this.projectFilter === 'in_progress' ? 'active' : ''} pill-prog" aria-pressed="${this.projectFilter === 'in_progress'}">In Progress (${inProgCount})</button>
                <button type="button" class="os-filter-pill ${this.projectFilter === 'backlog' ? 'active' : ''} pill-back" aria-pressed="${this.projectFilter === 'backlog'}">Backlog (${backlogCount})</button>
                <button type="button" class="os-filter-pill ${this.projectFilter === 'completed' ? 'active' : ''} pill-comp" aria-pressed="${this.projectFilter === 'completed'}">Completed (${completedCount})</button>
            `;

            filterBar.querySelector('.pill-all').addEventListener('click', () => { this.projectFilter = 'all'; this.render(panel); });
            filterBar.querySelector('.pill-prog').addEventListener('click', () => { this.projectFilter = 'in_progress'; this.render(panel); });
            filterBar.querySelector('.pill-back').addEventListener('click', () => { this.projectFilter = 'backlog'; this.render(panel); });
            filterBar.querySelector('.pill-comp').addEventListener('click', () => { this.projectFilter = 'completed'; this.render(panel); });
            main.appendChild(filterBar);
        }

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'os-cards';
        this.renderCards(cardsContainer, data, panel);
        main.appendChild(cardsContainer);
        grid.appendChild(main);

        // Column 3: Agenda
        const agenda = document.createElement('aside');
        agenda.className = 'os-agenda';

        const todayTasks = data.agendaTasks.filter(t => t.category === 'today');
        const overdueTasks = data.agendaTasks.filter(t => t.category === 'overdue');
        const upcomingTasks = data.agendaTasks.filter(t => t.category === 'upcoming');
        const inboxTasks = data.agendaTasks.filter(t => t.category === 'inbox');
        const taskCoverage = data.taskCoverage || { complete: true };
        const agendaIncomplete = !taskCoverage.complete;
        const agendaCount = count => agendaIncomplete ? `${count} loaded` : String(count);

        if (!this.agendaTabSetByUser) {
            if (todayTasks.length > 0) this.agendaTab = 'today';
            else if (overdueTasks.length > 0) this.agendaTab = 'overdue';
            else if (upcomingTasks.length > 0) this.agendaTab = 'upcoming';
            else this.agendaTab = 'inbox';
        }

        let shownTasks = [];
        if (this.agendaTab === 'today') shownTasks = todayTasks;
        else if (this.agendaTab === 'overdue') shownTasks = overdueTasks;
        else if (this.agendaTab === 'upcoming') shownTasks = upcomingTasks;
        else shownTasks = inboxTasks;
        const agendaLimit = this.agendaLimit || 25;

        agenda.innerHTML = `
            <div class="os-agenda-header">
                <h2>Agenda & Tasks</h2>
                <button type="button" class="os-view-all">All tasks ↗</button>
            </div>
            <div class="os-agenda-tabs" role="tablist" aria-label="Task filters">
                <button type="button" role="tab" aria-selected="${this.agendaTab === 'today' ? 'true' : 'false'}" class="os-agenda-tab ${this.agendaTab === 'today' ? 'active' : ''} tab-today">Today (${agendaCount(todayTasks.length)})</button>
                <button type="button" role="tab" aria-selected="${this.agendaTab === 'overdue' ? 'true' : 'false'}" class="os-agenda-tab ${this.agendaTab === 'overdue' ? 'active' : ''} tab-overdue">Overdue (${agendaCount(overdueTasks.length)})</button>
                <button type="button" role="tab" aria-selected="${this.agendaTab === 'upcoming' ? 'true' : 'false'}" class="os-agenda-tab ${this.agendaTab === 'upcoming' ? 'active' : ''} tab-upcoming">Next 7d (${agendaCount(upcomingTasks.length)})</button>
                <button type="button" role="tab" aria-selected="${this.agendaTab === 'inbox' ? 'true' : 'false'}" class="os-agenda-tab ${this.agendaTab === 'inbox' ? 'active' : ''} tab-inbox">Inbox (${agendaCount(inboxTasks.length)})</button>
            </div>
            ${agendaIncomplete ? '<p class="os-agenda-note" role="status">Task counts show loaded results only; more may exist.</p>' : ''}
            <div class="os-agenda-content"></div>
            <div class="os-agenda-footer">
                <button type="button" class="link-capture">+ Capture Task</button>
                <button type="button" class="link-notes">View Journal ↗</button>
            </div>
        `;

        agenda.querySelector('.os-view-all').addEventListener('click', () => {
            this.openCollection(this.collectionGuid('Projects'), panel);
        });

        const agendaContent = agenda.querySelector('.os-agenda-content');
        if (shownTasks.length === 0) {
            agendaContent.innerHTML = agendaIncomplete ? `
                <div class="os-empty-state">
                    <div class="os-empty-icon">…</div>
                    <div class="os-empty-title">No loaded tasks in this section</div>
                    <div class="os-empty-desc">Task data is incomplete; more tasks may exist. Refresh to retry.</div>
                </div>
            ` : `
                <div class="os-empty-state">
                    <div class="os-empty-icon">✓</div>
                    <div class="os-empty-title">All caught up!</div>
                    <div class="os-empty-desc">No tasks in this section. Use quick capture above to add new tasks.</div>
                    <button type="button" class="os-button os-agenda-empty-capture" style="margin-top: 10px;">+ Capture task</button>
                </div>
            `;
            agendaContent.querySelector('.os-agenda-empty-capture')?.addEventListener('click', () => {
                captureInput.focus();
            });
        } else {
            for (const t of shownTasks.slice(0, agendaLimit)) {
                const item = document.createElement('div');
                item.className = `os-task-item${t.waiting ? ' os-task-waiting' : ''}`;
                item.setAttribute('role', 'button');
                item.setAttribute('tabindex', '0');
                item.setAttribute('aria-label', `Open task: ${t.text}`);
                const canSuggest = t.category === 'inbox' && t.projectCandidates?.length && !this.dismissedProjectSuggestions.has(t.guid);
                item.innerHTML = `
                    <input type="checkbox" class="os-task-checkbox" aria-label="Mark task done: ${escapeHtml(t.text)}" />
                    <div class="os-task-content">
                        <span class="os-task-label" title="${escapeHtml(t.text)}">${escapeHtml(t.text)}</span>
                        ${(t.projectName || t.waiting || t.important || t.date || canSuggest) ? `
                            <div class="os-task-meta">
                                ${t.projectName ? `<span class="os-task-project" title="Linked project">📁 ${escapeHtml(t.projectName)}</span>` : ''}
                                ${t.waiting ? '<span class="os-task-state">Waiting</span>' : ''}
                                ${t.important ? '<span class="os-task-state">Important</span>' : ''}
                                ${t.date ? `<span class="os-task-date">📅 ${t.date}</span>` : ''}
                                ${canSuggest ? '<button type="button" class="os-suggest-project" aria-expanded="false">Link project</button>' : ''}
                            </div>
                        ` : ''}
                    </div>
                `;

                const chk = item.querySelector('.os-task-checkbox');
                chk.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    chk.disabled = true;
                    try {
                        if (typeof t.lineItem?.setTaskStatus !== 'function') throw new Error('Task state cannot be changed here');
                        const saved = await t.lineItem.setTaskStatus('done');
                        if (saved === false) throw new Error('Task state was not saved');
                        item.style.opacity = '0.35';
                        item.querySelector('.os-task-label').style.textDecoration = 'line-through';
                        this.ui.addToaster({ title: 'Task completed', autoDestroyTime: 2000, dismissible: true });
                    } catch (err) {
                        // The row was not changed optimistically, so it recovers by re-enabling the checkbox.
                        chk.checked = false;
                        chk.disabled = false;
                        this.ui.addToaster({ title: 'Task could not be completed. Try again.', autoDestroyTime: 3000, dismissible: true });
                        console.error('Task done error:', err);
                    }
                    this.scheduleRefresh();
                });

                item.addEventListener('click', () => {
                    this.openItem(t.guid, t.recordGuid, panel);
                });

                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        if (e.target === item) {
                            e.preventDefault();
                            this.openItem(t.guid, t.recordGuid, panel);
                        }
                    }
                });

                item.querySelector('.os-suggest-project')?.addEventListener('click', event => {
                    event.stopPropagation();
                    this.showProjectSuggestions(t, item, panel);
                });

                agendaContent.appendChild(item);
            }
            if (shownTasks.length > agendaLimit) {
                const more = document.createElement('button');
                more.className = 'os-button os-agenda-more';
                more.textContent = `Show more (${shownTasks.length - agendaLimit} loaded remaining)`;
                more.onclick = () => { this.agendaLimit = agendaLimit + 25; this.render(panel); };
                agendaContent.appendChild(more);
            }
        }

        agenda.querySelector('.tab-today').addEventListener('click', () => { this.agendaTab = 'today'; this.agendaTabSetByUser = true; this.agendaLimit = 25; this.render(panel); });
        agenda.querySelector('.tab-overdue').addEventListener('click', () => { this.agendaTab = 'overdue'; this.agendaTabSetByUser = true; this.agendaLimit = 25; this.render(panel); });
        agenda.querySelector('.tab-upcoming').addEventListener('click', () => { this.agendaTab = 'upcoming'; this.agendaTabSetByUser = true; this.agendaLimit = 25; this.render(panel); });
        agenda.querySelector('.tab-inbox').addEventListener('click', () => { this.agendaTab = 'inbox'; this.agendaTabSetByUser = true; this.agendaLimit = 25; this.render(panel); });
        this.enableTablistKeyboardNav(agenda.querySelector('.os-agenda-tabs'));
        agenda.querySelector('.link-capture').addEventListener('click', () => captureInput.focus());
        agenda.querySelector('.link-notes').addEventListener('click', () => this.openJournal(panel));

        grid.appendChild(agenda);
        app.appendChild(grid);

        container.innerHTML = '';
        const viewport = document.createElement('div');
        viewport.className = 'os-app';
        viewport.appendChild(app);
        container.appendChild(viewport);
    }

    renderCards(cardsContainer, data, panel) {
        cardsContainer.innerHTML = '';
        const q = (this.searchQuery || '').toLowerCase();
        const baseCurrency = typeof this.getBaseCurrency === 'function' ? this.getBaseCurrency() : (data?.baseCurrency || this.workflowState?.baseCurrency || 'CHF');

        if (this.currentTab === 'projects') {
            let list = data.projects;
            if (this.clientProjectGuid) list = list.filter(p => p.clientGuid === this.clientProjectGuid);
            if (this.projectFilter !== 'all') {
                list = list.filter(p => p.status === this.projectFilter);
            }
            if (q) {
                list = list.filter(p => p.name.toLowerCase().includes(q) || (p.clientName && p.clientName.toLowerCase().includes(q)));
            }

            if (list.length === 0) {
                const isFiltered = !!q || this.projectFilter !== 'all';
                const empty = document.createElement('div');
                empty.className = 'os-empty-placeholder';
                if (isFiltered) {
                    empty.innerHTML = `
                        <div class="os-empty-title">No matching projects</div>
                        <p>${q ? `No projects match "${escapeHtml(q)}".` : 'No projects in this status filter.'}</p>
                        <button type="button" class="os-button">Clear filter</button>
                    `;
                    empty.querySelector('button').onclick = () => {
                        this.searchQuery = '';
                        this.projectFilter = 'all';
                        this.render(panel);
                    };
                } else {
                    empty.innerHTML = `
                        <div class="os-empty-icon" style="font-size: 26px; margin-bottom: 2px;">📁</div>
                        <div class="os-empty-title">No projects yet</div>
                        <p>Track your deliverables, milestones, and client tasks in one place.</p>
                        <button type="button" class="os-button os-primary">Create your first project</button>
                    `;
                    empty.querySelector('button').onclick = () => this.showCreateProjectModal(panel, data);
                }
                cardsContainer.appendChild(empty);
                return;
            }

            for (const proj of list.slice(0, 30)) {
                const card = document.createElement('div');
                card.className = 'os-project-card';
                const statusLabel = projectStatusLabel(proj.status);
                const hasDeliverables = proj.deliverables && proj.deliverables.length > 0;
                const isExpanded = this.expandedProjects && this.expandedProjects.has(proj.guid);
                const workflowState = this.loadWorkflowState();
                const nextGuid = workflowState.next[proj.guid];
                const nextLabel = workflowState.nextLabels[proj.guid];
                const activeProject = isActiveProject(proj);

                card.innerHTML = `
                    <div class="os-card-top">
                        <button type="button" class="os-badge status-${escapeHtml(proj.status)}" title="Change project status">${statusLabel}</button>
                        ${proj.priority === 'high' ? '<span class="os-badge priority-high">High</span>' : ''}
                    </div>
                    <button type="button" class="os-card-title">${escapeHtml(proj.name)}</button>
                    ${proj.clientName ? `<button type="button" class="os-card-client os-card-client-link" title="Open client profile">${escapeHtml(proj.clientName)}</button>` : '<div class="os-card-client">Internal / no client linked</div>'}
                    ${proj.budget > 0 || (proj.totalBilledCHF && proj.totalBilledCHF > 0) ? `
                        <div class="os-project-financials">
                            <span class="os-project-fee-type">${proj.feeType ? escapeHtml(proj.feeType.replace('_', ' ')) : 'fixed'}</span>
                            <span class="os-project-budget-label">
                                ${proj.budget > 0 ? `Billed ${money(proj.totalBilledCHF || 0)} / <strong>${money(proj.budget)} ${escapeHtml(baseCurrency)}</strong> (${Math.round(((proj.totalBilledCHF || 0) / proj.budget) * 100)}%)` : `Billed <strong>${money(proj.totalBilledCHF || 0)} ${escapeHtml(baseCurrency)}</strong>`}
                            </span>
                        </div>
                    ` : ''}
                    ${activeProject ? `<button type="button" class="os-project-next-link" aria-label="Open actions for ${escapeHtml(proj.name)}">${nextGuid ? `<span class="os-project-next-label">Next action</span>${nextLabel ? ` · ${escapeHtml(nextLabel)}` : ' · Selected in Today'}` : 'Choose a next action →'}</button>` : ''}

                    ${hasDeliverables ? `
                        <div class="os-card-deliverables-summary">
                            <span class="os-deliverables-count" title="${proj.deliverables.length} sub-pages & deliverables">
                                📂 ${proj.deliverables.length} deliverables
                            </span>
                            <button class="os-toggle-deliverables" type="button">
                                ${isExpanded ? 'Hide ▲' : 'Show ▼'}
                            </button>
                        </div>
                        ${isExpanded ? `
                            <div class="os-deliverables-list">
                                ${proj.deliverables.map(d => `
                                    <button type="button" class="os-deliverable-item" data-guid="${d.guid}" title="${escapeHtml(d.name)}">
                                        <span class="os-deliverable-arrow">↳</span>
                                        <span class="os-deliverable-name">${escapeHtml(d.name)}</span>
                                        <span class="os-deliverable-open">↗</span>
                                    </button>
                                `).join('')}
                            </div>
                        ` : ''}
                    ` : ''}

                    <div class="os-card-bottom">
                        <span>📅 ${(!proj.deadline || typeof proj.deadline === 'object' || String(proj.deadline).includes('Object')) ? 'No deadline' : escapeHtml(proj.deadline)}</span>
                        <div class="os-card-actions">
                            <button type="button" class="os-card-action-btn os-project-invoice" title="Create an invoice for this project">+ Invoice</button>
                            <button type="button" class="os-card-action-btn os-project-support" title="Log support time for this project">+ Time</button>
                            <button type="button" class="os-card-open os-open-project">Open ↗</button>
                        </div>
                    </div>
                `;

                // Quick status toggle
                card.querySelector('button.os-badge')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const nextStatus = proj.status === 'in_progress' ? 'completed' : (proj.status === 'completed' ? 'backlog' : 'in_progress');
                    try {
                        if (!proj.record?.prop('status')?.setChoice(nextStatus)) throw new Error('Project status could not be saved');
                        this.ui.addToaster({ title: `Status: ${nextStatus}`, autoDestroyTime: 2000, dismissible: true });
                        this.scheduleRefresh();
                    } catch (err) {
                        this.ui.addToaster({ title: err.message || 'Project status could not be saved', dismissible: true });
                    }
                });

                // Toggle deliverables expander
                if (hasDeliverables) {
                    const toggleBtn = card.querySelector('.os-toggle-deliverables');
                    if (toggleBtn) {
                        toggleBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (this.expandedProjects.has(proj.guid)) {
                                this.expandedProjects.delete(proj.guid);
                            } else {
                                this.expandedProjects.add(proj.guid);
                            }
                            this.render(panel);
                        });
                    }

                    // Click deliverable item
                    card.querySelectorAll('.os-deliverable-item').forEach(el => {
                        el.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const g = el.getAttribute('data-guid');
                            if (g) this.openRecord(g, panel);
                        });
                    });
                }

                card.querySelector('.os-card-title').addEventListener('click', () => this.openRecord(proj.guid, panel));
                card.querySelector('.os-card-client-link')?.addEventListener('click', () => this.openRecord(proj.clientGuid, panel));
                card.querySelector('.os-project-next-link')?.addEventListener('click', event => {
                    event.stopPropagation();
                    this.workflowMode = 'today'; this.workflowMessage = '';
                    this.actionQueueTab = nextGuid ? 'next' : 'attention';
                    this.actionProject = proj.guid; this.actionSearch = ''; this.queueLimit = 20;
                    this.render(panel);
                });
                card.querySelector('.os-project-invoice')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showCreateInvoiceModal(panel, data, proj.clientGuid, proj.guid);
                });
                card.querySelector('.os-project-support')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showCreateSupportSessionModal(panel, data, proj.clientGuid, proj.guid);
                });
                card.querySelector('.os-open-project')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openRecord(proj.guid, panel);
                });

                cardsContainer.appendChild(card);
            }
        } else if (this.currentTab === 'clients') {
            let list = data.clients.filter(client => clientMatches(client, this.clientFilter));
            if (q) {
                list = list.filter(client => clientSearchText(client).includes(q));
            }

            if (list.length === 0) {
                const isFiltered = !!q;
                const empty = document.createElement('div');
                empty.className = 'os-empty-placeholder';
                if (isFiltered) {
                    empty.innerHTML = `
                        <div class="os-empty-title">No matching clients</div>
                        <p>No clients or leads match "${escapeHtml(q)}".</p>
                        <button type="button" class="os-button">Clear search</button>
                    `;
                    empty.querySelector('button').onclick = () => {
                        this.searchQuery = '';
                        this.render(panel);
                    };
                } else {
                    const title = this.clientFilter === 'leads' ? 'No leads yet' : this.clientFilter === 'archived' ? 'No archived clients' : 'No clients yet';
                    const desc = this.clientFilter === 'leads' ? 'Add a prospect to start tracking proposals, estimated values, and conversion milestones.' : this.clientFilter === 'archived' ? 'No archived clients or past relationships in this workspace.' : 'Add your clients to track active contracts, care plans, and contact details.';
                    empty.innerHTML = `
                        <div class="os-empty-icon" style="font-size: 26px; margin-bottom: 2px;">👥</div>
                        <div class="os-empty-title">${title}</div>
                        <p>${desc}</p>
                        ${this.clientFilter !== 'archived' ? `<button type="button" class="os-button os-primary">${this.clientFilter === 'leads' ? 'Add your first lead' : 'Add your first client'}</button>` : ''}
                    `;
                    if (this.clientFilter !== 'archived') {
                        empty.querySelector('button').onclick = () => this.showCreateClientModal(panel, null, this.clientFilter === 'leads' ? 'prospect' : 'active');
                    }
                }
                cardsContainer.appendChild(empty);
                return;
            }

            for (const cli of list) {
                const lead = isLeadClient(cli);
                const currentStatus = clientStatus(cli);
                const card = document.createElement('div');
                card.className = 'os-project-card';
                card.innerHTML = `
                    <div class="os-card-top">
                        <select class="os-client-status" aria-label="Status for ${escapeHtml(cli.name)}">${!CLIENT_STATUSES[currentStatus] ? `<option value="${escapeHtml(currentStatus)}" selected>${escapeHtml(currentStatus || 'Status not set')}</option>` : ''}${Object.entries(CLIENT_STATUSES).map(([key, label]) => `<option value="${key}" ${currentStatus === key ? 'selected' : ''}>${label}</option>`).join('')}</select>
                        ${cli.mrr > 0 && isRevenueClient(cli) && currentStatus !== 'maintenance' ? '<span class="os-client-plan-label">Care plan</span>' : ''}
                    </div>
                    <button type="button" class="os-card-title">${escapeHtml(cli.name)}</button>
                    ${cli.planValue || cli.mrr > 0 ? `<div class="os-card-client">${escapeHtml([cli.planValue, cli.mrr > 0 ? `${isRevenueClient(cli) ? '' : 'Proposed · '}${money(cli.mrr)} ${escapeHtml(baseCurrency)} / mo` : ''].filter(Boolean).join(' · '))}</div>` : ''}
                    <div class="os-client-contact">
                        ${cli.contact ? `<span class="os-client-contact-name">${escapeHtml(cli.contact)}</span>` : ''}
                        ${cli.email ? `<a href="mailto:${encodeURIComponent(cli.email)}">${escapeHtml(cli.email)}</a>` : ''}
                        ${cli.phone ? `<span>${escapeHtml(cli.phone)}</span>` : ''}
                        ${!cli.contact && !cli.email && !cli.phone ? '<span class="os-client-contact-empty">No contact details yet</span>' : ''}
                    </div>
                    <div class="os-client-meta">
                        <button type="button" class="os-meta-tag os-client-projects" aria-label="View ${cli.projectCount} projects for ${escapeHtml(cli.name)}">${cli.projectCount} projects · ${cli.summary.activeProjects} active</button>
                        <span class="os-meta-tag">🧾 ${cli.invoiceCount || 0} invoices</span>
                    </div>
                    ${lead ? `<dl class="os-client-value">
                        <div><dt>Estimated deal</dt><dd>${cli.estimatedValue ? `${money(cli.estimatedValue)} ${escapeHtml(baseCurrency)}` : 'Not set'}</dd></div>
                        <div><dt>Source</dt><dd>${cli.source ? escapeHtml(cli.source) : 'Not set'}</dd></div>
                    </dl>` : `<dl class="os-client-value">
                        <div><dt>Collected · all time</dt><dd>${money(cli.summary.collected)} ${escapeHtml(baseCurrency)}</dd></div>
                        <div><dt>Outstanding</dt><dd>${money(cli.summary.outstanding)} ${escapeHtml(baseCurrency)}${cli.summary.overdueCount ? ` · ${cli.summary.overdueCount} overdue` : ''}</dd></div>
                    </dl>`}
                    <div class="os-card-bottom">
                        <div class="os-card-actions">
                            <button type="button" class="os-card-action-btn os-add-project" title="Create a new project for ${escapeHtml(cli.name)}">+ Project</button>
                            <button type="button" class="os-card-action-btn os-add-invoice" title="Create a new invoice for ${escapeHtml(cli.name)}">+ Invoice</button>
                            <button type="button" class="os-card-open os-edit-client">Edit</button>
                        </div>
                        <button type="button" class="os-card-open os-open-profile">Profile ↗</button>
                    </div>
                `;

                card.querySelector('.os-card-title').addEventListener('click', () => this.openRecord(cli.guid, panel));
                card.querySelector('.os-client-projects').addEventListener('click', () => {
                    this.clientProjectGuid = cli.guid; this.currentTab = 'projects'; this.projectFilter = 'all'; this.searchQuery = ''; this.render(panel);
                });
                card.querySelector('.os-add-project').onclick = (e) => {
                    e.stopPropagation();
                    this.showCreateProjectModal(panel, data, cli.guid);
                };
                card.querySelector('.os-add-invoice').onclick = (e) => {
                    e.stopPropagation();
                    this.showCreateInvoiceModal(panel, data, cli.guid);
                };
                card.querySelector('.os-edit-client').onclick = () => this.showCreateClientModal(panel, cli);
                card.querySelector('.os-client-status')?.addEventListener('change', async event => {
                    const select = event.target; select.disabled = true;
                    try { await this.updateClientDetails(cli, { status: select.value }); cli.status = select.value; }
                    catch (error) { select.value = currentStatus; this.ui.addToaster({ title: error.message || 'The status could not be saved.', dismissible: true }); }
                    finally { select.disabled = false; }
                });
                card.querySelector('.os-open-profile').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openRecord(cli.guid, panel);
                });

                cardsContainer.appendChild(card);
            }
        } else if (this.currentTab === 'invoices') {
            let list = data.invoices.filter(i => invoiceMatches(i, this.invoiceFilter));
            if (q) {
                list = list.filter(i => i.name.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q));
            }

            if (list.length === 0) {
                const isFiltered = !!q || this.invoiceFilter !== 'all';
                const empty = document.createElement('div');
                empty.className = 'os-empty-placeholder';
                if (isFiltered) {
                    empty.innerHTML = `
                        <div class="os-empty-title">No matching invoices</div>
                        <p>${q ? `No invoices match "${escapeHtml(q)}".` : 'No invoices in this status filter.'}</p>
                        <button type="button" class="os-button">Clear filter</button>
                    `;
                    empty.querySelector('button').onclick = () => {
                        this.searchQuery = '';
                        this.invoiceFilter = 'all';
                        this.render(panel);
                    };
                } else {
                    empty.innerHTML = `
                        <div class="os-empty-icon" style="font-size: 26px; margin-bottom: 2px;">🧾</div>
                        <div class="os-empty-title">No invoices yet</div>
                        <p>Issue invoices with payment tracking, overdue reminders, and Swiss QR-bill integration.</p>
                        <button type="button" class="os-button os-primary">Create your first invoice</button>
                    `;
                    empty.querySelector('button').onclick = () => this.showCreateInvoiceModal(panel, data);
                }
                cardsContainer.appendChild(empty);
                return;
            }

            for (const inv of list) {
                const card = document.createElement('div');
                card.className = 'os-project-card os-invoice-card';
                card.innerHTML = `
                    <div class="os-card-top">
                        <span class="os-badge status-${escapeHtml(inv.status)}">${escapeHtml(inv.status.toUpperCase())}</span>
                        <span class="os-invoice-timing ${inv.daysOverdue ? 'os-cash-warning' : ''}">${inv.daysOverdue ? `${inv.daysOverdue}d overdue` : escapeHtml(inv.stage)}</span>
                    </div>
                    <button type="button" class="os-card-title">${escapeHtml(inv.name)}</button>
                    ${inv.clientName ? `<div class="os-card-client">${escapeHtml(inv.clientName)}</div>` : ''}
                    <div class="os-card-bottom">
                        <span>${money(inv.amount)} ${escapeHtml(inv.currency)} · ${inv.dueDate || 'No due date'}</span>
                        <button type="button" class="os-card-open">Open invoice ↗</button>
                    </div>
                `;

                card.querySelector('.os-card-title').addEventListener('click', () => this.openRecord(inv.guid, panel));
                card.querySelector('.os-card-open').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openRecord(inv.guid, panel);
                });

                cardsContainer.appendChild(card);
            }
        }
    }
}
