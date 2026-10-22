import fs from 'node:fs';

const BASE = "http://127.0.0.1:13100/";
const WS = "WNN1JJG50ZQ6BE9S1T3HG85S57";
const PLUGIN_GUID = "198WZ858D9JC12CY5SWW9GSZFJ";
const HDR = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };

async function deploy() {
    // 1. Initialize MCP
    const initRes = await fetch(BASE, {
        method: "POST",
        headers: HDR,
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2025-11-25",
                capabilities: {},
                clientInfo: { name: "deploy-client", version: "1" }
            }
        })
    });

    const sid = initRes.headers.get("Mcp-Session-Id");
    console.log("MCP Session ID:", sid);

    await fetch(BASE, {
        method: "POST",
        headers: { ...HDR, ...(sid ? { "Mcp-Session-Id": sid } : {}) },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
    });

    // 2. Read dist/plugin.js
    const code = fs.readFileSync('dist/plugin.js', 'utf8');
    console.log(`Plugin code length: ${code.length} characters`);

    // 3. Update plugin code
    const res = await fetch(BASE, {
        method: "POST",
        headers: { ...HDR, ...(sid ? { "Mcp-Session-Id": sid } : {}) },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: "update_plugin_code",
                arguments: {
                    workspace: WS,
                    plugin: PLUGIN_GUID,
                    code: code
                }
            }
        })
    });

    const data = await res.json();
    console.log("Update response:", JSON.stringify(data, null, 2));

    // Also update CSS
    const css = fs.readFileSync('dist/plugin.css', 'utf8');
    const cssRes = await fetch(BASE, {
        method: "POST",
        headers: { ...HDR, ...(sid ? { "Mcp-Session-Id": sid } : {}) },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "update_plugin_css",
                arguments: {
                    workspace: WS,
                    plugin: PLUGIN_GUID,
                    css: css
                }
            }
        })
    });
    const cssData = await cssRes.json();
    console.log("CSS Update response:", JSON.stringify(cssData, null, 2));
}

deploy().catch(console.error);
