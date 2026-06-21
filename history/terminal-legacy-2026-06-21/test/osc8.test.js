// OSC 8 explicit hyperlinks: term.js must tag cells with the active link (persisting across SGR),
// and ansi_html must emit them as .wlink spans with data-url. Plain Node.
'use strict';
const assert = require('assert');
const { Terminal } = require('../src/crates/warp_terminal/term');
const { buildPalette, BASE16 } = require('../src/crates/warp_terminal/engine_pane');
const { rowToHtml } = require('../src/crates/warpui/ansi_html');
const pal = buildPalette(BASE16);
const fg = [255, 255, 255], bg = [0, 0, 0];
const W = (t, s) => t.write(Buffer.from(s, 'utf8'));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 1. cells inside OSC 8 carry the link; cells after the closing OSC 8;; do not
{
  const t = new Terminal(40, 2);
  W(t, '\x1b]8;;https://warp.dev\x07Warp\x1b]8;;\x07 x');
  ok(t.grid[0][0].link === 'https://warp.dev', 'linked cell carries URI -> ' + t.grid[0][0].link);
  ok(t.grid[0][3].link === 'https://warp.dev', 'whole label linked');
  ok(t.grid[0][5].link == null, 'cell after close is unlinked -> ' + t.grid[0][5].link);
}

// 2. ansi_html emits a .wlink span with the data-url for linked cells
{
  const t = new Terminal(40, 2);
  W(t, '\x1b]8;;https://warp.dev/docs\x07click\x1b]8;;\x07');
  const html = rowToHtml(t.grid[0], pal, fg, bg);
  ok(/class="wlink"/.test(html), 'emits .wlink span -> ' + html);
  ok(html.indexOf('data-url="https://warp.dev/docs"') >= 0, 'carries data-url -> ' + html);
  ok(html.indexOf('click') >= 0, 'link text preserved');
}

// 3. link survives an SGR color change mid-link (OSC 8 is independent of the pen)
{
  const t = new Terminal(40, 2);
  W(t, '\x1b]8;;http://a.io\x07a\x1b[31mb\x1b[0mc\x1b]8;;\x07');
  ok(t.grid[0][0].link === 'http://a.io' && t.grid[0][1].link === 'http://a.io' && t.grid[0][2].link === 'http://a.io',
    'link persists across SGR -> ' + [0, 1, 2].map((i) => t.grid[0][i].link).join(','));
}

console.log(`OSC8 PASS: ${n} assertions`);
