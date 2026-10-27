import { connectCdp } from './cdp.mjs';

async function runA11yAudit() {
    const cdp = await connectCdp();
    console.log('Starting comprehensive accessibility sweep across Freelance OS in Thymer...');

    const tabsToAudit = ['overview', 'today', 'billing', 'ai', 'settings'];
    const report = [];

    for (const tab of tabsToAudit) {
        console.log(`\nAuditing Tab: ${tab}...`);
        await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            if (p) {
                p.workflowMode = '${tab}';
                p.render(p.activePanel);
            }
        })()`);
        await new Promise(r => setTimeout(r, 600));

        const tabFindings = await cdp.evaluate(`(() => {
            const issues = [];
            const app = document.querySelector('.os-app');
            if (!app) return [{ type: 'FATAL', msg: 'No .os-app found' }];

            // 1. Check clickable non-interactive elements that are NOT inside a valid interactive ancestor
            const allElements = app.querySelectorAll('*');
            allElements.forEach(el => {
                const style = window.getComputedStyle(el);
                const isClickableByStyle = style.cursor === 'pointer';
                const tag = el.tagName.toLowerCase();
                const isNativeInteractive = ['button', 'a', 'input', 'select', 'textarea', 'summary', 'label'].includes(tag);

                // If element has cursor: pointer and is NOT a button/a and NOT inside a button/a/[role]
                if (isClickableByStyle && !isNativeInteractive) {
                    const role = el.getAttribute('role');
                    const hasAccessibleRole = role && ['button', 'link', 'tab', 'menuitem', 'checkbox', 'switch'].includes(role);
                    const interactiveAncestor = el.parentElement?.closest('button, a, summary, label, [role="button"], [role="link"], [role="tab"]');

                    if (!hasAccessibleRole && !interactiveAncestor) {
                        const tabIndex = el.getAttribute('tabindex');
                        const isKeyboardFocusable = tabIndex !== null && parseInt(tabIndex, 10) >= 0;

                        issues.push({
                            type: 'NON_INTERACTIVE_CLICKABLE',
                            tag: tag,
                            cls: el.className,
                            text: el.textContent?.trim().slice(0, 30),
                            msg: \`<\${tag} class="\${el.className}"> text="\${el.textContent?.trim().slice(0, 25)}" has pointer cursor but lacks role="button" or tabindex\`
                        });
                    }
                }
            });

            // 2. Check interactive elements missing accessible names
            const interactiveEls = app.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"]');
            interactiveEls.forEach(el => {
                const tag = el.tagName.toLowerCase();
                const ariaLabel = el.getAttribute('aria-label');
                const ariaLabelledby = el.getAttribute('aria-labelledby');
                const title = el.getAttribute('title');
                const text = el.textContent?.trim();
                const placeholder = el.getAttribute('placeholder');
                const value = el.value;

                let accessibleName = ariaLabel || '';
                if (!accessibleName && ariaLabelledby) {
                    const ref = document.getElementById(ariaLabelledby);
                    if (ref) accessibleName = ref.textContent?.trim();
                }
                if (!accessibleName && (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'tab')) {
                    accessibleName = text || title;
                }
                if (!accessibleName && tag === 'input') {
                    const type = el.getAttribute('type') || 'text';
                    if (['submit', 'button'].includes(type)) accessibleName = value;
                    else accessibleName = el.labels?.[0]?.textContent?.trim() || placeholder || title;
                }
                if (!accessibleName && tag === 'select') {
                    accessibleName = el.labels?.[0]?.textContent?.trim() || title;
                }

                if (!accessibleName || accessibleName.length === 0) {
                    issues.push({
                        type: 'MISSING_ACCESSIBLE_NAME',
                        tag: tag,
                        cls: el.className,
                        text: text?.slice(0, 30),
                        msg: \`<\${tag} class="\${el.className}"> has no accessible name (aria-label, text, or title)\`
                    });
                }
            });

            // 3. Form controls without labels
            const inputs = app.querySelectorAll('input:not([type="hidden"]), select, textarea');
            inputs.forEach(input => {
                const hasLabel = input.labels && input.labels.length > 0;
                const hasAriaLabel = !!input.getAttribute('aria-label');
                const hasAriaLabelledBy = !!input.getAttribute('aria-labelledby');
                const hasTitle = !!input.getAttribute('title');
                if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
                    issues.push({
                        type: 'FORM_CONTROL_NO_LABEL',
                        tag: input.tagName.toLowerCase(),
                        id: input.id,
                        cls: input.className,
                        placeholder: input.getAttribute('placeholder'),
                        msg: \`<\${input.tagName.toLowerCase()} class="\${input.className}"> has no associated <label> or aria-label\`
                    });
                }
            });

            // 4. Check tabs for tablist / tab / aria-selected
            const tabGroups = app.querySelectorAll('.os-tabs, .os-workflow-modes, .os-agenda-tabs');
            tabGroups.forEach(tg => {
                if (tg.getAttribute('role') !== 'tablist') {
                    issues.push({
                        type: 'TABLIST_MISSING_ROLE',
                        cls: tg.className,
                        msg: \`<div class="\${tg.className}"> missing role="tablist"\`
                    });
                }
                const tabs = tg.querySelectorAll('.os-tab, .os-workflow-mode, .os-agenda-tab');
                tabs.forEach(t => {
                    const isTab = t.getAttribute('role') === 'tab';
                    const hasSelected = t.hasAttribute('aria-selected');
                    if (!isTab || !hasSelected) {
                        issues.push({
                            type: 'TAB_MISSING_ROLE',
                            cls: t.className,
                            text: t.textContent?.trim(),
                            msg: \`Tab <\${t.tagName.toLowerCase()} class="\${t.className}"> text="\${t.textContent?.trim()}" missing role="tab" or aria-selected\`
                        });
                    }
                });
            });

            return issues;
        })()`);

        report.push({ tab, issues: tabFindings });
        console.log(`  Issues in ${tab}: ${tabFindings.length}`);
    }

    // Aggregate by issue type across the app
    console.log('\n========================================');
    console.log('ACCESSIBILITY AUDIT GROUPED FINDINGS');
    console.log('========================================');
    
    const byType = {};
    for (const r of report) {
        for (const iss of r.issues) {
            if (!byType[iss.type]) byType[iss.type] = [];
            byType[iss.type].push({ tab: r.tab, ...iss });
        }
    }

    for (const [type, list] of Object.entries(byType)) {
        console.log(`\n• [${type}]: ${list.length} occurrence(s)`);
        const uniqueMsgs = Array.from(new Set(list.map(x => x.msg)));
        uniqueMsgs.slice(0, 10).forEach(m => console.log(`   - ${m}`));
        if (uniqueMsgs.length > 10) console.log(`   ... and ${uniqueMsgs.length - 10} more`);
    }

    cdp.close();
}

runA11yAudit().catch(console.error);
