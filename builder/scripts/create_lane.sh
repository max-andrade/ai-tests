#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <lane_id> <objective> <scope_path_csv>"
  echo "Example: $0 lane-auth 'Build auth slice' 'src/auth.ts,src/session.ts'"
  exit 1
fi

LANE_ID="$1"
OBJECTIVE="$2"
SCOPE_CSV="$3"
BRANCH="lane/${LANE_ID}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LANES_FILE="$ROOT_DIR/builder/state/lanes.json"

cd "$ROOT_DIR"

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "Branch ${BRANCH} already exists"
else
  git branch "$BRANCH"
  echo "Created branch ${BRANCH}"
fi

node -e '
const fs = require("fs");
const lanesPath = process.argv[1];
const laneId = process.argv[2];
const objective = process.argv[3];
const scopeCsv = process.argv[4];
const branch = process.argv[5];
const data = JSON.parse(fs.readFileSync(lanesPath, "utf8"));
if (data.lanes.some(l => l.laneId === laneId)) {
  console.log(`Lane ${laneId} already registered`);
  process.exit(0);
}
const scope = scopeCsv.split(",").map(s => s.trim()).filter(Boolean);
data.lanes.push({
  laneId,
  branch,
  objective,
  scope,
  status: "planned",
  verificationCommands: [],
  createdAtUtc: new Date().toISOString()
});
fs.writeFileSync(lanesPath, JSON.stringify(data, null, 2) + "\n");
console.log(`Registered lane ${laneId}`);
' "$LANES_FILE" "$LANE_ID" "$OBJECTIVE" "$SCOPE_CSV" "$BRANCH"
