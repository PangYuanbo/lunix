const { bb, json, navigate } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  try {
    const url = /^https?:\/\//i.test(req.body?.url || '') ? req.body.url : `https://${req.body?.url || ''}`;
    const session = await bb(`/sessions/${encodeURIComponent(req.body.sessionId)}`);
    await navigate(session.connectUrl, url);
    return json(res, 200, { ok: true });
  } catch (error) { return json(res, 500, { error: error.message }); }
};
