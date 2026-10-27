import { connectCdp } from './cdp.mjs';

async function testKeyboardNav() {
    console.log('Connecting to Thymer Desktop via CDP...');
    const cdp = await connectCdp();

    try {
        console.log('--- Testing Keyboard Navigation & Focus Management ---');

        // 1. Test Tablist Arrow Navigation on Workflow Modes
        const arrowTest = await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            if (!p) return { error: 'plugin not found' };
            p.workflowMode = 'overview';
            p.render(p.activePanel);

            const modes = document.querySelector('.os-workflow-modes');
            if (!modes) return { error: 'No modes tablist found' };
            const tabs = [...modes.querySelectorAll('button[role="tab"]')];
            if (tabs.length < 2) return { error: 'Not enough mode tabs' };

            // Focus first tab (Overview)
            tabs[0].focus();
            const activeBefore = document.activeElement.dataset.mode;

            // Dispatch ArrowRight
            const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
            tabs[0].dispatchEvent(arrowEvent);

            const activeAfter = document.activeElement.dataset.mode;

            // Reset back to overview
            tabs[0].focus();
            tabs[0].click();

            return { activeBefore, activeAfter, passed: activeBefore === 'overview' && activeAfter === 'today' };
        })()`);
        console.log('1. Workflow modes Arrow key navigation:', arrowTest);

        // 2. Test Modal Focus Trap & Escape Key Handling
        const modalTest = await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            if (!p) return { error: 'plugin not found' };

            // Find a trigger button
            const trigger = document.querySelector('.btn-new-project');
            if (!trigger) return { error: 'No new project trigger found' };
            trigger.focus();

            p.showCreateProjectModal(p.activePanel, p.cachedData || { clients: [] });

            const modal = document.querySelector('.os-modal-backdrop');
            if (!modal) return { error: 'Modal did not mount' };

            const focusedInside = !!document.activeElement.closest('.os-modal-card');
            const controls = [...modal.querySelectorAll('button:not(:disabled), input, select, textarea')];
            const first = controls[0];
            const last = controls.at(-1);

            // Test Tab wrap from last control
            last.focus();
            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
            modal.dispatchEvent(tabEvent);
            const wrappedToFirst = document.activeElement === first;

            // Test Escape key dismissal
            const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
            modal.dispatchEvent(escEvent);
            const modalClosed = !document.querySelector('.os-modal-backdrop');
            const focusRestored = document.activeElement === trigger;

            return {
                focusedInside,
                wrappedToFirst,
                modalClosed,
                focusRestored,
                passed: focusedInside && wrappedToFirst && modalClosed && focusRestored
            };
        })()`);
        console.log('2. Modal focus trap and Escape return:', modalTest);

        // 3. Test Quick Capture `/` and `Escape` shortcuts
        const shortcutTest = await cdp.evaluate(`(() => {
            const p = window.__freelanceOs;
            if (!p) return { error: 'plugin not found' };

            const app = document.querySelector('.os-shell');
            const captureInput = document.querySelector('.os-capture-input');
            if (!app || !captureInput) return { error: 'Shell or capture input not found' };

            // Blur everything
            document.body.focus();

            // Dispatch '/' on app
            const slashEvent = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
            app.dispatchEvent(slashEvent);
            const focusedOnSlash = document.activeElement === captureInput;

            // Dispatch Escape on captureInput
            const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
            captureInput.dispatchEvent(escEvent);
            const blurredOnEscape = document.activeElement !== captureInput;

            return {
                focusedOnSlash,
                blurredOnEscape,
                passed: focusedOnSlash && blurredOnEscape
            };
        })()`);
        console.log('3. Quick capture "/" and Escape shortcuts:', shortcutTest);

        console.log('\nKeyboard navigation audit complete!');
    } finally {
        cdp.close();
    }
}

testKeyboardNav().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
});
