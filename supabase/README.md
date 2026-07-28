# Fifty Overs — the `app` schema (the invite-league backend)

This is the backend for **"play with friends"**: a private league you create,
invite people into with a code, and play out against each other. Its state
lives in a per-league Postgres schema (`leagues, members, teams, squads,
draft_pools, fixtures, challenges, orders, results`), every write goes through
an `app.*` `SECURITY DEFINER` action function, and rounds are resolved by a
headless Playwright container running the real engine.

It is **live**. The game page calls into it in a dozen places — `create_league`,
`redeem_invite`, `create_league_team`, `push_league_state`, `challenge_create`,
`challenge_respond`, `challenge_set_orders`, `member_push_state`, `push_packet`,
`market_claim`, `watch_match`, `touch_presence` — and reads `league_clubs`,
`league_state`, `league_challenges`, `league_market`, `league_packets`,
`league_watchers`, `members`, `teams` and `leagues` directly.

`../resolver/round.mjs`, run by `.github/workflows/round-resolver.yml`, is its
umpire: it advances league rounds (`push_league_state`), plays accepted
human-vs-human challenge friendlies (`challenge_record_result`) and clears
stale ones (`expire_stale_challenges`). **Without it, a friends league stops
advancing.**

`migrations/0022_player_saves.sql` is separate from the league system:
`app.player_saves` is the cross-device cloud save, one row per signed-in
account, owner-only via RLS on `auth.uid()`, written by
`engine/src/league/00-boot-auth.js`.

## This is not the only backend

The **World Service** (`../server/`) is a different, newer system: nineteen
national leagues on a `world` schema, settled hourly by
`.github/workflows/world-tick.yml`, read through the `world_*` views and
functions in `../server/migrations/`. A manager reaches it through
`#/worldclub`, which claims a club with `world_auto_claim` /
`world_claim_club`.

The two run side by side and share nothing but the Supabase project and the
match engine. Work on one does not touch the other — and neither can be
retired by assuming the client has stopped calling it. Check
`engine/src/league/**` for the `rpc("…")` and `sel("…")` call sites first.

## Layout
- `migrations/0001_init.sql` — schema, the identity seam, invite/founder flow, RLS.
- `migrations/0002_actions.sql` — the constrained-action API. Every function is
  `SECURITY DEFINER` and self-authorizes via the identity seam.
- `migrations/0003_friendly.sql` — the friendly loop: server lock at kickoff−5min
  with no-show auto-fill, `friendly_inputs`, `store_friendly_result`,
  `expire_stale_challenges`.
- `migrations/0004_official.sql` — official league: `write_fixtures`,
  `fixture_inputs`, `lock_fixture_orders`, `begin_resolve` (team-lock),
  `store_official_result`, `due_fixtures`.
- `migrations/0005_scheduler.sql` — `friendlies_to_lock` / `friendlies_to_resolve`
  for the resolver's polling loop.
- `functions/` — Edge Function seams plus shared draft/schedule/identity helpers.
- `config.toml` — exposes the `app` schema to PostgREST. Removing it takes both
  the friends leagues and cloud saves offline.
- `tests/` — PGlite (real Postgres) suites over identity, RLS, the action API,
  the friendly loop and the official league. Not wired into CI; run by hand
  with `npm test` from this directory.

## Trust boundary
RLS is deny-by-default: no INSERT/UPDATE/DELETE policies exist and the
`authenticated` role has no table write privilege. The only write path is the
`app.*` `SECURITY DEFINER` functions, which self-authorize. Read policies scope
every table to the caller's league membership; draft pools are private to their
owning manager.
