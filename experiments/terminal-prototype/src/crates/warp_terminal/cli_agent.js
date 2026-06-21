// CLI agent detection + brand identity — ported 1:1 from app/src/terminal/cli_agent.rs (CLIAgent).
// Warp detects agentic CLIs (Claude Code, Codex, Gemini, …) by the command's first real word and
// renders them with the agent's brand color / name so they "look nicer" running inside Warp.
'use strict';
(function (root) {
  // command_prefix -> { display_name, brand_color, brand_icon_color, glyph }.
  // Colors are the exact ColorU values from cli_agent.rs / view_util.rs (CLAUDE_ORANGE #D97757).
  // darkIcon = brand_icon_color is black (light brand colors use a dark glyph for contrast).
  const AGENTS = {
    claude:   { name: 'Claude Code',  color: '#D97757', darkIcon: false, glyph: '✳' },
    gemini:   { name: 'Gemini',       color: '#4285F4', darkIcon: false, glyph: '✦' },
    codex:    { name: 'Codex',        color: '#000000', darkIcon: false, glyph: '◇' },
    amp:      { name: 'Amp',          color: '#F34E3F', darkIcon: false, glyph: 'A' },
    droid:    { name: 'Droid',        color: '#FFFFFF', darkIcon: true,  glyph: 'D' },
    opencode: { name: 'OpenCode',     color: '#808080', darkIcon: false, glyph: 'O' },
    copilot:  { name: 'Copilot',      color: '#8534F3', darkIcon: false, glyph: '∞' },
    pi:       { name: 'Pi',           color: '#FFFFFF', darkIcon: true,  glyph: 'π' },
    auggie:   { name: 'Auggie',       color: '#FFFFFF', darkIcon: true,  glyph: 'A' },
    agent:    { name: 'Cursor',       color: '#26251E', darkIcon: false, glyph: '▸' },  // cursor-cli prefix is "agent"
    goose:    { name: 'Goose',        color: '#101010', darkIcon: false, glyph: 'G' },
    hermes:   { name: 'Hermes',       color: '#7C3AED', darkIcon: false, glyph: 'H' },
    vibe:     { name: 'Mistral Vibe', color: '#FA520F', darkIcon: false, glyph: 'V' },
  };

  // Brand colors are matched against the terminal background for a minimum contrast, mirroring Warp's
  // `brand_color.on_background(bg, MinimumAllowedContrast::NonText)` — otherwise dark brands (Codex
  // #000, Goose #101010, Cursor #26251E) would be invisible on the #000 terminal. Lightens toward
  // white until perceived luminance clears a visibility floor. (bg is the dark theme background.)
  function onDarkBg(hex) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const lum = () => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    for (let i = 0; i < 24 && lum() < 96; i++) { r += (255 - r) * 0.25; g += (255 - g) * 0.25; b += (255 - b) * 0.25; }
    const h = (x) => Math.round(x).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }

  // First meaningful command token, skipping leading FOO=bar env assignments (extract_first_command).
  function firstCommandWord(command) {
    if (!command) return '';
    for (const t of command.trim().split(/\s+/)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) return t;
    }
    return '';
  }

  // Returns { key, name, color, darkIcon, glyph } if the command invokes a known CLI agent, else null.
  function detect(command) {
    let w = firstCommandWord(command);
    if (!w) return null;
    const slash = Math.max(w.lastIndexOf('/'), w.lastIndexOf('\\'));   // /usr/local/bin/claude -> claude
    if (slash >= 0) w = w.slice(slash + 1);
    if (w === 'vibe-acp') w = 'vibe';                                  // ACP-mode binary (cli_agent.rs)
    if (!AGENTS[w]) return null;
    // `display` = brand color adjusted for contrast on the dark terminal bg (what we actually paint).
    return Object.assign({ key: w, display: onDarkBg(AGENTS[w].color) }, AGENTS[w]);
  }

  const api = { detect, firstCommandWord, onDarkBg, AGENTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.warpCliAgent = api;
})(typeof window !== 'undefined' ? window : globalThis);
