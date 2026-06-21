// Faithful 1:1 port of crates/editor/src/render/model/table_offset_map.rs — maps a linear char
// offset (cells joined by tab separators and trailing newlines) to a table position: InCell,
// OnTab, or OnNewline. Built from per-cell text lengths. Offsets are plain integers (CharOffset).
'use strict';

const TablePosition = {
  InCell: (row, col, offset_in_cell) => ({ kind: 'InCell', row, col, offset_in_cell }),
  OnTab: (row, after_col) => ({ kind: 'OnTab', row, after_col }),
  OnNewline: (row) => ({ kind: 'OnNewline', row }),
};

class TableOffsetMap {
  constructor(cellLengths) {
    this._numRows = cellLengths.length;
    this._numCols = cellLengths.length ? cellLengths[0].length : 0;
    this.cell_ranges = [];
    this.row_ranges = [];
    this.cell_index_by_row_col = [];
    let cur = 0;
    cellLengths.forEach((row, rowIdx) => {
      const rowStart = cur;
      const rowCellIndices = [];
      row.forEach((cellLen, colIdx) => {
        const start = cur, end = start + cellLen, cellIdx = this.cell_ranges.length;
        this.cell_ranges.push({ start, end, row: rowIdx, col: colIdx });
        rowCellIndices.push(cellIdx);
        cur = end;
        if (colIdx < row.length - 1) cur += 1; // tab separator
      });
      cur += 1; // row newline
      this.row_ranges.push({ start: rowStart, end: cur });
      this.cell_index_by_row_col.push(rowCellIndices);
    });
    this.total_length_ = cur;
  }
  static new(cellLengths) { return new TableOffsetMap(cellLengths); }

  totalLength() { return this.total_length_; }
  numRows() { return this._numRows; }
  numCols() { return this._numCols; }

  _separatorPosition(cell) {
    const rowLen = this.cell_index_by_row_col[cell.row] ? this.cell_index_by_row_col[cell.row].length : 0;
    return cell.col + 1 < rowLen ? TablePosition.OnTab(cell.row, cell.col) : TablePosition.OnNewline(cell.row);
  }

  positionAtOffset(offset) {
    if (offset >= this.total_length_) return null;
    // partition_point: first row whose end > offset.
    let rowIdx = 0;
    while (rowIdx < this.row_ranges.length && this.row_ranges[rowIdx].end <= offset) rowIdx++;
    const rowRange = this.row_ranges[rowIdx];
    if (!rowRange || offset < rowRange.start) return null;
    const rowCells = this.cell_index_by_row_col[rowIdx];
    if (!rowCells) return null;
    let previousCell = null;
    for (const cellIdx of rowCells) {
      const cell = this.cell_ranges[cellIdx];
      if (offset < cell.start) return previousCell ? this._separatorPosition(previousCell) : null;
      if (offset < cell.end) return TablePosition.InCell(cell.row, cell.col, offset - cell.start);
      if (offset === cell.end) return this._separatorPosition(cell);
      previousCell = cell;
    }
    return TablePosition.OnNewline(rowIdx);
  }

  cellRange(row, col) {
    const rowCells = this.cell_index_by_row_col[row];
    if (!rowCells || rowCells[col] === undefined) return null;
    const cell = this.cell_ranges[rowCells[col]];
    return { start: cell.start, end: cell.end };
  }

  cellAtOffset(offset) {
    const pos = this.positionAtOffset(offset);
    if (!pos) return null;
    if (pos.kind === 'InCell') return { row: pos.row, col: pos.col, offset_in_cell: pos.offset_in_cell };
    if (pos.kind === 'OnTab') { const c = this.cellRange(pos.row, pos.after_col); return c ? { row: pos.row, col: pos.after_col, offset_in_cell: c.end - c.start } : null; }
    // OnNewline -> last cell of the row
    const cells = this.cell_index_by_row_col[pos.row];
    const lastCol = Math.max(0, (cells ? cells.length : 0) - 1);
    const c = this.cellRange(pos.row, lastCol);
    return c ? { row: pos.row, col: lastCol, offset_in_cell: c.end - c.start } : null;
  }

  isSeparator(offset) { const p = this.positionAtOffset(offset); return !!p && (p.kind === 'OnTab' || p.kind === 'OnNewline'); }

  cellsInRange(start, end) { return this.cell_ranges.filter((c) => c.end > start && c.start < end).map((c) => ({ ...c })); }
}

module.exports = { TableOffsetMap, TablePosition };
