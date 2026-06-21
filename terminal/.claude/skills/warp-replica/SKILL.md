---
name: warp-replica
description: Use when porting/replicating Warp (warpdotdev) into Electron — or any "rebuild app X 1:1" task. Encodes the hard rules learned from precise user corrections so the same mistakes aren't repeated: study the real source before building, replicate Warp's actual architecture (own VTE parser + grid + GPU renderer, NOT xterm.js), build the real Warp UI (block cards + bottom command editor, not a GPU-painted plain terminal), no scaffold padding, and screenshot every step honestly with Chrome/CDP.
---

# Warp replica — checklist & hard rules

This skill exists because the same class of mistakes kept happening. Before AND after each unit of
work, **核对 (check against) this list**. Every rule below traces to a precise user correction.

## The goal (constraints — do not drift)
- Target: rebuild Warp into Electron, usable on **macOS AND iPadOS** (iPadOS = WKWebView packaging).
- **Rebuild the high-performance GPU library from scratch, bottom-up.** Don't wrap an existing one.
- **Warp servers NOT needed. Cloud sync NOT needed.** Don't build or scaffold them.
- What's needed: a **1:1 Warp-UI-level Terminal** — the UI must look and behave like Warp.

## Rule 1 — Replicate Warp's ARCHITECTURE, not a lookalike
> "你看看真的warp是用xterm吗？如何不是的话，你也不要用，而是把warp的方法用electron复刻出来"

- Warp does **NOT** use xterm.js. Its pipeline is:
  `PTY bytes → VTE/ANSI state machine (vte crate, Williams DEC parser) → Grid<Cell> model
  (alacritty_terminal-derived) → own wgpu GPU renderer → blocks UI`.
- **Do not use xterm.js** (or any turnkey terminal engine) as the VT parser / grid / input. Build
  the parser + grid yourself. If you catch yourself mirroring someone else's grid onto a canvas,
  stop — that's the shortcut, not the replica.
- Before adopting ANY dependency, ask: *does real Warp use this?* If no, replicate the method
  instead. Verify against Warp's actual source/tech posts, not assumption.

## Rule 2 — Study the real components 1:1 BEFORE building
> "你真的一比一看了warp除了登录之外的所有组件了吗"

- Read Warp's actual source for the thing you're about to build (e.g. `block_list_element.rs`,
  grid `cell.rs`, the input editor). Pull real constants and structure from it.
- Don't infer Warp's UI from a generic terminal mental model. The real Warp UI is:
  - **Block cards**: each command = a card with a header, output body, a left accent bar, and a
    **hover toolbar on the right** (copy cmd / copy output / rerun / share). Exit status shown.
  - A **dedicated bottom command-input editor** (a real code editor with syntax highlight + ghost
    autosuggest) — the shell's own prompt/echo is suppressed; you type in the editor, not inline.
  - Prompt context chips (cwd, git branch, etc.) on the input block.
- A plain terminal that happens to be GPU-painted is NOT Warp. That was the central mistake:
  > "你只是拿 GPU 重新渲染了 MACOS Terminal"

## Rule 3 — No padding. No scaffolds-to-look-complete.
> "72 个 crate 镜像和大量 scaffold 有明显'为了像完整移植而存在'的味道"

- Never create empty modules / mirror directories whose only purpose is to make the tree look like
  a complete port. They are dishonest padding. Deleted: 49 such scaffolds.
- A module counts as "done" only if it has real ported behavior **and** a test exercising it.
- Keep an honest ledger (`MODULES.md`): what's actually built, what's explicitly NOT done. Don't
  inflate the count.

## Rule 4 — Screenshot EVERY step honestly with Chrome/CDP
> "你真的把每个步骤都截图了吗" / "你可以用chrome use 来自动测试。截图对比"

- After each UI-affecting change: launch the app with `--remote-debugging-port=9222`, drive it via
  CDP, and `Page.captureScreenshot`. Actually look at the PNG. Compare against real Warp.
- Do **not** reuse an old screenshot or claim a step was screenshotted when it wasn't. For non-UI
  algorithm modules, the honest artifact is the passing test output, not a recycled app screenshot —
  say so.
- GPU correctness = pixel read-back (`gl.readPixels`), not "it looks right."
- **Capturing the app window reliably:** macOS `screencapture -R<x,y,w,h>` grabs whatever is at those
  screen coords — a browser overlapping the Electron window will be captured instead. Prefer CDP
  `Page.captureScreenshot {fromSurface:true}` (grabs the renderer surface regardless of focus/overlap).
  If `Page.captureScreenshot` hangs, a DOM/WebGL canvas can be read via `canvas.toDataURL()` over the
  eval channel. Always Read the PNG back and actually look at it.
- **Study the real UI before restyling:** download several real Warp screenshots (warp.dev og/hero,
  cdn.sanity.io assets, docs) and read the structure — block = `cwd git:(branch)` breadcrumb (lavender)
  + bright command + muted output; failures show a subtle red left-edge, NOT exit-code pills; the input
  editor is a rounded box with a cwd+branch context row. Sample real pixel colors to match tones.

## Rule 5 — Be honest about scope and status
- The literal "port 1.43M LOC / 72 crates 1:1, pixel-exact" is not achievable; say so plainly
  instead of faking completeness.
- State failures with their output. Mark skipped steps as skipped. Only call something done when a
  test or screenshot verifies it.

## Build cadence (what the user asked for)
> "每轮一个可移植算法模块 + 测试 + 截图"

One real module per round: **port the behavior → write a test translated from Warp's own tests →
verify (test pass + honest screenshot/pixel read-back) → update MODULES.md.**

## Architecture target for the terminal (the honest replica)
1. `vte.js` — Williams DEC ANSI state machine (DONE, 23 assertions). Bytes → callbacks.
2. `ansi handler / term.js` — Performer: applies SGR/cursor/erase/scroll/modes to a `Grid<Cell>`.
3. `grid.js` — rows × `Cell` (char + fg/bg + flags), cursor, scroll region, tab stops.
4. `warpui_core/` GPU renderer — already built bottom-up (instanced bg, glyph atlas, text, cursor,
   wide-char, attrs, block decorations), verified by pixel read-back.
5. Input editor — separate bottom command editor feeding full commands to the PTY.
6. Blocks UI — block cards driven by OSC 133 boundaries, hover toolbar, exit status.

## Pre-flight checklist (run through before declaring any step complete)
- [ ] Did I confirm real Warp does it this way (not assume)?  [Rule 1,2]
- [ ] No turnkey engine standing in for Warp's own (no xterm.js)?  [Rule 1]
- [ ] Does the UI match Warp's real layout (cards + bottom editor), not a plain terminal?  [Rule 2]
- [ ] Is this real behavior with a test — not an empty scaffold?  [Rule 3]
- [ ] Did I actually capture and look at a fresh screenshot / pixel read-back?  [Rule 4]
- [ ] Is MODULES.md honest about done vs not-done?  [Rule 3,5]
