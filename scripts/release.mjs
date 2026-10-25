import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function bumpSemver(version, type = 'patch') {
    const parts = version.replace(/^v/i, '').split('.').map(Number);
    if (type === 'major') {
        parts[0] += 1;
        parts[1] = 0;
        parts[2] = 0;
    } else if (type === 'minor') {
        parts[1] += 1;
        parts[2] = 0;
    } else {
        parts[2] += 1;
    }
    return parts.join('.');
}

async function main() {
    const arg = process.argv[2] || 'patch';
    const pkgPath = path.join(rootDir, 'package.json');
    const pluginJsonPath = path.join(rootDir, 'plugin.json');

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const oldVersion = pkg.version;
    const nextVersion = arg.includes('.') ? arg : bumpSemver(oldVersion, arg);

    console.log(`\n🚀 Preparing Freelance OS release: v${oldVersion} -> v${nextVersion}`);

    // 1. Update version in package.json & plugin.json
    pkg.version = nextVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
    pluginJson.version = nextVersion;
    pluginJson.__source_repo = pluginJson.repository || 'https://github.com/jacoplane/thymer-freelance-os';
    fs.writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n', 'utf8');

    // 2. Build the bundle
    console.log('\n📦 Building bundle...');
    execSync('node build.mjs', { cwd: rootDir, stdio: 'inherit' });

    // Optional: Deploy locally if Thymer is running
    try {
        console.log('\n🖥️ Deploying updated bundle to active Thymer workspace...');
        execSync('node deploy.mjs --workspace WNN1JJG50ZQ6BE9S1T3HG85S57', { cwd: rootDir, stdio: 'inherit' });
    } catch (e) {
        console.log('Local MCP deploy skipped (will apply on launch or check).');
    }

    // 3. Git commit & tag
    console.log('\n📝 Committing release changes...');
    execSync(`git add package.json plugin.json dist/ src/ CHANGELOG.md`, { cwd: rootDir, stdio: 'inherit' });
    execSync(`git commit -m "chore(release): update version to ${nextVersion}"`, { cwd: rootDir, stdio: 'inherit' });
    execSync(`git tag -a v${nextVersion} -m "Freelance OS v${nextVersion}"`, { cwd: rootDir, stdio: 'inherit' });

    // 4. Push to GitHub
    console.log('\n⬆️ Pushing to GitHub (main + tags)...');
    execSync('git push origin main --tags', { cwd: rootDir, stdio: 'inherit' });

    // 5. Create GitHub release via gh CLI if available
    try {
        console.log('\n✨ Publishing GitHub Release via gh CLI...');
        execSync(`gh release create v${nextVersion} --title "v${nextVersion}" --generate-notes`, { cwd: rootDir, stdio: 'inherit' });
        console.log(`✓ GitHub Release v${nextVersion} published!`);
    } catch (e) {
        console.warn('⚠️ GitHub release creation skipped (run `gh release create` manually if needed).');
    }

    console.log(`\n🎉 Release v${nextVersion} published successfully!`);
    console.log(`• Other users will see an update notification in Thymer.`);
    console.log(`• Users with auto-update enabled will receive the update automatically.`);
}

main().catch(err => {
    console.error('Fatal release error:', err);
    process.exit(1);
});
