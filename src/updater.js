/**
 * Freelance OS In-Plugin Update Checker
 * Checks GitHub repository for new releases and updates gracefully.
 */

const Updater = {
    isRemoteVersionNewer(remoteVer, currentVer) {
        if (!remoteVer || !currentVer) return false;
        const clean = v => String(v).replace(/^v/i, '').trim();
        const rParts = clean(remoteVer).split('.').map(n => parseInt(n, 10) || 0);
        const cParts = clean(currentVer).split('.').map(n => parseInt(n, 10) || 0);
        const maxLen = Math.max(rParts.length, cParts.length);
        for (let i = 0; i < maxLen; i++) {
            const r = rParts[i] || 0;
            const c = cParts[i] || 0;
            if (r > c) return true;
            if (r < c) return false;
        }
        return false;
    },

    getUpdateConfig() {
        const conf = typeof this.getConfiguration === 'function' ? this.getConfiguration() : {};
        const autoUpdate = conf?.custom?.autoUpdate === true || localStorage.getItem('fos_auto_update') === 'true';
        return {
            version: conf?.version || '0.5.0',
            repoUrl: conf?.repository || conf?.__source_repo || 'https://github.com/jacoplane/thymer-freelance-os',
            autoUpdate
        };
    },

    setAutoUpdate(enabled) {
        localStorage.setItem('fos_auto_update', enabled ? 'true' : 'false');
        if (typeof this.getConfiguration === 'function' && typeof this.savePlugin === 'function') {
            const conf = this.getConfiguration();
            conf.custom = conf.custom || {};
            conf.custom.autoUpdate = !!enabled;
            // Best effort persist to config
            try {
                const code = this.getExistingCodeAndConfig?.()?.code;
                if (code) this.savePlugin(conf, code);
            } catch (e) { /* ignore */ }
        }
    },

    async checkForUpdates({ manual = false } = {}) {
        try {
            const now = Date.now();
            const lastCheck = parseInt(localStorage.getItem('fos_last_update_check') || '0', 10);
            // If background check, throttle to once every 4 hours
            if (!manual && (now - lastCheck < 4 * 60 * 60 * 1000)) {
                return;
            }
            localStorage.setItem('fos_last_update_check', String(now));

            const { version: currentVersion, repoUrl, autoUpdate } = this.getUpdateConfig();
            const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
            if (!match) return;
            const [, owner, repo] = match;

            if (manual && this.ui?.addToaster) {
                this.ui.addToaster({
                    title: 'Checking for updates…',
                    message: `Checking ${owner}/${repo} on GitHub…`,
                    autoDestroyTime: 2500,
                    dismissible: true
                });
            }

            const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/dist/plugin.json?t=${now}`;
            const res = await fetch(manifestUrl);
            if (!res.ok) {
                if (manual && this.ui?.addToaster) {
                    this.ui.addToaster({
                        title: 'Update check failed',
                        message: `Could not reach GitHub (HTTP ${res.status}).`,
                        dismissible: true
                    });
                }
                return;
            }

            const remoteManifest = await res.json();
            const remoteVersion = remoteManifest.version;

            if (!this.isRemoteVersionNewer(remoteVersion, currentVersion)) {
                if (manual && this.ui?.addToaster) {
                    this.ui.addToaster({
                        title: 'Freelance OS is up to date',
                        message: `You are on the latest version (v${currentVersion}).`,
                        autoDestroyTime: 3500,
                        dismissible: true
                    });
                }
                return;
            }

            // Remote version is newer!
            if (autoUpdate) {
                await this.performUpdate(owner, repo, remoteManifest, { silent: false });
            } else {
                this.showUpdatePrompt(owner, repo, remoteManifest, currentVersion);
            }
        } catch (err) {
            console.warn('[Freelance OS] Update check error:', err);
            if (manual && this.ui?.addToaster) {
                this.ui.addToaster({
                    title: 'Update check error',
                    message: err.message,
                    dismissible: true
                });
            }
        }
    },

    showUpdatePrompt(owner, repo, remoteManifest, currentVersion) {
        if (!this.ui?.addToaster) return;

        const toast = this.ui.addToaster({
            title: 'Freelance OS Update Available 🚀',
            messageHTML: `
                <div style="margin-top: 4px; font-size: 13px; line-height: 1.4;">
                    <div>A new version <strong>v${remoteManifest.version}</strong> is available (current: v${currentVersion}).</div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="btn btn-primary fos-update-now-btn" style="padding: 4px 10px; font-size: 12px; cursor: pointer; border-radius: 4px;">Update now</button>
                        <button class="btn btn-secondary fos-update-dismiss-btn" style="padding: 4px 10px; font-size: 12px; cursor: pointer; border-radius: 4px;">Later</button>
                    </div>
                </div>
            `,
            autoDestroyTime: 15000,
            dismissible: true
        });

        if (toast?.element) {
            const updateBtn = toast.element.querySelector('.fos-update-now-btn');
            if (updateBtn) {
                updateBtn.addEventListener('click', () => {
                    toast.destroy?.();
                    this.performUpdate(owner, repo, remoteManifest);
                });
            }
            const dismissBtn = toast.element.querySelector('.fos-update-dismiss-btn');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    toast.destroy?.();
                });
            }
        }
    },

    async performUpdate(owner, repo, remoteManifest) {
        try {
            if (this.ui?.addToaster) {
                this.ui.addToaster({
                    title: 'Updating Freelance OS…',
                    message: `Downloading v${remoteManifest.version} from GitHub…`,
                    autoDestroyTime: 4000,
                    dismissible: false
                });
            }

            const now = Date.now();
            const jsUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/dist/plugin.js?t=${now}`;
            const cssUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/dist/plugin.css?t=${now}`;

            const [jsRes, cssRes] = await Promise.all([
                fetch(jsUrl),
                fetch(cssUrl)
            ]);

            if (!jsRes.ok) throw new Error(`Could not download plugin.js (HTTP ${jsRes.status})`);
            const remoteJs = await jsRes.text();
            const remoteCss = cssRes.ok ? await cssRes.text() : '';

            // Apply CSS
            if (remoteCss && typeof this.saveCSS === 'function') {
                await this.saveCSS(remoteCss);
            }

            // Apply plugin configuration and code
            const currentConf = typeof this.getConfiguration === 'function' ? this.getConfiguration() : {};
            const newConf = {
                ...currentConf,
                version: remoteManifest.version,
                description: remoteManifest.description || currentConf.description,
                repository: remoteManifest.repository || currentConf.repository,
                __source_repo: currentConf.__source_repo || `https://github.com/${owner}/${repo}`
            };

            if (typeof this.savePlugin === 'function') {
                await this.savePlugin(newConf, remoteJs);
            } else {
                // Fallback: update via local MCP endpoint if running in an environment without savePlugin
                await fetch('http://127.0.0.1:13100/mcp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: Date.now(),
                        method: 'tools/call',
                        params: {
                            name: 'update_plugin_code',
                            arguments: {
                                workspace: this.workspaceGuid || 'WNN1JJG50ZQ6BE9S1T3HG85S57',
                                plugin: this.getGuid?.() || '198WZ858D9JC12CY5SWW9GSZFJ',
                                code: remoteJs
                            }
                        }
                    })
                });
            }

            if (this.ui?.addToaster) {
                this.ui.addToaster({
                    title: 'Freelance OS Updated! 🚀',
                    message: `Successfully upgraded to v${remoteManifest.version}.`,
                    autoDestroyTime: 5000,
                    dismissible: true
                });
            }

            // Refresh active dashboard if open
            if (this.activePanel) {
                setTimeout(() => this.render(this.activePanel), 800);
            }
        } catch (err) {
            console.error('[Freelance OS] Update installation failed:', err);
            if (this.ui?.addToaster) {
                this.ui.addToaster({
                    title: 'Update failed',
                    message: err.message,
                    dismissible: true
                });
            }
        }
    }
};
