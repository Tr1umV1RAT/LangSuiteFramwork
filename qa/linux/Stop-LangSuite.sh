#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DRY_RUN=0
LOG_PATH=""
write_step() { printf '%s\n' "$1"; if [[ -n "$LOG_PATH" ]]; then printf '%s\n' "$1" >> "$LOG_PATH"; fi; }
initialize_log_file() { if [[ -z "$LOG_PATH" ]]; then return; fi; if [[ "$LOG_PATH" != /* ]]; then LOG_PATH="$PROJECT_ROOT/$LOG_PATH"; fi; mkdir -p "$(dirname "$LOG_PATH")"; printf 'LangSuite stop log %s\n' "$(date -Iseconds)" > "$LOG_PATH"; }
while [[ $# -gt 0 ]]; do case "$1" in --dry-run) DRY_RUN=1 ;; --log-path) shift; LOG_PATH="${1:-}" ;; *) echo "Unknown argument: $1" >&2; exit 1 ;; esac; shift; done
initialize_log_file
write_step 'Stopping obvious local LangSuite processes...'
mapfile -t candidates < <(ps -eo pid=,args= | awk -v root="$PROJECT_ROOT" 'index($0, root) > 0 && ($0 ~ /uvicorn/ || $0 ~ /vite/ || $0 ~ /npm run dev/ || $0 ~ /npm run preview/) {print $1}')
if [[ ${#candidates[@]} -eq 0 ]]; then
  write_step 'No obvious LangSuite backend/frontend processes were found.'
  exit 0
fi
for pid in "${candidates[@]}"; do
  if [[ $DRY_RUN -eq 1 ]]; then
    write_step "[dry-run] Would stop process $pid"
  else
    kill -9 "$pid" || true
    write_step "Stopped process $pid"
  fi
done
if [[ $DRY_RUN -eq 1 ]]; then write_step 'Dry-run mode only described the stop plan.'; fi
