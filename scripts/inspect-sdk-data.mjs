import { connectCdp } from "./cdp.mjs";

async function main() {
    const cdp = await connectCdp();
    const res = await cdp.evaluate(`
        (() => {
            const d = window.__freelanceOs?.data;
            if (!d) return { error: 'no data' };
            return {
                createCollectionStr: d.createCollection.toString().slice(0, 300),
                createCollectionLength: d.createCollection.length
            };
        })()
    `);
    console.log("createCollection details:", res);
    cdp.close();
}

main().catch(console.error);
