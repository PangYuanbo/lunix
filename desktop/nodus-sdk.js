// Nodus SDK — one client for the three runtimes Nodus exposes:
//   • agent runtime    (nodus.agents)    — user-owned provider agents + auth
//   • session runtime  (nodus.sessions)  — live sessions: start/message/pause/resume/events + chat & terminal sockets
//   • workspace runtime (nodus.workspace) — the real /workspace filesystem: list/read/write
//
// Zero dependencies; works in the browser (window.Nodus) and in Node (require/import).
// Every request carries the x-nodus-user-id boundary. WebSocket methods return a raw
// WebSocket (global in browsers and Node 22+).
//
//   const nodus = Nodus({ baseUrl: "http://localhost:8787", userId: "me" });
//   await nodus.workspace.list("/");
//   const a = await nodus.agents.create({ provider: "claude" });
//   const s = await nodus.sessions.start(a.userAgentId);
//   await nodus.sessions.sendMessage(s.session.id, "hello");
//   const ws = nodus.sessions.terminalSocket(s.session.id);

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Nodus = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createNodus(opts) {
    opts = opts || {};
    const baseUrl = (opts.baseUrl || "http://localhost:8787").replace(/\/+$/, "");
    let userId = opts.userId || "default";

    async function req(method, path, body) {
      const headers = { "x-nodus-user-id": userId };
      if (body !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(baseUrl + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
      const text = await res.text();
      let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok) { const e = new Error(data.error || `${method} ${path} → ${res.status}`); e.status = res.status; e.data = data; throw e; }
      return data;
    }
    const enc = encodeURIComponent;
    // ws(s):// base for the socket routes, carrying the user id as a query param (ws can't set headers).
    function wsUrl(path) {
      const u = new URL(baseUrl + path);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      u.searchParams.set("userId", userId);
      return u.toString();
    }

    return {
      get userId() { return userId; },
      setUserId(id) { userId = id || "default"; },
      get baseUrl() { return baseUrl; },

      health: () => req("GET", "/health"),
      providers: () => req("GET", "/providers"),

      // Boot "the brain" in one call: create an agent, complete its auth, and start a live session.
      // Returns { agentId, session }. (apiKey: a real provider key, or any string against the mock runtime.)
      async ensureSession(o) {
        o = o || {};
        const a = await this.agents.create({ provider: o.provider || "claude" });
        const agentId = a.agent.id;
        const auth = await this.agents.startAuth(agentId, { authMethod: o.authMethod || "api_key" });
        await this.agents.completeAuth(agentId, auth.authSession.id, { apiKey: o.apiKey || "demo-key" });
        const s = await this.sessions.start(agentId);
        return { agentId, session: s.session };
      },

      // ---- agent runtime: user-owned provider agents (claude / codex / grok) + auth ----
      agents: {
        create: (input) => req("POST", "/agents", input),                                  // { provider, harness?, defaultResourceProfile?, region? }
        startAuth: (agentId, input) => req("POST", `/agents/${enc(agentId)}/auth-sessions`, input || {}),
        completeAuth: (agentId, authSessionId, input) =>
          req("POST", `/agents/${enc(agentId)}/auth-sessions/${enc(authSessionId)}/complete`, input || {}),
      },

      // ---- session runtime: a live run of an agent + its paired workspace ----
      sessions: {
        start: (userAgentId) => req("POST", "/sessions", { userAgentId }),
        sendMessage: (sessionId, text) => req("POST", `/sessions/${enc(sessionId)}/messages`, { text }),
        pause: (sessionId) => req("POST", `/sessions/${enc(sessionId)}/pause`),
        resume: (sessionId) => req("POST", `/sessions/${enc(sessionId)}/resume`),
        destroy: (sessionId) => req("DELETE", `/sessions/${enc(sessionId)}`),
        events: (sessionId) => req("GET", `/sessions/${enc(sessionId)}/events`),
        diff: (sessionId) => req("GET", `/sessions/${enc(sessionId)}/diff`),
        ssh: (sessionId) => req("POST", `/sessions/${enc(sessionId)}/ssh`, {}),
        webIde: (sessionId) => req("POST", `/sessions/${enc(sessionId)}/web-ide`, {}),
        preview: (sessionId, port) => req("POST", `/sessions/${enc(sessionId)}/preview`, { port }),
        sync: (sessionId, knownSourceUuids) => req("POST", `/sessions/${enc(sessionId)}/sync`, { knownSourceUuids }),
        chatSocket: (sessionId) => new WebSocket(wsUrl(`/sessions/${enc(sessionId)}/chat`)),
        terminalSocket: (sessionId) => new WebSocket(wsUrl(`/sessions/${enc(sessionId)}/terminal`)),
      },

      // ---- workspace runtime: the real /workspace filesystem ----
      workspace: {
        list: (path) => req("GET", `/workspace/files?path=${enc(path || "/")}`),
        read: (path) => req("GET", `/workspace/file?path=${enc(path)}`),
        write: (path, content) => req("POST", "/workspace/file", { path, content }),
      },
    };
  }
  createNodus.create = createNodus;
  return createNodus;
});
