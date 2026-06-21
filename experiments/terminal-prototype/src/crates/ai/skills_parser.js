// Faithful 1:1 port of crates/ai/src/skills/parser.rs — parse_markdown_content: extracts YAML
// front matter (between leading `---` fences, LF/CRLF, with optional surrounding whitespace) and
// computes the 1-indexed line range of the markdown body. Skill front matter is documented as a
// single-level string→string map, so it is parsed line-wise (matching serde_yaml for flat maps)
// rather than pulling in a full YAML library.
'use strict';

// Mirrors the Rust regex (?ms)\A\s*---[ \t]*\r?\n(.*?)\r?\n---[ \t]*\r?\n
const FRONT_MATTER_RE = /^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/;

// Rust str::lines() count: splits on \n, a trailing newline does not yield an empty final line.
function linesCount(s) {
  if (s === '') return 0;
  const parts = s.split('\n');
  if (parts[parts.length - 1] === '') parts.pop(); // drop the trailing-newline empty segment
  return parts.length;
}

function parseFlatYaml(yamlStr) {
  const map = {};
  for (let line of yamlStr.split('\n')) {
    line = line.replace(/\r$/, '').trim();
    if (line === '') continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return map;
}

function parseMarkdownContent(content) {
  const m = FRONT_MATTER_RE.exec(content);
  if (m) {
    const yamlStr = m[1].trim();
    const frontMatter = yamlStr === '' ? {} : parseFlatYaml(yamlStr);
    const contentStart = m.index + m[0].length;
    const linesBeforeContent = linesCount(content.slice(0, contentStart));
    const totalLines = linesCount(content);
    return { front_matter: frontMatter, content, line_range: [linesBeforeContent + 1, totalLines + 1] };
  }
  return { front_matter: {}, content, line_range: null };
}

module.exports = { parseMarkdownContent, linesCount };
