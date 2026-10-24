export async function connectMcp(endpoint = 'http://127.0.0.1:13100/mcp') {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    let id = 0;
    const request = async (method, params) => {
        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
        if (!response.ok) throw new Error(`Thymer MCP HTTP ${response.status}`);
        if (method === 'initialize') {
            const session = response.headers.get('Mcp-Session-Id');
            if (session) headers['Mcp-Session-Id'] = session;
        }
        const payload = await response.json();
        if (payload.error || payload.result?.isError) {
            console.error('MCP Error detail:', JSON.stringify(payload.error || payload.result));
            throw new Error(`Thymer MCP ${method} failed: ${JSON.stringify(payload.error || payload.result)}`);
        }
        return payload.result;
    };
    await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'freelance-os-views', version: '1' } });
    await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    return async (name, args) => {
        const result = await request('tools/call', { name, arguments: args });
        const content = result.content?.find(c => c.type === 'text')?.text;
        if (!content) throw new Error(`Empty response from ${name}`);
        try { return JSON.parse(content); } catch { return content; }
    };
}
