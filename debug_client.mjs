import puppeteer from 'puppeteer-core';
import path from 'node:path';

const ARTIFACT_DIR = 'C:\\Users\\Jaap\\.gemini\\antigravity\\brain\\7f530962-cdc5-4535-a069-0bd6dde8ee92';

async function main() {
    try {
        const browser = await puppeteer.connect({
            browserURL: 'http://127.0.0.1:9444',
            defaultViewport: null
        });
        console.log('SUCCESS: Connected to Thymer Desktop!');
        const pages = await browser.pages();
        console.log('Total pages:', pages.length);

        let activePage = null;
        for (let i = 0; i < pages.length; i++) {
            const p = pages[i];
            const title = await p.title();
            const url = p.url();
            console.log(`[${i}] Title: "${title}", URL: "${url}"`);
            if (url.includes('thymer') || title.includes('Thymer') || title.includes('jacoplane')) {
                activePage = p;
            }
        }

        if (!activePage && pages.length > 0) {
            activePage = pages[0];
        }

        if (activePage) {
            console.log('Inspecting active page...');
            
            // Check for Freelance OS element
            const domInfo = await activePage.evaluate(() => {
                const app = document.querySelector('.os-app');
                if (!app) {
                    return {
                        found: false,
                        bodySnippet: document.body.innerText.slice(0, 300)
                    };
                }
                const rect = app.getBoundingClientRect();
                const grid = app.querySelector('.os-grid');
                const gridRect = grid ? grid.getBoundingClientRect() : null;
                const parentRect = app.parentElement ? app.parentElement.getBoundingClientRect() : null;
                return {
                    found: true,
                    appWidth: rect.width,
                    appHeight: rect.height,
                    gridWidth: gridRect ? gridRect.width : null,
                    parentWidth: parentRect ? parentRect.width : null,
                    parentClass: app.parentElement ? app.parentElement.className : '',
                    projectsCount: app.querySelectorAll('.os-project-card').length,
                    tasksCount: app.querySelectorAll('.os-task-item').length
                };
            });

            console.log('DOM Info:', JSON.stringify(domInfo, null, 2));

            const screenshotPath = path.join(ARTIFACT_DIR, 'thymer_desktop_live.png');
            await activePage.screenshot({ path: screenshotPath });
            console.log(`Saved screenshot to: ${screenshotPath}`);
        }

        await browser.disconnect();
    } catch (err) {
        console.error('Debug client error:', err);
    }
}

main();
