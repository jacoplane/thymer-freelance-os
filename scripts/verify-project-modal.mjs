import fs from 'node:fs/promises';
import { connectCdp } from './cdp.mjs';

async function main() {
    const cdp = await connectCdp();

    // Wait for window.__freelanceOs to be available
    let ready = false;
    for (let i = 0; i < 20; i++) {
        ready = await cdp.evaluate('typeof window.__freelanceOs !== "undefined"');
        if (ready) break;
        await new Promise(r => setTimeout(r, 500));
    }
    console.log("Freelance OS instance ready:", ready);

    // Ensure Software & AI Engineering pack is active
    await cdp.evaluate(`
        (() => {
            const p = window.__freelanceOs;
            if (p && !p.isPackActive('pack-software-dev')) {
                p.togglePack('pack-software-dev');
            }
        })()
    `);

    // Click "+ Project" or open modal
    const modalRes = await cdp.evaluate(`
        (() => {
            const p = window.__freelanceOs;
            const projectBtn = Array.from(document.querySelectorAll("button, .os-card-action-btn, span")).find(b => b.textContent && b.textContent.trim() === "+ Project");
            if (projectBtn) {
                projectBtn.click();
            } else if (p) {
                p.showCreateProjectModal(null, { clients: [{ guid: "real-client", name: "Atelier Végétal" }] });
            }
            const modal = document.querySelector(".os-modal-card");
            const templateSelect = document.querySelector(".input-template");
            const preview = document.querySelector(".os-template-milestones-preview");
            return {
                modalOpen: !!modal,
                templateSelectFound: !!templateSelect,
                optionsCount: templateSelect ? templateSelect.options.length : 0,
                selectedOptionText: templateSelect ? templateSelect.options[templateSelect.selectedIndex]?.text : '',
                previewText: preview ? preview.textContent.trim() : ''
            };
        })()
    `);
    console.log("Modal Verification Result:", JSON.stringify(modalRes, null, 2));

    await new Promise(r => setTimeout(r, 600));
    const img = await cdp.screenshot();
    await fs.writeFile('C:/dev/thymer-freelance-os/project-modal-preview.png', img);
    console.log("Saved screenshot to C:/dev/thymer-freelance-os/project-modal-preview.png");

    cdp.close();
}

main().catch(console.error);
