import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const THYMER_EXE = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Jaap\\AppData\\Local', 'Programs', 'thymer', 'Thymer.exe');
const DEBUG_PORT = 9444;

async function isPortListening(port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        return res.ok;
    } catch {
        return false;
    }
}

async function killRunningThymer() {
    try {
        console.log('Stopping any existing Thymer processes (to release single-instance lock)...');
        execSync('taskkill /F /IM Thymer.exe /T 2>nul', { stdio: 'ignore' });
        await new Promise(r => setTimeout(r, 1000));
    } catch {}
}

async function launch() {
    if (!fs.existsSync(THYMER_EXE)) {
        throw new Error(`Thymer executable not found at: ${THYMER_EXE}`);
    }

    const alreadyRunningWithDebug = await isPortListening(DEBUG_PORT);
    if (alreadyRunningWithDebug) {
        console.log(`Thymer is already running with remote debugging on port ${DEBUG_PORT}.`);
    } else {
        await killRunningThymer();

        console.log(`Launching Thymer Desktop with --remote-debugging-port=${DEBUG_PORT}...`);
        const child = spawn(THYMER_EXE, [`--remote-debugging-port=${DEBUG_PORT}`], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        console.log('Waiting for CDP debugging endpoint to become ready...');
        let ready = false;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (await isPortListening(DEBUG_PORT)) {
                ready = true;
                break;
            }
        }
        if (!ready) {
            throw new Error(`Thymer failed to open debugging port ${DEBUG_PORT} within 15 seconds.`);
        }
        console.log(`✓ CDP debugging active at http://127.0.0.1:${DEBUG_PORT}`);
    }

    // Check targets and dismiss account picker if present
    await new Promise(r => setTimeout(r, 1500));
    try {
        const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
        const accPage = pages.find(p => (p.title || '').includes('Choose Account'));
        if (accPage) {
            console.log('Detected "Choose Account" screen, selecting jacoplane...');
            const ws = new WebSocket(accPage.webSocketDebuggerUrl);
            await new Promise(r => ws.onopen = r);
            ws.send(JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: {
                    expression: `(() => {
                        const els = Array.from(document.querySelectorAll('*')).filter(e => {
                            const text = (e.innerText || '').trim();
                            return text.includes('jacoplane') && e.children.length === 0;
                        });
                        if (els.length > 0) {
                            const target = els[0].closest('a, button, .account, [role="button"]') || els[0];
                            target.click();
                            return 'clicked';
                        }
                        return 'not found';
                    })()`,
                    returnByValue: true
                }
            }));
            await new Promise(r => setTimeout(r, 1500));
            ws.close();
            console.log('✓ Account selected.');
        }
    } catch (err) {
        console.warn('Note: Could not check account page:', err.message);
    }

    const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
    console.log(`Active CDP Targets (${pages.length}):`);
    for (const p of pages) {
        console.log(`  - [${p.type}] "${p.title}" -> ${p.url}`);
        if (p.devtoolsFrontendUrl) {
            console.log(`    DevTools: http://127.0.0.1:${DEBUG_PORT}${p.devtoolsFrontendUrl}`);
        }
    }
}

launch().catch(err => {
    console.error('Launch failed:', err);
    process.exit(1);
});
