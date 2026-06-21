// Module mirror of Warp crate `settings_value` (Rust: crates/settings_value, 405 LOC).
// STATUS: ported (codecs) — faithful port of the SettingsValue file-representation trait from
// crates/settings_value/src/lib.rs. Rust's trait-based dispatch (default serde passthrough +
// overrides for Vec/Option/HashSet/HashMap/Duration) is modeled as composable codec objects,
// each with to_file_value / from_file_value. The schemars JSON-Schema method and the proc-macro
// derive (settings_value_derive crate) are not ported. `Value` here is plain JSON.
'use strict';

// Default impl: serde passthrough — the value IS its file representation.
const passthrough = {
  to_file_value: (v) => v,
  from_file_value: (val) => val,
};
const bool = passthrough, string = passthrough, number = passthrough, pathBuf = passthrough;

// Vec<T> — recursive over elements; from_file_value collects (null if any element fails).
function vecOf(inner) {
  return {
    to_file_value: (arr) => arr.map((x) => inner.to_file_value(x)),
    from_file_value: (val) => {
      if (!Array.isArray(val)) return null;
      const out = [];
      for (const v of val) { const r = inner.from_file_value(v); if (r === null) return null; out.push(r); }
      return out;
    },
  };
}

// Option<T> — Some(x) maps through inner; None <-> JSON null.
function optionOf(inner) {
  return {
    to_file_value: (v) => (v === null || v === undefined ? null : inner.to_file_value(v)),
    from_file_value: (val) => (val === null ? null : inner.from_file_value(val)),
  };
}

// HashSet<T> — serialized as an array (operates on a JS Set).
function hashSetOf(inner) {
  return {
    to_file_value: (set) => [...set].map((x) => inner.to_file_value(x)),
    from_file_value: (val) => {
      if (!Array.isArray(val)) return null;
      const out = new Set();
      for (const v of val) { const r = inner.from_file_value(v); if (r === null) return null; out.add(r); }
      return out;
    },
  };
}

// HashMap<K, V> — serialized as an object (operates on a JS Map). String keys per the Rust.
function hashMapOf(keyCodec, valCodec) {
  return {
    to_file_value: (map) => {
      const obj = {};
      for (const [k, v] of map) {
        const kf = keyCodec.to_file_value(k);
        const keyStr = typeof kf === 'string' ? kf : String(kf);
        obj[keyStr] = valCodec.to_file_value(v);
      }
      return obj;
    },
    from_file_value: (val) => {
      if (val === null || typeof val !== 'object' || Array.isArray(val)) return null;
      const map = new Map();
      for (const [keyStr, v] of Object.entries(val)) {
        const k = keyCodec.from_file_value(keyStr); if (k === null) return null;
        const vv = valCodec.from_file_value(v); if (vv === null) return null;
        map.set(k, vv);
      }
      return map;
    },
  };
}

// Duration — serialized as integer seconds (override). Represented as { secs }.
const duration = {
  fromSecs: (secs) => ({ secs }),
  to_file_value: (d) => d.secs,
  from_file_value: (val) => (typeof val === 'number' && Number.isInteger(val) && val >= 0 ? { secs: val } : null),
};

module.exports = {
  __crate: 'settings_value', __status: 'ported', __rustLoc: 405,
  passthrough, bool, string, number, pathBuf, vecOf, optionOf, hashSetOf, hashMapOf, duration,
};
