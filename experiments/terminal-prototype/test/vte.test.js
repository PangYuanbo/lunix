// VTE parser test — drives the Williams DEC state machine (Warp's `vte`-crate equivalent) with raw
// byte streams and asserts the structured callbacks. Runs in plain Node (no app/CDP needed).
'use strict';
const assert = require('assert');
const { Parser } = require('../src/crates/warp_terminal/vte');

function collect(input) {
  const ev = [];
  const perf = {
    print: (c) => ev.push(['print', c]),
    execute: (b) => ev.push(['exec', b]),
    csiDispatch: (params, inter, fin) => ev.push(['csi', params, inter.map((x) => String.fromCharCode(x)).join(''), String.fromCharCode(fin)]),
    escDispatch: (inter, fin) => ev.push(['esc', inter.map((x) => String.fromCharCode(x)).join(''), String.fromCharCode(fin)]),
    oscDispatch: (slices, bell) => ev.push(['osc', slices.map((s) => Buffer.from(s).toString('utf8')), bell]),
    hook: (p, i, ig, f) => ev.push(['hook', p, String.fromCharCode(f)]),
    put: (b) => ev.push(['put', b]),
    unhook: () => ev.push(['unhook']),
  };
  const p = new Parser();
  p.advance(perf, typeof input === 'string' ? Buffer.from(input, 'utf8') : input);
  return ev;
}

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 1. plain printing
{
  const ev = collect('hi');
  ok(ev.length === 2 && ev[0][1] === 'h' && ev[1][1] === 'i', 'prints ascii');
}

// 2. C0 execute: CR LF BS TAB
{
  const ev = collect('a\r\n\b\t');
  ok(ev[0][0] === 'print', 'a printed');
  ok(ev.some((e) => e[0] === 'exec' && e[1] === 0x0d), 'CR executed');
  ok(ev.some((e) => e[0] === 'exec' && e[1] === 0x0a), 'LF executed');
  ok(ev.some((e) => e[0] === 'exec' && e[1] === 0x08), 'BS executed');
  ok(ev.some((e) => e[0] === 'exec' && e[1] === 0x09), 'TAB executed');
}

// 3. SGR: ESC [ 1 ; 31 m  -> csi params [[1],[31]] final 'm'
{
  const ev = collect('\x1b[1;31m');
  const csi = ev.find((e) => e[0] === 'csi');
  ok(csi && csi[3] === 'm', 'SGR final m');
  ok(JSON.stringify(csi[1]) === '[[1],[31]]', 'SGR params 1;31 -> ' + JSON.stringify(csi[1]));
}

// 4. SGR with subparams (truecolor): ESC [ 38:2:255:0:0 m
{
  const ev = collect('\x1b[38:2:255:0:0m');
  const csi = ev.find((e) => e[0] === 'csi');
  ok(JSON.stringify(csi[1]) === '[[38,2,255,0,0]]', 'subparams parsed -> ' + JSON.stringify(csi[1]));
}

// 5. CUP: ESC [ 12 ; 40 H
{
  const ev = collect('\x1b[12;40H');
  const csi = ev.find((e) => e[0] === 'csi');
  ok(csi[3] === 'H' && csi[1][0][0] === 12 && csi[1][1][0] === 40, 'CUP 12;40H');
}

// 6. private mode: ESC [ ? 25 h  (show cursor) -> intermediate '?'
{
  const ev = collect('\x1b[?25h');
  const csi = ev.find((e) => e[0] === 'csi');
  ok(csi[2] === '?' && csi[3] === 'h' && csi[1][0][0] === 25, "private '?25h'");
}

// 7. empty params default: ESC [ H  (home)
{
  const ev = collect('\x1b[H');
  const csi = ev.find((e) => e[0] === 'csi');
  ok(csi[3] === 'H' && csi[1].length === 0, 'bare CUP has no params');
}

// 8. OSC 133 (shell integration): ESC ] 133 ; A BEL
{
  const ev = collect('\x1b]133;A\x07');
  const osc = ev.find((e) => e[0] === 'osc');
  ok(osc && osc[1][0] === '133' && osc[1][1] === 'A' && osc[2] === true, 'OSC 133;A with BEL');
}

// 9. OSC 7 cwd, terminated by ST (ESC \)
{
  const ev = collect('\x1b]7;file://host/Users/me/proj\x1b\\');
  const osc = ev.find((e) => e[0] === 'osc');
  ok(osc && osc[1][0] === '7' && osc[1][1] === 'file://host/Users/me/proj', 'OSC 7 cwd via ST');
}

// 10. UTF-8 wide char 中 and emoji 😀
{
  const ev = collect('A中😀');
  const prints = ev.filter((e) => e[0] === 'print').map((e) => e[1]);
  ok(prints[0] === 'A' && prints[1] === '中' && prints[2] === '😀', 'utf-8 decoded -> ' + prints.join(''));
}

// 11. split UTF-8 across two advance() calls (streaming boundary)
{
  const p = new Parser(); const out = [];
  const perf = { print: (c) => out.push(c) };
  const bytes = Buffer.from('中', 'utf8'); // 3 bytes
  p.advance(perf, bytes.subarray(0, 1));
  p.advance(perf, bytes.subarray(1, 3));
  ok(out.join('') === '中', 'utf-8 reassembled across chunks -> ' + out.join(''));
}

// 12. ESC dispatch (ESC M = reverse index)
{
  const ev = collect('\x1bM');
  const esc = ev.find((e) => e[0] === 'esc');
  ok(esc && esc[2] === 'M', 'ESC M dispatched');
}

// 13. ED erase: ESC [ 2 J
{
  const ev = collect('\x1b[2J');
  const csi = ev.find((e) => e[0] === 'csi');
  ok(csi[3] === 'J' && csi[1][0][0] === 2, 'ED 2J');
}

// 14. CAN aborts an escape mid-sequence
{
  const ev = collect('\x1b[31\x18m');
  ok(!ev.some((e) => e[0] === 'csi'), 'CAN aborts CSI');
  ok(ev.some((e) => e[0] === 'print' && e[1] === 'm'), "'m' printed after CAN");
}

// 15. DCS passthrough: ESC P ... ST
{
  const ev = collect('\x1bPq#0\x1b\\');
  ok(ev.some((e) => e[0] === 'hook' && e[2] === 'q'), 'DCS hook fired (final q)');
  ok(ev.some((e) => e[0] === 'put'), 'DCS put bytes');
  ok(ev.some((e) => e[0] === 'unhook'), 'DCS unhook');
}

console.log(`VTE PARSER PASS: ${n} assertions`);
