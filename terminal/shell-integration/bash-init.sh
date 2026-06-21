# Warp-electron bash shell integration: emit OSC 133 prompt markers for block UI.
# Sourced via `bash --rcfile`. We load the user's config first, then layer markers.
if [ -f /etc/profile ]; then source /etc/profile; fi
if [ -f "$HOME/.bashrc" ]; then source "$HOME/.bashrc"; fi

__warp_preexec() {
  [ -n "$COMP_LINE" ] && return                          # tab-completion, not a command
  [ "$BASH_COMMAND" = "$PROMPT_COMMAND" ] && return       # the precmd hook itself
  printf '\033]7001;%s\007' "$BASH_COMMAND"  # exact command text
  printf '\033]133;C\007'   # command execution begins
}
__warp_precmd() {
  local ec=$?
  printf '\033]133;D;%s\007' "$ec"  # previous command done
  printf '\033]7;file://%s%s\007' "${HOSTNAME:-localhost}" "$PWD"  # report cwd (Warp breadcrumb)
  local __b; __b=$(command git rev-parse --abbrev-ref HEAD 2>/dev/null)
  printf '\033]7000;%s\007' "$__b"  # report git branch (custom OSC)
  printf '\033]133;A\007'           # new prompt starts (block boundary)
}

# DEBUG trap fires before each command; guard so it only fires for interactive commands.
__warp_prev_cmd=""
trap '__warp_preexec' DEBUG
PROMPT_COMMAND='__warp_precmd'

# Mark end of prompt / start of typed command region.
PS1='\[\033]133;B\007\]'"$PS1"
