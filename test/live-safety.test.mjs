import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTestIdentity, guardedEvaluate, ownedSubtreeIds, TEST_WORKSPACE, TEST_PLUGIN } from './live-safety.mjs';

test('live test guard rejects production or a different plugin before dispatching any mutation', async () => {
    for (const identity of [null, { workspace: 'WNN1JJG50ZQ6BE9S1T3HG85S57', plugin: '198WZ858D9JC12CY5SWW9GSZFJ' }, { workspace: TEST_WORKSPACE, plugin: 'other' }]) {
        let dispatches = 0;
        const page = { evaluate: async () => { dispatches++; return identity; } };
        await assert.rejects(guardedEvaluate(page, () => { throw new Error('Must not run'); }), /explicit Freelance OS test/);
        assert.equal(dispatches, 1);
    }
    assert.doesNotThrow(() => assertTestIdentity({ workspace: TEST_WORKSPACE, plugin: TEST_PLUGIN }));
});

test('fixture subtree cleanup includes partial pending children and preserves unrelated review trees', () => {
    const lines = [{ guid: 'existing', parent_guid: 'record' }, { guid: 'user-note', parent_guid: 'existing' }, { guid: 'own', parent_guid: 'record' }, { guid: 'body', parent_guid: 'own' }, { guid: 'pending-line', parent_guid: 'body' }];
    assert.deepEqual([...ownedSubtreeIds(lines, 'own')].sort(), ['body', 'own', 'pending-line']);
    assert.equal(ownedSubtreeIds(lines, 'own').has('existing'), false);
    assert.deepEqual([...ownedSubtreeIds([], 'created-before-first-body-failure')], ['created-before-first-body-failure']);
});
