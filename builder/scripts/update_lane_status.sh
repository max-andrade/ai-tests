#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <lane_id> <planned|in_progress|blocked|done>"
  exit 1
fi

LANE_ID="$1"
NEW_STATUS="$2"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LANES_FILE="$ROOT_DIR/builder/state/lanes.json"

node -e '
const fs = require("fs");
const lanesPath = process.argv[1];
const laneId = process.argv[2];
const newStatus = process.argv[3];
const valid = new Set(["planned", "in_progress", "blocked", "done"]);
if (!valid.has(newStatus)) {
  console.error(`Invalid status: ${newStatus}`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(lanesPath, "utf8"));
const lane = data.lanes.find(l => l.laneId === laneId);
if (!lane) {
  console.error(`Lane not found: ${laneId}`);
  process.exit(1);
}
lane.status = newStatus;
lane.updatedAtUtc = new Date().toISOString();
fs.writeFileSync(lanesPath, JSON.stringify(data, null, 2) + "\n");
console.log(`Updated ${laneId} => ${newStatus}`);
' "$LANES_FILE" "$LANE_ID" "$NEW_STATUS"
