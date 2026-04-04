#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DRY_RUN=0
LOG_PATH=""

write_step() {
  printf '%s
' "$1"
  if [[ -n "$LOG_PATH" ]]; then printf '%s
' "$1" >> "$LOG_PATH"; fi
}

initialize_log_file() {
  if [[ -z "$LOG_PATH" ]]; then return; fi
  if [[ "$LOG_PATH" != /* ]]; then LOG_PATH="$PROJECT_ROOT/$LOG_PATH"; fi
  mkdir -p "$(dirname "$LOG_PATH")"
  printf 'LangSuite stop log %s
' "$(date -Iseconds)" > "$LOG_PATH"
}

collect_descendants() {
  local parent_pid="$1"
  local child
  while IFS= read -r child; do
    child="${child//[[:space:]]/}"
    [[ -z "$child" ]] && continue
    if [[ -z "${protected_pids[$child]:-}" && -z "${pid_seen[$child]:-}" ]]; then
      pid_seen[$child]=1
      pids+=("$child")
      collect_descendants "$child"
    fi
  done < <(ps -o pid= --ppid "$parent_pid" 2>/dev/null || true)
}

collect_protected_ancestors() {
  local current="$$"
  while [[ -n "$current" && "$current" =~ ^[0-9]+$ && "$current" != "0" ]]; do
    if [[ -n "${protected_pids[$current]:-}" ]]; then
      break
    fi
    protected_pids[$current]=1
    current=$(ps -o ppid= -p "$current" 2>/dev/null | tr -d '[:space:]')
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --log-path) shift; LOG_PATH="${1:-}" ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
  shift
done

initialize_log_file
write_step 'Stopping obvious local LangSuite processes...'
mapfile -t candidate_rows < <(ps -eo pid=,args= | awk -v root="$PROJECT_ROOT" 'index($0, root) > 0 && ($0 ~ /uvicorn/ || $0 ~ /vite/ || $0 ~ /node .*vite/ || $0 ~ /npm run dev/ || $0 ~ /npm run preview/) {print $1}')
if [[ ${#candidate_rows[@]} -eq 0 ]]; then
  write_step 'No obvious LangSuite backend/frontend processes were found.'
  exit 0
fi

declare -A pid_seen=()
declare -A protected_pids=()
collect_protected_ancestors
pids=()
for pid in "${candidate_rows[@]}"; do
  pid="${pid//[[:space:]]/}"
  [[ -z "$pid" ]] && continue
  [[ -n "${protected_pids[$pid]:-}" ]] && continue
  if [[ -z "${pid_seen[$pid]:-}" ]]; then
    pid_seen[$pid]=1
    pids+=("$pid")
    collect_descendants "$pid"
  fi
done

if [[ ${#pids[@]} -eq 0 ]]; then
  write_step 'No obvious LangSuite backend/frontend processes were found after excluding the current shell ancestry.'
  exit 0
fi

if [[ $DRY_RUN -eq 1 ]]; then
  for pid in "${pids[@]}"; do write_step "[dry-run] Would stop process $pid"; done
  write_step 'Dry-run mode only described the stop plan.'
  exit 0
fi

for (( idx=${#pids[@]}-1; idx>=0; idx-- )); do
  pid="${pids[$idx]}"
  kill -TERM "$pid" 2>/dev/null || true
done
sleep 1
for (( idx=${#pids[@]}-1; idx>=0; idx-- )); do
  pid="${pids[$idx]}"
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid" 2>/dev/null || true
  fi
done
sleep 0.2

stopped_any=0
for pid in "${pids[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    write_step "Process $pid is still alive after stop attempts."
  else
    write_step "Stopped process $pid"
    stopped_any=1
  fi
done
if [[ $stopped_any -eq 0 ]]; then
  write_step 'No obvious LangSuite backend/frontend processes remained after stop attempts.'
fi
