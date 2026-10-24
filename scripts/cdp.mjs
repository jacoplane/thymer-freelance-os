export async function connectCdp() {
    const pages = await (await fetch('http://127.0.0.1:9444/json')).json();
    const target = pages.find(p => p.type === 'page' && p.url.includes('thymer.com'));
    if (!target) throw new Error('No Thymer page found on CDP port 9444');
    
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    let msgId = 0;
    const callbacks = new Map();
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
            const { resolve, reject } = callbacks.get(msg.id);
            callbacks.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || 'CDP Error'));
            else resolve(msg.result);
        }
    };

    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++msgId;
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });

    // Guardrail: Always clear device metrics override to protect window resolution
    await send('Emulation.clearDeviceMetricsOverride');

    return {
        send,
        evaluate: async (expression) => {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || 'Evaluation failed');
            return res.result?.value;
        },
        screenshot: async () => {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            return Buffer.from(res.data, 'base64');
        },
        close: () => ws.close()
    };
}
