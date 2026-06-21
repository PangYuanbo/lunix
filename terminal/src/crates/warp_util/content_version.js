// Faithful port of crates/warp_util/src/content_version.rs — an app-unique, monotonically
// increasing content version. new() draws from a process-global counter (the Rust uses an
// AtomicUsize); from_raw() bypasses the counter for wire-deserialization boundaries.
'use strict';

let NEXT_ID = 0; // analog of the static AtomicUsize NEXT_ID

class ContentVersion {
  constructor(raw) { this._v = raw; }
  static new() { return new ContentVersion(NEXT_ID++); }
  static fromRaw(val) { return new ContentVersion(val); }
  asI32() { return this._v | 0; }
  asU64() { return this._v; }
  equals(other) { return other instanceof ContentVersion && this._v === other._v; }
  valueOf() { return this._v; }
}

module.exports = { ContentVersion };
