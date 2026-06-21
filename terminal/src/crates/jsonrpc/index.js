// Module mirror of Warp crate `jsonrpc` (Rust: crates/jsonrpc, 461 LOC).
// STATUS: partial — faithful port of the JSON-RPC 2.0 message envelope and the server-request
// ack/error logic from crates/jsonrpc/src/service.rs (Request / Notification / AnyRequest /
// AnyResponse shapes, null-params skipping, ack-allowlist vs not-implemented error). The async
// service loop + Transport trait (service.rs / transport.rs) are runtime-coupled (warpui_core
// executor, async channels, oneshot) and are not ported here.
'use strict';

const JSON_RPC_VERSION = '2.0';
const isNull = (v) => v === null || v === undefined;

// Request<T> / Notification<T>: params skipped when null (serde skip_serializing_if = is_null_value).
function buildRequest(id, method, params) {
  const out = { jsonrpc: JSON_RPC_VERSION, id, method };
  if (!isNull(params)) out.params = params;
  return out;
}
function buildNotification(method, params) {
  const out = { jsonrpc: JSON_RPC_VERSION, method };
  if (!isNull(params)) out.params = params;
  return out;
}

// AnyRequest / AnyNotification / AnyResponse — parse + validate the inbound envelope.
function parseAnyRequest(json) {
  const m = typeof json === 'string' ? safeParse(json) : json;
  if (!m || typeof m.method !== 'string' || !Number.isInteger(m.id)) return null;
  return { jsonrpc: m.jsonrpc, method: m.method, params: m.params ?? null, id: m.id };
}
function parseAnyNotification(json) {
  const m = typeof json === 'string' ? safeParse(json) : json;
  if (!m || typeof m.method !== 'string' || m.id !== undefined) return null;
  return { jsonrpc: m.jsonrpc, method: m.method, params: m.params ?? null };
}
function parseAnyResponse(json) {
  const m = typeof json === 'string' ? safeParse(json) : json;
  if (!m || !Number.isInteger(m.id) || !('result' in m || 'error' in m)) return null;
  return { jsonrpc: m.jsonrpc, result: m.result ?? null, error: m.error ?? null, id: m.id };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// Server -> client requests we can safely acknowledge (some LSP servers crash on an error reply).
const ACK_METHODS = new Set(['window/workDoneProgress/create', 'client/registerCapability', 'client/unregisterCapability']);

// Faithful port of the ack/error response construction (service.rs handle_server_request).
// Returns { response, shouldAck }.
function serverRequestResponse(request, requestErrorCode) {
  const shouldAck = ACK_METHODS.has(request.method);
  const response = shouldAck
    ? { jsonrpc: JSON_RPC_VERSION, id: request.id, result: null }
    : { jsonrpc: JSON_RPC_VERSION, id: request.id, error: { code: requestErrorCode, message: `Method ${request.method} not implemented` } };
  return { response, shouldAck };
}

module.exports = {
  __crate: 'jsonrpc', __status: 'partial', __rustLoc: 461,
  JSON_RPC_VERSION, ACK_METHODS,
  buildRequest, buildNotification, parseAnyRequest, parseAnyNotification, parseAnyResponse, serverRequestResponse,
};
