---
name: lunix-browser-workflow
description: Use Lunix's built-in Browser or Preview when a task involves web development, previewing a local app, or opening a website for browser use.
---

# Lunix Browser Workflow

- Web development: start the app on `5173`, `3000`, `4173`, `8000`, or `8080`; include the localhost URL in the response so Lunix opens Preview.
- Website tasks: include `LUNIX_BROWSER_OPEN https://example.com` so Lunix opens its built-in Browser.
- Check the rendered page before claiming success.
- Never print cookies, tokens, or browser credentials.
