// block_view — Warp-style block-card terminal UI. Driven by the from-scratch engine (term.js vte +
// Grid<Cell>), it renders each command as a DOM "block": a cwd breadcrumb + command header, a hover
// toolbar (copy / rerun / save), an exit-status chip, and ANSI-colored output (ansi_html). At the
// bottom sits a dedicated prompt editor with cwd + git context chips — not an inline terminal line.
// This is Warp's actual UI model: blocks are UI elements, not a raw scrolling grid.
//
// mountBlockPane(container, io, opts) -> controller { term, write, focus, fit, clear, setTheme, ... }
// io = { spawn(cols,rows), write(bytes), resize(cols,rows) }  (PTY data is fed in via controller.write)
'use strict';
(function (root) {
  const Term = (typeof require !== 'undefined') ? require('../warp_terminal/term').Terminal : root.WarpTerminal;
  const keys = (typeof require !== 'undefined') ? require('../warp_terminal/keys') : { encodeKey: root.warpEncodeKey, encodePaste: root.warpEncodePaste };
  const ansi = (typeof require !== 'undefined') ? require('./ansi_html') : root.warpAnsiHtml;
  const cli = (typeof require !== 'undefined') ? require('../warp_terminal/cli_agent') : root.warpCliAgent;
  const buildPalette = (typeof require !== 'undefined') ? require('../warp_terminal/engine_pane').buildPalette : root.warpBuildPalette;
  const BASE16 = (typeof require !== 'undefined') ? require('../warp_terminal/engine_pane').BASE16 : root.warpBASE16;

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function fmtDur(ms) { if (ms < 1000) return Math.round(ms) + 'ms'; const s = ms / 1000; return (s < 10 ? s.toFixed(1) : Math.round(s)) + 's'; }
  function stripPrompt(s) { const m = s.match(/[%$#>›❯]\s?(.*)$/); return (m ? m[1] : s).trim(); }
  // Detect URLs AND file paths in already-rendered output and wrap them as hover-underline links
  // (Warp: underline in URL_COLOR on hover, glyph color unchanged; Cmd/middle-click opens — URLs in
  // the browser, files in the editor/Finder). Walks text nodes so the per-cell ANSI colors survive.
  // Group 1 = http(s) URL; group 2 = file path (abs /…, ~/, ./, ../) with optional :line:col.
  const LINK_RE = /(https?:\/\/[^\s<>"'`)\]}\\]+)|((?<![:/\w])(?:~|\.{1,2})?\/[\w.@+-]+(?:\/[\w.@+-]+)*(?::\d+(?::\d+)?)?)/g;
  function linkify(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const targets = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement && n.parentElement.closest('.wlink')) continue;  // already an OSC 8 link
      if (LINK_RE.test(n.nodeValue)) targets.push(n); LINK_RE.lastIndex = 0;
    }
    for (const node of targets) {
      const frag = document.createDocumentFragment(); let last = 0; const s = node.nodeValue; let m;
      LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(s))) {
        if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        const a = document.createElement('span'); a.className = 'wlink'; a.textContent = m[0];
        if (m[1]) a.dataset.url = m[0]; else a.dataset.file = m[0];
        frag.appendChild(a); last = m.index + m[0].length;
      }
      if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  function mountBlockPane(container, io, opts = {}) {
    opts = opts || {};
    const pal = buildPalette(opts.base16 || BASE16);
    const fgDef = opts.fg || [255, 255, 255], bgDef = opts.bg || [0, 0, 0];  // theme.foreground()/background() = #fff/#000
    const cellW = opts.cellW || 8;   // used only to compute cols from width
    const lineH = opts.lineH || 20;

    container.classList.add('wpane');
    const blocksEl = el('div', 'wblocks');
    const promptEl = el('div', 'wprompt',
      '<div class="wprompt-line"><span class="wprompt-caret">❯</span>'
      + '<span class="wprompt-input"></span><span class="wprompt-cursor"></span><span class="wprompt-ghost"></span></div>'
      + '<div class="wprompt-ctx"><span class="wctx-cwd">~</span><span class="wctx-git" style="display:none"></span></div>');
    container.appendChild(blocksEl);
    container.appendChild(promptEl);
    // Open a detected URL externally. Warp's should_directly_open_link: Cmd+click (macOS) /
    // Ctrl+click (Linux/Win), plus middle-click. Plain click does NOT open (it selects).
    const openLink = (a) => {
      if (!a) return;
      if (a.dataset.url) (opts.onOpenUrl || ((u) => root.open && root.open(u)))(a.dataset.url);
      else if (a.dataset.file) (opts.onOpenFile || (() => {}))(a.dataset.file);
    };
    const isMac = (root.navigator && /Mac/.test(root.navigator.platform));
    // On container (not blocksEl) so links work in the live-agent / alt-screen fullscreen viewport too.
    container.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('.wlink'); if (!a) return;
      if (isMac ? e.metaKey : e.ctrlKey) { e.preventDefault(); openLink(a); }
    });
    container.addEventListener('auxclick', (e) => {                 // middle-click also opens
      if (e.button !== 1) return; const a = e.target.closest && e.target.closest('.wlink');
      if (a) { e.preventDefault(); openLink(a); }
    });

    const measure = () => {
      const w = blocksEl.clientWidth || 800, h = blocksEl.clientHeight || 400;
      return { cols: Math.max(20, Math.floor((w - 28) / cellW)), rows: Math.max(4, Math.floor(h / lineH)) };
    };
    let { cols, rows } = measure();
    const ctrl = { inputBuf: '', _suggest: '', cwd: '~', gitBranch: '', blocks: [], _cmdQueue: [] };

    const term = new Term(cols, rows, { maxScrollback: opts.maxScrollback || 200000, onOsc: (num, args) => onOsc(num, args), onBell: () => {}, onAltScreen: (on) => onAltScreen(on) });
    ctrl.term = term;
    // Full-screen viewport — used for alt-screen apps (vim/top/less) AND live CLI agents (claude/codex).
    // Rendering the visible grid bottom-anchored pins the agent's own input box at the bottom of the pane
    // (Warp does the same: the agent owns a fixed region, its input doesn't scroll away).
    const altEl = el('div', 'walt', '<div class="walt-head"></div><div class="walt-grid"></div>');
    altEl.style.display = 'none'; container.appendChild(altEl);
    const altHead = altEl.querySelector('.walt-head'), altGrid = altEl.querySelector('.walt-grid');
    function onAltScreen(on) { ctrl.alt = on; updateView(); }
    // Fullscreen when an alt-screen app is up, or the active command is a live (running) CLI agent.
    function fullscreenOn() { return ctrl.alt || !!(ctrl.active && ctrl.active.agent && !ctrl.active.frozen); }
    function updateView() {
      const fs = fullscreenOn();
      altEl.style.display = fs ? '' : 'none';
      blocksEl.style.display = fs ? 'none' : '';
      promptEl.style.display = fs ? 'none' : '';      // the agent/app owns the input while fullscreen
      ctrl._fs = fs;
      if (fs) renderAlt();
    }
    function renderAlt() {
      // Brand header (live CLI agent only) — keeps the agent identity while its TUI owns the viewport.
      const a = !ctrl.alt && ctrl.active && ctrl.active.agent;
      if (a) {
        altEl.style.setProperty('--brand', a.display);
        altHead.innerHTML = '<span class="wb-agent"><span class="wb-agent-dot"' + (a.darkIcon ? ' data-dark="1"' : '')
          + ' style="background:' + a.display + '">' + ansi.esc(a.glyph) + '</span>'
          + '<span class="wb-agent-name">' + ansi.esc(a.name) + '</span></span>';
        altHead.style.display = '';
      } else { altHead.style.display = 'none'; }
      // Render the visible screen grid as a full-pane monospace view, with the app's block cursor.
      // For a live agent, start just after its command line so the raw shell prompt isn't shown (the
      // brand header already identifies it); fall back to the visible top once that line scrolls off.
      const base = term.scrollback.length;
      const from = (a && ctrl.active.cmdAbs != null) ? Math.max(base, ctrl.active.cmdAbs + 1) : base;
      const cursor = term.cursorVisible ? { row: base + term.cursor.row, col: term.cursor.col } : null;
      ctrl._vpFrom = from; ctrl._vpBase = base;        // remembered for canvas click hit-testing
      if (gpuOk()) gpuRender(from, base, cursor);      // GPU: fast for the agent's constant redraws
      else { altGrid.innerHTML = ansi.rowsToHtml(term, from, base + term.rows - 1, pal, fgDef, bgDef, cursor); linkify(altGrid); }
    }

    // --- GPU viewport (WebGL) — high-perf rendering of the agent/alt full-screen grid. Falls back to
    // DOM if WebGL is unavailable. Links aren't DOM spans here, so clicks are hit-tested on the canvas.
    const ACCENT = [0.098, 0.667, 0.847];
    function gpuOk() {
      if (ctrl._gpu) return true;
      if (ctrl._gpuFailed || !root.GpuTerminal || !root.GlyphAtlas) return false;
      try {
        const canvas = el('canvas', 'walt-canvas');
        const atlas = new root.GlyphAtlas(cellW, lineH, { font: opts.font || 'Menlo, monospace' });
        ctrl._gpu = new root.GpuTerminal(canvas, atlas, term.cols, term.rows, cellW, lineH);
        ctrl._gpuCanvas = canvas; altGrid.innerHTML = ''; altGrid.appendChild(canvas);
        canvas.addEventListener('mousedown', onCanvasClick);
        return true;
      } catch (e) { ctrl._gpuFailed = true; return false; }
    }
    function gpuRender(from, base, cursor) {
      const gpu = ctrl._gpu, c = ctrl._gpuCanvas;
      if (gpu.cols !== term.cols || gpu.rows !== term.rows) { gpu.cols = term.cols; gpu.rows = term.rows; }
      if (c.width !== term.cols * cellW || c.height !== term.rows * lineH) { c.width = term.cols * cellW; c.height = term.rows * lineH; }
      gpu.clear();
      let vr = 0;
      for (let i = from; i <= base + term.rows - 1; i++, vr++) {
        const row = term.rowAt(i); if (!row) continue;
        for (let col = 0; col < term.cols; col++) {
          const cell = row[col]; if (!cell || cell.spacer) continue;
          if (cell.c === ' ' && cell.bg.t === 'bg' && !cell.underline && !cell.strike) continue;
          let fg = ansi.resolve(cell.fg, fgDef, pal), bg = cell.bg.t === 'bg' ? null : ansi.resolve(cell.bg, bgDef, pal);
          if (cell.inverse) { const t = fg; fg = bg || bgDef; bg = t; }
          if (cell.dim) fg = [fg[0] * 0.66, fg[1] * 0.66, fg[2] * 0.66];
          gpu.setCell(vr, col, cell.c === '\0' ? ' ' : cell.c, [fg[0] / 255, fg[1] / 255, fg[2] / 255],
            bg ? [bg[0] / 255, bg[1] / 255, bg[2] / 255] : null, cell.width,
            { bold: cell.bold, italic: cell.italic, underline: cell.underline, strike: cell.strike });
        }
      }
      if (cursor) gpu.setCursor(cursor.row - from, cursor.col, 'block', ACCENT);
      gpu.draw([0, 0, 0]);
    }
    // Cmd/middle-click on the GPU viewport: map pixel -> cell -> scan the row text for a URL/file -> open.
    function onCanvasClick(e) {
      const open = (isMac ? e.metaKey : e.ctrlKey) || e.button === 1;
      if (!open) return;
      const r = ctrl._gpuCanvas.getBoundingClientRect();
      const col = Math.floor((e.clientX - r.left) / (r.width / term.cols));
      const vr = Math.floor((e.clientY - r.top) / (r.height / term.rows));
      const rowIdx = (ctrl._vpFrom || 0) + vr;
      const row = term.rowAt(rowIdx); if (!row) return;
      const text = row.map((c) => c.spacer ? '' : c.c).join('');
      let m; LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(text))) {
        if (col >= m.index && col < m.index + m[0].length) {
          e.preventDefault();
          if (m[1]) (opts.onOpenUrl || (() => {}))(m[0]); else (opts.onOpenFile || (() => {}))(m[0]);
          return;
        }
      }
    }

    // --- blocks ---
    function makeBlock(data = {}) {
      const b = Object.assign({ cmdAbs: null, exit: null, cwd: ctrl.cwd, branch: ctrl.gitBranch, frozen: false }, data);
      b.el = el('div', 'wblock');
      b.el.innerHTML =
        '<div class="wblock-gutter"></div>'
        + '<div class="wblock-body">'
        + '<div class="wblock-cwd"></div>'
        + '<div class="wblock-cmd"></div>'
        + '<div class="wblock-out"></div></div>'
        + '<div class="wblock-tools">'
        + '<button data-act="copy-cmd" title="Copy command">⧉</button>'
        + '<button data-act="copy-out" title="Copy output">⎘</button>'
        + '<button data-act="rerun" title="Rerun">↻</button>'
        + '<button data-act="save" title="Save as workflow">☆</button></div>';
      b.el.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); (opts.onAction || (() => {}))(b, btn.dataset.act, blockText(b)); }));
      b.el.addEventListener('mousedown', () => focus());
      blocksEl.appendChild(b.el);
      ctrl.blocks.push(b);
      return b;
    }

    function startBlock() {
      const prev = ctrl.active;
      const b = makeBlock({ startAbs: term.scrollback.length + term.cursor.row });
      ctrl.active = b;
      // Finalize the previous block now that its boundary (b.startAbs) is known — so a no-output
      // command's range can't bleed into this new prompt's echoed command line.
      if (prev && !prev.frozen) { prev.frozen = true; renderBlock(prev); }
      return b;
    }

    function blockText(b) {
      if (b.outputHtmlRows) return { cmd: cmdOf(b), out: htmlRowsText(b.outputHtmlRows) };
      const end = blockEnd(b);
      return { cmd: cmdOf(b), out: ansiText(b.cmdAbs != null ? b.cmdAbs + 1 : b.startAbs, end) };
    }
    function blockEnd(b) {
      if (b.endAbs != null) return b.endAbs - 1;   // exact: captured at OSC 133;D (command finished)
      const i = ctrl.blocks.indexOf(b), next = ctrl.blocks[i + 1];
      return (next ? next.startAbs - 1 : term.totalRows() - 1);
    }
    // The command shown in the head: prefer the exact text the user typed (captured at Enter);
    // fall back to scraping the prompt line from the grid (for programmatic / rerun commands).
    function cmdOf(b) {
      if (b.cmd != null) return b.cmd;
      const to = b.cmdAbs != null ? b.cmdAbs : (term.scrollback.length + term.cursor.row);
      const lines = [];
      for (let i = b.startAbs; i <= to && i < term.totalRows(); i++) { const r = rowPlain(term.rowAt(i)); if (r) lines.push(r); }
      return stripPrompt(lines.join('\n').replace(/\n+$/, '')).split('\n')[0] || '';
    }
    function rowPlain(row) { return row ? row.map((c) => c.spacer ? '' : c.c).join('').replace(/\s+$/, '') : ''; }
    function ansiText(from, to) { const n = term.totalRows(), out = []; for (let i = Math.max(0, from); i <= to && i < n; i++) out.push(rowPlain(term.rowAt(i))); while (out.length && !out[out.length - 1]) out.pop(); return out.join('\n'); }
    function htmlRowsText(rows) { return rows.join('\n').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }

    function renderBlock(b) {
      const cwdEl = b.el.querySelector('.wblock-cwd');
      const cmdEl = b.el.querySelector('.wblock-cmd');
      const outEl = b.el.querySelector('.wblock-out');
      if (b.banner) {                                  // pre-first-prompt content: all rows are output, no head
        cwdEl.style.display = 'none'; cmdEl.style.display = 'none';
        const html = ansi.rowsToHtml(term, b.startAbs, blockEnd(b), pal, fgDef, bgDef);
        outEl.innerHTML = html; outEl.style.display = html ? '' : 'none';
        if (html) linkify(outEl);
        return;
      }
      // Clean cwd line: "~/path  git:(branch)" — the muted Warp breadcrumb. No exit-code pill.
      cwdEl.style.display = '';
      const path = b.cwd || '~';
      cwdEl.innerHTML = '<span class="wb-path">' + ansi.esc(path) + '</span>'
        + (b.branch ? ' <span class="wb-git">git:(<span class="wb-branch">' + ansi.esc(b.branch) + '</span>)</span>' : '')
        + (b.dur != null ? '<span class="wb-meta">' + fmtDur(b.dur) + '</span>' : '');
      cmdEl.style.display = '';
      const cmdText = cmdOf(b) || '';
      cmdEl.innerHTML = highlightCmd(cmdText);
      // CLI agent (Claude Code / Codex / Gemini / …): brand the block like Warp does — a left flag pole
      // in the agent's brand color + an identity badge (brand tile + name). Mirrors cli_agent.rs.
      const agent = b.agent || (b.agent = cli.detect(cmdText));
      b.el.classList.toggle('agent', !!agent);
      // While the agent is the live (running, unfrozen) command, strip our block chrome so its own
      // TUI shows clean & full-width — Warp hands a running agent a frameless region, not a boxed block.
      b.el.classList.toggle('live', !!(agent && b === ctrl.active && !b.frozen));
      if (agent) {
        b.el.style.setProperty('--brand', agent.display);   // contrast-adjusted for the dark bg
        cwdEl.innerHTML = '<span class="wb-agent">'
          + '<span class="wb-agent-dot"' + (agent.darkIcon ? ' data-dark="1"' : '') + ' style="background:' + agent.display + '">' + ansi.esc(agent.glyph) + '</span>'
          + '<span class="wb-agent-name">' + ansi.esc(agent.name) + '</span></span>' + cwdEl.innerHTML;
      }
      // Failure shows as a subtle red left edge (Warp's approach), not a pill.
      b.el.classList.toggle('failed', b.exit != null && b.exit !== 0);
      const from = b.cmdAbs != null ? b.cmdAbs : null;
      if (b.outputHtmlRows) renderSnapshotOutput(b, outEl);
      else if (from != null) renderOutput(b, outEl, from, blockEnd(b));
      else { outEl.style.display = 'none'; }
    }

    function renderSnapshotOutput(b, outEl) {
      const rows = b.outputHtmlRows || [];
      const pageRows = b.pageRows || opts.snapshotPageRows || term.rows || 80;
      const start = Math.max(0, Math.min(b.pageStart || 0, Math.max(0, rows.length - pageRows)));
      b.pageStart = start;
      const html = rows.slice(start, start + pageRows).join('\n');
      outEl.innerHTML = html; outEl.style.display = html ? '' : 'none';
      if (html) linkify(outEl);
    }

    function renderOutput(b, outEl, from, to) {
      const final = !!b.frozen;
      const full = final || b._outFrom !== from || b._outTo == null || to < b._outTo;
      if (full) {
        const html = ansi.rowsToHtml(term, from, to, pal, fgDef, bgDef, null, { trimEnd: final });
        outEl.innerHTML = html; outEl.style.display = html ? '' : 'none';
        if (html) linkify(outEl);
        b._outFrom = from; b._outTo = to;
        return;
      }
      if (to === b._outTo) return;
      const html = ansi.rowsToHtml(term, b._outTo + 1, to, pal, fgDef, bgDef, null, { trimEnd: false });
      const prefix = b._outTo >= from ? '\n' : '';
      if (prefix || html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = prefix + html;
        if (html) linkify(tpl.content);
        outEl.appendChild(tpl.content);
        outEl.style.display = '';
      }
      b._outTo = to;
    }

    function onOsc(num, args) {
      if (num === '133') {
        const k = args[0];
        if (k === 'A') startBlock();
        else if (k === 'C') { if (!ctrl.active || ctrl.active.cmdAbs != null || ctrl.active.banner) startBlock(); ctrl.active.cmdAbs = term.scrollback.length + term.cursor.row; ctrl.active.cwd = ctrl.cwd; ctrl.active.branch = ctrl.gitBranch; ctrl.active.t0 = now(); if (ctrl.active.cmd == null && ctrl._cmdQueue.length) ctrl.active.cmd = ctrl._cmdQueue.shift(); const c = cmdOf(ctrl.active); if (c) { (opts.onCommand || (() => {}))(c); } renderBlock(ctrl.active); }
        else if (k === 'D' && ctrl.active) { ctrl.active.exit = args[1] != null ? parseInt(args[1], 10) : 0; ctrl.active.endAbs = term.scrollback.length + term.cursor.row; if (ctrl.active.t0) ctrl.active.dur = now() - ctrl.active.t0; ctrl.active.frozen = true; renderBlock(ctrl.active); scrollToBottom(); }
      } else if (num === '7001') {                      // exact command text from the shell preexec hook
        // Never attach the command to the banner block (it renders output-only and would swallow the
        // first command); queue it so the real block created at OSC 133;C picks it up.
        if (ctrl.active && !ctrl.active.frozen && !ctrl.active.banner) { ctrl.active.cmd = args[0] || ''; renderBlock(ctrl.active); }
        else ctrl._cmdQueue.push(args[0] || '');
      } else if (num === '7' && args[0]) {
        const m = args[0].match(/file:\/\/[^/]*(\/.*)/);
        if (m) { ctrl.cwd = decodeURIComponent(m[1]).replace(/^\/Users\/[^/]+/, '~'); promptEl.querySelector('.wctx-cwd').textContent = ctrl.cwd; (opts.onCwd || (() => {}))(ctrl.cwd); }
      } else if (num === '7000') {                       // custom: git branch
        ctrl.gitBranch = args[0] || '';
        const g = promptEl.querySelector('.wctx-git');
        if (ctrl.gitBranch) { g.style.display = ''; g.textContent = '⎇ ' + ctrl.gitBranch; } else g.style.display = 'none';
        (opts.onBranch || (() => {}))(ctrl.gitBranch);
      }
    }

    // --- render loop ---
    let pending = false;
    function scrollToBottom() { blocksEl.scrollTop = blocksEl.scrollHeight; }
    // ponytail: bulk active streams skip per-frame auto-scroll (research perf win); completion scrolls once.
    function schedule() {
      if (pending) return; pending = true;
      (root.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => {
        pending = false;
        updateView();                                 // switch between block flow and fullscreen viewport
        if (ctrl._fs) return;                          // fullscreen (alt-screen or live agent) already rendered
        if (ctrl.active && !ctrl.active.frozen) renderBlock(ctrl.active);
      });
    }

    // --- input ---
    container.tabIndex = 0;
    function refreshPrompt() {
      promptEl.querySelector('.wprompt-input').innerHTML = highlightCmd(ctrl.inputBuf);
      const g = promptEl.querySelector('.wprompt-ghost');
      g.textContent = (ctrl._suggest && ctrl._suggest.startsWith(ctrl.inputBuf) && ctrl.inputBuf) ? ctrl._suggest.slice(ctrl.inputBuf.length) : '';
    }
    // Warp-style command-line syntax highlight: first token = command, --flags, "strings".
    function highlightCmd(s) {
      if (!s) return '';
      let first = true;
      return s.replace(/("[^"]*"?|'[^']*'?|\S+|\s+)/g, (tok) => {
        if (/^\s+$/.test(tok)) return tok;
        let cls = 'wsh-arg';
        if (/^["']/.test(tok)) cls = 'wsh-str';
        else if (/^-/.test(tok)) cls = 'wsh-flag';
        else if (first) cls = 'wsh-cmd';
        first = false;
        return '<span class="' + cls + '">' + ansi.esc(tok) + '</span>';
      });
    }
    const keyHandler = (e) => {
      if (e.metaKey && (e.key === 'v' || e.key === 'c')) return;
      const bytes = keys.encodeKey(e);
      if (!bytes) return;
      e.preventDefault();
      io.write(bytes);
      if (opts.onInput) opts.onInput(bytes);
      // FIFO queue: commands execute in order, so each OSC 133;C consumes the oldest typed command.
      if (bytes === '\r' || bytes === '\n') { if (ctrl.inputBuf.trim()) ctrl._cmdQueue.push(ctrl.inputBuf.trim()); ctrl.inputBuf = ''; }
      else if (bytes === '\x7f') ctrl.inputBuf = ctrl.inputBuf.slice(0, -1);
      else if (bytes === '\x03' || bytes === '\x1b') ctrl.inputBuf = '';
      else if (bytes.length === 1 && bytes >= ' ') ctrl.inputBuf += bytes;
      refreshPrompt();
    };
    const pasteHandler = (e) => { const t = (e.clipboardData || root.clipboardData).getData('text'); if (t) { e.preventDefault(); io.write(keys.encodePaste(t, false)); } };
    container.addEventListener('keydown', keyHandler);
    container.addEventListener('paste', pasteHandler);

    // --- controller ---
    function utf8(s) { return (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')); }
    ctrl.write = (data) => { term.write(typeof data === 'string' ? utf8(data) : data); schedule(); };
    ctrl.focus = () => container.focus();
    ctrl.fit = () => { const m = measure(); if (m.cols !== term.cols || m.rows !== term.rows) { term.resize(m.cols, m.rows); io.resize(m.cols, m.rows); schedule(); } };
    // Mutate ctrl.blocks in place (length=0) — renderer aliases it as pane.blocks, so reassigning a new
    // array would orphan that alias and the status bar would read a stale block count.
    ctrl.clear = () => { term.scrollback.length = 0; term._reset(); ctrl.blocks.forEach((b) => b.el.remove()); ctrl.blocks.length = 0; ctrl.active = null; ctrl._cmdQueue = []; };
    ctrl.exportSnapshot = () => ({
      version: 1,
      blocks: ctrl.blocks.filter((b) => b.frozen && !b.banner).map((b) => {
        let outputHtmlRows = b.outputHtmlRows;
        if (!outputHtmlRows) {
          const from = b.cmdAbs != null ? b.cmdAbs : b.startAbs;
          outputHtmlRows = ansi.rowsToHtmlLines(term, from, blockEnd(b), pal, fgDef, bgDef);
          while (outputHtmlRows.length && outputHtmlRows[outputHtmlRows.length - 1] === '') outputHtmlRows.pop();
        }
        return { cmd: cmdOf(b), cwd: b.cwd || '~', branch: b.branch || '', exit: b.exit, dur: b.dur || null, outputHtmlRows };
      }),
    });
    // Trusted only: outputHtmlRows is renderer-generated HTML from exportSnapshot/cache, not raw user input.
    ctrl.loadSnapshot = (doc) => {
      ctrl.clear();
      for (const s of (doc && doc.blocks) || []) {
        const b = makeBlock({
          snapshot: true, frozen: true, cmd: s.cmd || '', cwd: s.cwd || '~', branch: s.branch || '',
          exit: s.exit == null ? null : s.exit, dur: s.dur == null ? null : s.dur,
          outputHtmlRows: Array.isArray(s.outputHtmlRows) ? s.outputHtmlRows : String(s.outputHtml || '').split('\n'),
          pageStart: 0, pageRows: s.pageRows || opts.snapshotPageRows || term.rows || 80,
        });
        renderBlock(b);
      }
      ctrl.active = null;
    };
    ctrl.renderSnapshotPage = (blockIndex, startRow) => {
      const b = ctrl.blocks[blockIndex];
      if (!b || !b.outputHtmlRows) return false;
      b.pageStart = startRow || 0; renderBlock(b); return true;
    };
    ctrl.setSuggest = (s) => { ctrl._suggest = s || ''; refreshPrompt(); };
    ctrl.setTheme = (bg) => { if (bg) { ctrl._bg = bg; } };
    ctrl.dispose = () => { container.removeEventListener('keydown', keyHandler); container.removeEventListener('paste', pasteHandler); };

    // Initial "banner" block captures any shell output before the first OSC 133 prompt.
    const b0 = startBlock(); b0.banner = true; renderBlock(b0);

    io.spawn(cols, rows);
    return ctrl;
  }

  const api = { mountBlockPane, stripPrompt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.warpBlockView = api;
})(typeof window !== 'undefined' ? window : globalThis);
