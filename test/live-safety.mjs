export const TEST_WORKSPACE = 'W8JXPTMKY8DEDMGB3JZ6ARRHJ2';
export const TEST_PLUGIN = '1Y01APTHH8RZN3BRYVHQT0YXQP';

export function assertTestIdentity(identity) {
    if (identity?.workspace !== TEST_WORKSPACE || identity?.plugin !== TEST_PLUGIN) {
        throw new Error('Live mutation checks require the explicit Freelance OS test workspace and plugin. Production is never a test target.');
    }
}

export async function guardedEvaluate(page, callback, ...args) {
    assertTestIdentity(await page.evaluate(() => ({
        workspace: window.__freelanceOs?.getWorkspaceGuid(),
        plugin: window.__freelanceOs?.getGuid()
    })));
    return page.evaluate(callback, ...args);
}

export function ownedSubtreeIds(lines, headingGuid) {
    const ids = new Set([headingGuid]);
    let previous;
    do {
        previous = ids.size;
        for (const line of lines) if (ids.has(line.parent_guid)) ids.add(line.guid);
    } while (ids.size !== previous);
    return ids;
}
