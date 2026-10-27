import fs from 'node:fs';

let content = fs.readFileSync('c:/dev/thymer-freelance-os/test/projects.test.mjs', 'utf8').replace(/\r\n/g, '\n');

// Update line 5 to include ai.js and Ai
content = content.replace(
  "const source = fs.readFileSync(new URL('../src/workflow.js',import.meta.url),'utf8')+'\\n'+fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');",
  "const source = fs.readFileSync(new URL('../src/workflow.js',import.meta.url),'utf8')+'\\n'+fs.readFileSync(new URL('../src/ai.js',import.meta.url),'utf8')+'\\n'+fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');"
);
content = content.replace(
  "Object.assign(Plugin.prototype,Workflow);({Plugin,projectStatusLabel})",
  "Object.assign(Plugin.prototype,Workflow,Ai);({Plugin,projectStatusLabel})"
);

const additionalTest = `
test('Trade Pack template initializes custom milestones and tailored deliverables', async () => {
    const plugin = new Plugin(), state = page();
    const milestones = [
        'Discovery & Technical Architecture',
        'Sprint 1 Core MVP',
        'Staging QA & UAT',
        'Production Deployment & Handoff'
    ];
    await plugin.initializeProject(state.record, {
        brief: 'Build client API portal',
        packId: 'pack-software-dev',
        projectType: 'Engineering Sprint',
        milestones
    });

    // Verify milestones are created under Client review checkpoints
    const reviewSection = state.lines.find(l => l.type === 'heading' && l.segments?.[0]?.text === 'Client review checkpoints');
    assert.ok(reviewSection, 'Review checkpoints section must exist');

    for (const milestone of milestones) {
        assert.ok(state.lines.some(l => l.type === 'task' && l.segments?.[0]?.text === milestone), 'Milestone ' + milestone + ' must be generated as a task');
    }

    // Verify engineering-specific deliverables
    assert.ok(state.lines.some(l => l.type === 'text' && l.segments?.[0]?.text?.includes('Engineering Repositories')));
    assert.ok(state.lines.some(l => l.type === 'ulist' && l.segments?.[0]?.text?.includes('Staging QA Environment')));
});
`;

if (!content.includes('Trade Pack template initializes custom milestones')) {
    content = content + additionalTest;
}

fs.writeFileSync('c:/dev/thymer-freelance-os/test/projects.test.mjs', content, 'utf8');
console.log('Successfully updated test/projects.test.mjs');
