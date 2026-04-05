#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "builder/README.md"
  "builder/docs/OPERATING_MODEL.md"
  "builder/templates/LANE_TASK_TEMPLATE.md"
  "builder/templates/STAGE_REVIEW_TEMPLATE.md"
  "builder/state/system_state.json"
  "builder/state/lanes.json"
  "builder/state/tasks.json"
  "builder/scripts/create_lane.sh"
  "builder/scripts/set_stage.sh"
  "builder/scripts/update_lane_status.sh"
  "builder/scripts/run_verify_loop.sh"
  "builder/scripts/promote_lane.sh"
  "builder/scripts/verify_integration.sh"
)

for f in "${required_files[@]}"; do
  [[ -f "$f" ]] || { echo "Missing required file: $f"; exit 1; }
done

grep -q "Persistent Loop" builder/README.md || { echo "README missing loop definition"; exit 1; }
grep -q "Role: Verifier" builder/docs/OPERATING_MODEL.md || { echo "Operating model missing verifier role"; exit 1; }

node -e '
const fs = require("fs");
const state = JSON.parse(fs.readFileSync("builder/state/system_state.json", "utf8"));
const lanesData = JSON.parse(fs.readFileSync("builder/state/lanes.json", "utf8"));
const tasksData = JSON.parse(fs.readFileSync("builder/state/tasks.json", "utf8"));

if (!Array.isArray(lanesData.lanes)) {
  console.error("lanes.json invalid: lanes must be array");
  process.exit(1);
}
if (!Array.isArray(tasksData.tasks)) {
  console.error("tasks.json invalid: tasks must be array");
  process.exit(1);
}
const iso = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
if (!iso(state.updatedAtUtc)) {
  console.error("system_state.json invalid: updatedAtUtc must be ISO timestamp");
  process.exit(1);
}

const ids = new Set();
for (const lane of lanesData.lanes) {
  if (ids.has(lane.laneId)) {
    console.error(`Duplicate lane ID detected: ${lane.laneId}`);
    process.exit(1);
  }
  ids.add(lane.laneId);

  for (const key of ["createdAtUtc", "updatedAtUtc"]) {
    if (lane[key] && !iso(lane[key])) {
      console.error(`Lane ${lane.laneId} has invalid timestamp ${key}: ${lane[key]}`);
      process.exit(1);
    }
  }

  const hasVerificationCommands = Array.isArray(lane.verificationCommands) && lane.verificationCommands.length > 0;
  if ((lane.status === "done" || lane.status === "integrated") && !hasVerificationCommands) {
    console.error(`Lane ${lane.laneId} is ${lane.status} but has no verificationCommands`);
    process.exit(1);
  }

  if (!lane.verifyScript || typeof lane.verifyScript !== "string") {
    console.error(`Lane ${lane.laneId} missing verifyScript`);
    process.exit(1);
  }
  if (!lane.laneTaskFile || typeof lane.laneTaskFile !== "string") {
    console.error(`Lane ${lane.laneId} missing laneTaskFile`);
    process.exit(1);
  }

  const laneDir = lane.laneTaskFile.replace(/\/task\.md$/, "");
  if (fs.existsSync(laneDir)) {
    if (!fs.existsSync(`${laneDir}/task.md`) || !fs.existsSync(`${laneDir}/verify.sh`)) {
      console.error(`Lane directory exists but required files missing for ${lane.laneId}: ${laneDir}`);
      process.exit(1);
    }
  }

  if ((lane.status === "done" || lane.status === "integrated") && !fs.existsSync(lane.verifyScript)) {
    console.error(`Lane ${lane.laneId} is ${lane.status} but verify script path does not exist: ${lane.verifyScript}`);
    process.exit(1);
  }
}

const completedStageNums = tasksData.tasks
  .filter(t => t.status === "completed" && typeof t.id === "string")
  .map(t => {
    const m = t.id.match(/^C(\d+)-/);
    return m ? Number(m[1]) : null;
  })
  .filter(v => Number.isInteger(v));
if (completedStageNums.length > 0) {
  const maxCompleted = Math.max(...completedStageNums);
  if (Number(state.currentStage) < maxCompleted) {
    console.error(`system_state.currentStage (${state.currentStage}) behind max completed task stage (${maxCompleted})`);
    process.exit(1);
  }
}
'

