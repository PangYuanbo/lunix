// Module mirror of Warp crate `languages` (Rust: crates/languages).
// STATUS: partial — faithful 1:1 port of the filename/extension -> language resolution from
// crates/languages/src/lib.rs (language_by_filename_parts + normalize_language_name) and the
// per-grammar display names from grammars/*/config.yaml. The tree-sitter grammar loading
// (arborium / rust_embed .scm queries) is native and not ported; language_by_filename here
// returns { name, display_name } rather than a fully-loaded Language.
'use strict';

// Internal language name -> display name (from grammars/<name>/config.yaml).
const DISPLAY_NAMES = {
  "c": "C",
  "cpp": "C++",
  "csharp": "C#",
  "css": "CSS",
  "dockerfile": "Dockerfile",
  "elixir": "Elixir",
  "golang": "Go",
  "hcl": "HCL",
  "html": "HTML",
  "java": "Java",
  "javascript": "JavaScript",
  "jq": "jq",
  "json": "JSON",
  "jsx": "JSX",
  "kotlin": "Kotlin",
  "lua": "Lua",
  "nix": "Nix",
  "objective-c": "Objective-C",
  "php": "PHP",
  "powershell": "PowerShell",
  "python": "Python",
  "ruby": "Ruby",
  "rust": "Rust",
  "scala": "Scala",
  "shell": "Shell",
  "sql": "SQL",
  "starlark": "Bazel (Starlark)",
  "swift": "Swift",
  "toml": "TOML",
  "tsx": "TSX",
  "typescript": "TypeScript",
  "vue": "Vue",
  "xml": "XML",
  "yaml": "YAML",
};

function languageByName(name) {
  const display = DISPLAY_NAMES[name];
  return display ? { name, display_name: display } : null;
}

// normalize_language_name: markdown alias -> internal name.
function normalizeLanguageName(name) {
  const m = { go: 'golang', bash: 'shell', sh: 'shell', zsh: 'shell', js: 'javascript', ts: 'typescript',
    py: 'python', rb: 'ruby', rs: 'rust', cs: 'csharp', 'c#': 'csharp', 'c++': 'cpp', objc: 'objective-c',
    objective_c: 'objective-c', terraform: 'hcl', tf: 'hcl', kt: 'kotlin', docker: 'dockerfile', containerfile: 'dockerfile' };
  return m[name] || name;
}

// Faithful port of language_by_filename_parts.
function languageByFilenameParts(filename, extension) {
  if (filename) {
    if (filename === '.bashrc' || filename === '.bash_profile') return languageByName('shell');
    if (filename === '.zshrc' || filename === '.zsh_profile' || filename === '.zprofile') return languageByName('shell');
    if (filename === 'BUILD' || filename === 'WORKSPACE') return languageByName('starlark');
    if (['Dockerfile', 'Containerfile', 'dockerfile', 'containerfile'].includes(filename)) return languageByName('dockerfile');
    if (filename.startsWith('Dockerfile.') || filename.startsWith('Containerfile.')) return languageByName('dockerfile');
  }
  if (!extension) return null;
  const EXT = {
    rs: 'rust', go: 'golang', yml: 'yaml', yaml: 'yaml', py: 'python', py3: 'python', pyw: 'python', pyi: 'python',
    js: 'javascript', cjs: 'javascript', mjs: 'javascript', jsx: 'jsx', tsx: 'tsx', ts: 'typescript', cts: 'typescript', mts: 'typescript',
    java: 'java', groovy: 'java', gvy: 'java', gy: 'java', gsh: 'java',
    cpp: 'cpp', cxx: 'cpp', cc: 'cpp', h: 'cpp', hh: 'cpp', hpp: 'cpp', hxx: 'cpp', H: 'cpp', 'h++': 'cpp',
    sh: 'shell', zsh: 'shell', bash: 'shell', command: 'shell', cs: 'csharp', html: 'html', htm: 'html', css: 'css', c: 'c',
    json: 'json', jq: 'jq', tf: 'hcl', hcl: 'hcl', tfvars: 'hcl', lua: 'lua', nix: 'nix', rb: 'ruby', php: 'php', phtml: 'php',
    toml: 'toml', swift: 'swift', kt: 'kotlin', kts: 'kotlin', scala: 'scala', sbt: 'scala', sc: 'scala', ps1: 'powershell', pwsh: 'powershell',
    ex: 'elixir', exs: 'elixir', sql: 'sql', bzl: 'starlark', bazel: 'starlark', m: 'objective-c', mm: 'objective-c', xml: 'xml', vue: 'vue', dockerfile: 'dockerfile',
  };
  const name = EXT[extension];
  return name ? languageByName(name) : null;
}

// language_by_filename over a basename string (parses out basename + extension, Rust Path semantics).
function languageByLocalFilename(p) {
  const parts = String(p).split('/');
  const basename = parts[parts.length - 1];
  const dot = basename.lastIndexOf('.');
  const extension = dot > 0 ? basename.slice(dot + 1) : null;
  return languageByFilenameParts(basename, extension);
}

module.exports = {
  __crate: 'languages', __status: 'partial',
  DISPLAY_NAMES, languageByName, normalizeLanguageName, languageByFilenameParts, languageByLocalFilename,
};
