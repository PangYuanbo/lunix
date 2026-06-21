// Faithful 1:1 port of crates/warp_completer/src/completer/matchers.rs — exact/prefix/fuzzy
// match classification over the already-ported fuzzy_match crate. `match_type_for_case_insensitive`
// reports whether `partial` exactly/prefix matches `from` and whether the match is case-sensitive;
// MatchStrategy.getMatchType applies one of CaseSensitive/CaseInsensitive/Fuzzy.
'use strict';
const fuzzy = require('../fuzzy_match');

const chars = (s) => Array.from(s);
const eqIgnoreAsciiCase = (a, b) => a.toLowerCase() === b.toLowerCase();

// Match variants: { k:'Exact'|'Prefix', is_case_sensitive } | { k:'Fuzzy', match_result }
const Match = {
  Exact: (is_case_sensitive) => ({ k: 'Exact', is_case_sensitive }),
  Prefix: (is_case_sensitive) => ({ k: 'Prefix', is_case_sensitive }),
  Fuzzy: (match_result) => ({ k: 'Fuzzy', match_result }),
};

// 1:1 of match_type_for_case_insensitive (uses byte length like the Rust `str::len`).
function matchTypeForCaseInsensitive(partial, from) {
  const pBytes = Buffer.byteLength(partial), fBytes = Buffer.byteLength(from);
  if (pBytes > fBytes) return null;
  let startsWith = true, isCaseSensitive = true;
  const fc = chars(from), pc = chars(partial);
  for (let i = 0; i < Math.min(fc.length, pc.length); i++) {
    const a = fc[i], b = pc[i];
    if (a === b) continue;
    else if (eqIgnoreAsciiCase(a, b)) isCaseSensitive = false;
    else { startsWith = false; break; }
  }
  if (!startsWith) return null;
  const sameLength = pBytes === fBytes;
  return sameLength ? Match.Exact(isCaseSensitive) : Match.Prefix(isCaseSensitive);
}

const MatchStrategy = Object.freeze({ CaseSensitive: 'CaseSensitive', CaseInsensitive: 'CaseInsensitive', Fuzzy: 'Fuzzy' });

function getMatchType(strategy, partial, from) {
  switch (strategy) {
    case MatchStrategy.CaseSensitive:
      if (from === partial) return Match.Exact(true);
      if (from.startsWith(partial)) return Match.Prefix(true);
      return null;
    case MatchStrategy.CaseInsensitive:
      return matchTypeForCaseInsensitive(partial, from);
    case MatchStrategy.Fuzzy: {
      const ci = matchTypeForCaseInsensitive(partial, from);
      if (ci) return ci;
      const r = fuzzy.match_indices_case_insensitive(from, partial);
      return r ? Match.Fuzzy(r) : null;
    }
    default: return null;
  }
}

// From<Match> for MatchType
function matchToMatchType(m) {
  if (m.k === 'Prefix') return { k: 'Prefix', is_case_sensitive: m.is_case_sensitive };
  if (m.k === 'Exact') return { k: 'Exact', is_case_sensitive: m.is_case_sensitive };
  return { k: 'Fuzzy' };
}

module.exports = { Match, MatchStrategy, matchTypeForCaseInsensitive, getMatchType, matchToMatchType };
