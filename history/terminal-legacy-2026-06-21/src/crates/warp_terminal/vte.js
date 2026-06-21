// VTE parser — the Paul Williams DEC ANSI state machine, the same algorithm Warp's `vte` crate
// (and Alacritty) uses to turn a raw PTY byte stream into terminal actions. This is the layer
// Warp uses instead of xterm.js: bytes in, structured callbacks out. No rendering here.
//
// The parser walks a state machine (Ground, Escape, CsiEntry, CsiParam, OscString, DcsPassthrough,
// …). For each byte it consults the (state, byte) transition table and runs an action
// (print/execute/csi_dispatch/esc_dispatch/osc_*/hook/put/unhook). UTF-8 multibyte sequences are
// decoded in Ground/Utf8 before being delivered to `print` as full code points.
//
// The Performer (caller) implements the handler methods; this file only sequences them.
'use strict';
// IIFE-wrapped: when loaded via <script> (not a module), top-level declarations would otherwise
// leak into the shared global lexical scope and collide with other scripts. Only window.* exports leak.
(function () {

// Parser states.
const S = {
  Ground: 0, Escape: 1, EscapeIntermediate: 2,
  CsiEntry: 3, CsiParam: 4, CsiIntermediate: 5, CsiIgnore: 6,
  DcsEntry: 7, DcsParam: 8, DcsIntermediate: 9, DcsPassthrough: 10, DcsIgnore: 11,
  OscString: 12, SosPmApcString: 13, Utf8: 14,
};

const MAX_PARAMS = 32;          // alacritty/vte cap
const MAX_INTERMEDIATES = 2;
const MAX_OSC_RAW = 1024 * 1024;
const MAX_OSC_PARAMS = 24;

// Is this byte a C0 control that should be executed even mid-escape? (vte "anywhere" transitions)
function isExecutable(b) { return (b <= 0x17 && b !== 0x1b) || b === 0x19 || (b >= 0x1c && b <= 0x1f); }

class Parser {
  constructor() {
    this.state = S.Ground;
    this.intermediates = [];
    this.params = [];         // array of arrays (subparams via ':')
    this._curParam = 0;
    this._curSub = [];
    this._paramFull = false;
    this.ignoring = false;    // params/intermediates overflowed -> ignore dispatch
    // OSC
    this.oscRaw = [];         // byte array
    this.oscParams = [];      // [start,end] index pairs into oscRaw
    this._oscStart = 0;
    this._oscNumParams = 0;
    // UTF-8 decoding
    this._u8 = { need: 0, got: 0, cp: 0, min: 0 };
    this._returnState = S.Ground;
  }

  _resetParams() {
    this.params = []; this._curParam = 0; this._curSub = []; this._paramFull = false;
  }
  _clear() {
    this.intermediates = []; this._resetParams(); this.ignoring = false;
  }
  _pushParam() {
    if (this.params.length >= MAX_PARAMS) { this.ignoring = true; return; }
    this._curSub.push(this._curParam);
    this.params.push(this._curSub);
    this._curSub = []; this._curParam = 0;
  }
  _pushSub() {
    if (this.params.length >= MAX_PARAMS) { this.ignoring = true; return; }
    this._curSub.push(this._curParam); this._curParam = 0;
  }
  _paramDigit(b) {
    const v = this._curParam * 10 + (b - 0x30);
    this._curParam = v > 0xffff ? 0xffff : v;
  }

  // Finalize the param list (the trailing in-progress param) for dispatch.
  _finishParams() {
    // only push a trailing param if any digit/sep was seen or there are existing params
    if (this.params.length || this._curSub.length || this._curParam !== 0 || this._sawParam) this._pushParam();
    const out = this.params;
    return out.length ? out : [];
  }

  // --- OSC handling ---
  _oscStartSeq() { this.oscRaw = []; this.oscParams = []; this._oscNumParams = 0; this._oscStart = 0; }
  _oscPut(b) {
    if (this.oscRaw.length >= MAX_OSC_RAW) return;
    if (b === 0x3b) { // ';' param separator
      if (this._oscNumParams < MAX_OSC_PARAMS) {
        this.oscParams.push([this._oscStart, this.oscRaw.length]);
        this._oscNumParams++; this._oscStart = this.oscRaw.length;
      }
    } else {
      this.oscRaw.push(b);
    }
  }
  _oscEnd(perf) {
    if (this._oscNumParams < MAX_OSC_PARAMS) {
      this.oscParams.push([this._oscStart, this.oscRaw.length]);
      this._oscNumParams++;
    }
    const buf = Uint8Array.from(this.oscRaw);
    const slices = this.oscParams.slice(0, this._oscNumParams).map(([a, b]) => buf.subarray(a, b));
    if (perf.oscDispatch) perf.oscDispatch(slices, this._bell || false);
    this._bell = false;
  }

  // --- main entry: feed a chunk of bytes ---
  advance(perf, bytes) {
    for (let i = 0; i < bytes.length; i++) this._byte(perf, bytes[i] & 0xff);
  }

  _byte(perf, b) {
    // UTF-8 continuation handling takes precedence.
    if (this.state === S.Utf8) return this._utf8(perf, b);

    // "anywhere" transitions (vte): ESC, CAN/SUB, C1, executable C0 — except inside string states.
    const inString = this.state === S.OscString || this.state === S.DcsPassthrough || this.state === S.SosPmApcString;
    if (!inString) {
      if (b === 0x1b) { this._clear(); this.state = S.Escape; return; }
      if (b === 0x18 || b === 0x1a) { perf.execute && perf.execute(b); this.state = S.Ground; return; }
      if (b >= 0x80 && b <= 0x9f) return this._c1(perf, b);
      if (isExecutable(b) && this.state !== S.DcsEntry && this.state !== S.DcsParam && this.state !== S.DcsIntermediate) {
        perf.execute && perf.execute(b); return;
      }
    }

    switch (this.state) {
      case S.Ground: return this._ground(perf, b);
      case S.Escape: return this._escape(perf, b);
      case S.EscapeIntermediate: return this._escapeIntermediate(perf, b);
      case S.CsiEntry: return this._csiEntry(perf, b);
      case S.CsiParam: return this._csiParam(perf, b);
      case S.CsiIntermediate: return this._csiIntermediate(perf, b);
      case S.CsiIgnore: return this._csiIgnore(perf, b);
      case S.DcsEntry: return this._dcsEntry(perf, b);
      case S.DcsParam: return this._dcsParam(perf, b);
      case S.DcsIntermediate: return this._dcsIntermediate(perf, b);
      case S.DcsPassthrough: return this._dcsPassthrough(perf, b);
      case S.DcsIgnore: return this._dcsIgnore(perf, b);
      case S.OscString: return this._oscString(perf, b);
      case S.SosPmApcString: return this._sosPmApc(perf, b);
    }
  }

  _c1(perf, b) {
    // C1 controls: map the important ones; others ignored.
    switch (b) {
      case 0x9b: this._clear(); this.state = S.CsiEntry; return;          // CSI
      case 0x9d: this._oscStartSeq(); this.state = S.OscString; return;   // OSC
      case 0x90: this._clear(); this.state = S.DcsEntry; return;          // DCS
      case 0x98: case 0x9e: case 0x9f: this.state = S.SosPmApcString; return; // SOS/PM/APC
      default: this.state = S.Ground; return;
    }
  }

  _ground(perf, b) {
    if (b < 0x80) { perf.print && perf.print(String.fromCharCode(b)); return; }
    // begin UTF-8 multibyte
    this._beginUtf8(perf, b, S.Ground);
  }

  _beginUtf8(perf, b, ret) {
    let need, cp, min;
    if ((b & 0xe0) === 0xc0) { need = 1; cp = b & 0x1f; min = 0x80; }
    else if ((b & 0xf0) === 0xe0) { need = 2; cp = b & 0x0f; min = 0x800; }
    else if ((b & 0xf8) === 0xf0) { need = 3; cp = b & 0x07; min = 0x10000; }
    else { perf.print && perf.print('�'); return; }      // invalid lead
    this._u8 = { need, got: 0, cp, min };
    this._returnState = ret;
    this.state = S.Utf8;
  }
  _utf8(perf, b) {
    if ((b & 0xc0) !== 0x80) {            // invalid continuation -> replacement, reprocess byte
      perf.print && perf.print('�');
      this.state = this._returnState;
      return this._byte(perf, b);
    }
    const u = this._u8;
    u.cp = (u.cp << 6) | (b & 0x3f); u.got++;
    if (u.got === u.need) {
      const cp = (u.cp < u.min || (cp => cp >= 0xd800 && cp <= 0xdfff)(u.cp) || u.cp > 0x10ffff) ? 0xfffd : u.cp;
      perf.print && perf.print(String.fromCodePoint(cp));
      this.state = this._returnState;
    }
  }

  _escape(perf, b) {
    if (b >= 0x20 && b <= 0x2f) { this.intermediates.push(b); this.state = S.EscapeIntermediate; return; }
    if (b === 0x5b) { this._clear(); this.state = S.CsiEntry; return; }   // [
    if (b === 0x5d) { this._oscStartSeq(); this.state = S.OscString; return; } // ]
    if (b === 0x50) { this._clear(); this.state = S.DcsEntry; return; }   // P (DCS)
    if (b === 0x58 || b === 0x5e || b === 0x5f) { this.state = S.SosPmApcString; return; } // X ^ _
    // final byte 0x30-0x7e
    perf.escDispatch && perf.escDispatch(this.intermediates.slice(), b);
    this.state = S.Ground;
  }
  _escapeIntermediate(perf, b) {
    if (b >= 0x20 && b <= 0x2f) { if (this.intermediates.length < MAX_INTERMEDIATES) this.intermediates.push(b); return; }
    perf.escDispatch && perf.escDispatch(this.intermediates.slice(), b);
    this.state = S.Ground;
  }

  _csiEntry(perf, b) {
    this._sawParam = false;
    if (b >= 0x30 && b <= 0x39) { this._sawParam = true; this._paramDigit(b); this.state = S.CsiParam; return; }
    if (b === 0x3a) { this._sawParam = true; this._pushSub(); this.state = S.CsiParam; return; }
    if (b === 0x3b) { this._sawParam = true; this._pushParam(); this.state = S.CsiParam; return; }
    if (b >= 0x3c && b <= 0x3f) { this.intermediates.push(b); this.state = S.CsiParam; return; } // private markers
    if (b >= 0x20 && b <= 0x2f) { this.intermediates.push(b); this.state = S.CsiIntermediate; return; }
    if (b >= 0x40 && b <= 0x7e) { this._csiDispatch(perf, b); return; }
    this.state = S.CsiIgnore;
  }
  _csiParam(perf, b) {
    if (b >= 0x30 && b <= 0x39) { this._sawParam = true; this._paramDigit(b); return; }
    if (b === 0x3a) { this._sawParam = true; this._pushSub(); return; }
    if (b === 0x3b) { this._sawParam = true; this._pushParam(); return; }
    if (b >= 0x20 && b <= 0x2f) { this.intermediates.push(b); this.state = S.CsiIntermediate; return; }
    if (b >= 0x40 && b <= 0x7e) { this._csiDispatch(perf, b); return; }
    if (b >= 0x3c && b <= 0x3f) { this.state = S.CsiIgnore; return; }
    this.state = S.CsiIgnore;
  }
  _csiIntermediate(perf, b) {
    if (b >= 0x20 && b <= 0x2f) { if (this.intermediates.length < MAX_INTERMEDIATES) this.intermediates.push(b); else this.ignoring = true; return; }
    if (b >= 0x40 && b <= 0x7e) { this._csiDispatch(perf, b); return; }
    this.state = S.CsiIgnore;
  }
  _csiIgnore(perf, b) {
    if (b >= 0x40 && b <= 0x7e) this.state = S.Ground;
  }
  _csiDispatch(perf, b) {
    const params = this._finishParams();
    if (!this.ignoring && perf.csiDispatch) perf.csiDispatch(params, this.intermediates.slice(), b);
    this._sawParam = false;
    this.state = S.Ground;
  }

  _dcsEntry(perf, b) {
    this._sawParam = false;
    if (b >= 0x30 && b <= 0x39) { this._paramDigit(b); this.state = S.DcsParam; return; }
    if (b === 0x3b) { this._pushParam(); this.state = S.DcsParam; return; }
    if (b >= 0x3c && b <= 0x3f) { this.intermediates.push(b); this.state = S.DcsParam; return; }
    if (b >= 0x20 && b <= 0x2f) { this.intermediates.push(b); this.state = S.DcsIntermediate; return; }
    if (b >= 0x40 && b <= 0x7e) { this._dcsHook(perf, b); return; }
    this.state = S.DcsIgnore;
  }
  _dcsParam(perf, b) {
    if (b >= 0x30 && b <= 0x39) { this._paramDigit(b); return; }
    if (b === 0x3b) { this._pushParam(); return; }
    if (b >= 0x20 && b <= 0x2f) { this.intermediates.push(b); this.state = S.DcsIntermediate; return; }
    if (b >= 0x40 && b <= 0x7e) { this._dcsHook(perf, b); return; }
    this.state = S.DcsIgnore;
  }
  _dcsIntermediate(perf, b) {
    if (b >= 0x20 && b <= 0x2f) { this.intermediates.push(b); return; }
    if (b >= 0x40 && b <= 0x7e) { this._dcsHook(perf, b); return; }
    this.state = S.DcsIgnore;
  }
  _dcsHook(perf, b) {
    const params = this._finishParams();
    perf.hook && perf.hook(params, this.intermediates.slice(), false, b);
    this.state = S.DcsPassthrough;
  }
  _dcsPassthrough(perf, b) {
    if (b === 0x1b) { perf.unhook && perf.unhook(); this._clear(); this.state = S.Escape; return; }
    if (b === 0x07) { perf.unhook && perf.unhook(); this.state = S.Ground; return; }
    if ((b >= 0x20 && b <= 0x7e) || (b >= 0x08 && b <= 0x0d)) { perf.put && perf.put(b); return; }
  }
  _dcsIgnore(perf, b) {
    if (b === 0x1b) { this._clear(); this.state = S.Escape; }
  }

  _oscString(perf, b) {
    if (b === 0x07) { this._bell = true; this._oscEnd(perf); this.state = S.Ground; return; }   // BEL
    if (b === 0x1b) { this._oscEnd(perf); this._clear(); this.state = S.Escape; return; }        // ST via ESC \
    this._oscPut(b);
  }
  _sosPmApc(perf, b) {
    if (b === 0x1b) { this._clear(); this.state = S.Escape; return; }
    if (b === 0x07) { this.state = S.Ground; return; }
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { Parser, States: S };
if (typeof window !== 'undefined') window.VteParser = Parser;
})();
