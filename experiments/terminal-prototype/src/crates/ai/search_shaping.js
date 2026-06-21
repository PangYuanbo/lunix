// Faithful 1:1 port of crates/ai/src/index/full_source_code_embedding/search_shaping.rs —
// builds verified fragments from file contents (byte-range + char-boundary + content-hash checks)
// and shapes fragments into merged context line-ranges. ContentHash::from_content (a MerkleHash in
// Rust) is modeled as a deterministic SHA-256 hex digest; only equality/determinism matter here.
'use strict';
const crypto = require('crypto');

const ContentHash = { fromContent: (content) => crypto.createHash('sha256').update(content, 'utf8').digest('hex') };

const isCharBoundary = (buf, idx) => idx === 0 || idx === buf.length || (buf[idx] & 0xC0) !== 0x80;
const byteRangeEq = (a, b) => a.start === b.start && a.end === b.end;

// build_fragments_from_file_contents: metadatas = [[contentHash, metadata]], fileContents = Map<path,string>.
function buildFragmentsFromFileContents(metadatas, fileContents) {
  const successfullyRead = [], failToRead = [], failToReadPath = [];
  const byPath = new Map();
  for (const [contentHash, metadata] of metadatas) {
    if (!byPath.has(metadata.absolute_path)) byPath.set(metadata.absolute_path, []);
    byPath.get(metadata.absolute_path).push([contentHash, metadata.location.byte_range]);
  }
  for (const [filePath, fileFragments] of byPath) {
    let hasFailed = false;
    const fileContent = fileContents.get(filePath);
    if (fileContent !== undefined) {
      const buf = Buffer.from(fileContent, 'utf8');
      for (const [contentHash, range] of fileFragments) {
        const s = range.start, e = range.end;
        if (s <= e && e <= buf.length && isCharBoundary(buf, s) && isCharBoundary(buf, e)) {
          const content = buf.subarray(s, e).toString('utf8');
          if (content === '') { failToRead.push(contentHash); hasFailed = true; }
          else if (ContentHash.fromContent(content) !== contentHash) { failToRead.push(contentHash); hasFailed = true; }
          else successfullyRead.push({ content, content_hash: contentHash, location: { absolute_path: filePath, byte_range: range } });
        } else { failToRead.push(contentHash); hasFailed = true; }
      }
    } else {
      for (const [contentHash] of fileFragments) failToRead.push(contentHash);
      hasFailed = true;
    }
    if (hasFailed) failToReadPath.push(filePath);
  }
  return { successfully_read: successfullyRead, fail_to_read: failToRead, fail_to_read_path: failToReadPath };
}

// fragments_to_context_locations: groups + dedupes fragments per file, merging line ranges with
// `context_lines` of padding. metadataForHash(hash) -> array of FragmentMetadata or null.
function fragmentsToContextLocations(fragments, metadataForHash, contextLines) {
  const byPath = new Map();
  const wholeFiles = new Set();
  for (const fragment of fragments) {
    const metas = metadataForHash(fragment.content_hash);
    const metadata = metas && metas.find((m) => m.absolute_path === fragment.location.absolute_path && byteRangeEq(m.location.byte_range, fragment.location.byte_range));
    if (metadata) {
      const path = fragment.location.absolute_path;
      const start = Math.max(0, metadata.location.start_line - contextLines);
      const end = metadata.location.end_line + 1 + contextLines;
      if (!byPath.has(path)) byPath.set(path, []);
      byPath.get(path).push([start, end]);
    } else {
      wholeFiles.add(fragment.location.absolute_path);
    }
  }
  const result = [];
  for (const [path, ranges] of byPath) {
    if (ranges.length === 0 || wholeFiles.has(path)) continue;
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    result.push({ kind: 'Fragment', path, line_ranges: merged });
  }
  for (const path of wholeFiles) result.push({ kind: 'WholeFile', path });
  return result;
}

module.exports = { ContentHash, buildFragmentsFromFileContents, fragmentsToContextLocations };
