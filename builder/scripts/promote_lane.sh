#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <lane_id> [target_branch]"
  exit 1
fi

LANE_ID="$1"
TARGET_BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD)}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LANES_FILE="$ROOT_DIR/builder/state/lanes.json"
VERIFY_SCRIPT="$ROOT_DIR/builder/lanes/${LANE_ID}/verify.sh"

cd "$ROOT_DIR"

if [[ ! -f "$VERIFY_SCRIPT" ]]; then
  echo "Missing lane verify script: $VERIFY_SCRIPT"
  exit 1
fi

node -e '
const fs = require("fs");
const lanesPath = process.argv[1];
const laneId = process.argv[2];
const data = JSON.parse(fs.readFileSync(lanesPath, "utf8"));
const lane = data.lanes.find(l => l.laneId === laneId);
if (!lane) {
  console.error(`Lane not found: ${laneId}`);
  process.exit(1);
}
if (lane.status !== "done") {
  console.error(`Lane ${laneId} must be in status done before promotion; got ${lane.status}`);
  process.exit(1);
}
' "$LANES_FILE" "$LANE_ID"

bash "$VERIFY_SCRIPT"

if ! git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
  echo "Target branch not found: ${TARGET_BRANCH}"
  exit 1
fi

LANE_BRANCH="lane/${LANE_ID}"
if ! git show-ref --verify --quiet "refs/heads/${LANE_BRANCH}"; then
  echo "Lane branch not found: ${LANE_BRANCH}"
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]]; then
  git checkout "$TARGET_BRANCH"
fi

git merge --no-ff "$LANE_BRANCH" -m "Promote ${LANE_ID} into ${TARGET_BRANCH}"
"$ROOT_DIR/builder/scripts/update_lane_status.sh" "$LANE_ID" integrated

echo "Promoted ${LANE_ID} into ${TARGET_BRANCH}"
