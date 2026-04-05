#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <lane_id> <verify-command> [max_retries] [task_id]"
  exit 1
fi

LANE_ID="$1"
VERIFY_CMD="$2"
MAX_RETRIES="${3:-5}"
TASK_ID="${4:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$ROOT_DIR/builder/logs"
TASKS_FILE="$ROOT_DIR/builder/state/tasks.json"
LOG_FILE="$LOG_DIR/${LANE_ID}-verify.log"

mkdir -p "$LOG_DIR"
: > "$LOG_FILE"

ATTEMPT=1
PREV_ERROR=""
FAIL_COUNT=0

append_failure_summary() {
  local summary="$1"
  [[ -n "$TASK_ID" ]] || return 0

  node -e '
const fs = require("fs");
const tasksPath = process.argv[1];
const taskId = process.argv[2];
const summary = process.argv[3];
const attempts = Number(process.argv[4]);
if (!fs.existsSync(tasksPath)) process.exit(0);
const data = JSON.parse(fs.readFileSync(tasksPath, "utf8"));
if (!Array.isArray(data.tasks)) process.exit(0);
const task = data.tasks.find(t => t.id === taskId);
if (!task) process.exit(0);
if (!Array.isArray(task.verificationFailures)) task.verificationFailures = [];
task.verificationFailures.push({
  atUtc: new Date().toISOString(),
  attempts,
  summary
});
fs.writeFileSync(tasksPath, JSON.stringify(data, null, 2) + "\n");
' "$TASKS_FILE" "$TASK_ID" "$summary" "$FAIL_COUNT"
}

while (( ATTEMPT <= MAX_RETRIES )); do
  echo "[verify-loop] attempt ${ATTEMPT}/${MAX_RETRIES}: ${VERIFY_CMD}" | tee -a "$LOG_FILE"

  set +e
  OUTPUT="$(bash -lc "$VERIFY_CMD" 2>&1)"
  CODE=$?
  set -e

  printf '%s\n' "$OUTPUT" | tee -a "$LOG_FILE"

  if [[ $CODE -eq 0 ]]; then
    echo "[verify-loop] PASS" | tee -a "$LOG_FILE"
    exit 0
  fi

  ((FAIL_COUNT++))
  CURRENT_ERROR="$(printf '%s' "$OUTPUT" | tail -n 5)"
  echo "[verify-loop] FAIL on attempt ${ATTEMPT}" | tee -a "$LOG_FILE"

  if [[ -n "$PREV_ERROR" && "$CURRENT_ERROR" == "$PREV_ERROR" ]]; then
    echo "[verify-loop] Deterministic failure detected (same error twice); stopping early." | tee -a "$LOG_FILE"
    append_failure_summary "Deterministic failure after ${FAIL_COUNT} attempts: ${CURRENT_ERROR}"
    exit 1
  fi

  PREV_ERROR="$CURRENT_ERROR"
  ((ATTEMPT++))
done

append_failure_summary "Verification failed after ${FAIL_COUNT} attempts. Last error: ${PREV_ERROR}"
echo "[verify-loop] Exhausted retries (${MAX_RETRIES})" | tee -a "$LOG_FILE"
exit 1
