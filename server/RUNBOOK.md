# World Service — Ops Runbook (P2: the whole planet)

One Node process family, one Postgres. The engine is the shipped build
(`../index.html` via `test/engine-vm.mjs`) — build the client first.
All 19 national leagues run here; their names, sides and play hours are
read from the shipped build itself (host.worldConfig()), so the served
world can never drift from what the phones compute.

## Deploy (any box with Node 22 + Postgres 16)
    cd server && npm install
    createdb foworld
    node migrate.mjs                 # idempotent, transactional
    node init-world.mjs              # founds ALL 19 leagues (no-op if complete)
    # phones read the world through Supabase PostgREST (the world_* views and
    # SECURITY DEFINER functions the migrations define) — there is no separate
    # read process to run.
    # the umpire: run every hour from cron — it settles everything due,
    # every nation, at that nation's own hour (staggered globe)
    17 * * * *  cd /path/server && node tick.mjs >> tick.log 2>&1
DATABASE_URL overrides the default local-socket connection everywhere.

## Upgrading a P1 (England-only) database
Run `node init-world.mjs` once. The world exists, so it calls
expandWorld(): every missing country is founded in its own transaction
with position-stable squad seeds; England's clubs, season and matches
are untouched. Their season 1 begins on the next world day.

## The international windows
Rounds 5, 9 and 13 of every season are window days. The umpire names each
nation's fifteen on the morning of one (banked in `callups` — named once,
never re-picked), plays every club fixture without those men, and at
**18:00 UTC** pairs whoever is in a window that world day and plays the
tours on the real engine (`nat_matches`). Nineteen nations make nine ties;
the nation drawn out calls nobody up that window. One idempotency key a day
(`nat:day:<n>`); a dead cron is healed for four days back by the next
invocation. Compensation is never written to a balance — `economy.mjs`
walks the callups from genesis with the rest of the books.

    psql foworld -c "SELECT country_id,round,count(*),sum(fee) FROM callups GROUP BY 1,2 ORDER BY 1,2;"
    psql foworld -c "SELECT id,a_name,b_name,result->>'text' FROM nat_matches ORDER BY world_day DESC LIMIT 9;"

## Inspect the world
    psql foworld -c "SELECT key,status,detail FROM ticks ORDER BY started_at DESC LIMIT 5;"
    psql foworld -c "SELECT country_id,round,count(*) FROM matches GROUP BY 1,2 ORDER BY 1,2;"
    curl -s localhost:8787/world/today.json        # all 19: rounds, leaders, play hours
    curl -s localhost:8787/league/eng.json | python3 -m json.tool | head -40
Country ids: afg aus bgd can eng ire ken ned nep nzl pak rsa sco slk
sub usa wal win zim. A full planet-day is ~95 engine matches (~15s).

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
