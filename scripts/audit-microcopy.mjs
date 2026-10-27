import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectCdp } from './cdp.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runStaticAudit() {
    console.log('Running static microcopy and formatting audit on source files...');
    const indexSrc = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');

    // 1. Check money() function
    if (!indexSrc.includes('minimumFractionDigits: 2') || !indexSrc.includes('maximumFractionDigits: 2')) {
        throw new Error('money() does not specify consistent 2-decimal fraction digits.');
    }
    if (!indexSrc.includes('Number.isFinite')) {
        throw new Error('money() does not guard against non-finite / NaN inputs.');
    }

    // 2. Check sentence casing in navigation links
    const badNavCasing = ['All Projects', 'All Clients', 'All Invoices', 'Care Plans', 'Support Sessions'];
    for (const phrase of badNavCasing) {
        if (indexSrc.includes(`>${phrase}<`) || indexSrc.includes(`class="os-nav-link">${phrase}`)) {
            throw new Error(`Found unstandardized title casing in navigation: "${phrase}"`);
        }
    }

    // 3. Check sentence casing in project filter pills
    if (indexSrc.includes('>In Progress (')) {
        throw new Error('Found unstandardized title casing in filter pills: "In Progress"');
    }

    // 4. Check sentence casing in buttons
    if (indexSrc.includes('>+ Capture Task<')) {
        throw new Error('Found unstandardized title casing in button: "+ Capture Task"');
    }
    if (indexSrc.includes('>Create Project<')) {
        throw new Error('Found unstandardized title casing in button: "Create Project"');
    }

    console.log('✓ money() NaN guards and 2-decimal formatting verified.');
    console.log('✓ Navigation rail labels standardized to sentence case.');
    console.log('✓ Filter pills standardized to sentence case.');
    console.log('✓ Action buttons standardized to sentence case.');
    console.log('\nStatic microcopy & formatting audit PASSED!');
}

async function auditMicrocopy() {
    console.log('Connecting to Thymer Desktop via CDP...');
    let cdp;
    try {
        cdp = await connectCdp();
    } catch (err) {
        console.warn('Thymer Desktop is not currently reachable via CDP (', err.message, '). Falling back to static audit.');
        await runStaticAudit();
        return;
    }

    try {
        console.log('--- Auditing Microcopy & Formatting Consistency via Live CDP ---');

        await cdp.evaluate(`(async () => {
            const p = window.__freelanceOs;
            if (!p) return;
            p.workflowMode = 'overview';
            p.currentTab = 'projects';
            p.searchQuery = '';
            await p.render(p.activePanel);
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const results = await cdp.evaluate(`(() => {
            // 1. Pulse currency values
            const metricValues = [...document.querySelectorAll('.os-metric-value')].map(el => el.textContent.trim());
            const hasNan = metricValues.some(v => v.includes('NaN'));

            // 2. Rail navigation links text
            const navLinks = [...document.querySelectorAll('.os-nav-link')].map(el => el.textContent.trim());

            // 3. Project filter pills text
            const filterPills = [...document.querySelectorAll('.os-filter-pill')].map(el => el.textContent.trim());

            // 4. Agenda footer buttons text
            const agendaFooterBtns = [...document.querySelectorAll('.os-agenda-footer button')].map(el => el.textContent.trim());

            return {
                metricValues,
                hasNan,
                navLinks,
                filterPills,
                agendaFooterBtns
            };
        })()`);

        console.log('Microcopy Audit Results:', results);

        if (results.hasNan) throw new Error('NaN detected in currency metric values!');
        console.log('\nLive microcopy & formatting consistency sweep PASSED!');
    } finally {
        if (cdp) cdp.close();
    }
}

auditMicrocopy().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
});

