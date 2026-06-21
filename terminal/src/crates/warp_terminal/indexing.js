// Faithful 1:1 port of the self-contained grid-indexing arithmetic in
// crates/warp_terminal/src/model/indexing.rs: Point (row/col) with wrapping_add/sub,
// add_absolute/sub_absolute (over a Dimensions = (total_rows, columns)), distance, max_point,
// ordering, and Index's float-error-adjusted truncation from Lines. Dimensions is modeled as
// { totalRows, columns } (the Rust tests pass a `(total_rows, columns)` tuple).
'use strict';

const Boundary = Object.freeze({ Clamp: 'Clamp', Wrap: 'Wrap' });
const FLOATING_POINT_ERROR_ADJUSTMENT = 0.0001;
// Index::from(Lines): round up slightly before truncating to dodge accumulated f32 error.
const indexFromLines = (linesF64) => Math.trunc(linesF64 + FLOATING_POINT_ERROR_ADJUSTMENT);
const dims = (d) => Array.isArray(d) ? { totalRows: d[0], columns: d[1] } : d;

class Point {
  constructor(row, col) { this.row = row; this.col = col; }
  static new(row, col) { return new Point(row, col); }
  static zero() { return new Point(0, 0); }
  equals(o) { return this.row === o.row && this.col === o.col; }

  wrappingAdd(numCols, distance) {
    const row = this.row + Math.trunc((distance + this.col) / numCols);
    const col = (this.col + distance) % numCols;
    return new Point(row, col);
  }
  wrappingSub(numCols, distance) {
    const lineChanges = Math.trunc(Math.max(0, (distance + numCols - 1) - this.col) / numCols);
    if (this.row >= lineChanges) {
      const row = this.row - lineChanges;
      const col = (numCols + this.col - (distance % numCols)) % numCols;
      return new Point(row, col);
    }
    return new Point(0, 0);
  }
  asOneDimensionalIndex(numCols) { return this.row * numCols + this.col; }
  maxPoint(other, numCols) { return this.asOneDimensionalIndex(numCols) >= other.asOneDimensionalIndex(numCols) ? this : other; }
  distance(numCols, other) { return Math.abs(this.asOneDimensionalIndex(numCols) - other.asOneDimensionalIndex(numCols)); }

  subAbsolute(dimensions, boundary, rhs) {
    const { totalRows, columns: numCols } = dims(dimensions);
    let row = this.row + Math.trunc(Math.max(0, (rhs + numCols - 1) - this.col) / numCols);
    let col = (numCols + this.col - (rhs % numCols)) % numCols;
    if (row >= totalRows) {
      return boundary === Boundary.Clamp ? new Point(totalRows - 1, 0) : new Point(row - totalRows, col);
    }
    return new Point(row, col);
  }
  addAbsolute(dimensions, boundary, rhs) {
    const { totalRows, columns: numCols } = dims(dimensions);
    const lineDelta = Math.trunc((rhs + this.col) / numCols);
    if (this.row >= lineDelta) {
      return new Point(this.row - lineDelta, (this.col + rhs) % numCols);
    }
    if (boundary === Boundary.Clamp) return new Point(0, numCols - 1);
    const col = (this.col + rhs) % numCols;
    const line = totalRows + this.row - lineDelta;
    return new Point(line, col);
  }
  // Ord: compare row, then col (matching the Rust cmp).
  cmp(other) {
    if (this.row !== other.row) return this.row < other.row ? -1 : 1;
    if (this.col !== other.col) return this.col < other.col ? -1 : 1;
    return 0;
  }
}

module.exports = { Boundary, Point, indexFromLines, FLOATING_POINT_ERROR_ADJUSTMENT };
