// Port of crates/warp_util/src/on_cancel.rs — attach a callback that fires if an async operation
// is cancelled before completing. Rust expresses this as a Future wrapper whose PinnedDrop calls
// `on_cancel` unless the inner future already reached Poll::Ready. JS has no future-drop, so the
// idiomatic 1:1 of "cancelled before ready" is an AbortSignal: the callback fires exactly once iff
// the signal aborts before the promise resolves. Semantics preserved; mechanism is AbortSignal.
'use strict';

const Aborted = Symbol('Aborted');

// withOnCancel(makePromise, onCancel, signal): runs makePromise(); if `signal` aborts before it
// resolves, calls onCancel() once and rejects with `Aborted`. If it resolves first, onCancel is
// never called.
function withOnCancel(makePromise, onCancel, signal) {
  return new Promise((resolve, reject) => {
    let isReady = false;
    if (signal && signal.aborted) { onCancel(); reject(Aborted); return; }
    const onAbort = () => { if (!isReady) { onCancel(); reject(Aborted); } };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve().then(makePromise).then(
      (v) => { isReady = true; if (signal) signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { isReady = true; if (signal) signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

module.exports = { Aborted, withOnCancel };
