// Faithful 1:1 port of crates/warp_completer/src/parsers/simple/{parser.rs, iter.rs} + the
// Command/Part model and public fns (top_level_command, decompose_command,
// command_without_leading_env_vars) from mod.rs. Consumes lexer tokens into commands/parts with
// subshell ($()/`` ` ``), quote, and escape handling. Spans are UTF-8 byte offsets (matching Rust).
'use strict';
const { tokenize, EscapeChar } = require('./lexer');

// ---- Command / Part model ----
const Part = {
  Literal: (v) => ({ k: 'Literal', v }),
  ClosedSubshell: (cmds) => ({ k: 'ClosedSubshell', cmds }),
  OpenSubshell: (cmds) => ({ k: 'OpenSubshell', cmds }),
  Concatenated: (parts) => ({ k: 'Concatenated', parts }),
};
const Command = (parts) => ({ parts });
const spanned = (item, span) => ({ item, span: Array.isArray(span) ? { start: span[0], end: span[1] } : span });

function asStr(t) {
  switch (t.t) {
    case 'Literal': case 'Whitespace': case 'EscapeChar': return t.v;
    case 'Pipe': return '|'; case 'LogicalOr': return '||'; case 'Ampersand': return '&';
    case 'LogicalAnd': return '&&'; case 'Semicolon': return ';'; case 'Newline': return '\n';
    case 'Backtick': return '`'; case 'OpenParen': return '('; case 'CloseParen': return ')';
    case 'OpenCurly': return '{'; case 'CloseCurly': return '}'; case 'Dollar': return '$';
    case 'SingleQuote': return "'"; case 'DoubleQuote': return '"'; case 'RedirectInput': return '<';
    case 'RedirectOutput': return '>'; default: return '';
  }
}
const isValidSeparator = (t) => ['Pipe', 'LogicalOr', 'Ampersand', 'LogicalAnd', 'Semicolon', 'Newline'].includes(t.t);
const isCommandTerminator = (t) => isValidSeparator(t) || ['OpenParen', 'CloseParen', 'OpenCurly', 'CloseCurly'].includes(t.t);

// ---- ParserInput (iter.rs) — array of {item, span} lexer tokens with a position cursor ----
class ParserInput {
  constructor(tokens, offset = 0, startPos = 0) { this.tokens = tokens; this.i = 0; this.pos = startPos; this.offset = offset; }
  next() { if (this.i < this.tokens.length) { const t = this.tokens[this.i++]; this.pos = this.offset + t.span.end; return t.item; } return null; }
  peek() { return this.i < this.tokens.length ? this.tokens[this.i].item : null; }
  peekpeek() { return this.i + 1 < this.tokens.length ? this.tokens[this.i + 1].item : null; }
  posn() { return this.pos; }
  untilBacktick() {
    const start = this.pos; const buf = [];
    while (this.i < this.tokens.length && this.tokens[this.i].item.t !== 'Backtick') { buf.push(this.tokens[this.i]); this.pos = this.offset + this.tokens[this.i].span.end; this.i++; }
    return new ParserInput(buf, this.offset, start);
  }
}

// ---- PartBuilder (parser.rs) ----
class PartBuilder {
  constructor(start) { this.start = start; this.buffer = ''; this.bufferStart = start; this.subParts = []; }
  addPart(part) {
    if (this.buffer !== '') { this.subParts.push(spanned(Part.Literal(this.buffer), { start: this.bufferStart, end: part.span.start })); this.buffer = ''; }
    this.bufferStart = part.span.end;
    if (part.item.k === 'Concatenated') this.subParts.push(...part.item.parts);
    else this.subParts.push(part);
  }
  addRaw(v) { this.buffer += v; }
  complete(end) {
    if (this.buffer !== '') this.subParts.push(spanned(Part.Literal(this.buffer), { start: this.bufferStart, end }));
    const span = { start: this.start, end };
    if (this.subParts.length === 0) return spanned(Part.Literal(''), span);
    if (this.subParts.length === 1) return this.subParts.pop();
    return spanned(Part.Concatenated(this.subParts), span);
  }
  isEmpty() { return this.buffer === '' && this.subParts.length === 0; }
}

// ---- Parser (parser.rs) ----
class Parser {
  constructor(input) { this.tokens = input; this.containsRedirection = false; }
  parse() { const commands = this.parseCommandList(null); return { commands, containsRedirection: this.containsRedirection }; }
  span(start) { return { start, end: this.tokens.posn() }; }
  skipWhitespace() { while (this.tokens.peek() && this.tokens.peek().t === 'Whitespace') this.tokens.next(); }

