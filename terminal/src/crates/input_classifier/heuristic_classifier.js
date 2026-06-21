// Faithful port of crates/input_classifier/src/heuristic_classifier/mod.rs — the rule-based
// input classifier deciding Shell vs AI. Control flow (one-off allowlist -> shell heuristic ->
// NL fallback with last-token handling + token-count thresholds) is 1:1. The NL scoring delegates
// to natural_language_detection::natural_language_words_score, which needs the English/SO/Command
// word dictionaries + Snowball stemmer — those large data deps are injected via `deps` rather than
// shipped, so callers/tests supply { isWord, stem }.
'use strict';

const nld = require('../natural_language_detection');
const { parseQueryIntoTokens } = require('./parser');
// util fns (is_likely_shell_command, is_installed_binary, is_one_off_…) live in index.js;
// required lazily inside functions to avoid an eager require cycle.

const InputType = Object.freeze({ Shell: 'Shell', AI: 'AI' });
const DecisionSource = Object.freeze({
  ShellHeuristic: 'ShellHeuristic',
  NaturalLanguageOneOffAllowlist: 'NaturalLanguageOneOffAllowlist',
  InputClassifierFallbackHeuristic: 'InputClassifierFallbackHeuristic',
});

const MIN_COMMAND_DETECTION_TOKENS = 2;
const MIN_NL_DETECTION_TOKENS = 2;
const DETECT_AS_NL_THRESHOLD = 0.6;
const DETECT_AS_NL_LOW_TOKEN_THRESHOLD = 0.8;
const END_TOKEN_COMPLETE_KEYS = [' ', '?', '!', '.', '"', ','];

class ClassificationResult {
  constructor(type, source) { this._type = type; this.source = source; }
  static pureShell(source) { return new ClassificationResult(InputType.Shell, source); }
  static pureAi(source) { return new ClassificationResult(InputType.AI, source); }
  toInputType() { return this._type; }
}
class InputClassificationResult {
  constructor(input_type, source) { this.input_type = input_type; this.source = source; }
  equals(o) { return o && this.input_type === o.input_type && this.source === o.source; }
}

function naturalLanguageDetectionHeuristic(input, wordTokens, currentInputType, includeLastToken, deps) {
  const u = require('./index');
  const source = DecisionSource.InputClassifierFallbackHeuristic;
  const wtc = wordTokens.length;
  const minLen = currentInputType === InputType.AI ? MIN_COMMAND_DETECTION_TOKENS : MIN_NL_DETECTION_TOKENS;
  if (minLen > wtc) return ClassificationResult.pureShell(source);

  let tokens = wordTokens.slice();
  const lastComplete = END_TOKEN_COMPLETE_KEYS.some((k) => input.buffer_text.endsWith(k));
  if (!includeLastToken && !lastComplete && tokens.length > 2) tokens.pop();

  const updated = tokens.length;
  const score = nld.natural_language_words_score(tokens, u.is_installed_binary(input), deps);
  const threshold = updated <= 3 ? 1.0 : (updated <= 4 ? DETECT_AS_NL_LOW_TOKEN_THRESHOLD : DETECT_AS_NL_THRESHOLD);
  if (score >= Math.trunc(updated * threshold)) return ClassificationResult.pureAi(source);
  return ClassificationResult.pureShell(source);
}

function classifyInput(input, context, deps) {
  const wordTokens = parseQueryIntoTokens(input.buffer_text);
  const r = naturalLanguageDetectionHeuristic(input, wordTokens, context.current_input_type, false, deps);
  if (r.toInputType() === InputType.AI) return r;
  return naturalLanguageDetectionHeuristic(input, wordTokens, context.current_input_type, true, deps);
}

function detectInputType(input, context, deps = {}) {
  const u = require('./index');
  const wordTokens = parseQueryIntoTokens(input.buffer_text);
  if (wordTokens.length === 1 && u.is_one_off_natural_language_word_or_prefix(wordTokens[0].toLowerCase())) {
    return new InputClassificationResult(InputType.AI, DecisionSource.NaturalLanguageOneOffAllowlist);
  }
  if (u.is_likely_shell_command(input, wordTokens.length)) {
    return new InputClassificationResult(InputType.Shell, DecisionSource.ShellHeuristic);
  }
  const r = classifyInput(input, context, deps);
  return new InputClassificationResult(r.toInputType(), r.source);
}

module.exports = {
  InputType, DecisionSource, ClassificationResult, InputClassificationResult,
  naturalLanguageDetectionHeuristic, classifyInput, detectInputType,
};
