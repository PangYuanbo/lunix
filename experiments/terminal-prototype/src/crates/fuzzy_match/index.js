// Module mirror of Warp crate `fuzzy_match` (Rust: crates/fuzzy_match, 1045 LOC).
// STATUS: ported — the self-contained wildcard glob engine is a faithful 1:1 port of
// crates/fuzzy_match/src/lib.rs. The traditional fuzzy path in Rust wraps the external
// `fuzzy_matcher::SkimMatcherV2` crate; here it is reimplemented as an equivalent
// subsequence scorer (same API + smart-case semantics), since Skim itself is a separate crate.
'use strict';

const chars = (s) => Array.from(s); // Rust `char` iteration analog

function noMatch() { return { score: 0, matched_indices: [] }; }

// ---- traditional fuzzy (smart-case subsequence; mirrors match_indices API) ----
function matchInternal(text, query, ignoreCase) {
  if (query === '') return { score: 0, matched_indices: [] };
  const t = chars(text), q = chars(query);
  const tcmp = ignoreCase ? t.map((c) => c.toLowerCase()) : t;
  const qcmp = ignoreCase ? q.map((c) => c.toLowerCase()) : q;
  let ti = 0, score = 0, prevMatch = -2;
  const idx = [];
  for (let qi = 0; qi < qcmp.length; qi++) {
    let found = -1;
    for (let k = ti; k < tcmp.length; k++) { if (tcmp[k] === qcmp[qi]) { found = k; break; } }
    if (found === -1) return null;
    score += 16;
    if (found === prevMatch + 1) score += 8;                              // consecutive bonus
    if (found === 0 || /[\/_\-. ]/.test(t[found - 1] || '')) score += 4;  // word-boundary bonus
    score -= found - ti;                                                  // gap penalty
    idx.push(found);
    prevMatch = found; ti = found + 1;
  }
  return { score, matched_indices: idx };
}
function match_indices(text, query) { return matchInternal(text, query, query === query.toLowerCase()); }
function match_indices_case_insensitive(text, query) { return matchInternal(text, query, true); }
function match_indices_case_insensitive_ignore_spaces(text, query) {
  const q = chars(query).filter((c) => !/\s/.test(c)).join('');
  if (q === '') return null;
  return matchInternal(text, q, true);
}

function contains_wildcards(query) { return query.includes('*') || query.includes('?'); }

// ---- wildcard glob engine — faithful 1:1 of the Rust ----
function find_partial_suffix_match(text, partial_suffix) {
  if (partial_suffix === '') return null;
  const tc = chars(text), pc = chars(partial_suffix);
  for (let start = tc.length - 1; start >= 0; start--) {
    const rem = tc.slice(start);
    if (rem.length >= pc.length) {
      const ok = pc.every((p, i) => rem[i].toLowerCase() === p.toLowerCase());
      if (ok) { const out = []; for (let i = start; i < start + pc.length; i++) out.push(i); return out; }
    }
  }
  return null;
}
function is_glob_match_chars_recursive(text, pattern, ti, pi) {
  if (pi >= pattern.length) return ti >= text.length;
  if (ti >= text.length) { for (let k = pi; k < pattern.length; k++) if (pattern[k] !== '*') return false; return true; }
  const pch = pattern[pi];
  if (pch === '*') {
    if (is_glob_match_chars_recursive(text, pattern, ti, pi + 1)) return true;
    for (let i = ti; i < text.length; i++) if (is_glob_match_chars_recursive(text, pattern, i + 1, pi + 1)) return true;
    return false;
  } else if (pch === '?') {
    return is_glob_match_chars_recursive(text, pattern, ti + 1, pi + 1);
  }
  return text[ti].toLowerCase() === pch.toLowerCase()
    ? is_glob_match_chars_recursive(text, pattern, ti + 1, pi + 1) : false;
}
function is_glob_match(text, pattern) { return is_glob_match_chars_recursive(chars(text), chars(pattern), 0, 0); }
function is_glob_match_at_position(tc, pc, start) { return is_glob_match_chars_recursive(tc.slice(start), pc, 0, 0); }
function find_glob_match_end(tc, pc, start) { return is_glob_match_at_position(tc, pc, start) ? tc.length : null; }

