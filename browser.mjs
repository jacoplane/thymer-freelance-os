import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\dev\\thymer-chrome-profile';
const ARTIFACT_DIR = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\7f530962-cdc5-4535-a069-0bd6dde8ee92';

export async function runBrowser({ url = 'https://jacoplane.thymer.com/', action = 'screenshot', clickSelector = null } = {}) {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        userDataDir: USER_DATA_DIR,
        args: [
            '--window-size=1600,1000',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        defaultViewport: {
            width: 1600,
            height: 1000
        }
    });

    const page = await browser.newPage();
    
    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
        consoleLogs.push(`[PAGE ERROR] ${err.message}`);
    });

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait 4 seconds for Thymer SPA / plugins to initialize
    await new Promise(r => setTimeout(r, 4000));

    if (clickSelector) {
        console.log(`Clicking ${clickSelector}...`);
        await page.waitForSelector(clickSelector, { timeout: 5000 });
        await page.click(clickSelector);
        await new Promise(r => setTimeout(r, 2000));
    }

    const title = await page.title();
    console.log('Page Title:', title);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const isLoggedIn = !bodyText.includes('Login') && !bodyText.includes('Forgot password?');

    console.log('Logged In:', isLoggedIn);

    const screenshotPath = path.join(ARTIFACT_DIR, 'live_thymer_dashboard.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot to ${screenshotPath}`);

    // If there is custom panel or freelance-os element, inspect its layout
    const panelInfo = await page.evaluate(() => {
        const app = document.querySelector('.os-app');
        if (!app) return { found: false };
        const rect = app.getBoundingClientRect();
        const grid = app.querySelector('.os-grid');
        const gridRect = grid ? grid.getBoundingClientRect() : null;
        return {
            found: true,
            appWidth: rect.width,
            appHeight: rect.height,
            gridWidth: gridRect ? gridRect.width : null,
            projectsCount: app.querySelectorAll('.os-project-card').length,
            tasksCount: app.querySelectorAll('.os-task-item').length
        };
    });

    console.log('Panel DOM Info:', JSON.stringify(panelInfo, null, 2));

    await browser.close();

    return {
        isLoggedIn,
        panelInfo,
        consoleLogs: consoleLogs.slice(-20),
        screenshotPath
    };
}

if (process.argv[1].endsWith('browser.mjs')) {
    runBrowser().then(res => {
        console.log('\n--- RESULT ---');
        console.log('Logged in:', res.isLoggedIn);
        console.log('Panel info:', res.panelInfo);
    }).catch(err => {
        console.error('Browser run error:', err);
    });
}
