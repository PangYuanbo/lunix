// Module mirror of Warp crate `input_classifier` (Rust: crates/input_classifier, 2023 LOC).
// STATUS: ported (heuristic core) — faithful port of the v1 production heuristic in
// crates/input_classifier/src/util.rs + the InputType enum (input_type.rs). The ONNX
// neural classifier (onnx/*.rs, uses `ort`/`candle`) and the live token-description lookup
// (from warp_completer) are not portable here; is_likely_shell_command takes a tokens
// snapshot { parsed_tokens: [{token, token_index, token_description}] } as the Rust does.
'use strict';

const nld = require('../natural_language_detection');
const { parseQueryIntoTokens } = require('./parser');

const DETECT_AS_COMMAND_THRESHOLD = 0.5;
const DETECT_AS_COMMAND_LOW_TOKEN_THRESHOLD = 0.7;

const ONE_OFF_SHELL_COMMAND_KEYWORDS = new Set(['#', 'echo', 'man', 'sudo', 'claude', 'codex', 'gemini']);
const ONE_OFF_NATURAL_LANGUAGE_WORDS = new Set(['hello', 'hi', 'hey', 'hola', 'thanks', 'explain', 'yes', 'no', 'what', 'nice', '1. ']);
const AGENT_FOLLOW_UP_INPUTS = new Set(['yes', 'continue', 'do it', 'approve']);

// InputType (input_type.rs)
const InputType = Object.freeze({ Shell: 'Shell', AI: 'AI' });
function inputTypeIsAi(t) { return t === InputType.AI; }
function inputTypeFromStr(s) {
  switch (s.toLowerCase()) {
    case 'shell': return InputType.Shell;
    case 'ai': return InputType.AI;
    default: throw new Error(`Invalid input type: ${s}. Must be 'shell' or 'ai'`);
  }
}

function is_agent_follow_up_input(input) { return AGENT_FOLLOW_UP_INPUTS.has(input); }
function is_one_off_shell_command_keyword(word) { return ONE_OFF_SHELL_COMMAND_KEYWORDS.has(word); }
function is_one_off_natural_language_word(word) { return ONE_OFF_NATURAL_LANGUAGE_WORDS.has(word); }
function is_prefix_of_natural_language_word(input) {
  for (const word of ONE_OFF_NATURAL_LANGUAGE_WORDS) if (word.startsWith(input)) return true;
  return false;
}
function is_one_off_natural_language_word_or_prefix(word) {
  return is_one_off_natural_language_word(word) || is_prefix_of_natural_language_word(word);
}

// Faithful port of is_likely_shell_command (v1 prod heuristic; useNldHeuristicV2 default false).
// A token: { token: string, token_index: number, token_description: string|null }
function is_likely_shell_command(snapshot, wordTokensCount, useNldHeuristicV2 = false) {
  let likelyCommandTokenCount = 0;
  const tokens = snapshot.parsed_tokens;
  const totalTokenCount = tokens.length;
  let isFirstTokenCommand = false;

  for (const token of tokens) {
    if (token.token_index === 0 && ONE_OFF_SHELL_COMMAND_KEYWORDS.has(token.token)) return true;
    const hasShellSyntax = !useNldHeuristicV2 && nld.check_if_token_has_shell_syntax(token.token);
    if (token.token_description != null || hasShellSyntax) likelyCommandTokenCount += 1;
    if (token.token_index === 0) isFirstTokenCommand = token.token_description != null;
  }

  let commandThreshold;
  if (useNldHeuristicV2 || totalTokenCount <= 2) commandThreshold = 1.0;
  else if (totalTokenCount <= 4) commandThreshold = DETECT_AS_COMMAND_LOW_TOKEN_THRESHOLD;
  else commandThreshold = DETECT_AS_COMMAND_THRESHOLD;

  // `(total * threshold) as usize` truncates toward zero in Rust — Math.trunc.
  return likelyCommandTokenCount >= Math.trunc(totalTokenCount * commandThreshold)
    || (wordTokensCount < 3 && isFirstTokenCommand);
}

function is_installed_binary(snapshot) {
  const first = snapshot.parsed_tokens[0];
  return first ? first.token_description != null : false;
}

module.exports = {
  __crate: 'input_classifier', __status: 'ported', __rustLoc: 2023,
  InputType, inputTypeIsAi, inputTypeFromStr,
  is_agent_follow_up_input, is_one_off_shell_command_keyword, is_one_off_natural_language_word,
  is_prefix_of_natural_language_word, is_one_off_natural_language_word_or_prefix,
  is_likely_shell_command, is_installed_binary, parseQueryIntoTokens,
  get heuristic() { return require('./heuristic_classifier'); },
};
