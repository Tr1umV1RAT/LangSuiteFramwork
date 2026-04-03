#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DRY_RUN=0
DESKTOP=0
APPLICATIONS_MENU=0
LOG_PATH=""
write_step() { printf '%s\n' "$1"; if [[ -n "$LOG_PATH" ]]; then printf '%s\n' "$1" >> "$LOG_PATH"; fi; }
initialize_log_file() { if [[ -z "$LOG_PATH" ]]; then return; fi; if [[ "$LOG_PATH" != /* ]]; then LOG_PATH="$PROJECT_ROOT/$LOG_PATH"; fi; mkdir -p "$(dirname "$LOG_PATH")"; printf 'LangSuite shortcut log %s\n' "$(date -Iseconds)" > "$LOG_PATH"; }
new_shortcut() {
  local path="$1"; local name="$2"; local exec_line="$3"; local comment="$4"
  if [[ $DRY_RUN -eq 1 ]]; then write_step "[dry-run] Would create shortcut $path -> $exec_line"; return; fi
  mkdir -p "$(dirname "$path")"
  cat > "$path" <<EOF
[Desktop Entry]
Type=Application
Name=$name
Exec=$exec_line
Path=$PROJECT_ROOT
Terminal=false
Comment=$comment
Categories=Development;
EOF
  chmod +x "$path"
  write_step "Created shortcut $path"
}
while [[ $# -gt 0 ]]; do case "$1" in --desktop) DESKTOP=1 ;; --applications-menu) APPLICATIONS_MENU=1 ;; --dry-run) DRY_RUN=1 ;; --log-path) shift; LOG_PATH="${1:-}" ;; *) echo "Unknown argument: $1" >&2; exit 1 ;; esac; shift; done
initialize_log_file
if [[ $DESKTOP -eq 0 && $APPLICATIONS_MENU -eq 0 ]]; then DESKTOP=1; fi
MANAGER_EXEC="bash '$PROJECT_ROOT/LangSuiteLauncher.sh'"
LAUNCH_EXEC="bash '$PROJECT_ROOT/qa/linux/Launch-LangSuite.sh'"
if [[ $DESKTOP -eq 1 ]]; then
  new_shortcut "$HOME/Desktop/LangSuite Manager.desktop" 'LangSuite Manager' "$MANAGER_EXEC" 'Open the LangSuite cross-platform manager.'
  new_shortcut "$HOME/Desktop/LangSuite Launch.desktop" 'LangSuite Launch' "$LAUNCH_EXEC" 'Launch LangSuite directly with the QA launcher.'
  write_step 'Desktop shortcuts prepared.'
fi
if [[ $APPLICATIONS_MENU -eq 1 ]]; then
  new_shortcut "$HOME/.local/share/applications/LangSuite Manager.desktop" 'LangSuite Manager' "$MANAGER_EXEC" 'Open the LangSuite cross-platform manager.'
  new_shortcut "$HOME/.local/share/applications/LangSuite Launch.desktop" 'LangSuite Launch' "$LAUNCH_EXEC" 'Launch LangSuite directly with the QA launcher.'
  write_step 'Applications-menu shortcuts prepared.'
fi
if [[ $DRY_RUN -eq 1 ]]; then write_step 'Dry-run mode only validated the shortcut plan.'; fi
