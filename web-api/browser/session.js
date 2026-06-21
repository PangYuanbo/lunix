const { bb, cookie, json, navigate } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  try {
    const savedId = cookie(req, 'lunix_browser_session');
    if (savedId) {
      try {
        const saved = await bb(`/sessions/${encodeURIComponent(savedId)}`);
        if (saved.connectUrl && !['COMPLETED', 'ERROR'].includes(saved.status)) {
          const debug = await bb(`/sessions/${encodeURIComponent(savedId)}/debug`).catch(() => ({}));
          return json(res, 200, { sessionId: saved.id, home: debug.pages?.at(-1)?.url || '', connectUrl: saved.connectUrl, reused: true });
        }
      } catch { /* expired session: create a fresh one */ }
    }
    const url = /^https?:\/\//i.test(req.body?.url || '') ? req.body.url : 'https://www.google.com';
    const session = await bb('/sessions', { method: 'POST', body: JSON.stringify({ projectId: process.env.BROWSERBASE_PROJECT_ID, keepAlive: true, timeout: 1800 }) });
    await navigate(session.connectUrl, url);
    res.setHeader('Set-Cookie', `lunix_browser_session=${session.id}; Path=/; Max-Age=1800; HttpOnly; Secure; SameSite=Lax`);
    return json(res, 200, { sessionId: session.id, home: url, connectUrl: session.connectUrl });
  } catch (error) { return json(res, 500, { error: error.message }); }
};
