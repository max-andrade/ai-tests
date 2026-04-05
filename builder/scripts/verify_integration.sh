#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

HAS_BUILD=0
HAS_TEST=0

if [[ -f "./scripts/build" ]]; then
  HAS_BUILD=1
fi

if [[ -f "./scripts/test" ]]; then
  HAS_TEST=1
fi

if [[ $HAS_BUILD -eq 0 && $HAS_TEST -eq 0 ]]; then
  echo "Integration verification failed: neither ./scripts/build nor ./scripts/test exists"
  exit 1
fi

if [[ $HAS_BUILD -eq 1 ]]; then
  if [[ -x "./scripts/build" ]]; then
    ./scripts/build
  else
    bash ./scripts/build
  fi
fi

if [[ $HAS_TEST -eq 1 ]]; then
  if [[ -x "./scripts/test" ]]; then
    ./scripts/test
  else
    bash ./scripts/test
  fi
fi

echo "Integration verification completed"
