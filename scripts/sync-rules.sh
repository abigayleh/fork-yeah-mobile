#!/usr/bin/env bash
# firestore.rules is owned by the fork-yeah web repo (it is the deploy target
# there). This copy exists so the mobile tests run against the SAME rules the
# app meets in production; tests/rulesSync.test.ts fails if the two drift.
set -euo pipefail
SRC="${1:-$(dirname "$0")/../../fork-yeah/firestore.rules}"
DEST="$(dirname "$0")/../firestore.rules"
[ -f "$SRC" ] || { echo "source rules not found: $SRC" >&2; exit 1; }
cp "$SRC" "$DEST"
echo "synced $SRC -> $DEST"
