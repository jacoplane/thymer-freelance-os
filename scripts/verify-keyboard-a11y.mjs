import { connectCdp } from './cdp.mjs';

async function verifyKeyboardNav() {
    const cdp = await connectCdp();
    console.log('Verifying Keyboard Focus and Navigation in Freelance OS...');

    await cdp.evaluate(`(() => {
        const p = window.__freelanceOs;
        if (p) {
            p.workflowMode = 'overview';
            p.render(p.activePanel);
        }
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const checkFocus = await cdp.evaluate(`(() => {
        const app = document.querySelector('.os-app');
        if (!app) return { error: 'No .os-app found' };

        // Check all interactive elements can receive focus
        const focusables = Array.from(app.querySelectorAll('button, [tabindex="0"], input, select, textarea, a[href]'));
        const nonNegativeTabindex = focusables.filter(el => {
            const ti = el.getAttribute('tabindex');
            return ti === null || parseInt(ti, 10) >= 0;
        });

        // Test focus outline styles
        const focusVisibleRule = Array.from(document.styleSheets).some(sheet => {
            try {
                return Array.from(sheet.cssRules).some(r => r.selectorText && r.selectorText.includes(':focus-visible'));
            } catch {
                return false;
            }
        });

        // Check task items tabindex and keyboard listener
        const taskItems = Array.from(app.querySelectorAll('.os-task-item'));
        const tasksAccessible = taskItems.every(t => t.getAttribute('role') === 'button' && t.getAttribute('tabindex') === '0');

        // Check checkboxes have aria-label
        const checkboxes = Array.from(app.querySelectorAll('.os-task-checkbox'));
        const checkboxesLabeled = checkboxes.every(cb => !!cb.getAttribute('aria-label'));

        // Check agenda tabs are buttons with role="tab"
        const agendaTabs = Array.from(app.querySelectorAll('.os-agenda-tab'));
        const tabsSemantic = agendaTabs.every(tab => tab.tagName.toLowerCase() === 'button' && tab.getAttribute('role') === 'tab' && tab.hasAttribute('aria-selected'));

        return {
            totalFocusable: nonNegativeTabindex.length,
            focusVisibleStyleConfigured: focusVisibleRule,
            taskItemsCount: taskItems.length,
            tasksAccessible,
            checkboxesCount: checkboxes.length,
            checkboxesLabeled,
            agendaTabsCount: agendaTabs.length,
            tabsSemantic
        };
    })()`);

    console.log('Keyboard & ARIA Audit Results:');
    console.log(checkFocus);
    cdp.close();
}

verifyKeyboardNav().catch(console.error);
