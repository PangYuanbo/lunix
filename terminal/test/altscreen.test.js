// Alt-screen buffer (vim/top/less): ?1049h swaps to a blank screen-sized buffer with no scrollback;
// ?1049l restores the main buffer + cursor. The main content must survive untouched. Plain Node.
'use strict';
const assert = require('assert');
const { Terminal } = require('../src/crates/warp_terminal/term');
const W = (t, s) => t.write(Buffer.from(s, 'utf8'));
const rowText = (t, r) => t.grid[r].map((c) => c.spacer ? '' : c.c).join('').replace(/\s+$/, '');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 1. enter alt -> screen blank, flag set, callback fired; main content stashed
{
  let events = [];
  const t = new Terminal(20, 4, { onAltScreen: (on) => events.push(on) });
  W(t, 'main-line');                 // write into the main buffer
  ok(rowText(t, 0) === 'main-line', 'main buffer has content');
  W(t, '\x1b[?1049h');               // enter alt screen
  ok(t.altScreen === true, 'altScreen flag set');
  ok(events[0] === true, 'onAltScreen(true) fired');
  ok(rowText(t, 0) === '', 'alt screen starts blank');
  ok(t.scrollback.length === 0, 'alt has no scrollback');
}

// 2. write in alt then exit -> main content restored, flag cleared, callback fired
{
  let events = [];
  const t = new Terminal(20, 4, { onAltScreen: (on) => events.push(on) });
  W(t, 'keep-me');
  W(t, '\x1b[?1049h');
  W(t, 'TUI app drawing here');      // pollute the alt buffer
  ok(rowText(t, 0).startsWith('TUI'), 'alt buffer shows app content');
  W(t, '\x1b[?1049l');               // exit alt screen
  ok(t.altScreen === false, 'altScreen flag cleared');
  ok(events[events.length - 1] === false, 'onAltScreen(false) fired');
  ok(rowText(t, 0) === 'keep-me', 'main buffer restored intact -> ' + rowText(t, 0));
}

// 3. 1049 saves & restores the cursor position across the alt session
{
  const t = new Terminal(20, 4);
  W(t, 'abc');                       // cursor now at col 3
  const savedCol = t.cursor.col;
  W(t, '\x1b[?1049h');
  W(t, 'xxxxxxxx');                  // move cursor in alt
  W(t, '\x1b[?1049l');
  ok(t.cursor.col === savedCol, 'cursor restored to pre-alt position -> ' + t.cursor.col);
}

console.log(`ALTSCREEN PASS: ${n} assertions`);
