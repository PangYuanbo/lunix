export default {
  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('websocket required', { status: 426 });
    const target = new URL(request.url).searchParams.get('url');
    let url;
    try { url = new URL(target); } catch { return new Response('invalid target', { status: 400 }); }
    if (url.protocol !== 'wss:' || !url.hostname.endsWith('.browserbase.com')) return new Response('target denied', { status: 403 });

    const [client, server] = Object.values(new WebSocketPair());
    const upstream = new WebSocket(url.href);
    server.accept();
    const queued = [];
    server.addEventListener('message', (event) => upstream.readyState === 1 ? upstream.send(event.data) : queued.push(event.data));
    server.addEventListener('close', () => upstream.close());
    upstream.addEventListener('open', () => { for (const message of queued) upstream.send(message); });
    upstream.addEventListener('message', (event) => server.send(event.data));
    upstream.addEventListener('close', (event) => server.close(event.code || 1000, event.reason));
    upstream.addEventListener('error', () => server.close(1011, 'upstream error'));
    return new Response(null, { status: 101, webSocket: client });
  },
};
