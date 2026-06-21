// Terminal engine test — drives the Grid<Cell> + ANSI Performer (Warp's xterm replacement) with
// real escape sequences and asserts the resulting screen state. Plain Node, no app/CDP.
'use strict';
const assert = require('assert');
const { Terminal } = require('../src/crates/warp_terminal/term');

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const W = (t, s) => t.write(Buffer.from(s, 'utf8'));
const line = (t, r) => t.grid[r].map((c) => c.spacer ? '' : c.c).join('').replace(/\s+$/, '');

// 1. plain text lands in the grid at the cursor
{
  const t = new Terminal(20, 5);
  W(t, 'hello');
  ok(line(t, 0) === 'hello', 'text written -> ' + line(t, 0));
  ok(t.cursor.col === 5 && t.cursor.row === 0, 'cursor advanced');
}

// 2. CR/LF move the cursor; second line writes below
{
  const t = new Terminal(20, 5);
  W(t, 'ab\r\ncd');
  ok(line(t, 0) === 'ab' && line(t, 1) === 'cd', 'CRLF newline -> ' + line(t, 0) + '/' + line(t, 1));
}

// 3. CUP positions the cursor (1-based)
{
  const t = new Terminal(20, 5);
  W(t, '\x1b[3;5HX');
  ok(t.grid[2][4].c === 'X', 'CUP 3;5 placed X at row2 col4');
}

// 4. SGR colors + attributes carry onto written cells
{
  const t = new Terminal(20, 5);
  W(t, '\x1b[1;31mA\x1b[0mB');
  const a = t.grid[0][0], b = t.grid[0][1];
  ok(a.bold && a.fg.t === 'idx' && a.fg.i === 1, 'A is bold red');
  ok(!b.bold && b.fg.t === 'fg', 'B reset to default');
}

// 5. truecolor SGR 38:2:r:g:b
{
  const t = new Terminal(10, 3);
  W(t, '\x1b[38:2:10:20:30mZ');
  const z = t.grid[0][0];
  ok(z.fg.t === 'rgb' && z.fg.r === 10 && z.fg.g === 20 && z.fg.b === 30, 'truecolor fg -> ' + JSON.stringify(z.fg));
}

// 6. 256-color SGR 38;5;200
{
  const t = new Terminal(10, 3);
  W(t, '\x1b[38;5;200mZ');
  ok(t.grid[0][0].fg.t === 'idx' && t.grid[0][0].fg.i === 200, '256-color idx 200');
}

// 7. wide char takes two cells (spacer)
{
  const t = new Terminal(10, 3);
  W(t, '中A');
  ok(t.grid[0][0].c === '中' && t.grid[0][0].width === 2 && t.grid[0][1].spacer, 'wide char + spacer');
  ok(t.grid[0][2].c === 'A', 'A after wide char at col2');
}

// 8. autowrap to next line at right margin
{
  const t = new Terminal(4, 3);
  W(t, 'abcde');           // 4 cols -> 'abcd' then wrap 'e'
  ok(line(t, 0) === 'abcd' && line(t, 1) === 'e', 'autowrap -> ' + line(t, 0) + '/' + line(t, 1));
}

// 9. ED 2J clears the screen
{
  const t = new Terminal(10, 3);
  W(t, 'xxxx\r\nyyyy');
  W(t, '\x1b[2J');
  ok(line(t, 0) === '' && line(t, 1) === '', 'ED 2J cleared');
}

// 10. EL 0 erases from cursor to end of line
{
  const t = new Terminal(10, 3);
  W(t, 'abcdef\x1b[1;4H\x1b[0K');   // cursor to col4, erase right
  ok(line(t, 0) === 'abc', 'EL0 -> ' + line(t, 0));
}

// 11. scroll up when writing past the bottom row
{
  const t = new Terminal(6, 2);
  W(t, 'L1\r\nL2\r\nL3');           // 2 rows: L2 scrolls L1 off, then L3
  ok(line(t, 0) === 'L2' && line(t, 1) === 'L3', 'scrolled -> ' + line(t, 0) + '/' + line(t, 1));
}

