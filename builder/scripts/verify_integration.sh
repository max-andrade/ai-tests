#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -x "./scripts/build" ]]; then
  ./scripts/build
elif [[ -f "./scripts/build" ]]; then
  bash ./scripts/build
else
  echo "No ./scripts/build found; skipping build"
fi

if [[ -x "./scripts/test" ]]; then
  ./scripts/test
elif [[ -f "./scripts/test" ]]; then
  bash ./scripts/test
else
  echo "No ./scripts/test found; skipping test"
fi

echo "Integration verification completed"
