// Module mirror of Warp crate `lsp` (Rust: crates/lsp, 5067 LOC).
// STATUS: partial — faithful 1:1 port of the file-URI <-> path conversions from
// crates/lsp/src/config.rs (path_to_lsp_uri / lsp_uri_to_path). The Rust uses the `url` crate
// for percent-encoding; here Node's url.pathToFileURL / fileURLToPath provide the same RFC 3986
// behavior, plus the explicit `[`/`]` -> %5B/%5D rule LSP requires (Next.js [slug].tsx routes).
// The LSP client/server runtime is process-coupled and not ported.
'use strict';
const { pathToFileURL, fileURLToPath } = require('url');

// path_to_lsp_uri: absolute path -> file:// URI with LSP bracket encoding.
function pathToLspUri(p) {
  if (!p.startsWith('/')) throw new Error(`Path must be absolute: ${p}`);
  // pathToFileURL percent-encodes spaces, non-ASCII, '#', etc. like the url crate.
  let uri = pathToFileURL(p).href;
  // The url crate / WHATWG URL don't encode brackets, but LSP requires them encoded.
  uri = uri.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
  return uri;
}

// lsp_uri_to_path: file:// URI -> decoded absolute path. Rejects non-file schemes.
function lspUriToPath(uri) {
  const scheme = uri.slice(0, uri.indexOf(':'));
  if (scheme !== 'file') throw new Error(`Invalid file URI: ${uri}`);
  return fileURLToPath(uri); // decodes percent-encoding
}

module.exports = { __crate: 'lsp', __status: 'partial', __rustLoc: 5067, pathToLspUri, lspUriToPath };
