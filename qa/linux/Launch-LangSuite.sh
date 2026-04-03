#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CLIENT_DIR="$PROJECT_ROOT/client"
PYTHON_EXE="$PROJECT_ROOT/.venv/bin/python"
STATIC_DIST="$CLIENT_DIR/dist"
MAIN_PY="$PROJECT_ROOT/main.py"
PACKAGE_JSON_PATH="$CLIENT_DIR/package.json"
BACKEND_PORT=8000
FRONTEND_PORT=5000
NO_BROWSER=0
PREVIEW_BUILD=0
DRY_RUN=0
WAIT_TIMEOUT_SECONDS=35
LOG_PATH=""

write_step() { printf '%s\n' "$1"; if [[ -n "$LOG_PATH" ]]; then printf '%s\n' "$1" >> "$LOG_PATH"; fi; }
initialize_log_file() { if [[ -z "$LOG_PATH" ]]; then return; fi; if [[ "$LOG_PATH" != /* ]]; then LOG_PATH="$PROJECT_ROOT/$LOG_PATH"; fi; mkdir -p "$(dirname "$LOG_PATH")"; printf 'LangSuite launch log %s\n' "$(date -Iseconds)" > "$LOG_PATH"; }
require_path() { [[ -e "$1" ]] || { echo "$2 was not found at $1" >&2; exit 1; }; }
port_available() { python3 - "$1" <<'PY'
import socket, sys
port = int(sys.argv[1])
s = socket.socket()
try:
    s.bind(('127.0.0.1', port))
except OSError:
    raise SystemExit(1)
finally:
    s.close()
PY
}
wait_for_http() {
  local url="$1"; local label="$2"; local timeout="$3"
  python3 - "$url" "$label" "$timeout" <<'PY'
import sys, time, urllib.request
url, label, timeout = sys.argv[1], sys.argv[2], int(sys.argv[3])
deadline = time.time() + timeout
while time.time() < deadline:
    try:
        with urllib.request.urlopen(url, timeout=2) as resp:
            if resp.status < 500:
                print(f"{label} ready at {url}")
                raise SystemExit(0)
    except Exception:
        time.sleep(0.4)
raise SystemExit(f"{label} did not become ready at {url} within {timeout} seconds.")
PY
}
format_command_for_log() {
  local out=()
  for part in "$@"; do
    if [[ "$part" == *' '* ]]; then out+=("\"$part\""); else out+=("$part"); fi
  done
  printf '%s' "${out[*]}"
}
start_or_describe() {
  local label="$1"; shift
  local workdir="$1"; shift
  local wait_url="$1"; shift
  local wait_label="$1"; shift
  local logfile="$1"; shift
  write_step "$label"
  write_step "$(format_command_for_log "$@")"
  if [[ $DRY_RUN -eq 1 ]]; then
    write_step "[dry-run] Would run in $workdir: $(format_command_for_log "$@")"
    return 0
  fi
  mkdir -p "$(dirname "$logfile")"
  (
    cd "$workdir"
    nohup "$@" > "$logfile" 2>&1 &
    echo $! > "$logfile.pid"
  )
  if [[ -n "$wait_url" ]]; then
    local wait_output
    wait_output=$(wait_for_http "$wait_url" "$wait_label" "$WAIT_TIMEOUT_SECONDS")
    write_step "$wait_output"
  fi
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-port) shift; BACKEND_PORT="${1:-}" ;;
    --frontend-port) shift; FRONTEND_PORT="${1:-}" ;;
    --no-browser) NO_BROWSER=1 ;;
    --preview-build) PREVIEW_BUILD=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --log-path) shift; LOG_PATH="${1:-}" ;;
    --wait-timeout-seconds) shift; WAIT_TIMEOUT_SECONDS="${1:-}" ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
  shift
done
initialize_log_file
require_path "$PYTHON_EXE" 'Virtual environment python'
require_path "$MAIN_PY" 'Backend main.py'
require_path "$PACKAGE_JSON_PATH" 'Frontend package.json'
require_path "$CLIENT_DIR/node_modules" 'Frontend node_modules'
command -v npm >/dev/null 2>&1 || { echo "Required command 'npm' was not found in PATH." >&2; exit 1; }
if [[ $PREVIEW_BUILD -eq 1 ]]; then
  require_path "$STATIC_DIST" 'Built frontend dist directory'
  write_step 'Preview mode uses the built dist output from the last successful install/build step.'
else
  write_step 'Default launch mode mirrors the real QA path: backend + Vite dev server on the fixed frontend port. This is a local QA/dev flow, not a packaged desktop launcher.'
fi
if [[ $DRY_RUN -eq 0 ]]; then
  port_available "$BACKEND_PORT" || { echo "Backend port $BACKEND_PORT is already in use." >&2; exit 1; }
  port_available "$FRONTEND_PORT" || { echo "Frontend port $FRONTEND_PORT is already in use. The launcher uses --strictPort and will not silently drift." >&2; exit 1; }
fi
BACKEND_LOG="$PROJECT_ROOT/qa/logs/backend-$BACKEND_PORT.log"
FRONTEND_LOG="$PROJECT_ROOT/qa/logs/frontend-$FRONTEND_PORT.log"
start_or_describe "Starting backend on http://127.0.0.1:$BACKEND_PORT" "$PROJECT_ROOT" "http://127.0.0.1:$BACKEND_PORT/openapi.json" 'Backend' "$BACKEND_LOG" "$PYTHON_EXE" -m uvicorn main:app --host 127.0.0.1 --port "$BACKEND_PORT"
if [[ $PREVIEW_BUILD -eq 1 ]]; then
  start_or_describe "Starting frontend on http://127.0.0.1:$FRONTEND_PORT using npm preview" "$CLIENT_DIR" "http://127.0.0.1:$FRONTEND_PORT" 'Frontend' "$FRONTEND_LOG" npm run preview -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort
else
  start_or_describe "Starting frontend on http://127.0.0.1:$FRONTEND_PORT using npm dev" "$CLIENT_DIR" "http://127.0.0.1:$FRONTEND_PORT" 'Frontend' "$FRONTEND_LOG" npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort
fi
if [[ $NO_BROWSER -eq 0 ]]; then
  if [[ $DRY_RUN -eq 1 ]]; then
    write_step "[dry-run] Would open browser: http://127.0.0.1:$FRONTEND_PORT"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:$FRONTEND_PORT" >/dev/null 2>&1 || true
  else
    python3 -m webbrowser "http://127.0.0.1:$FRONTEND_PORT" >/dev/null 2>&1 || true
  fi
fi
write_step 'LangSuite launcher prepared:'
write_step "  Backend  -> http://127.0.0.1:$BACKEND_PORT"
write_step "  Frontend -> http://127.0.0.1:$FRONTEND_PORT"
if [[ $DRY_RUN -eq 1 ]]; then
  write_step 'Dry-run mode only validated launch prerequisites and command composition.'
fi
