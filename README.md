# lunix-mono

A 24-hour hackathon project for the Lunix web desktop and its embedded terminal.

## Packages

- **`desktop/`** (`@lunix/desktop`) — the web desktop OS shell: window manager, dock, and the
  apps (Files, Browser, Terminal, Agent). A thin frontend; every app is a window onto a runtime.
- **`terminal/`** (`@lunix/terminal`) — a wterm-powered Electron app and embeddable web terminal.
- **`experiments/terminal-prototype/`** — the initial custom renderer explored during the hackathon.

## Dev

```bash
npm install               # installs both workspaces (rebuilds node-pty for the terminal)
npm run desktop           # web desktop → http://localhost:8090
npm run terminal:web      # embedded terminal service → http://localhost:7777
npm run build:web         # static deploy bundle → web-dist/
```

Open the desktop and the Terminal app loads the terminal web build (`?theme=sand&embed=1`).
The Files and Agent apps talk to the Nodus runtimes (configured at the top of `desktop/app.js`).
