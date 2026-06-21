// Module mirror of Warp crate `command` (Rust: crates/command, 1740 LOC).
// STATUS: ported (WSL resolution) — faithful port of the pure WSL-safe binary resolver and
// bare-name detection from crates/command/src/wsl.rs. The async/blocking Command wrappers
// (async.rs/blocking.rs, over `async_process`) map onto Node's child_process and are not
// re-wrapped here. `isExecutableFile` is dependency-injectable so the path-walking algorithm
// is testable without a real WSL host (the Rust tests use temp dirs + chmod).
'use strict';

const fs = require('fs');
const path = require('path');

const KNOWN_NAMES = ['git', 'gh'];

// Faithful port of is_wsl(): true when /proc/sys/fs/binfmt_misc/WSLInterop exists.
let _isWslCache;
function is_wsl() {
  if (_isWslCache === undefined) _isWslCache = fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
  return _isWslCache;
}

// Faithful port of known_bare_name: returns the name iff it's a bare KNOWN_NAMES entry
// (no '/' or '\\'); paths and unknowns return null.
function known_bare_name(program) {
  if (program == null) return null;
  const s = String(program);
  if (s.includes('/') || s.includes('\\')) return null;
  return KNOWN_NAMES.includes(s) ? s : null;
}

function defaultIsExecutableFile(p) {
  try { const md = fs.statSync(p); return md.isFile() && (md.mode & 0o111) !== 0; }
  catch { return false; }
}

// Faithful port of resolve_binary_in_wsl_safe_path: first executable `name` on PATH, skipping
// entries under /mnt when isWsl. Returns the path string or null.
function resolve_binary_in_wsl_safe_path(name, pathEnv, isWsl, isExecutableFile = defaultIsExecutableFile) {
  if (pathEnv == null) return null;
  for (const dir of String(pathEnv).split(path.delimiter)) {
    if (dir === '') continue;
    if (isWsl && (dir === '/mnt' || dir.startsWith('/mnt/'))) continue;
    const candidate = path.join(dir, name);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

// Port of translate_program_for_spawn: on WSL, bare known names resolve to the Linux-side
// binary; everything else passes through unchanged.
function translate_program_for_spawn(program) {
  if (!is_wsl()) return program;
  const name = known_bare_name(program);
  if (!name) return program;
  return resolve_binary_in_wsl_safe_path(name, process.env.PATH, true) || name;
}

module.exports = {
  __crate: 'command', __status: 'ported', __rustLoc: 1740,
  KNOWN_NAMES, is_wsl, known_bare_name, resolve_binary_in_wsl_safe_path, translate_program_for_spawn,
};