function find_substring_glob_match(text, pattern) {
  const star = pattern.indexOf('*');
  if (star !== -1) {
    const prefix = pattern.slice(0, star);
    const suffix_pattern = pattern.slice(star);
    const prefix_start = text.indexOf(prefix);
    if (prefix_start !== -1) {
      const prefix_end = prefix_start + prefix.length;
      const remaining_text = text.slice(prefix_end);
      let suffix_result = null;
      if (suffix_pattern.startsWith('*') && !suffix_pattern.slice(1).includes('*') && !suffix_pattern.slice(1).includes('?')) {
        const suffix_part = suffix_pattern.slice(1);
        if (remaining_text.endsWith(suffix_part)) {
          const rc = chars(remaining_text).length, sc = chars(suffix_part).length, s = rc - sc;
          const mi = []; for (let i = s; i < rc; i++) mi.push(i);
          suffix_result = { score: 1000, matched_indices: mi };
        } else {
          const partial = find_partial_suffix_match(remaining_text, suffix_part);
          if (partial) suffix_result = { score: 800, matched_indices: partial };
        }
      } else if (is_glob_match(remaining_text, suffix_pattern)) {
        const mi = []; for (let i = 0; i < chars(remaining_text).length; i++) mi.push(i);
        suffix_result = { score: 1000, matched_indices: mi };
      }
      if (suffix_result) {
        const prefix_start_char = chars(text.slice(0, prefix_start)).length;
        const prefix_char_count = chars(prefix).length;
        const remaining_start_char = chars(text.slice(0, prefix_end)).length;
        const combined = [];
        for (let i = prefix_start_char; i < prefix_start_char + prefix_char_count; i++) combined.push(i);
        for (const idx of suffix_result.matched_indices) combined.push(remaining_start_char + idx);
        return combined;
      }
    }
  }
  if (pattern.endsWith('*') && !pattern.slice(0, -1).includes('*') && !pattern.slice(0, -1).includes('?')) {
    const prefix = pattern.slice(0, -1);
    const start_pos = text.indexOf(prefix);
    if (start_pos !== -1) {
      const start_char_idx = chars(text.slice(0, start_pos)).length;
      const prefix_char_count = chars(prefix).length;
      const mi = []; for (let i = start_char_idx; i < start_char_idx + prefix_char_count; i++) mi.push(i);
      return mi;
    }
  }
  const tc = chars(text), pc = chars(pattern);
  for (let start = 0; start < tc.length; start++) {
    if (is_glob_match_at_position(tc, pc, start)) {
      const end = find_glob_match_end(tc, pc, start) ?? tc.length;
      const mi = []; for (let i = start; i < Math.min(end, tc.length); i++) mi.push(i);
      return mi;
    }
  }
  return null;
}

function match_wildcard_pattern(text, pattern) {
  if (pattern === '') return noMatch();
  if (pattern.startsWith('*') && !pattern.slice(1).includes('*') && !pattern.slice(1).includes('?')) {
    const suffix = pattern.slice(1);
    if (text.endsWith(suffix)) {
      const tcc = chars(text).length, scc = chars(suffix).length, s = tcc - scc;
      const mi = []; for (let i = s; i < tcc; i++) mi.push(i);
      return { score: 1000, matched_indices: mi };
    }
    const partial = find_partial_suffix_match(text, suffix);
    if (partial) return { score: 800, matched_indices: partial };
    return null;
  }
  if (pattern.endsWith('*') && !pattern.slice(0, -1).includes('*') && !pattern.slice(0, -1).includes('?')) {
    const prefix = pattern.slice(0, -1);
    if (text.startsWith(prefix)) {
      const pcc = chars(prefix).length; const mi = []; for (let i = 0; i < pcc; i++) mi.push(i);
      return { score: 1000, matched_indices: mi };
    }
  }
  const sub = find_substring_glob_match(text, pattern);
  if (sub) return { score: 1000, matched_indices: sub };
  if (is_glob_match(text, pattern)) {
    const mi = []; for (let i = 0; i < chars(text).length; i++) mi.push(i);
    const score = (pattern.includes('*') || pattern.includes('?')) ? 1000 : 2000;
    return { score, matched_indices: mi };
  }
  return null;
}
function match_wildcard_pattern_case_insensitive(text, pattern) {
  if (pattern === '') return noMatch();
  const res = match_wildcard_pattern(text.toLowerCase(), pattern.toLowerCase());
  if (!res) return null;
  res.matched_indices = res.matched_indices.filter((i) => i < chars(text).length);
  return res;
}

module.exports = {
  __crate: 'fuzzy_match', __status: 'ported', __rustLoc: 1045,
  match_indices, match_indices_case_insensitive, match_indices_case_insensitive_ignore_spaces,
  contains_wildcards, match_wildcard_pattern, match_wildcard_pattern_case_insensitive, noMatch,
};