// 12. backspace + overwrite
{
  const t = new Terminal(10, 2);
  W(t, 'abc\b\bX');
  ok(line(t, 0) === 'aXc', 'BS overwrite -> ' + line(t, 0));
}

// 13. cursor up/down/forward/back
{
  const t = new Terminal(10, 5);
  W(t, '\x1b[5;5H');               // row4 col4
  W(t, '\x1b[2A\x1b[1B\x1b[3C\x1b[1D');
  ok(t.cursor.row === 3 && t.cursor.col === 6, `CUU/CUD/CUF/CUB -> ${t.cursor.row},${t.cursor.col}`);
}

// 14. insert/delete chars (ICH/DCH)
{
  const t = new Terminal(10, 2);
  W(t, 'abcdef\x1b[1;1H\x1b[2@');   // insert 2 blanks at start
  ok(line(t, 0) === '  abcdef'.slice(0, 10).replace(/\s+$/, '') || t.grid[0][2].c === 'a', 'ICH shifted right');
  const t2 = new Terminal(10, 2);
  W(t2, 'abcdef\x1b[1;1H\x1b[2P'); // delete 2 chars at start
  ok(line(t2, 0) === 'cdef', 'DCH -> ' + line(t2, 0));
}

// 15. OSC 133 / OSC 7 routed to onOsc callback
{
  const seen = [];
  const t = new Terminal(20, 3, { onOsc: (num, args) => seen.push([num, ...args]) });
  W(t, '\x1b]133;A\x07\x1b]7;file://h/Users/me/p\x1b\\');
  ok(seen.some((e) => e[0] === '133' && e[1] === 'A'), 'OSC 133 A routed');
  ok(seen.some((e) => e[0] === '7' && e[1] === 'file://h/Users/me/p'), 'OSC 7 cwd routed');
}

// 16. DECSTBM scroll region confines scrolling
{
  const t = new Terminal(6, 4);
  W(t, '\x1b[2;3r');               // region rows 2..3
  W(t, '\x1b[2;1HA\r\nB\r\nC');    // write within region; should scroll only rows 2..3
  ok(line(t, 0) === '', 'row0 outside region untouched');
}

// 17. resize preserves content
{
  const t = new Terminal(10, 3);
  W(t, 'keep');
  t.resize(20, 5);
  ok(line(t, 0) === 'keep' && t.cols === 20 && t.rows === 5, 'resize kept text');
}

// SGR underline colon sub-params: 4 / 4:1 = on, 4:0 = off (regression: 4:0 was wrongly turning it ON,
// which left agent CLIs like Claude rendering everything underlined).
{
  const t = new Terminal(20, 3);
  W(t, '\x1b[4mU\x1b[4:0mN\x1b[4:3mC');
  ok(t.grid[0][0].underline === true, '4 -> underline on');
  ok(t.grid[0][1].underline === false, '4:0 -> underline OFF (not on)');
  ok(t.grid[0][2].underline === true, '4:3 (curly) -> underline on');
}

// Private-prefixed CSI must NOT be treated as SGR. `CSI > 4;2 m` (xterm modifyOtherKeys) was being
// parsed as SGR 4;2 (underline+dim), which underlined entire agent CLIs (Claude/Codex). Regression.
{
  const t = new Terminal(20, 3);
  W(t, '\x1b[>4;2mX');                 // modifyOtherKeys, then a plain char
  ok(t.grid[0][0].underline === false, 'CSI >4;2m is modifyOtherKeys, not SGR underline');
  ok(t.grid[0][0].dim === false, 'CSI >4;2m did not set dim either');
  ok(t.grid[0][0].c === 'X', 'char after private CSI renders normally');
}

console.log(`TERMINAL ENGINE PASS: ${n} assertions`);
