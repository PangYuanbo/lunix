// Faithful 1:1 port of crates/ai/src/index/full_source_code_embedding/chunker/naive.rs plus the
// Fragment type and coalesce_fragments from chunker.rs. Chunks code into Fragments of at most
// numLinesPerChunk lines / maxBytesPerChunk bytes, splitting over-long lines on UTF-8 byte
// boundaries and coalescing small fragments back together. Byte offsets are real UTF-8 byte indices.
'use strict';

const isCharBoundary = (buf, idx) => idx <= 0 || idx >= buf.length || (buf[idx] & 0xC0) !== 0x80;

// line_span::line_spans analog: byte ranges [start,end) of each line's content (excluding the \n).
// A trailing newline does not yield an empty final line (matches str::lines()).
function lineSpans(buf) {
  const spans = [];
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length) { if (start < buf.length) spans.push({ start, end: i }); }
    else if (buf[i] === 0x0A) { spans.push({ start, end: i }); start = i + 1; }
  }
  return spans;
}

function makeFragment(content, startLine, endLine, filePath, startByte, endByte) {
  return { content, start_line: startLine, end_line: endLine, file_path: filePath, start_byte_index: startByte, end_byte_index: endByte };
}

function chunkLineByBytes(buf, sliceStr, path, maxBytes, lineNumber, sp) {
  const lineStart = sp.start, lineEnd = sp.end, lineLength = lineEnd - lineStart;
  if (lineLength <= maxBytes) return [makeFragment(sliceStr(lineStart, lineEnd), lineNumber, lineNumber, path, lineStart, lineEnd)];
  const fragments = [];
  let currentStart = lineStart;
  while (currentStart < lineEnd) {
    const remaining = lineEnd - currentStart;
    const chunkSize = Math.min(remaining, maxBytes);
    let chunkEnd = currentStart + chunkSize;
    while (chunkEnd > currentStart && !isCharBoundary(buf, chunkEnd)) chunkEnd -= 1;
    if (chunkEnd <= currentStart) { chunkEnd = currentStart + chunkSize; while (chunkEnd < lineEnd && !isCharBoundary(buf, chunkEnd)) chunkEnd += 1; }
    fragments.push(makeFragment(sliceStr(currentStart, chunkEnd), lineNumber, lineNumber, path, currentStart, chunkEnd));
    currentStart = chunkEnd;
  }
  return fragments;
}

function coalesceFragments(fragments, sliceStr, maxBytes) {
  const acc = [];
  for (let i = fragments.length - 1; i >= 0; i--) {
    const fragment = fragments[i];
    const last = acc[acc.length - 1];
    if (last) {
      const newSize = last.end_byte_index - fragment.start_byte_index;
      if (newSize <= maxBytes) {
        // fragment.append(last): extend fragment to cover through last, then replace last.
        fragment.end_line = last.end_line;
        fragment.end_byte_index = last.end_byte_index;
        fragment.content = sliceStr(fragment.start_byte_index, last.end_byte_index);
        acc[acc.length - 1] = fragment;
      } else acc.push(fragment);
    } else acc.push(fragment);
  }
  return acc.reverse();
}

function chunkCode(code, path, maxBytesPerChunk, numLinesPerChunk) {
  const buf = Buffer.from(code, 'utf8');
  const sliceStr = (s, e) => buf.subarray(s, e).toString('utf8');
  const spans = lineSpans(buf);
  const out = [];
  for (let c = 0; c < spans.length; c += numLinesPerChunk) {
    const chunk = spans.slice(c, c + numLinesPerChunk).map((sp, i) => [c + i, sp]);
    const [startLine, startRange] = chunk[0];
    const [endLine, endRange] = chunk[chunk.length - 1];
    if (endRange.end - startRange.start > maxBytesPerChunk) {
      const chunked = [];
      for (const [line, sp] of chunk) chunked.push(...chunkLineByBytes(buf, sliceStr, path, maxBytesPerChunk, line, sp));
      out.push(...coalesceFragments(chunked, sliceStr, maxBytesPerChunk));
    } else {
      out.push(makeFragment(sliceStr(startRange.start, endRange.end), startLine, endLine, path, startRange.start, endRange.end));
    }
  }
  return out;
}

module.exports = { chunkCode, lineSpans, coalesceFragments };
