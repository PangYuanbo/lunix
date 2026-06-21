// Engine I/O test: scrollback history (term.js) + keyboard->bytes encoding (keys.js) — the two
// pieces term.js needs to fully replace xterm's engine for a live, interactive pane. Plain Node.
'use strict';
const assert = require('assert');
const { Terminal } = require('../src/crates/warp_terminal/term');
const { encodeKey, encodePaste } = require('../src/crates/warp_terminal/keys');

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const W = (t, s) => t.write(Buffer.from(s, 'utf8'));
const rowText = (row) => row.map((c) => c.spacer ? '' : c.c).join('').replace(/\s+$/, '');

// ---- scrollback ----
{
  const t = new Terminal(6, 2);                 // 2 visible rows
  W(t, 'L1\r\nL2\r\nL3\r\nL4');                  // L1,L2 scroll off; L3,L4 visible
  ok(t.scrollback.length === 2, 'two rows in scrollback -> ' + t.scrollback.length);
  ok(rowText(t.scrollback[0]) === 'L1' && rowText(t.scrollback[1]) === 'L2', 'scrollback holds L1,L2');
  ok(rowText(t.grid[0]) === 'L3' && rowText(t.grid[1]) === 'L4', 'viewport holds L3,L4');
  ok(t.totalRows() === 4, 'totalRows = history+viewport');
  ok(rowText(t.rowAt(0)) === 'L1' && rowText(t.rowAt(3)) === 'L4', 'rowAt spans history+viewport');
}
{
  const t = new Terminal(4, 2, { maxScrollback: 3 });
  for (let i = 0; i < 10; i++) W(t, 'r' + i + '\r\n');
  ok(t.scrollback.length <= 3, 'scrollback capped at maxScrollback -> ' + t.scrollback.length);
}

// ---- keyboard encoding ----
const K = (key, mods = {}) => encodeKey({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });
const hex = (s) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');

ok(K('a') === 'a', 'plain a');
ok(K('Enter') === '\r', 'Enter -> CR');
ok(K('Backspace') === '\x7f', 'Backspace -> DEL (0x7f)');
ok(K('Tab') === '\t', 'Tab -> HT');
ok(K('Tab', { shiftKey: true }) === '\x1b[Z', 'Shift+Tab -> CSI Z');
ok(K('Escape') === '\x1b', 'Escape -> ESC');
ok(K('c', { ctrlKey: true }) === '\x03', 'Ctrl+C -> 0x03 (' + hex(K('c', { ctrlKey: true })) + ')');
ok(K('d', { ctrlKey: true }) === '\x04', 'Ctrl+D -> 0x04');
ok(K('a', { ctrlKey: true }) === '\x01', 'Ctrl+A -> 0x01');
ok(K('ArrowUp') === '\x1b[A', 'Up -> CSI A');
ok(K('ArrowDown') === '\x1b[B', 'Down -> CSI B');
ok(K('ArrowRight') === '\x1b[C', 'Right -> CSI C');
ok(K('ArrowLeft') === '\x1b[D', 'Left -> CSI D');
ok(K('Home') === '\x1b[H', 'Home -> CSI H');
ok(K('End') === '\x1b[F', 'End -> CSI F');
ok(K('ArrowUp', { ctrlKey: true }) === '\x1b[1;5A', 'Ctrl+Up -> CSI 1;5A (' + hex(K('ArrowUp', { ctrlKey: true })) + ')');
ok(K('ArrowRight', { shiftKey: true }) === '\x1b[1;2C', 'Shift+Right -> CSI 1;2C');
ok(K('Delete') === '\x1b[3~', 'Delete -> CSI 3~');
ok(K('PageUp') === '\x1b[5~', 'PageUp -> CSI 5~');
ok(K('F1') === '\x1bOP', 'F1 -> SS3 P');
ok(K('F5') === '\x1b[15~', 'F5 -> CSI 15~');
ok(K('x', { altKey: true }) === '\x1bx', 'Alt+x -> ESC x');
ok(K('Shift') === '', 'pure modifier -> empty');

// round-trip: typing "echo hi\n" through the encoder then into a Terminal yields the text on screen
{
  const t = new Terminal(20, 3);
  for (const ch of 'echo hi') t.write(Buffer.from(K(ch)));
  ok(rowText(t.grid[0]) === 'echo hi', 'typed bytes render on the grid -> ' + rowText(t.grid[0]));
}

// bracketed paste wrapping
ok(encodePaste('ls', true) === '\x1b[200~ls\x1b[201~', 'bracketed paste wraps');
ok(encodePaste('ls', false) === 'ls', 'unbracketed paste is raw');

console.log(`ENGINE IO PASS: ${n} assertions`);
