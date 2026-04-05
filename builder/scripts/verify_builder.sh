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
)

for f in "${required_files[@]}"; do
  [[ -f "$f" ]] || { echo "Missing required file: $f"; exit 1; }
done

node -e '
const fs = require("fs");
const files = [
  "builder/state/system_state.json",
  "builder/state/lanes.json",
  "builder/state/tasks.json"
];
for (const f of files) {
  try {
    JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    console.error(`Invalid JSON in ${f}: ${e.message}`);
    process.exit(1);
  }
}
' 

grep -q "Persistent Loop" builder/README.md || { echo "README missing loop definition"; exit 1; }
grep -q "Role: Verifier" builder/docs/OPERATING_MODEL.md || { echo "Operating model missing verifier role"; exit 1; }

echo "Builder verification passed"
