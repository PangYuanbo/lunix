// Module mirror of Warp crate `field_mask` (Rust: crates/field_mask, 169 LOC).
// STATUS: ported (algorithm) — faithful port of the FieldMaskOperation apply logic from
// crates/field_mask/src/lib.rs. The Rust drives protobuf reflection (prost_reflect /
// DynamicMessage); here messages are modeled as plain objects and repeated fields as arrays,
// preserving the path-walk semantics: dot-separated paths, Update vs append-string, no-op on
// unknown (absent) fields, list-length equality, and nested recursion.
'use strict';

const OperationType = Object.freeze({ Update: 'Update', Append: 'Append' });

class FieldMaskError extends Error {}
const isMessage = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

function applyPath(target, patch, segments, op) {
  const fieldName = segments[0];
  if (fieldName === undefined) return;
  // Unknown field (absent in target schema) -> no-op, mirroring protobuf forward-compat.
  if (!Object.prototype.hasOwnProperty.call(target, fieldName)) return;

  if (segments.length === 1) {
    if (op === OperationType.Update) {
      target[fieldName] = patch[fieldName];
    } else { // Append
      const tv = target[fieldName], pv = patch[fieldName];
      if (typeof tv === 'string' && typeof pv === 'string') target[fieldName] = `${tv}${pv}`;
      else throw new FieldMaskError(`Append is unsupported for field: ${fieldName}`);
    }
    return;
  }

  // Nested path
  const tField = target[fieldName], pField = patch[fieldName];
  if (Array.isArray(tField) && Array.isArray(pField)) {
    if (tField.length !== pField.length) {
      throw new FieldMaskError(`Field ${fieldName} lists have different lengths: target has ${tField.length}, patch has ${pField.length}`);
    }
    for (let i = 0; i < tField.length; i++) {
      if (isMessage(tField[i]) && isMessage(pField[i])) applyPath(tField[i], pField[i], segments.slice(1), op);
      else throw new FieldMaskError(`Field ${fieldName} list elements are not messages`);
    }
    return;
  }
  if (isMessage(tField) && isMessage(pField)) { applyPath(tField, pField, segments.slice(1), op); return; }
  throw new FieldMaskError(segments.join('.'));
}

class FieldMaskOperation {
  constructor(destination, source, maskPaths, op) {
    this.destination = destination; this.source = source; this.maskPaths = maskPaths; this.op = op;
  }
  static update(destination, source, maskPaths) { return new FieldMaskOperation(destination, source, maskPaths, OperationType.Update); }
  static append(destination, source, maskPaths) { return new FieldMaskOperation(destination, source, maskPaths, OperationType.Append); }
  apply() {
    const target = structuredClone(this.destination);
    for (const path of this.maskPaths) applyPath(target, this.source, path.split('.'), this.op);
    return target;
  }
}

module.exports = {
  __crate: 'field_mask', __status: 'ported', __rustLoc: 169,
  OperationType, FieldMaskError, FieldMaskOperation,
};
