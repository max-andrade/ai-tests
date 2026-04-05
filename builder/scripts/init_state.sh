#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="$ROOT_DIR/builder/state"

mkdir -p "$STATE_DIR"

cat > "$STATE_DIR/system_state.json" <<'JSON'
{
  "currentStage": 0,
  "stageName": "Builder bootstrap",
  "status": "in_progress",
  "nextStageTrigger": "builder_verification_passed",
  "lanes": [],
  "artifacts": [],
  "openQuestions": [],
  "risks": [],
  "updatedAtUtc": "1970-01-01T00:00:00Z"
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
