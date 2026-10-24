import { connectCdp } from './cdp.mjs';
import fs from 'fs';

async function main() {
    const cdp = await connectCdp();
    const buf = await cdp.screenshot();
    fs.writeFileSync('current-screen.png', buf);
    console.log('Saved current-screen.png (', buf.length, 'bytes)');
    cdp.close();
}

main().catch(console.error);
