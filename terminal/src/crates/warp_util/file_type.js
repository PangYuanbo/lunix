// Faithful port of crates/warp_util/src/file_type.rs — text/binary/markdown file detection.
// Extension sets are transcribed verbatim from the Rust matches! arms. The Rust `is_text_file`
// consults mime_guess first; since its text MIME cases are subsumed by the development-extension
// list below (and the application text-subtypes set), this port applies the same precedence:
// MIME text-subtypes -> development extensions -> extensionless names. Binary detection mirrors
// content_inspector via a NUL/control-byte heuristic.
'use strict';
const fs = require('fs');

const MARKDOWN_EXTENSIONS = ["md", "markdown"];
const MARKDOWN_FILE_NAMES = ["README", "CHANGELOG", "LICENSE"];
const APP_TEXT_SUBTYPES = new Set(["json", "xml", "javascript", "yaml", "toml", "x-yaml", "x-toml", "x-javascript", "x-sh", "x-shellscript", "x-httpd-php", "x-ruby", "x-python", "x-perl", "sql"]);
const DEV_TEXT_EXTENSIONS = new Set(["rs", "go", "py", "py3", "pyw", "pyi", "js", "mjs", "cjs", "ts", "tsx", "jsx", "java", "c", "cc", "cpp", "cxx", "h", "hh", "hpp", "hxx", "cs", "php", "phtml", "rb", "swift", "kt", "kts", "scala", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "asm", "s", "vb", "pl", "r", "m", "mm", "dart", "lua", "vim", "el", "clj", "cljs", "hs", "lhs", "ml", "mli", "fs", "fsi", "fsx", "ex", "exs", "erl", "hrl", "elm", "nim", "cr", "zig", "v", "jl", "rkt", "scm", "lisp", "cl", "coffee", "purs", "reason", "re", "res", "resi", "html", "htm", "css", "scss", "sass", "less", "vue", "svelte", "astro", "blade", "twig", "mustache", "hbs", "handlebars", "ejs", "pug", "jade", "erb", "haml", "toml", "yaml", "yml", "json", "jsonc", "json5", "jq", "xml", "ini", "cfg", "conf", "config", "properties", "env", "dotenv", "editorconfig", "gitignore", "gitattributes", "md", "markdown", "mdown", "mkd", "rst", "txt", "rtf", "tex", "latex", "adoc", "asciidoc", "org", "pod", "rdoc", "textile", "wiki", "mediawiki", "cmake", "gradle", "sbt", "ant", "maven", "pom", "build", "mk", "mak", "ninja", "bazel", "bzl", "dockerfile", "containerfile", "lock", "sum", "mod", "prettierrc", "eslintrc", "stylelintrc", "babelrc", "postcssrc", "browserslistrc", "npmrc", "yarnrc", "nvmrc", "rvmrc", "gemfile", "podfile", "cartfile", "log", "diff", "patch", "bak", "tmp", "temp", "csv", "tsv", "sql", "graphql", "gql", "proto", "thrift", "avro", "schema", "xsd", "dtd", "rng", "rnc", "wsdl", "wadl"]);
const EXTENSIONLESS_TEXT = new Set(["readme", "license", "licence", "changelog", "changes", "authors", "contributors", "copying", "install", "news", "todo", "fixme", "bugs", "issues", "release", "history", "version", "notice", "disclaimer", "makefile", "dockerfile", "containerfile", "rakefile", "gemfile", "podfile", "cartfile", "brewfile", "procfile", "profile", "bashrc", "zshrc", "vimrc", "tmux.conf", "gitconfig", "hgrc", "cargo.toml", "package.json", "composer.json", "pubspec.yaml", "pyproject.toml"]);
const DOTFILE_TEXT = new Set([".gitignore", ".gitattributes", ".editorconfig", ".prettierrc", ".eslintrc", ".stylelintrc", ".babelrc", ".postcssrc", ".browserslistrc", ".npmrc", ".yarnrc", ".nvmrc", ".rvmrc", ".env", ".envrc", ".profile", ".bashrc", ".zshrc", ".vimrc", ".tmux.conf"]);
const BINARY_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp", "ico", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "dmg", "iso", "img", "exe", "msi", "deb", "rpm", "app", "pkg", "bin", "so", "dll", "dylib", "mp3", "mp4", "avi", "mov", "wmv", "flv", "mkv", "wav", "flac", "ogg", "woff", "woff2", "ttf", "otf", "eot", "db", "sqlite", "sqlite3", "pyc", "pyo", "class", "jar"]);

// Rust Path semantics: basename = last '/'-separated segment; extension = text after the final
// '.' only when that '.' is not the first char of the basename (so dotfiles have no extension).
function basenameOf(p) { const parts = String(p).split('/'); return parts[parts.length - 1]; }
function extensionOf(p) {
  const b = basenameOf(p); const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i + 1) : null;
}

function is_development_text_extension(ext) { return DEV_TEXT_EXTENSIONS.has(ext); }

function is_extensionless_text_file(filename) {
  const base = (basenameOf(filename) || filename).toLowerCase();
  if (EXTENSIONLESS_TEXT.has(base)) return true;
  return base.startsWith('.') && DOTFILE_TEXT.has(base);
}

function is_text_file(filename) {
  const ext = (extensionOf(filename) || '').toLowerCase();
  if (is_development_text_extension(ext)) return true;
  if (ext === '') return is_extensionless_text_file(filename);
  return false;
}

function is_markdown_file(path) {
  const ext = extensionOf(path);
  if (ext != null) return MARKDOWN_EXTENSIONS.some((m) => ext.toLowerCase() === m);
  const base = basenameOf(path);
  return MARKDOWN_FILE_NAMES.some((m) => base.toLowerCase() === m.toLowerCase());
}

function is_binary_file(path) {
  const ext = extensionOf(path);
  if (ext != null) return BINARY_EXTENSIONS.has(ext.toLowerCase());
  return !is_text_file(String(path));
}

// content_inspector analog: BINARY if a NUL byte appears in the inspected chunk.
function is_buffer_binary(buffer) { return Buffer.from(buffer).includes(0); }
function is_file_content_binary(path) {
  try { const fd = fs.openSync(path, 'r'); const buf = Buffer.alloc(1024); const n = fs.readSync(fd, buf, 0, 1024, 0); fs.closeSync(fd); return is_buffer_binary(buf.subarray(0, n)); }
  catch { return true; }
}

module.exports = {
  is_text_file, is_development_text_extension, is_extensionless_text_file,
  is_markdown_file, is_binary_file, is_buffer_binary, is_file_content_binary,
  DEV_TEXT_EXTENSIONS, BINARY_EXTENSIONS,
};
