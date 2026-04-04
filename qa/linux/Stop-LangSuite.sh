#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DRY_RUN=0
LOG_PATH=""

write_step() {
  printf '%s\n' "$1"
  if [[ -n "$LOG_PATH" ]]; then printf '%s\n' "$1" >> "$LOG_PATH"; fi
}

initialize_log_file() {
  if [[ -z "$LOG_PATH" ]]; then return; fi
  if [[ "$LOG_PATH" != /* ]]; then LOG_PATH="$PROJECT_ROOT/$LOG_PATH"; fi
  mkdir -p "$(dirname "$LOG_PATH")"
  printf 'LangSuite stop log %s\n' "$(date -Iseconds)" > "$LOG_PATH"
}

pattern_matches() {
  local args="$1"
  [[ "$args" == *"$PROJECT_ROOT"* ]] && [[ "$args" =~ uvicorn|vite|node[[:space:]].*vite|npm[[:space:]]+run[[:space:]]+dev|npm[[:space:]]+run[[:space:]]+preview ]]
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

declare -A protected=()
pid_cursor=$$
while [[ -n "$pid_cursor" && "$pid_cursor" != "0" ]]; do
  protected[$pid_cursor]=1
  parent_pid=$(ps -o ppid= -p "$pid_cursor" 2>/dev/null | tr -d '[:space:]')
  [[ -z "$parent_pid" || "$parent_pid" == "$pid_cursor" ]] && break
  pid_cursor="$parent_pid"
done

declare -A args_by_pid=()
declare -A parent_by_pid=()
declare -A root_candidates=()
while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  pid=$(awk '{print $1}' <<<"$row")
  ppid=$(awk '{print $2}' <<<"$row")
  args=${row#"$pid"}
  args=${args#" $ppid"}
  args=${args# }
  [[ -z "$pid" ]] && continue
  parent_by_pid[$pid]="$ppid"
  args_by_pid[$pid]="$args"
  if [[ -z "${protected[$pid]:-}" ]] && pattern_matches "$args"; then
    root_candidates[$pid]=1
  fi
done < <(ps -eo pid=,ppid=,args=)

if [[ ${#root_candidates[@]} -eq 0 ]]; then
  write_step 'No obvious LangSuite backend/frontend processes were found.'
  exit 0
fi

declare -A stop_seen=()
stop_order=()
collect_descendants() {
  local root_pid="$1"
  local child_pid
  while IFS= read -r child_pid; do
    [[ -z "$child_pid" ]] && continue
    [[ -n "${protected[$child_pid]:-}" ]] && continue
    [[ -n "${stop_seen[$child_pid]:-}" ]] && continue
    stop_seen[$child_pid]=1
    collect_descendants "$child_pid"
    stop_order+=("$child_pid")
  done < <(printf '%s\n' "${!parent_by_pid[@]}" | while IFS= read -r pid; do [[ "${parent_by_pid[$pid]}" == "$root_pid" ]] && printf '%s\n' "$pid"; done)
}

for pid in "${!root_candidates[@]}"; do
  collect_descendants "$pid"
  if [[ -z "${protected[$pid]:-}" && -z "${stop_seen[$pid]:-}" ]]; then
    stop_seen[$pid]=1
    stop_order+=("$pid")
  fi
done

if [[ ${#stop_order[@]} -eq 0 ]]; then
  write_step 'No obvious LangSuite backend/frontend processes remained after ancestry protection.'
  exit 0
fi

if [[ $DRY_RUN -eq 1 ]]; then
  for pid in "${stop_order[@]}"; do write_step "[dry-run] Would stop descendant-tree process $pid"; done
  write_step 'Dry-run mode only described the stop plan.'
  exit 0
fi

for pid in "${stop_order[@]}"; do
  kill -TERM "$pid" 2>/dev/null || true
done
sleep 1
for pid in "${stop_order[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid" 2>/dev/null || true
  fi
done
sleep 0.2

stopped_any=0
for pid in "${stop_order[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    write_step "Process $pid is still alive after stop attempts."
  else
    write_step "Stopped descendant-tree process $pid"
    stopped_any=1
  fi
done
if [[ $stopped_any -eq 0 ]]; then
  write_step 'No obvious LangSuite backend/frontend processes remained after stop attempts.'
fi
