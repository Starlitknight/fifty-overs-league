# World Service — Ops Runbook (P1)

One Node process family, one Postgres. The engine is the shipped build
(`../index.html` via `test/engine-vm.mjs`) — build the client first.

## Deploy (any box with Node 22 + Postgres 16)
    cd server && npm install
    createdb foworld
    node migrate.mjs                 # idempotent, transactional
    node init-world.mjs              # founds England (no-op if founded)
    node api.mjs                     # read API on :8787 (PORT to change)
    # the umpire: run every hour from cron — it settles everything due
    17 * * * *  cd /path/server && node tick.mjs >> tick.log 2>&1
DATABASE_URL overrides the default local-socket connection everywhere.

## Inspect the world
    psql foworld -c "SELECT key,status,detail FROM ticks ORDER BY started_at DESC LIMIT 5;"
    psql foworld -c "SELECT round,count(*) FROM matches GROUP BY 1 ORDER BY 1;"
    curl -s localhost:8787/world/today.json
    curl -s localhost:8787/league/eng.json | python3 -m json.tool | head -40

## Re-run a failed tick
Nothing special: run `node tick.mjs` again. A tick killed mid-round left
its idempotency row 'running' and its completed matches persisted; the
re-run plays only the gap (fixture UNIQUE + ON CONFLICT guarantees no
double-writes; standings derive from matches so nothing double-pays).
A tick that never fired is healed the same way — runDue walks every
unsettled day since the season began.

## Backups
    bash backup.sh                         # -> backups/world-<UTC>.dump
    bash restore.sh backups/world-<UTC>.dump
Restore is wholesale (--clean --if-exists): yesterday's world, one
command. Cron a nightly backup next to the tick. Proven in tests and by
hand (mutation made after a backup vanished on restore).

## Laws in force (BLUEPRINT.md)
Deterministic seeds derive from match ids (FNV-1a); every match stamps
engine_version and stores the canonical result string byte-for-byte
(jsonb for queries, text for proof); never re-simulate an old match
with a new engine — bumping ENGINE_VERSION requires a new calibration
golden (tools/calibration.mjs) and applies to new matches only.

## Client hookup
On any device: `localStorage.fo_world_api = "https://your-service"` —
the planet page grows the served-world card. Remove the key to detach.
