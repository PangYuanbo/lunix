// Faithful 1:1 port of crates/warp_completer/src/signatures/v2/{lookup.rs, registry.rs} and the
// Command/Opt/Argument signature shapes from signatures/v2/mod.rs. Resolves the deepest matching
// command/subcommand signature for an input, skipping recognized/unrecognized flags (and the
// arguments that valued flags consume) before subcommands. The last token only matches a
// subcommand when the input has trailing whitespace.
'use strict';

// Signature data shapes (defaults applied).
const Argument = ({ name = '', optional = false } = {}) => ({ name, optional });
const Opt = ({ name = [], arguments: args = [] } = {}) => ({ name, arguments: args });
const Command = ({ name = '', arguments: args = [], subcommands = [], options = [] } = {}) => ({ name, arguments: args, subcommands, options });
const CommandSignature = (command) => ({ command });

class CommandRegistry {
  constructor() { this.signatures = new Map(); }
  static new() { return new CommandRegistry(); }
  getSignature(command) { return this.signatures.get(command) || null; }
  registerSignature(signature) { this.signatures.set(signature.command.name, signature); }
  registeredCommands() { return [...this.signatures.keys()]; }
}

function getMatchingSignatureForInput(input, registry) {
  const tokens = input.split(/\s+/).filter(Boolean);
  const hasTrailingWs = /\s$/.test(input);
  return getMatchingSignatureForTokenizedInput(tokens, hasTrailingWs, registry);
}

function getMatchingSignatureForTokenizedInput(inputTokens, hasTrailingWhitespace, registry) {
  if (inputTokens.length === 0) return null;
  const [firstToken, ...remaining] = inputTokens;
  const signature = registry.getSignature(firstToken);
  if (!signature) return null;
  return deepestMatchingSubcommandSignature(remaining, signature.command, 0, hasTrailingWhitespace);
}

function deepestMatchingSubcommandSignature(inputTokens, commandSignature, currentTokenIndex, hasTrailingWhitespace) {
  if (inputTokens.length === 0) return [commandSignature, currentTokenIndex];
  const subcommandSearchStartIndex = currentTokenIndex;

  while (currentTokenIndex < inputTokens.length) {
    const isLastToken = currentTokenIndex === inputTokens.length - 1;
    const token = inputTokens[currentTokenIndex];

    const subcommandMatch = commandSignature.subcommands.find((sub) => {
      const matches = token === sub.name;
      return isLastToken ? (matches && hasTrailingWhitespace) : matches;
    });
    if (subcommandMatch) {
      return deepestMatchingSubcommandSignature(inputTokens, subcommandMatch, currentTokenIndex + 1, hasTrailingWhitespace);
    }

    if (token.startsWith('-')) {
      const option = commandSignature.options.find((opt) => opt.name.some((nm) => nm === token));
      if (option) {
        const numArgs = option.arguments.filter((a) => !a.optional).length;
        const available = Math.max(0, inputTokens.length - (currentTokenIndex + 1));
        currentTokenIndex += Math.min(numArgs, available);
      }
      currentTokenIndex += 1;
      continue;
    }
    break;
  }
  return [commandSignature, subcommandSearchStartIndex];
}

module.exports = {
  Argument, Opt, Command, CommandSignature, CommandRegistry,
  getMatchingSignatureForInput, getMatchingSignatureForTokenizedInput,
};
