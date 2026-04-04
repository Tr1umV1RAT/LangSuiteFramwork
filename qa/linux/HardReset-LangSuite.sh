#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CLIENT_DIR="$PROJECT_ROOT/client"
DRY_RUN=0
REMOVE_NODE_MODULES=0
CLEAN_NPM_CACHE=0
LOG_PATH=""
write_step() { printf '%s\n' "$1"; if [[ -n "$LOG_PATH" ]]; then printf '%s\n' "$1" >> "$LOG_PATH"; fi; }
initialize_log_file() { if [[ -z "$LOG_PATH" ]]; then return; fi; if [[ "$LOG_PATH" != /* ]]; then LOG_PATH="$PROJECT_ROOT/$LOG_PATH"; fi; mkdir -p "$(dirname "$LOG_PATH")"; printf 'LangSuite hard reset log %s\n' "$(date -Iseconds)" > "$LOG_PATH"; }
remove_if_exists() { if [[ -e "$1" ]]; then if [[ $DRY_RUN -eq 1 ]]; then write_step "[dry-run] Would remove $1"; else rm -rf "$1"; write_step "Removed $1"; fi; fi; }
while [[ $# -gt 0 ]]; do case "$1" in --remove-node-modules) REMOVE_NODE_MODULES=1 ;; --clean-npm-cache) CLEAN_NPM_CACHE=1 ;; --dry-run) DRY_RUN=1 ;; --log-path) shift; LOG_PATH="${1:-}" ;; *) echo "Unknown argument: $1" >&2; exit 1 ;; esac; shift; done
initialize_log_file
write_step 'Stopping obvious local LangSuite processes...'
stop_args=()
if [[ $DRY_RUN -eq 1 ]]; then stop_args+=(--dry-run); fi
"$PROJECT_ROOT/qa/linux/Stop-LangSuite.sh" "${stop_args[@]}" >/dev/null 2>&1 || true
remove_if_exists "$CLIENT_DIR/dist"
remove_if_exists "$PROJECT_ROOT/static"
remove_if_exists "$CLIENT_DIR/tsconfig.tsbuildinfo"
remove_if_exists "$PROJECT_ROOT/.pytest_cache"
find "$PROJECT_ROOT" -path "$PROJECT_ROOT/.venv" -prune -o -type d -name '__pycache__' -print0 2>/dev/null | while IFS= read -r -d '' d; do remove_if_exists "$d"; done
if [[ -d "$PROJECT_ROOT/db" ]]; then find "$PROJECT_ROOT/db" -maxdepth 1 -name 'langgraph_builder.db*' -print0 2>/dev/null | while IFS= read -r -d '' f; do remove_if_exists "$f"; done; fi
if [[ -d "$PROJECT_ROOT/data" ]]; then find "$PROJECT_ROOT/data" -maxdepth 1 -name '*.db*' -print0 2>/dev/null | while IFS= read -r -d '' f; do remove_if_exists "$f"; done; fi
if [[ $REMOVE_NODE_MODULES -eq 1 ]]; then remove_if_exists "$CLIENT_DIR/node_modules"; fi
if [[ $CLEAN_NPM_CACHE -eq 1 ]]; then
  if ! command -v npm >/dev/null 2>&1; then write_step 'npm not found in PATH; skipping npm cache cleanup.'; elif [[ $DRY_RUN -eq 1 ]]; then write_step '[dry-run] Would run: npm cache clean --force'; else npm cache clean --force; fi
fi
write_step 'LangSuite hard reset complete.'
if [[ $DRY_RUN -eq 1 ]]; then write_step 'Dry-run mode only described the cleanup plan.'; fi
