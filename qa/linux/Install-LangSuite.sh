#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CLIENT_DIR="$PROJECT_ROOT/client"
VENV_DIR="$PROJECT_ROOT/.venv"
PYTHON_EXE="$VENV_DIR/bin/python"
NODE_MODULES_DIR="$CLIENT_DIR/node_modules"
REQUIREMENTS_PATH="$PROJECT_ROOT/requirements.txt"
PACKAGE_JSON_PATH="$CLIENT_DIR/package.json"
SHORTCUT_SCRIPT="$PROJECT_ROOT/qa/linux/CreateShortcuts-LangSuite.sh"
DRY_RUN=0
REINSTALL_NODE_MODULES=0
SKIP_FRONTEND_BUILD=0
SKIP_DB_INIT=0
CREATE_DESKTOP_SHORTCUT=0
CREATE_APPLICATIONS_SHORTCUT=0
LOG_PATH=""

write_step() {
  printf '%s\n' "$1"
  if [[ -n "$LOG_PATH" ]]; then printf '%s\n' "$1" >> "$LOG_PATH"; fi
}
initialize_log_file() {
  if [[ -z "$LOG_PATH" ]]; then return; fi
  if [[ "$LOG_PATH" != /* ]]; then LOG_PATH="$PROJECT_ROOT/$LOG_PATH"; fi
  mkdir -p "$(dirname "$LOG_PATH")"
  printf 'LangSuite install log %s\n' "$(date -Iseconds)" > "$LOG_PATH"
}
require_path() {
  [[ -e "$1" ]] || { echo "$2 was not found at $1" >&2; exit 1; }
}
require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required command '$1' was not found in PATH." >&2; exit 1; }
}
invoke_external() {
  local label="$1"; shift
  write_step "$label"
  if [[ $DRY_RUN -eq 1 ]]; then
    write_step "[dry-run] Skipped: $label"
    return
  fi
  "$@"
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reinstall-node-modules) REINSTALL_NODE_MODULES=1 ;;
    --skip-frontend-build) SKIP_FRONTEND_BUILD=1 ;;
    --skip-db-init) SKIP_DB_INIT=1 ;;
    --create-desktop-shortcut) CREATE_DESKTOP_SHORTCUT=1 ;;
    --create-applications-shortcut|--create-applications-menu-shortcut) CREATE_APPLICATIONS_SHORTCUT=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --log-path) shift; LOG_PATH="${1:-}" ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
  shift
done
initialize_log_file
require_path "$REQUIREMENTS_PATH" 'Backend requirements.txt'
require_path "$PACKAGE_JSON_PATH" 'Frontend package.json'
require_command npm
if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  echo "Python 3 was not found. Install Python or ensure python3 is in PATH." >&2
  exit 1
fi
ensure_virtualenv() {
  if [[ $DRY_RUN -eq 1 ]]; then
    if [[ ! -d "$VENV_DIR" ]]; then
      write_step "[dry-run] Would create Python virtual environment in $VENV_DIR"
    elif [[ ! -x "$PYTHON_EXE" ]]; then
      write_step "[dry-run] Would recreate incomplete Python virtual environment in $VENV_DIR"
    else
      write_step '[dry-run] Verified Python virtual environment shape.'
    fi
    return
  fi
  recreate=0
  if [[ ! -d "$VENV_DIR" ]]; then
    recreate=1
  elif [[ ! -x "$PYTHON_EXE" ]]; then
    write_step "Existing virtual environment is incomplete (missing python executable); recreating $VENV_DIR"
    rm -rf "$VENV_DIR"
    recreate=1
  elif ! "$PYTHON_EXE" -m pip --version >/dev/null 2>&1; then
    write_step "Existing virtual environment is incomplete (pip unavailable); recreating $VENV_DIR"
    rm -rf "$VENV_DIR"
    recreate=1
  fi
  if [[ $recreate -eq 1 ]]; then
    invoke_external "Creating Python virtual environment in $VENV_DIR" bash -lc "if command -v python3 >/dev/null 2>&1; then python3 -m venv '$VENV_DIR'; else python -m venv '$VENV_DIR'; fi"
  fi
}
ensure_virtualenv
if [[ $DRY_RUN -eq 0 ]]; then require_path "$PYTHON_EXE" 'Virtual environment python'; fi
invoke_external 'Installing backend dependencies...' "$PYTHON_EXE" -m pip install --upgrade pip
invoke_external 'Installing backend requirements...' "$PYTHON_EXE" -m pip install -r "$REQUIREMENTS_PATH"
if [[ $REINSTALL_NODE_MODULES -eq 1 && -d "$NODE_MODULES_DIR" ]]; then
  invoke_external 'Removing existing node_modules before reinstall...' rm -rf "$NODE_MODULES_DIR"
fi
write_step 'Installing frontend dependencies...'
if [[ $DRY_RUN -eq 1 ]]; then
  write_step '[dry-run] Skipped frontend install/build commands'
else
  pushd "$CLIENT_DIR" >/dev/null
  if [[ -f "$CLIENT_DIR/package-lock.json" ]]; then npm ci; else npm install; fi
  if [[ $SKIP_FRONTEND_BUILD -eq 0 ]]; then npm run build; fi
  popd >/dev/null
fi
if [[ $SKIP_DB_INIT -eq 0 ]]; then
  invoke_external 'Initializing local database state...' bash -lc "cd '$PROJECT_ROOT' && '$PYTHON_EXE' -c \"import db; print('LangSuite DB initialized')\""
fi
if [[ $CREATE_DESKTOP_SHORTCUT -eq 1 || $CREATE_APPLICATIONS_SHORTCUT -eq 1 ]]; then
  extra=()
  [[ $CREATE_DESKTOP_SHORTCUT -eq 1 ]] && extra+=(--desktop)
  [[ $CREATE_APPLICATIONS_SHORTCUT -eq 1 ]] && extra+=(--applications-menu)
  [[ $DRY_RUN -eq 1 ]] && extra+=(--dry-run)
  invoke_external 'Creating optional Linux shortcuts...' "$SHORTCUT_SCRIPT" "${extra[@]}"
fi
write_step ''
write_step 'LangSuite QA install complete.'
write_step "Launcher: $PROJECT_ROOT/LangSuiteLauncher.py"
write_step "Manager:  $PROJECT_ROOT/qa/LangSuiteLauncher.py"
if [[ $DRY_RUN -eq 1 ]]; then
  write_step 'Dry-run mode only validated paths, prerequisites, and intended commands.'
fi
