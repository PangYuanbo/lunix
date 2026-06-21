// Browser bridge: provides window.warp + window.crates when running in a plain browser (served by
// web-server.js). In Electron these are already set by preload.js, so this file no-ops there.
// PTY runs on the local server, or in the current Nodus workspace when the iframe supplies sessionId.
(function () {
  if (window.warp) return; // Electron preload already wired everything — nothing to do.

  const dataCbs = [], exitCbs = [];
  const streams = new Map(); // id -> EventSource
  const sockets = new Map(); // id -> Nodus WebSocket
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('sessionId');
  const nodusUrl = params.get('nodusUrl');
  const userId = params.get('userId');
  const post = (path, obj) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });

  function nodusSocket() {
    const url = new URL(nodusUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = url.pathname.replace(/\/$/, '') + '/sessions/' + encodeURIComponent(sessionId) + '/terminal';
    url.search = '?userId=' + encodeURIComponent(userId || 'default');
    return url;
  }

  function openNodus(id, cols, rows) {
    if (sockets.has(id)) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(nodusSocket(), ['tty']); ws.binaryType = 'arraybuffer'; sockets.set(id, ws);
      ws.onopen = () => { ws.send('1' + JSON.stringify({ columns: cols || 80, rows: rows || 24 })); resolve(true); };
      ws.onmessage = async (e) => {
        const text = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
        if (text[0] === '0') dataCbs.forEach((cb) => cb({ id, data: text.slice(1) }));
      };
      ws.onclose = () => { sockets.delete(id); exitCbs.forEach((cb) => cb({ id })); };
      ws.onerror = () => reject(new Error('Nodus terminal unavailable'));
    });
  }

  function openStream(id) {
    if (streams.has(id)) return Promise.resolve();
    const es = new EventSource('/pty/stream?id=' + encodeURIComponent(id));
    streams.set(id, es);
    es.addEventListener('data', (e) => { const m = JSON.parse(e.data); dataCbs.forEach((cb) => cb(m)); });
    es.addEventListener('exit', (e) => { const m = JSON.parse(e.data); exitCbs.forEach((cb) => cb(m)); es.close(); streams.delete(id); });
    return new Promise((r) => { es.onopen = r; setTimeout(r, 400); }); // proceed once the stream is registered server-side
  }

  window.warp = {
    spawn: async (id, cols, rows) => sessionId && nodusUrl ? openNodus(id, cols, rows) : (await openStream(id), post('/pty/spawn', { id, cols, rows }).then((r) => r.json())),
    write: (id, data) => sockets.has(id) ? sockets.get(id).send('0' + data) : post('/pty/write', { id, data }),
    resize: (id, cols, rows) => sockets.has(id) ? sockets.get(id).send('1' + JSON.stringify({ columns: cols, rows })) : post('/pty/resize', { id, cols, rows }),
    kill: (id) => { const ws = sockets.get(id); if (ws) { ws.close(); sockets.delete(id); return Promise.resolve(true); } const es = streams.get(id); if (es) { es.close(); streams.delete(id); } return post('/pty/kill', { id }); },
    onData: (cb) => dataCbs.push(cb),
    onExit: (cb) => exitCbs.push(cb),
    openExternal: (url) => { if (/^https?:\/\//.test(url)) window.open(url, '_blank'); },
    openPath: () => {}, // a browser can't open local paths
    storeGet: () => fetch('/store').then((r) => r.json()),
    storeSet: (s) => post('/store', s).then((r) => r.json()),
    aiAsk: (prompt) => post('/ai', { prompt }).then((r) => r.json()),
  };

  // window.crates: only two call sites in the renderer (worktree name + guarded fuzzy). Light shims.
  if (!window.crates) {
    const ADJ = ['brave', 'calm', 'swift', 'lucky', 'quiet', 'bold', 'witty', 'keen'];
    const NOUN = ['otter', 'falcon', 'maple', 'cobalt', 'harbor', 'cedar', 'quartz', 'meadow'];
    window.crates = {
      worktreeBranchName: (existing) => {
        const used = new Set(existing || []);
        for (let i = 0; i < 64; i++) { const n = ADJ[i % ADJ.length] + '-' + NOUN[(i * 3) % NOUN.length] + (i > 15 ? '-' + i : ''); if (!used.has(n)) return n; }
        return 'branch-' + (used.size + 1);
      },
      fuzzy: {
        matchIndices: (text, query) => { // subsequence match -> matched char indices, or null
          const t = text.toLowerCase(), q = query.toLowerCase(), out = []; let qi = 0;
          for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) { out.push(i); qi++; }
          return qi === q.length ? out : null;
        },
        containsWildcards: (q) => /[*?]/.test(q),
        matchWildcard: (text, pat) => new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i').test(text),
      },
    };
  }
})();
