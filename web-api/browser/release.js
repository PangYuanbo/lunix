const { bb, json } = require('./_lib');
module.exports = async (req, res) => {
  try {
    await bb(`/sessions/${encodeURIComponent(req.body?.sessionId)}`, { method: 'POST', body: JSON.stringify({ status: 'REQUEST_RELEASE', projectId: process.env.BROWSERBASE_PROJECT_ID }) });
    return json(res, 200, { ok: true });
  } catch (error) { return json(res, 500, { error: error.message }); }
};
