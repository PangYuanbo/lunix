// Faithful 1:1 port of the pure functions in crates/warp_util/src/path.rs: user_friendly_path,
// to_relative_path, EscapeChar/ShellFamily (escape/unescape/shell_escape), is_posix_portable_pathname,
// normalize_relative_path_for_glob, and common_path. The Windows/WSL/MSYS2 conversion helpers in
// that file are platform-bound and not ported here.
'use strict';
const path = require('path');

// ~ display: collapse a leading home-dir prefix to "~". Unix separator handling.
function userFriendlyPath(p, homeDir) {
  if (homeDir != null && p.startsWith(homeDir)) {
    const rest = p.slice(homeDir.length);
    if (rest === '') return '~';
    const next = rest[0];
    if (next === '/' || (process.platform === 'win32' && next === '\\')) return '~' + rest;
    return p;
  }
  return p;
}

// pathdiff-style relative path (unix). WSL is unsupported (returns null), matching the Rust.
function toRelativePath(isWsl, absolutePath, cwd) {
  if (isWsl) return null;
  const rel = path.posix.relative(cwd, absolutePath);
  const cleaned = rel.startsWith('./') ? rel.slice(2) : (rel.startsWith('/') ? rel.slice(1) : rel);
  return cleaned === '' || cleaned === '.' ? '.' : cleaned;
}

const EscapeChar = Object.freeze({ Backslash: 'Backslash', Backtick: 'Backtick' });
const escIsChar = (esc, c) => (esc === EscapeChar.Backslash ? c === '\\' : c === '`');

// Special-char patterns transcribed from POSIX_SHELL_ESCAPE_PATTERN / POWERSHELL_SHELL_ESCAPE_PATTERN.
const POSIX_RE = /([ "$'\\#=[\]!><|;{}()*?&`~]|\n|\t)/g;
const POWERSHELL_RE = /([ "$'#=[\]!><|;{}()*&`@,]|\n|\t)/g;
const HOME_DIR_ENV_VAR_PREFIX = '$HOME';

const ShellFamily = Object.freeze({ Posix: 'Posix', PowerShell: 'PowerShell' });
function shellEscapeChar(family) { return family === ShellFamily.Posix ? EscapeChar.Backslash : EscapeChar.Backtick; }

function escape(family, input) {
  if (input === '') return "''";
  return family === ShellFamily.Posix ? input.replace(POSIX_RE, '\\$1') : input.replace(POWERSHELL_RE, '`$1');
}
function unescape(family, input) {
  const esc = shellEscapeChar(family);
  if (![...input].some((c) => escIsChar(esc, c))) return input;
  let result = '';
  const chars = [...input];
  for (let i = 0; i < chars.length; i++) {
    if (escIsChar(esc, chars[i])) {
      if (i + 1 < chars.length) { result += chars[i + 1]; i++; }
      else result += chars[i]; // trailing escape char kept
    } else result += chars[i];
  }
  return result;
}
function shellEscape(family, p) {
  for (const prefix of ['~', HOME_DIR_ENV_VAR_PREFIX]) {
    if (p.startsWith(prefix)) {
      const suffix = p.slice(prefix.length);
      if (suffix === '') return prefix;
      const first = suffix[0];
      if (first !== '/' && first !== '\\') return escape(family, p);
      const escapedSuffix = escape(family, suffix);
      return escapedSuffix === suffix ? p : prefix + escapedSuffix;
    }
  }
  return escape(family, p);
}

function isPosixPortablePathname(s) {
  return s.split('/').every((filename) => [...filename].every((c) => /[A-Za-z0-9._-]/.test(c)));
}

// Join only the "normal" components with '/', dropping '.', '..', and roots.
function normalizeRelativePathForGlob(p) {
  return p.split(/[\\/]+/).filter((c) => c !== '' && c !== '.' && c !== '..').join('/');
}

// Longest common path prefix (component-wise). Returns null if empty between any two paths.
function commonPath(paths) {
  const arr = [...paths];
  if (arr.length === 0) return null;
  let common = arr[0].split('/');
  for (let i = 1; i < arr.length; i++) {
    const other = arr[i].split('/');
    const out = [];
    for (let j = 0; j < Math.min(common.length, other.length); j++) {
      if (common[j] === other[j]) out.push(common[j]); else break;
    }
    common = out;
    // empty (only [''] from leading '/') -> no common path
    if (common.length === 0 || (common.length === 1 && common[0] === '')) return null;
  }
  return common.join('/');
}

module.exports = {
  EscapeChar, ShellFamily, shellEscapeChar,
  userFriendlyPath, toRelativePath, escape, unescape, shellEscape,
  isPosixPortablePathname, normalizeRelativePathForGlob, commonPath,
};
