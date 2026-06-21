# Terminal Renderer Prototype

An early renderer experiment from the Lunix 24-hour hackathon. It explored a block-based terminal
with a custom VTE parser, grid, and GPU/DOM renderer before the main terminal moved to wterm.

## Run

```bash
npm install            # rebuilds node-pty for Electron (postinstall)
npm start              # Electron app
npm run web            # web build served on :7777 (embeddable via iframe)
```

## Embedding

The web build runs the same renderer in a browser, bridging the PTY over HTTP + SSE. A host (e.g. the
desktop) embeds it via iframe:

- `?theme=<key>` — pick a skin (e.g. `sand` for a warm light theme).
- `?embed=1` — hide the built-in title/status bars so the host window is the only chrome.

## Features

Real shell via PTY (`node-pty`, your `$SHELL` + rc files) · block model via OSC 133 shell integration ·
per-block copy/rerun/save · tabs (⌘T) · split panes (⌘D) · command palette (⌘K) · NL→command (⌘I) ·
history/builtin autosuggest (`⌃→`) · themes (live switch, persisted) · full ANSI / TUI apps
(vim, htop, less) via the from-scratch VTE engine + alt-screen.

## Layout

```
main.js / preload.js    Electron main + PTY bridge (IPC)
web-server.js           web build's HTTP + SSE/POST PTY gateway
renderer.js             tabs, panes, blocks, themes, palette
src/crates/             the engine — vte parser, grid, block view, glyph atlas
shell-integration/      bash/zsh hooks: OSC 133 block markers + OSC 7001 exact command
test/                   node unit tests (npm test) + CDP smoke test (npm run test:live)
```

## License

MIT
