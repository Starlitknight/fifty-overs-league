#!/usr/bin/env bash
# backup.sh — one command, one durable snapshot of the world.
#   DATABASE_URL=postgres:///foworld bash backup.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="backups/world-$STAMP.dump"
pg_dump -Fc -f "$OUT" "${DATABASE_URL:-postgres:///foworld}"
echo "$OUT"
