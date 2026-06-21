// Module mirror of Warp crate `markdown_parser` (Rust: crates/markdown_parser, 6722 LOC).
// STATUS: partial — faithful 1:1 port of the self-contained CustomWeight enum from
// crates/markdown_parser/src/weight.rs (ordered font-weight + merge/bold helpers). The full
// Markdown/HTML parsers (markdown_parser.rs, html_parser.rs) build on the `nom` parser-combinator
// crate and are not ported here.
'use strict';

// Ordered variants (preserves the Rust `Sequence` ordering thin -> black).
const CustomWeight = Object.freeze({
  Thin: 'Thin', ExtraLight: 'ExtraLight', Light: 'Light', Medium: 'Medium',
  Semibold: 'Semibold', Bold: 'Bold', ExtraBold: 'ExtraBold', Black: 'Black',
});
const WEIGHT_SEQUENCE = ['Thin', 'ExtraLight', 'Light', 'Medium', 'Semibold', 'Bold', 'ExtraBold', 'Black'];

function isAtLeastBold(w) {
  return w === CustomWeight.Bold || w === CustomWeight.ExtraBold || w === CustomWeight.Black;
}

// Nested weights are not supported — the outer (first) non-null weight wins.
function mergeWeights(first, second) {
  return first != null ? first : (second != null ? second : null);
}

module.exports = {
  __crate: 'markdown_parser', __status: 'partial', __rustLoc: 6722,
  CustomWeight, WEIGHT_SEQUENCE, isAtLeastBold, mergeWeights,
};
