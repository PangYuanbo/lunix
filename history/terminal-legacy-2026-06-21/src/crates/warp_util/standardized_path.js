// Faithful port of crates/warp_util/src/standardized_path.rs — a normalized, platform-aware
// path type that performs no filesystem I/O on construction (except from_local_canonicalized).
// The Rust wraps the `typed_path` crate; here the Unix/Windows normalization is reimplemented
// directly. Construction normalizes (removes `.`/`..`, collapses separators) and requires the
// path to be absolute; symlinks/existence are NOT resolved (except canonicalized()).
'use strict';
const fs = require('fs');

function detectEncoding(s) {
  // typed_path's `from` heuristic: a drive letter or backslashes => Windows, else Unix.
  if (/^[A-Za-z]:[\\/]/.test(s) || (s.includes('\\') && !s.startsWith('/'))) return 'windows';
  return 'unix';
}
const sepOf = (enc) => (enc === 'windows' ? '\\' : '/');

function splitDrive(s) {
  const m = /^([A-Za-z]:)([\\/].*)?$/.exec(s);
  return m ? { drive: m[1], rest: m[2] || '' } : { drive: '', rest: s };
}

// Lexical normalization (component-aware), matching typed_path::normalize semantics.
function normalize(s, enc) {
  if (enc === 'windows') {
    const { drive, rest } = splitDrive(s);
    const abs = /^[\\/]/.test(rest);
    const comps = rest.split(/[\\/]+/).filter((c) => c !== '' && c !== '.');
    const out = [];
    for (const c of comps) {
      if (c === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else if (!abs) out.push('..'); }
      else out.push(c);
    }
    return drive + (abs ? '\\' : '') + out.join('\\');
  }
  const abs = s.startsWith('/');
  const comps = s.split('/').filter((c) => c !== '' && c !== '.');
  const out = [];
  for (const c of comps) {
    if (c === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else if (!abs) out.push('..'); }
    else out.push(c);
  }
  return (abs ? '/' : '') + out.join('/');
}

function isAbsolute(s, enc) {
  if (enc === 'windows') { const { drive, rest } = splitDrive(s); return drive !== '' && /^[\\/]/.test(rest); }
  return s.startsWith('/');
}

class InvalidPathError extends Error {}

class StandardizedPath {
  constructor(normalized, enc) { this._s = normalized; this._enc = enc; }

  static tryNew(path) {
    const enc = detectEncoding(path);
    const norm = normalize(path, enc);
    if (!isAbsolute(norm, enc)) throw new InvalidPathError(`path is not absolute: ${path}`);
    return new StandardizedPath(norm, enc);
  }
  // Local std::path::Path equivalent — encoding from the host (unix on macOS/Linux).
  static tryFromLocal(path) {
    const enc = process.platform === 'win32' ? 'windows' : 'unix';
    const norm = normalize(String(path), enc);
    if (!isAbsolute(norm, enc)) throw new InvalidPathError(`path is not absolute: ${path}`);
    return new StandardizedPath(norm, enc);
  }
  // Like try_from_local but skips the absolute check (from_local_absolute_unchecked).
  static fromLocalAbsoluteUnchecked(path) {
    const enc = process.platform === 'win32' ? 'windows' : 'unix';
    return new StandardizedPath(normalize(String(path), enc), enc);
  }
  // I/O: resolve symlinks + verify existence (throws if missing), like dunce::canonicalize.
  static fromLocalCanonicalized(path) {
    const real = fs.realpathSync(String(path)); // throws on nonexistent
    const enc = process.platform === 'win32' ? 'windows' : 'unix';
    return new StandardizedPath(normalize(real, enc), enc);
  }

  asStr() { return this._s; }
  toString() { return this._s; }
  isUnix() { return this._enc === 'unix'; }
  isWindows() { return this._enc === 'windows'; }

  _components() {
    if (this._enc === 'windows') { const { drive, rest } = splitDrive(this._s); return { root: drive, comps: rest.split(/[\\/]+/).filter(Boolean) }; }
    return { root: this._s.startsWith('/') ? '/' : '', comps: this._s.split('/').filter(Boolean) };
  }
  fileName() { const { comps } = this._components(); return comps.length ? comps[comps.length - 1] : null; }
  extension() {
    const fn = this.fileName(); if (!fn) return null;
    const i = fn.lastIndexOf('.'); return i > 0 ? fn.slice(i + 1) : null;
  }
  parent() {
    const { root, comps } = this._components();
    if (comps.length === 0) return null;
    const parentComps = comps.slice(0, -1);
    const sep = sepOf(this._enc);
    const s = root + parentComps.join(sep);
    return new StandardizedPath(s === '' ? root : s, this._enc);
  }
  startsWith(base) {
    const a = this._components(), b = base._components();
    if (a.root !== b.root) return false;
    if (b.comps.length > a.comps.length) return false;
    return b.comps.every((c, i) => c === a.comps[i]);
  }
  endsWith(suffix) {
    const sufComps = suffix.split(/[\\/]+/).filter(Boolean);
    const { comps } = this._components();
    if (sufComps.length > comps.length) return false;
    const off = comps.length - sufComps.length;
    return sufComps.every((c, i) => c === comps[off + i]);
  }
  stripPrefix(base) {
    if (!this.startsWith(base)) return null;
    let rem = this._s.slice(base._s.length);
    if (rem.startsWith('/')) rem = rem.slice(1);
    else if (rem.startsWith('\\')) rem = rem.slice(1);
    return rem;
  }
  join(segment) {
    // Path::join replacement semantics: an absolute segment replaces the base entirely.
    const combined = isAbsolute(segment, this._enc) ? segment : this._s + sepOf(this._enc) + segment;
    return new StandardizedPath(normalize(combined, this._enc), this._enc);
  }
  ancestors() {
    const out = []; let cur = this;
    while (cur) { out.push(cur); cur = cur.parent(); }
    return out;
  }
  toLocalPath() {
    const localEnc = process.platform === 'win32' ? 'windows' : 'unix';
    return this._enc === localEnc ? this._s : null;
  }
  equals(other) { return other instanceof StandardizedPath && this._s === other._s && this._enc === other._enc; }
  // serde: serializes as the path string; deserialize via tryNew.
  toJSON() { return this._s; }
}

module.exports = { StandardizedPath, InvalidPathError, normalize };
