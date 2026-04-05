#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <verify-command> [max_retries]"
  exit 1
fi

VERIFY_CMD="$1"
MAX_RETRIES="${2:-5}"
ATTEMPT=1

while (( ATTEMPT <= MAX_RETRIES )); do
  echo "[verify-loop] attempt ${ATTEMPT}/${MAX_RETRIES}: ${VERIFY_CMD}"
  if bash -lc "$VERIFY_CMD"; then
    echo "[verify-loop] PASS"
    exit 0
  fi

  echo "[verify-loop] FAIL on attempt ${ATTEMPT}"
  ((ATTEMPT++))
done

echo "[verify-loop] Exhausted retries (${MAX_RETRIES})"
exit 1
