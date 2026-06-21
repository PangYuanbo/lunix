const { bb, json } = require('./_lib');
module.exports = async (req, res) => {
  try {
    const debug = await bb(`/sessions/${encodeURIComponent(req.query.sessionId)}/debug`);
    const page = debug.pages?.at(-1);
    return json(res, 200, { url: page?.url, liveViewUrl: page?.debuggerFullscreenUrl || debug.debuggerFullscreenUrl });
  } catch (error) { return json(res, 500, { error: error.message }); }
};
