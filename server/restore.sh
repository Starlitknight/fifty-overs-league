#!/usr/bin/env bash
# restore.sh — restore the world from a backup dump, wholesale.
#   bash restore.sh backups/world-20260726T000000Z.dump
# Restores into DATABASE_URL (default postgres:///foworld), dropping and
# recreating the world's objects from the dump (--clean --if-exists).
set -euo pipefail
cd "$(dirname "$0")"
DUMP="${1:?usage: restore.sh <dumpfile>}"
pg_restore --clean --if-exists --no-owner -d "${DATABASE_URL:-postgres:///foworld}" "$DUMP"
echo "restored from $DUMP"