  parseCommandList(delimiter) {
    const commands = [];
    for (;;) {
      this.skipWhitespace();
      const pk = this.tokens.peek();
      if (delimiter !== null && pk !== null && pk.t === delimiter) break;
      if (pk === null) break;
      if (pk.t === 'OpenParen') { this.tokens.next(); commands.push(...this.parseCommandList('CloseParen')); }
      else if (pk.t === 'OpenCurly') { this.tokens.next(); commands.push(...this.parseCommandList('CloseCurly')); }
      else if (pk.t === 'CloseParen' || pk.t === 'CloseCurly') { this.tokens.next(); }
      else if (pk.t === 'RedirectInput' || pk.t === 'RedirectOutput') { this.containsRedirection = true; this.tokens.next(); }
      else if (isValidSeparator(pk)) { this.tokens.next(); }
      else { commands.push(this.parseCommand()); }
    }
    return commands;
  }

  parseCommand() {
    const start = this.tokens.posn();
    const parts = [];
    for (;;) {
      this.skipWhitespace();
      const pk = this.tokens.peek();
      if (pk === null) break;
      if (pk.t === 'RedirectInput' || pk.t === 'RedirectOutput') { this.containsRedirection = true; this.tokens.next(); }
      else if (isCommandTerminator(pk)) break;
      else parts.push(this.parsePart(parts.length === 0));
    }
    return spanned(Command(parts), this.span(start));
  }

  parsePart(firstPart) {
    const builder = new PartBuilder(this.tokens.posn());
    for (;;) {
      const pk = this.tokens.peek();
      if (pk === null) break;
      if (pk.t === 'Whitespace') break;
      if (pk.t === 'RedirectInput' || pk.t === 'RedirectOutput') { this.containsRedirection = true; this.tokens.next(); continue; }
      if (isCommandTerminator(pk)) break;
      if (pk.t === 'DoubleQuote') { builder.addPart(this.parseDoubleQuotedPart()); continue; }
      if (pk.t === 'SingleQuote') { builder.addPart(this.parseSingleQuotedPart()); continue; }
      if (pk.t === 'Backtick') { builder.addPart(this.parseBacktickedSubshell()); continue; }
      if (pk.t === 'Dollar') {
        const pp = this.tokens.peekpeek();
        if (pp && pp.t === 'OpenParen') builder.addPart(this.parseDollarSubshell());
        else { this.tokens.next(); builder.addRaw('$'); }
        continue;
      }
      if (pk.t === 'EscapeChar') {
        const c = pk.v; this.tokens.next();
        const nt = this.tokens.next();
        if (nt === null) builder.addRaw(c);
        else if (nt.t === 'Newline') { /* line continuation */ }
        else if (nt.t === 'Literal' && nt.v === '~') { builder.addRaw(c); builder.addRaw('~'); }
        else { if (firstPart && builder.isEmpty()) builder.addRaw(c); builder.addRaw(asStr(nt)); }
        continue;
      }
      builder.addRaw(asStr(pk)); this.tokens.next();
    }
    return builder.complete(this.tokens.posn());
  }

