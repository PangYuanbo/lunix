// Module mirror of Warp crate `ipc` (Rust: crates/ipc, 1182 LOC).
// STATUS: partial — faithful port of the wire framing from crates/ipc/src/protocol.rs: each
// message is an 8-byte (usize) big-endian length header followed by the serialized payload
// (send_message / receive_message). The Request/Response message shapes are ported as data
// types. The async socket transport (native/wasm/server/client) and bincode codec are
// runtime-coupled and not ported; framing operates on raw payload bytes here.
'use strict';

const USIZE_SIZE = 8; // size_of::<usize>() on 64-bit, matching usize::to_be_bytes()

// send_message framing: [8-byte BE length][payload].
function frameMessage(payloadBytes) {
  const payload = Buffer.isBuffer(payloadBytes) ? payloadBytes : Buffer.from(payloadBytes);
  const header = Buffer.alloc(USIZE_SIZE);
  header.writeBigUInt64BE(BigInt(payload.length));
  return Buffer.concat([header, payload]);
}

// receive_message framing: read the 8-byte header, then exactly that many payload bytes.
// Returns { payload, rest } or null if `buf` doesn't yet hold a complete frame.
function parseFrame(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < USIZE_SIZE) return null;
  const payloadLen = Number(b.readBigUInt64BE(0));
  if (b.length < USIZE_SIZE + payloadLen) return null;
  return { payload: b.subarray(USIZE_SIZE, USIZE_SIZE + payloadLen), rest: b.subarray(USIZE_SIZE + payloadLen) };
}

// Request / Response message shapes (protocol.rs). RequestId is a UUID string here.
function newRequest(id, serviceId, bytes) { return { id, service_id: serviceId, bytes }; }
const Response = {
  success: (requestId, serviceId, bytes) => ({ k: 'Success', request_id: requestId, service_id: serviceId, bytes }),
  failure: (requestId, errorMessage) => ({ k: 'Failure', request_id: requestId, error_message: errorMessage }),
};

module.exports = {
  __crate: 'ipc', __status: 'partial', __rustLoc: 1182,
  USIZE_SIZE, frameMessage, parseFrame, newRequest, Response,
};
