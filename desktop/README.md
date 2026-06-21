# lunix

A **web desktop OS shell** — a Chrome-OS-style desktop that runs entirely in the browser. The shell
itself is thin and does no heavy work: every app is just a **window onto a runtime**. The same client
runs on a laptop or an iPad — all the compute lives in the runtimes it connects to.

> Design: lunix is the *pure frontend*. The runtimes (agent / workspace / browser / terminal) are
> separate services it drives. Each app you open is a window; behind it is a runtime.

## What's in here

It looks small because it's meant to — ~10 files, no `node_modules`, no build step. The density is in
`app.js` (the window manager + every app), `server.js` (the local gateway), and `nodus-sdk.js`.

```
index.html      desktop shell markup + wallpaper
styles.css      desktop / window / dock / explorer styling
app.js          icons, dock, window manager (drag/resize via pointer capture), and the apps
server.js       lunix's local gateway: serves the desktop, a cloud-browser screencast, and a
                home-sandboxed local filesystem mount
nodus-sdk.js    the Nodus SDK (agent / session / workspace runtimes) — used by Files + Assistant
assets/mark.svg app mark
```

## The desktop & its apps

- **Window manager** — open from the dock, focus z-ordering, drag by the title bar, 8-way resize.
  Drag/resize use Pointer Events with pointer capture (no lost frames over iframes) and move on the
  compositor, so it stays smooth even over heavy embedded content.
- **Agent** *(the brain — first-class)* — a real agent runtime via the Nodus SDK: `ensureSession`
  boots an agent (create → auth → session), then it streams the conversation. Opens on load.
- **Files** — a multi-source file manager. Mounts: **Workspace** (the Nodus WorkspaceRuntime, via the
  SDK) and **Local** (real home folders, home-sandboxed; desktop-only — hidden on iPad/cloud). Browse,
  read into an editable preview, and Save writes back to whichever source is mounted.
- **Terminal** — an embedded web terminal (chrome-less via `?embed=1`), so the desktop window is the
  only frame.
- **Browser** — a real cloud browser (Browserbase) rendered as *our* UI: the page is streamed as MJPEG
  into the window (sized to the window, so it reflows — no devtools chrome, no tiny scaling), with
  mouse/keyboard forwarded over CDP. The API key never reaches the client.

## Architecture: app ↔ runtime

```
        Agent runtime (the brain) ── Nodus SDK ──┐
                                                  ▼  drives / uses
   workspace runtime    local FS (desktop only)    browser runtime    terminal
   (Files: Workspace)   (Files: Local)             (Browser)          (Terminal)
```

The agent runtime is first-class; workspace / local / browser / terminal are the resources it drives.

## Run

```bash
node server.js            # lunix gateway → http://localhost:8090
```

Apps that need a runtime (all optional — each degrades to a clear message if its runtime is down):

| App      | Runtime to start |
|----------|------------------|
| Files (Workspace) · Agent | Nodus backend: `cd Nodus-backend && NODUS_WORKSPACE_RUNTIME_DRIVER=local npm run dev` (:8787) |
| Terminal | a web terminal service on `:7777` |
| Browser  | set `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` in a local `.env` (gitignored) |

The Nodus user id and runtime URLs are single constants at the top of `app.js` (`NODUS_URL`, `NODUS_USER`).

## License

MIT