TEMP_DIR="$(mktemp -d)"
TEMP_LANE_A="verify-temp-a-$$"
TEMP_LANE_B="verify-temp-b-$$"
TEMP_BRANCH_A="lane/${TEMP_LANE_A}"
TEMP_BRANCH_B="lane/${TEMP_LANE_B}"
LANES_BACKUP="$TEMP_DIR/lanes.json.bak"
TASKS_BACKUP="$TEMP_DIR/tasks.json.bak"
SYSTEM_BACKUP="$TEMP_DIR/system_state.json.bak"
LANE_PATH_A="builder/lanes/${TEMP_LANE_A}"
LANE_PATH_B="builder/lanes/${TEMP_LANE_B}"

cp builder/state/lanes.json "$LANES_BACKUP"
cp builder/state/tasks.json "$TASKS_BACKUP"
cp builder/state/system_state.json "$SYSTEM_BACKUP"

cleanup() {
  set +e

  for branch in "$TEMP_BRANCH_A" "$TEMP_BRANCH_B"; do
    if git show-ref --verify --quiet "refs/heads/${branch}"; then
      git branch -D "$branch" >/dev/null 2>&1 || true
    fi
  done

  git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r wt; do
    if [[ "$wt" == *"/builder/worktrees/${TEMP_LANE_A}" || "$wt" == *"/builder/worktrees/${TEMP_LANE_B}" ]]; then
      git worktree remove "$wt" --force >/dev/null 2>&1 || true
    fi
  done

  rm -rf "$LANE_PATH_A" "$LANE_PATH_B" "$ROOT_DIR/builder/worktrees/${TEMP_LANE_A}" "$ROOT_DIR/builder/worktrees/${TEMP_LANE_B}"

  cp "$LANES_BACKUP" builder/state/lanes.json
  cp "$TASKS_BACKUP" builder/state/tasks.json
  cp "$SYSTEM_BACKUP" builder/state/system_state.json
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

./builder/scripts/create_lane.sh "$TEMP_LANE_A" "Builder verification temporary lane A" "builder/tmp/shared-scope"

git show-ref --verify --quiet "refs/heads/${TEMP_BRANCH_A}" || { echo "Temp lane A branch not created"; exit 1; }
[[ -f "$LANE_PATH_A/task.md" ]] || { echo "Temp lane A task file missing"; exit 1; }
[[ -x "$LANE_PATH_A/verify.sh" ]] || { echo "Temp lane A verify script missing/executable bit absent"; exit 1; }

node -e '
const fs = require("fs");
const laneId = process.argv[1];
const data = JSON.parse(fs.readFileSync("builder/state/lanes.json", "utf8"));
const lane = data.lanes.find(l => l.laneId === laneId);
if (!lane) {
  console.error("Temp lane A not registered in lanes.json");
  process.exit(1);
}
if (!Array.isArray(lane.verificationCommands) || lane.verificationCommands.length === 0) {
  console.error("verificationCommands must contain default verify command");
  process.exit(1);
}
if (!lane.verificationCommands.includes(`builder/lanes/${laneId}/verify.sh`)) {
  console.error("verificationCommands missing lane verify script path");
  process.exit(1);
}
' "$TEMP_LANE_A"

if ./builder/scripts/create_lane.sh "$TEMP_LANE_B" "overlap test lane" "builder/tmp/shared-scope/nested" >/dev/null 2>&1; then
  echo "Scope-overlap lane creation unexpectedly succeeded"
  exit 1
fi

if ./builder/scripts/create_lane.sh "$TEMP_LANE_A" "duplicate" "builder/tmp/duplicate.md" >/dev/null 2>&1; then
  echo "Duplicate lane creation unexpectedly succeeded"
  exit 1
fi

if ./builder/scripts/update_lane_status.sh "$TEMP_LANE_A" "invalid_status" >/dev/null 2>&1; then
  echo "Invalid lane status update unexpectedly succeeded"
  exit 1
fi

if ./builder/scripts/update_lane_status.sh "$TEMP_LANE_A" "done" >/dev/null 2>&1; then
  echo "Invalid lane transition (planned -> done) unexpectedly succeeded"
  exit 1
fi

echo "Builder verification passed"
