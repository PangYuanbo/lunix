// Keyboard -> PTY bytes encoder. xterm.js does this internally; since we're replacing it, the
// engine needs its own. Maps a DOM-KeyboardEvent-like object ({key, ctrlKey, altKey, metaKey,
// shiftKey}) to the byte string a terminal app expects (the standard xterm/VT encodings).
// Returns '' for keys that produce no input (pure modifiers, unhandled combos).
'use strict';
// IIFE-wrapped so a <script>-tag load leaks nothing into global scope. Only window.* exports leak.
(function () {

// DECCKM off (normal) cursor keys use CSI; apps that set DECCKM use SS3 (ESC O). We emit the common
// CSI form, which works for the vast majority of programs.
const CURSOR = { ArrowUp: 'A', ArrowDown: 'B', ArrowRight: 'C', ArrowLeft: 'D', Home: 'H', End: 'F' };
const TILDE = { Insert: '2', Delete: '3', PageUp: '5', PageDown: '6' };
const FN = { F1: 'OP', F2: 'OQ', F3: 'OR', F4: 'OS', F5: '15~', F6: '17~', F7: '18~', F8: '19~', F9: '20~', F10: '21~', F11: '23~', F12: '24~' };

function encodeKey(e) {
  const k = e.key;
  // Plain Enter/Tab/Backspace/Escape.
  if (k === 'Enter') return '\r';
  if (k === 'Tab') return e.shiftKey ? '\x1b[Z' : '\t';
  if (k === 'Backspace') return e.ctrlKey ? '\x08' : '\x7f';
  if (k === 'Escape') return '\x1b';

  // Ctrl + letter/symbol -> control code (Ctrl-A=0x01 .. Ctrl-Z=0x1a, plus the classic punctuation).
  if (e.ctrlKey && !e.altKey && !e.metaKey && k.length === 1) {
    const c = k.toLowerCase();
    if (c >= 'a' && c <= 'z') return String.fromCharCode(c.charCodeAt(0) - 96);
    const punct = { ' ': 0, '@': 0, '[': 27, '\\': 28, ']': 29, '^': 30, '_': 31, '?': 127 };
    if (k in punct) return String.fromCharCode(punct[k]);
  }

  // Cursor / navigation keys. With modifiers, emit the CSI 1;<mod><final> form xterm uses.
  if (k in CURSOR) {
    const mod = modParam(e);
    return mod ? `\x1b[1;${mod}${CURSOR[k]}` : `\x1b[${CURSOR[k]}`;
  }
  if (k in TILDE) {
    const mod = modParam(e);
    return mod ? `\x1b[${TILDE[k]};${mod}~` : `\x1b[${TILDE[k]}~`;
  }
  if (k in FN) { const seq = FN[k]; return seq.length === 2 ? '\x1b' + seq : '\x1b[' + seq; }

  // Alt + printable -> ESC prefix (meta-sends-escape).
  if (e.altKey && !e.ctrlKey && !e.metaKey && k.length === 1) return '\x1b' + k;

  // Plain printable character (ignore when Ctrl/Meta held without a mapping above).
  if (k.length === 1 && !e.ctrlKey && !e.metaKey) return k;

  return '';
}

// xterm modifier parameter: 1 + (shift=1, alt=2, ctrl=4).
function modParam(e) {
  let m = 0;
  if (e.shiftKey) m += 1;
  if (e.altKey) m += 2;
  if (e.ctrlKey) m += 4;
  return m ? m + 1 : 0;
}

// Bracketed paste (mode 2004): wrap pasted text so apps can tell it from typing.
function encodePaste(text, bracketed) {
  return bracketed ? `\x1b[200~${text}\x1b[201~` : text;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { encodeKey, encodePaste, modParam };
if (typeof window !== 'undefined') { window.warpEncodeKey = encodeKey; window.warpEncodePaste = encodePaste; }
})();