  parseBacktickedSubshell() {
    const start = this.tokens.posn();
    this.tokens.next(); // backtick
    const sub = new Parser(this.tokens.untilBacktick());
    const cmds = sub.parseCommandList(null);
    if (sub.containsRedirection) this.containsRedirection = true;
    const close = this.tokens.next();
    return close === null ? spanned(Part.OpenSubshell(cmds), this.span(start)) : spanned(Part.ClosedSubshell(cmds), this.span(start));
  }
  parseDollarSubshell() {
    const start = this.tokens.posn();
    this.tokens.next(); this.tokens.next(); // $ (
    const cmds = this.parseCommandList('CloseParen');
    const close = this.tokens.next();
    return close === null ? spanned(Part.OpenSubshell(cmds), this.span(start)) : spanned(Part.ClosedSubshell(cmds), this.span(start));
  }
  parseDoubleQuotedPart() {
    const builder = new PartBuilder(this.tokens.posn());
    this.tokens.next(); // opening "
    for (;;) {
      const pk = this.tokens.peek();
      if (pk === null) break;
      if (pk.t === 'DoubleQuote') { this.tokens.next(); break; }
      if (pk.t === 'EscapeChar') {
        const c = pk.v; this.tokens.next();
        const nt = this.tokens.next();
        if (nt === null) builder.addRaw(c);
        else if (nt.t === 'Newline') { /* nothing */ }
        else if (nt.t === 'Dollar' || nt.t === 'Backtick' || nt.t === 'DoubleQuote' || nt.t === 'EscapeChar') builder.addRaw(asStr(nt));
        else { builder.addRaw(c); builder.addRaw(asStr(nt)); }
        continue;
      }
      if (pk.t === 'Backtick') { builder.addPart(this.parseBacktickedSubshell()); continue; }
      if (pk.t === 'Dollar') {
        const pp = this.tokens.peekpeek();
        if (pp && pp.t === 'OpenParen') builder.addPart(this.parseDollarSubshell());
        else { this.tokens.next(); builder.addRaw('$'); }
        continue;
      }
      builder.addRaw(asStr(pk)); this.tokens.next();
    }
    return builder.complete(this.tokens.posn());
  }
  parseSingleQuotedPart() {
    const start = this.tokens.posn();
    let buffer = '';
    this.tokens.next(); // opening '
    for (;;) { const t = this.tokens.next(); if (t === null) break; if (t.t === 'SingleQuote') break; buffer += asStr(t); }
    return spanned(Part.Literal(buffer), this.span(start));
  }
}

function newParser(source, escapeChar) { return new Parser(new ParserInput(tokenize(source, escapeChar, false))); }

// ---- Command helpers (mod.rs) ----
function partToString(part) {
  if (part.k === 'Literal') return part.v;
  if (part.k === 'Concatenated') return part.parts.map((p) => partToString(p.item)).join('');
  return '';
}
function byteSliceTrim(src, a, b) { return Buffer.from(src, 'utf8').subarray(a, b).toString('utf8').trim(); }
function commandSource(cmd, src) {
  if (cmd.parts.length === 0) return null;
  const f = cmd.parts[0], l = cmd.parts[cmd.parts.length - 1];
  return byteSliceTrim(src, f.span.start, l.span.end);
}
function removeLeadingEnvVars(cmd) {
  while (cmd.parts.length) { const f = cmd.parts[0]; if (partToString(f.item).split('=').length !== 2) break; cmd.parts.shift(); }
}
function decompose(cmd, src) {
  const all = []; let hasLiteral = false;
  for (const part of cmd.parts) {
    const it = part.item;
    if (it.k === 'Literal') hasLiteral = true;
    else if (it.k === 'ClosedSubshell' || it.k === 'OpenSubshell') {
      const s = it.cmds; if (s.length) all.push(byteSliceTrim(src, s[0].span.start, s[s.length - 1].span.end));
      for (const c of s) all.push(...decompose(c.item, src));
    } else if (it.k === 'Concatenated') {
      const s = it.parts; if (s.length) all.push(byteSliceTrim(src, s[0].span.start, s[s.length - 1].span.end));
      all.push(...decompose(Command(s), src));
    }
  }
  const thisCommand = commandSource(cmd, src);
  if (thisCommand !== null && hasLiteral) all.push(thisCommand);
  return all;
}

// ---- Public API (mod.rs) ----
function topLevelCommand(source, escapeChar) {
  const cmds = newParser(source, escapeChar).parse().commands;
  if (cmds.length === 0) return null;
  const command = cmds[0]; removeLeadingEnvVars(command.item);
  const first = command.item.parts[0];
  return first && first.item.k === 'Literal' ? first.item.v : null;
}
function allParsedCommands(source, escapeChar) {
  return newParser(source, escapeChar).parse().commands.map((c) => { removeLeadingEnvVars(c.item); return c; });
}
function commandWithoutLeadingEnvVars(source, escapeChar) {
  const cmds = newParser(source, escapeChar).parse().commands;
  if (cmds.length === 0) return null;
  removeLeadingEnvVars(cmds[0].item);
  return commandSource(cmds[0].item, source);
}
function decomposeCommand(command, escapeChar) {
  const res = newParser(command, escapeChar).parse();
  const out = res.commands.flatMap((c) => decompose(c.item, command));
  return [out, res.containsRedirection];
}
function parseCommandOf(source, escapeChar) { return newParser(source, escapeChar).parseCommand(); }

module.exports = {
  Part, Command, spanned, Parser, ParserInput, EscapeChar,
  newParser, parseCommandOf,
  topLevelCommand, allParsedCommands, commandWithoutLeadingEnvVars, decomposeCommand, decompose,
};
