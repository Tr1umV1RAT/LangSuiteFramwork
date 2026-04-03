#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
VENV_DIR="$PROJECT_ROOT/.venv"
CLIENT_NODE_MODULES="$PROJECT_ROOT/client/node_modules"
DESKTOP_MANAGER="$HOME/Desktop/LangSuite Manager.desktop"
DESKTOP_LAUNCH="$HOME/Desktop/LangSuite Launch.desktop"
APPLICATIONS_MANAGER="$HOME/.local/share/applications/LangSuite Manager.desktop"
APPLICATIONS_LAUNCH="$HOME/.local/share/applications/LangSuite Launch.desktop"
DRY_RUN=0
CLEAN_NPM_CACHE=0
REMOVE_SHORTCUTS=0
LOG_PATH=""
write_step() { printf '%s\n' "$1"; if [[ -n "$LOG_PATH" ]]; then printf '%s\n' "$1" >> "$LOG_PATH"; fi; }
initialize_log_file() { if [[ -z "$LOG_PATH" ]]; then return; fi; if [[ "$LOG_PATH" != /* ]]; then LOG_PATH="$PROJECT_ROOT/$LOG_PATH"; fi; mkdir -p "$(dirname "$LOG_PATH")"; printf 'LangSuite uninstall log %s\n' "$(date -Iseconds)" > "$LOG_PATH"; }
remove_if_exists() { if [[ -e "$1" ]]; then if [[ $DRY_RUN -eq 1 ]]; then write_step "[dry-run] Would remove $1"; else rm -rf "$1"; write_step "Removed $1"; fi; fi; }
while [[ $# -gt 0 ]]; do case "$1" in --clean-npm-cache) CLEAN_NPM_CACHE=1 ;; --remove-shortcuts) REMOVE_SHORTCUTS=1 ;; --dry-run) DRY_RUN=1 ;; --log-path) shift; LOG_PATH="${1:-}" ;; *) echo "Unknown argument: $1" >&2; exit 1 ;; esac; shift; done
initialize_log_file
args=()
[[ $CLEAN_NPM_CACHE -eq 1 ]] && args+=(--clean-npm-cache)
[[ $DRY_RUN -eq 1 ]] && args+=(--dry-run)
"$PROJECT_ROOT/qa/linux/HardReset-LangSuite.sh" "${args[@]}"
remove_if_exists "$VENV_DIR"
remove_if_exists "$CLIENT_NODE_MODULES"
if [[ $REMOVE_SHORTCUTS -eq 1 ]]; then
  remove_if_exists "$DESKTOP_MANAGER"
  remove_if_exists "$DESKTOP_LAUNCH"
  remove_if_exists "$APPLICATIONS_MANAGER"
  remove_if_exists "$APPLICATIONS_LAUNCH"
fi
write_step 'LangSuite local QA uninstall complete.'
if [[ $REMOVE_SHORTCUTS -eq 1 ]]; then write_step 'Linux shortcuts were also removed when present.'; fi
if [[ $DRY_RUN -eq 1 ]]; then write_step 'Dry-run mode only described uninstall cleanup.'; fi
