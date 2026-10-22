import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { connectMcp } from './thymer-mcp.mjs';
import { VIEW_PLANS, planCollectionViews } from './collection-view-plan.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const collectionIndex = args.indexOf('--collection');
const collections = collectionIndex >= 0 ? [args[collectionIndex + 1]] : Object.keys(VIEW_PLANS);
const workspace = process.env.THYMER_WORKSPACE;
if (!workspace) throw new Error('Set THYMER_WORKSPACE to the explicit target workspace GUID.');
const call = await connectMcp();
const plans = [];
for (const collection of collections) {
    const current = await call('get_collection_config_json', { workspace, collection });
    const next = planCollectionViews(collection, current.config);
    plans.push({ collection, current, next });
}
for (const { collection, current, next } of plans) {
    const changed = !isDeepStrictEqual(current.config, next);
    console.log(`${collection}: ${changed ? (apply ? 'applying' : 'planned') : 'up to date'}; ${VIEW_PLANS[collection].map(v => v.label).join(', ')}`);
    if (!apply || !changed) continue;
    const latest = await call('get_collection_config_json', { workspace, collection });
    if (!isDeepStrictEqual(latest.config, current.config)) throw new Error(`${collection} changed during planning; run again`);
    const directory = process.env.OS_COLLECTION_BACKUP_DIR || path.join(os.tmpdir(), 'freelance-os-collection-backups');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `${collection}-${Date.now()}.json`), JSON.stringify(current, null, 2));
    await call('update_collection_config_json', { workspace, collection, config: JSON.stringify(next) });
    const saved = await call('get_collection_config_json', { workspace, collection });
    if (!isDeepStrictEqual(saved.config.views, next.views)) throw new Error(`${collection} view verification failed`);
    console.log(`${collection}: saved and verified; backup kept locally`);
}
