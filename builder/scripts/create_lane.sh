#!/usr/bin/env bash
set -euo pipefail

WITH_WORKTREE=0
if [[ "${1:-}" == "--with-worktree" ]]; then
  WITH_WORKTREE=1
  shift
fi

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 [--with-worktree] <lane_id> <objective> <scope_path_csv>"
  echo "Example: $0 lane-auth 'Build auth slice' 'src/auth.ts,src/session.ts'"
  exit 1
fi

LANE_ID="$1"
OBJECTIVE="$2"
SCOPE_CSV="$3"
BRANCH="lane/${LANE_ID}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LANES_FILE="$ROOT_DIR/builder/state/lanes.json"
LANE_DIR="$ROOT_DIR/builder/lanes/${LANE_ID}"
TASK_TEMPLATE="$ROOT_DIR/builder/templates/LANE_TASK_TEMPLATE.md"
VERIFY_SCRIPT="$LANE_DIR/verify.sh"
TASK_FILE="$LANE_DIR/task.md"
WORKTREE_DIR="$ROOT_DIR/builder/worktrees/${LANE_ID}"
VERIFY_CMD="builder/lanes/${LANE_ID}/verify.sh"

cd "$ROOT_DIR"

if [[ ! -f "$LANES_FILE" ]]; then
  echo "Missing lanes state file: $LANES_FILE"
  exit 1
fi

if [[ -d "$LANE_DIR" ]]; then
  echo "Lane directory already exists: $LANE_DIR"
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "Branch ${BRANCH} already exists"
  exit 1
fi

node -e '
const fs = require("fs");
const lanesPath = process.argv[1];
const laneId = process.argv[2];
const scopeCsv = process.argv[3];
const data = JSON.parse(fs.readFileSync(lanesPath, "utf8"));
if (!Array.isArray(data.lanes)) {
  console.error("Invalid lanes.json: lanes must be an array");
  process.exit(1);
}
if (data.lanes.some(l => l.laneId === laneId)) {
  console.error(`Lane already exists in state: ${laneId}`);
  process.exit(1);
}
const incoming = scopeCsv.split(",").map(s => s.trim()).filter(Boolean);
if (incoming.length === 0) {
  console.error("Scope cannot be empty");
  process.exit(1);
}
const activeStatuses = new Set(["planned", "in_progress"]);
function overlaps(a, b) {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
for (const lane of data.lanes) {
  if (!activeStatuses.has(lane.status)) continue;
  const existingScope = Array.isArray(lane.scope) ? lane.scope : [];
  for (const i of incoming) {
    for (const e of existingScope) {
      if (overlaps(i, e)) {
        console.error(`Scope overlap detected with active lane ${lane.laneId}: ${i} <-> ${e}`);
        process.exit(1);
      }
    }
  }
}
' "$LANES_FILE" "$LANE_ID" "$SCOPE_CSV"

git branch "$BRANCH"
echo "Created branch ${BRANCH}"

mkdir -p "$LANE_DIR"
cp "$TASK_TEMPLATE" "$TASK_FILE"

node -e '
const fs = require("fs");
const p = process.argv[1];
const laneId = process.argv[2];
const branch = process.argv[3];
const objective = process.argv[4];
const lines = fs.readFileSync(p, "utf8")
  .replace(/<lane-id>/g, laneId)
  .replace(/<branch-or-worktree>/g, branch)
  .replace(/<single measurable outcome>/g, objective)
  .replace(/<stage-number-and-name>/g, "2: Lane decomposition");
fs.writeFileSync(p, lines);
' "$TASK_FILE" "$LANE_ID" "$BRANCH" "$OBJECTIVE"

cat > "$VERIFY_SCRIPT" <<EOF_VERIFY
#!/usr/bin/env bash
set -euo pipefail

echo "Lane ${LANE_ID} verify stub: replace with deterministic checks"
exit 0
EOF_VERIFY
chmod +x "$VERIFY_SCRIPT"

if [[ $WITH_WORKTREE -eq 1 ]]; then
  mkdir -p "$(dirname "$WORKTREE_DIR")"
  if [[ -d "$WORKTREE_DIR" ]]; then
    echo "Worktree already exists at $WORKTREE_DIR (continuing)"
  else
    if git worktree add "$WORKTREE_DIR" "$BRANCH" >/dev/null 2>&1; then
      echo "Created worktree $WORKTREE_DIR"
    else
      echo "Warning: failed to create worktree for ${BRANCH}; branch created and lane registered" >&2
    fi
  fi
fi

node -e '
const fs = require("fs");
const lanesPath = process.argv[1];
const laneId = process.argv[2];
const objective = process.argv[3];
const scopeCsv = process.argv[4];
const branch = process.argv[5];
const laneDir = process.argv[6];
const verifyScript = process.argv[7];
const verifyCommand = process.argv[8];
const data = JSON.parse(fs.readFileSync(lanesPath, "utf8"));
const scope = scopeCsv.split(",").map(s => s.trim()).filter(Boolean);
data.lanes.push({
  laneId,
  branch,
  objective,
  scope,
  status: "planned",
  verificationCommands: [verifyCommand],
  laneTaskFile: laneDir,
  verifyScript,
  createdAtUtc: new Date().toISOString(),
  updatedAtUtc: new Date().toISOString()
});
fs.writeFileSync(lanesPath, JSON.stringify(data, null, 2) + "\n");
console.log(`Registered lane ${laneId}`);
' "$LANES_FILE" "$LANE_ID" "$OBJECTIVE" "$SCOPE_CSV" "$BRANCH" "builder/lanes/${LANE_ID}/task.md" "builder/lanes/${LANE_ID}/verify.sh" "$VERIFY_CMD"
