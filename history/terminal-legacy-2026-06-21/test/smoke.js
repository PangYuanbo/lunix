// CDP smoke test against the live Electron renderer. Run app with --remote-debugging-port=9222.
const assert = require('assert');

async function getPageWs() {
  const port = process.env.CDP_PORT || 9222;
  const res = await fetch(`http://localhost:${port}/json`);
  const page = (await res.json()).find((t) => t.type === 'page' && t.title === 'Warp');
  assert(page, 'Warp renderer not found — launch with --remote-debugging-port=9222');
  return page.webSocketDebuggerUrl;
}
function cdp(ws) {
  let id = 0; const pending = new Map(); const errors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value).join(' '));
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
    return r.result.result.value;
  };
  return { send, evalJs, errors };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const ws = new WebSocket(await getPageWs());
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const { send, evalJs, errors } = cdp(ws);
  await send('Runtime.enable');

  // 1. terminal mounted (from-scratch engine lives at activePane.view.term)
  assert.ok(await evalJs('!!window.__warp.activePane && window.__warp.activePane.view.term.rows > 0'), 'terminal not mounted');

  // 2. command -> block forms + output renders
  const before = await evalJs('window.__warp.activePane.blocks.length');
  await evalJs("window.__warp.write('echo warp_block_test\\r')");
  await sleep(1400);
  assert.ok(await evalJs('window.__warp.activePane.blocks.length') > before, 'block did not form');
  // Scrape the from-scratch grid (no xterm buffer API): join every logical row's plain text.
  const screen = await evalJs(`(function(){var t=window.__warp.activePane.view.term;var out=[];for(var i=0;i<t.totalRows();i++){var r=t.rowAt(i);out.push(r?r.map(function(c){return c.spacer?'':c.c;}).join(''):'');}return out.join('\\n');})()`);
  assert.ok(/warp_block_test/.test(screen), 'output not on screen');

  // 3. history captured (completions source)
  assert.ok(await evalJs("window.__warp.history.some(h=>h.includes('warp_block_test'))"), 'history not captured');

  // 4. tabs
  const tabsBefore = await evalJs('window.__warp.tabs.length');
  await evalJs('window.__warp.makeTab()'); await sleep(400);
  assert.strictEqual(await evalJs('window.__warp.tabs.length'), tabsBefore + 1, 'tab not created');

  // 5. split pane
  const panesBefore = await evalJs('window.__warp.panes.size');
  await evalJs('window.__warp.splitActive()'); await sleep(400);
  assert.ok(await evalJs('window.__warp.panes.size') > panesBefore, 'pane not split');

  // 6. AI (offline heuristic works without key)
  await evalJs('window.__warp.openAI()');
  const ai = await evalJs("window.warp.aiAsk('list all files here')");
  assert.ok(/ls/.test(ai.text), 'AI did not return a command: ' + JSON.stringify(ai));
  await evalJs("document.getElementById('ai').classList.add('hidden')");

  // 7. workflow save -> persisted in store
  const wfBefore = await evalJs('window.__warp.store.workflows.length');
  await evalJs("(function(){window.__warp.store.workflows.unshift({name:'t',command:'echo wf'});window.warp.storeSet(window.__warp.store);})()");
  assert.ok(await evalJs('window.__warp.store.workflows.length') > wfBefore, 'workflow not saved');

  // 8. palette opens + lists items
  await evalJs('window.__warp.openPalette()'); await sleep(150);
  assert.ok(await evalJs("document.querySelectorAll('#palette-list li').length") > 5, 'palette empty');
  await evalJs("document.getElementById('palette').classList.add('hidden')");

  // 9. theme applies
  await evalJs("window.__warp.applyTheme('dracula')");
  assert.strictEqual(await evalJs("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"), '#bd93f9', 'theme not applied');

  // 10. frozen snapshot hydrates without replaying the terminal grid and can page output rows
  await evalJs(`(function(){
    const rows = Array.from({length:300}, (_, i) => '<span style="color:rgb(255,255,255);">snap '+i+'</span>');
    window.__warp.activePane.view.loadSnapshot({version:1, blocks:[{cmd:'snapshot bench', cwd:'~', exit:0, pageRows:40, outputHtmlRows:rows}]});
  })()`);
  assert.strictEqual(await evalJs('window.__warp.activePane.blocks.length'), 1, 'snapshot block count');
  assert.ok(await evalJs("window.__warp.activePane.el.querySelector('.wblock-out').textContent.includes('snap 0')"), 'snapshot first page missing');
  assert.ok(!await evalJs("window.__warp.activePane.el.querySelector('.wblock-out').textContent.includes('snap 240')"), 'snapshot rendered too many rows');
  assert.ok(await evalJs('window.__warp.activePane.view.renderSnapshotPage(0, 240)'), 'snapshot page render failed');
  assert.ok(await evalJs("window.__warp.activePane.el.querySelector('.wblock-out').textContent.includes('snap 240')"), 'snapshot page did not move');

  await sleep(300);
  assert.strictEqual(errors.length, 0, 'console errors:\n' + errors.join('\n'));
  console.log('PASS: blocks, history, tabs, split, AI, workflow, palette, theme, snapshot, no-errors');
  ws.close(); process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
