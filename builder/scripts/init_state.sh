#!/usr/bin/env bash
set -euo pipefail

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--force]"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="$ROOT_DIR/builder/state"
NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

mkdir -p "$STATE_DIR"

if [[ $FORCE -ne 1 ]]; then
  for f in system_state.json lanes.json tasks.json; do
    if [[ -f "$STATE_DIR/$f" ]]; then
      echo "State file exists: $STATE_DIR/$f"
      echo "Refusing to overwrite existing state. Re-run with --force to overwrite."
      exit 1
    fi
  done
fi

cat > "$STATE_DIR/system_state.json" <<JSON
{
  "currentStage": 0,
  "stageName": "Builder bootstrap",
  "status": "in_progress",
  "nextStageTrigger": "builder_verification_passed",
  "lanes": [],
  "artifacts": [],
  "openQuestions": [],
  "risks": [],
  "updatedAtUtc": "${NOW_UTC}"
}
JSON

cat > "$STATE_DIR/lanes.json" <<'JSON'
{
  "lanes": []
}
JSON

cat > "$STATE_DIR/tasks.json" <<'JSON'
{
  "tasks": []
}
JSON

echo "Initialized builder state in $STATE_DIR"
