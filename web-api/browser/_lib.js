const API = 'https://api.browserbase.com/v1';
const headers = () => ({ 'content-type': 'application/json', 'x-bb-api-key': process.env.BROWSERBASE_API_KEY });
const json = (res, code, body) => res.status(code).json(body);
async function bb(path, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Browserbase ${response.status}`);
  return body;
}
async function navigate(connectUrl, url) {
  const ws = new WebSocket(connectUrl); let id = 0; const pending = new Map();
  const send = (method, params, sessionId) => new Promise((resolve, reject) => {
    const requestId = ++id; pending.set(requestId, { resolve, reject });
    const message = { id: requestId, method, params: params || {} }; if (sessionId) message.sessionId = sessionId;
    ws.send(JSON.stringify(message));
  });
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('Browser connection failed')); });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id); if (!request) return;
    pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  };
  const targets = await send('Target.getTargets');
  const target = (targets.targetInfos || []).filter((item) => item.type === 'page').at(-1);
  if (!target) throw new Error('Browser page unavailable');
  const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  await send('Page.navigate', { url }, attached.sessionId);
  ws.close();
}
module.exports = { bb, json, navigate };
