const { bb, json, navigate } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  try {
    const url = /^https?:\/\//i.test(req.body?.url || '') ? req.body.url : 'https://www.google.com';
    const session = await bb('/sessions', { method: 'POST', body: JSON.stringify({ projectId: process.env.BROWSERBASE_PROJECT_ID, keepAlive: true, timeout: 1800 }) });
    await navigate(session.connectUrl, url);
    return json(res, 200, { sessionId: session.id, home: url, connectUrl: session.connectUrl });
  } catch (error) { return json(res, 500, { error: error.message }); }
};
