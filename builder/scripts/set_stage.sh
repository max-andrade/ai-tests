#!/usr/bin/env bash
set -euo pipefail

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
  shift
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 [--force] <stage_number> <stage_name>"
  exit 1
fi

STAGE_NUM="$1"
shift
STAGE_NAME="$*"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$ROOT_DIR/builder/state/system_state.json"

node -e '
const fs = require("fs");
const path = process.argv[1];
const next = Number(process.argv[2]);
const stageName = process.argv[3];
const force = process.argv[4] === "1";
if (!Number.isInteger(next) || next < 0) {
  console.error(`Invalid stage number: ${process.argv[2]}`);
  process.exit(1);
}
const s = JSON.parse(fs.readFileSync(path, "utf8"));
const prev = Number(s.currentStage);
if (!Number.isInteger(prev) || prev < 0) {
  console.error(`Invalid currentStage in state: ${s.currentStage}`);
  process.exit(1);
}
if (!force) {
  if (next < prev) {
    console.error(`Backward stage transition blocked: ${prev} -> ${next}. Use --force to override.`);
    process.exit(1);
  }
  if (next > prev + 1) {
    console.error(`Stage skip blocked: ${prev} -> ${next}. Advance one stage at a time or use --force.`);
    process.exit(1);
  }
}
s.currentStage = next;
s.stageName = stageName;
s.status = "in_progress";
s.nextStageTrigger = `stage_${next}_complete`;
s.updatedAtUtc = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(s, null, 2) + "\n");
' "$STATE_FILE" "$STAGE_NUM" "$STAGE_NAME" "$FORCE"

echo "Updated stage to $STAGE_NUM: $STAGE_NAME"
