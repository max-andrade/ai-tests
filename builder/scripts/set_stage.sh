#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <stage_number> <stage_name>"
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
const stageNum = Number(process.argv[2]);
const stageName = process.argv[3];
const s = JSON.parse(fs.readFileSync(path, "utf8"));
s.currentStage = stageNum;
s.stageName = stageName;
s.updatedAtUtc = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(s, null, 2) + "\n");
' "$STATE_FILE" "$STAGE_NUM" "$STAGE_NAME"

echo "Updated stage to $STAGE_NUM: $STAGE_NAME"
