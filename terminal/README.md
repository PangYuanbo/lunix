# @lunix/terminal

An Electron and embeddable web terminal powered by [`@wterm/dom`](https://wterm.dev/). The previous
custom VTE/Grid/GPU implementation is archived at `history/terminal-legacy-2026-06-21/`.

## Run

```bash
npm install            # installs wterm and rebuilds node-pty for Electron
npm start              # build and open the Electron app
npm run web            # build and serve the embeddable web terminal on :7777
```

## Embedding

The browser build uses the same wterm renderer and bridges PTY traffic through the existing
Electron IPC, local HTTP/SSE service, or Nodus workspace WebSocket.

- `?theme=<key>` — pick a skin (e.g. `sand` for a warm light theme).
- `?embed=1` — hide the built-in title/status bars so the host window is the only chrome.

## Features

Real shell via `node-pty` or Nodus · wterm VT/WASM engine · tabs (`⌘T`) · split panes (`⌘D`) ·
close tab (`⌘W`) · dark and embedded sand themes · browser-native selection, copy/paste, and find.

## Layout

```
main.js / preload.js    Electron main + PTY bridge
web-server.js           local browser PTY gateway
web/bridge.js           local or Nodus browser bridge
renderer.js             wterm integration, tabs, and split panes
dist/                   generated browser bundle
test/                   bridge/integration check
```

## License

MIT
