# Warp-electron zsh shell integration. Loaded because ZDOTDIR points here.
# Restore the user's real config first, then layer OSC 133 markers.
if [[ -n "$USER_ZDOTDIR" && -f "$USER_ZDOTDIR/.zshrc" ]]; then
  ZDOTDIR="$USER_ZDOTDIR" source "$USER_ZDOTDIR/.zshrc"
fi

# ZDOTDIR points at this repo dir, so zsh would write .zsh_history HERE. Keep history out of the
# repo by pointing HISTFILE at the user's real home (unless their own rc already set one elsewhere).
[[ "$HISTFILE" == "$ZDOTDIR/.zsh_history" || -z "$HISTFILE" ]] && export HISTFILE="${USER_ZDOTDIR:-$HOME}/.zsh_history"

__warp_preexec() { printf '\033]7001;%s\007' "$1"; printf '\033]133;C\007'; }  # 7001 = exact command text
__warp_precmd() {
  local ec=$?
  printf '\033]133;D;%s\007' "$ec"
  printf '\033]7;file://%s%s\007' "${HOST:-localhost}" "$PWD"   # report cwd (Warp breadcrumb)
  local __b; __b=$(command git rev-parse --abbrev-ref HEAD 2>/dev/null)
  printf '\033]7000;%s\007' "$__b"                              # report git branch (custom OSC)
  printf '\033]133;A\007'
}
autoload -Uz add-zsh-hook 2>/dev/null
if (( $+functions[add-zsh-hook] )); then
  add-zsh-hook preexec __warp_preexec
  add-zsh-hook precmd __warp_precmd
fi
PROMPT='%{'$'\033]133;B\007''%}'"$PROMPT"
