// ansi_html test: drive term.js with colored output, render rows to HTML, assert the grouped spans
// carry the right colors / attributes. Plain Node.
'use strict';
const assert = require('assert');
const { Terminal } = require('../src/crates/warp_terminal/term');
const { buildPalette, BASE16 } = require('../src/crates/warp_terminal/engine_pane');
const { rowToHtml, rowsToHtml, rowsToHtmlLines } = require('../src/crates/warpui/ansi_html');

const pal = buildPalette(BASE16);
const fgDef = [200, 205, 214], bgDef = [30, 33, 39];
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const W = (t, s) => t.write(Buffer.from(s, 'utf8'));

// 1. plain text -> a single span with the text
{
  const t = new Terminal(20, 3); W(t, 'hello');
  const html = rowToHtml(t.grid[0], pal, fgDef, bgDef);
  ok(/<span[^>]*>hello<\/span>/.test(html), 'plain text span -> ' + html);
}

// 2. red bold + reset -> two spans, first bold red
{
  const t = new Terminal(20, 3); W(t, '\x1b[1;31mERR\x1b[0mok');
  const html = rowToHtml(t.grid[0], pal, fgDef, bgDef);
  ok(/font-weight:600/.test(html), 'bold present');
  ok(html.indexOf('rgb(255,130,114)') >= 0, 'ANSI red resolved (Warp #FF8272) -> ' + html);
  ok((html.match(/<span/g) || []).length >= 2, 'split into >=2 runs');
}

// 3. truecolor + underline
{
  const t = new Terminal(20, 3); W(t, '\x1b[38:2:10:20:30m\x1b[4mU');
  const html = rowToHtml(t.grid[0], pal, fgDef, bgDef);
  ok(html.indexOf('rgb(10,20,30)') >= 0, 'truecolor fg');
  ok(/text-decoration:[^"]*underline/.test(html), 'underline deco');
}

// 4. HTML is escaped (no injection from shell output)
{
  const t = new Terminal(30, 3); W(t, '<script>&');
  const html = rowToHtml(t.grid[0], pal, fgDef, bgDef);
  ok(html.indexOf('&lt;script&gt;&amp;') >= 0, 'escaped -> ' + html);
  ok(html.indexOf('<script>') === -1, 'no raw <script>');
}

// 5. trailing blanks trimmed; empty row -> ''
{
  const t = new Terminal(20, 3); W(t, 'hi');
  ok(rowToHtml(t.grid[1], pal, fgDef, bgDef) === '', 'empty row -> empty string');
}

// 6. multi-row range with CRLF
{
  const t = new Terminal(20, 4); W(t, 'a\r\n\x1b[32mb\x1b[0m\r\nc');
  const html = rowsToHtml(t, 0, 2, pal, fgDef, bgDef);
  ok(html.split('\n').length === 3, 'three lines');
  ok(html.indexOf('rgb(180,250,114)') >= 0, 'green on middle line (Warp #B4FA72)');
}

// 7. inverse swaps fg/bg
{
  const t = new Terminal(20, 3); W(t, '\x1b[7mX');
  const html = rowToHtml(t.grid[0], pal, fgDef, bgDef);
  ok(/background:rgb\(200,205,214\)/.test(html), 'inverse uses fg as bg -> ' + html);
}

// 8. cursorCol marks one cell as a .wcursor span (alt-screen block cursor)
{
  const t = new Terminal(20, 3); W(t, 'abc');
  const html = rowToHtml(t.grid[0], pal, fgDef, bgDef, 1);
  ok(/<span class="wcursor">b<\/span>/.test(html), 'cursor cell wrapped -> ' + html);
}

// 9. cursor on a trailing blank cell is still rendered (last extended to cursorCol)
{
  const t = new Terminal(20, 3); W(t, 'hi');
  const html = rowToHtml(t.grid[0], pal, fgDef, bgDef, 5);
  ok(/<span class="wcursor"> <\/span>/.test(html), 'blank cursor cell kept -> ' + html);
}

// 10. chunked active render preserves blank rows between chunks
{
  const t = new Terminal(20, 4); W(t, 'a\r\n\r\nb');
  const full = rowsToHtml(t, 0, 2, pal, fgDef, bgDef, null, { trimEnd: false });
  const chunked = [
    rowsToHtml(t, 0, 0, pal, fgDef, bgDef, null, { trimEnd: false }),
    rowsToHtml(t, 1, 1, pal, fgDef, bgDef, null, { trimEnd: false }),
    rowsToHtml(t, 2, 2, pal, fgDef, bgDef, null, { trimEnd: false }),
  ].join('\n');
  ok(chunked === full, 'chunked blank row render matches full');
}

// 11. row snapshots preserve the same per-line HTML as the joined renderer
{
  const t = new Terminal(20, 4); W(t, 'a\r\n\x1b[32mb\x1b[0m');
  ok(rowsToHtmlLines(t, 0, 1, pal, fgDef, bgDef).join('\n') === rowsToHtml(t, 0, 1, pal, fgDef, bgDef), 'row snapshot matches joined HTML');
}

console.log(`ANSI HTML PASS: ${n} assertions`);
