// Browser bridge: provides window.warp + window.crates when running in a plain browser (served by
// web-server.js). In Electron these are already set by preload.js, so this file no-ops there.
// PTY runs on the local server, or in the current Nodus workspace when the iframe supplies sessionId.
(function () {
  if (window.warp) return; // Electron preload already wired everything — nothing to do.

  const dataCbs = [], exitCbs = [];
  const streams = new Map(); // id -> EventSource
  const sockets = new Map(); // id -> Nodus WebSocket
  const socketQueues = new Map(); // id -> frames entered before the browser WS opens
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('sessionId');
  const nodusUrl = params.get('nodusUrl');
  const userId = params.get('userId');
  const post = (path, obj) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });

  function nodusSocket() {
    const url = new URL(nodusUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = url.pathname.replace(/\/$/, '') + '/sessions/' + encodeURIComponent(sessionId) + '/terminal';
    url.searchParams.set('userId', userId || 'default');
    url.searchParams.set('target', 'workspace');
    return url;
  }

  function openNodus(id, cols, rows) {
    if (sockets.has(id)) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(nodusSocket(), ['tty']); ws.binaryType = 'arraybuffer'; sockets.set(id, ws); socketQueues.set(id, []);
      window.parent.postMessage({ type: 'lunix-terminal-status', status: 'connecting' }, location.origin);
      ws.onopen = () => {
        ws.send('1' + JSON.stringify({ columns: cols || 80, rows: rows || 24 }));
        for (const frame of socketQueues.get(id) || []) ws.send(frame);
        socketQueues.delete(id);
        resolve(true);
      };
      ws.onmessage = async (e) => {
        const text = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
        if (text[0] === '0') dataCbs.forEach((cb) => cb({ id, data: text.slice(1) }));
      };
      ws.onclose = (event) => {
        sockets.delete(id); socketQueues.delete(id);
        window.parent.postMessage({ type: 'lunix-terminal-status', status: 'error', code: event.code, message: event.reason || 'Terminal disconnected' }, location.origin);
        exitCbs.forEach((cb) => cb({ id }));
      };
      ws.onerror = () => {
        window.parent.postMessage({ type: 'lunix-terminal-status', status: 'error', message: 'Nodus terminal unavailable' }, location.origin);
        reject(new Error('Nodus terminal unavailable'));
      };
    });
  }

  function sendNodus(id, frame) {
    const ws = sockets.get(id);
    if (!ws) return false;
    if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    else if (ws.readyState === WebSocket.CONNECTING) socketQueues.get(id)?.push(frame);
    return true;
  }

  function openStream(id) {
    if (streams.has(id)) return;
    const es = new EventSource('/pty/stream?id=' + encodeURIComponent(id));
    streams.set(id, es);
    es.addEventListener('data', (e) => { const m = JSON.parse(e.data); dataCbs.forEach((cb) => cb(m)); });
    es.addEventListener('exit', (e) => { const m = JSON.parse(e.data); exitCbs.forEach((cb) => cb(m)); es.close(); streams.delete(id); });
  }

  window.warp = {
    spawn: async (id, cols, rows) => sessionId && nodusUrl ? openNodus(id, cols, rows) : (openStream(id), post('/pty/spawn', { id, cols, rows }).then((r) => r.json())),
    write: (id, data) => sendNodus(id, '0' + data) || post('/pty/write', { id, data }),
    resize: (id, cols, rows) => sendNodus(id, '1' + JSON.stringify({ columns: cols, rows })) || post('/pty/resize', { id, cols, rows }),
    kill: (id) => { const ws = sockets.get(id); if (ws) { ws.close(); sockets.delete(id); return Promise.resolve(true); } const es = streams.get(id); if (es) { es.close(); streams.delete(id); } return post('/pty/kill', { id }); },
    onData: (cb) => dataCbs.push(cb),
    onExit: (cb) => exitCbs.push(cb),
  };
})();
