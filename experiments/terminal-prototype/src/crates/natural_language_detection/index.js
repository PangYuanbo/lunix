// Module mirror of Warp crate `natural_language_detection` (Rust: crates/natural_language_detection, 126 LOC).
// STATUS: ported (logic) — the pure token-analysis functions are faithful ports of
// crates/natural_language_detection/src/lib.rs. Two inputs are dependency-injected because
// they are not self-contained in JS: the word dictionaries (WORD_LIST/STACK_OVERFLOW_LIST/
// COMMAND_LIST data) and the Snowball English stemmer (Rust uses the `rust_stemmers` crate).
// Pass `{ isWord, stem }` to get full behavior; defaults degrade gracefully.
'use strict';

const CONTRACTION_RE = /('s|'re|n't|'t|'m|'ve|'ll)$/;
const RESERVED_KEYWORDS = ['what'];
const SHELL_SPECIAL = ['$', '=', '{', '}', '[', ']', '>', '<', '*', '~', '&', '(', ')', '|', '/', '-'];

// Faithful port of check_if_token_has_shell_syntax.
function check_if_token_has_shell_syntax(word) {
  return !word.includes(' ') && SHELL_SPECIAL.some((c) => word.includes(c));
}
// Faithful port of wrapped_in_quotes.
function wrapped_in_quotes(word) {
  return (word.startsWith('"') && word.endsWith('"')) || (word.startsWith("'") && word.endsWith("'"));
}
// Faithful port of token_preprocessing: lowercase + contraction stripping ("can't" -> "can").
function token_preprocessing(token) {
  let t = token.toLowerCase();
  if (t === "can't") return 'can';
  const m = CONTRACTION_RE.exec(t);
  if (m) t = t.slice(0, t.length - m[1].length);
  return t;
}

// Faithful port of natural_language_words_score.
// isWord(word, db) where db in {'English','StackOverflow','Command'}; stem(word) -> string.
function natural_language_words_score(words, isFirstTokenCommand, { isWord = () => false, stem = (w) => w } = {}) {
  let count = 0;
  words.forEach((tokenRaw, i) => {
    const token = token_preprocessing(tokenRaw);
    if (i === 0 && (isWord(token, 'Command') || (isFirstTokenCommand && !RESERVED_KEYWORDS.includes(token)))) return;
    if (isWord(token, 'StackOverflow') || isWord(token, 'Command')) {
      count += 1;
    } else {
      const stemmed = stem(token);
      if (isWord(stemmed, 'English') || isWord(stemmed, 'StackOverflow') || isWord(stemmed, 'Command')) {
        count += 1;
      } else if (!wrapped_in_quotes(token) && check_if_token_has_shell_syntax(token)) {
        count = Math.max(0, count - 1); // saturating_sub
      }
    }
  });
  return count;
}

module.exports = {
  __crate: 'natural_language_detection', __status: 'ported', __rustLoc: 126,
  check_if_token_has_shell_syntax, wrapped_in_quotes, token_preprocessing, natural_language_words_score,
};
