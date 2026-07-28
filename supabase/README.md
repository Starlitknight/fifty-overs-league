# Fifty Overs — the `app` schema (mostly retired)

This directory is the migration history of the **first** multiplayer backend: a
per-league Postgres schema (`leagues, members, teams, squads, draft_pools,
fixtures, challenges, orders, results`) driven through `app.*` `SECURITY
DEFINER` action functions, with a headless Playwright container resolving
matches on a cron.

**That system is retired.** The shipped game no longer contains a single call
into it. Matches are settled by the World Service (`../server/`, run hourly by
`.github/workflows/world-tick.yml`), and phones read the world through the
`world_*` views and functions defined in `../server/migrations/`. See
`../BLUEPRINT.md`.

## What is still live here

Exactly one thing:

- **`migrations/0022_player_saves.sql`** — `app.player_saves`, the cross-device
  cloud save. One row per signed-in account, owner-only via RLS on
  `auth.uid()`. The client writes it after an autosave and offers to pull when
  another device holds a newer copy (`engine/src/league/00-boot-auth.js`).
- **`config.toml`** — exposes the `app` schema to PostgREST, which is what makes
  that table reachable. Do not remove it while cloud saves are on.
- **`email-templates/confirm-signup.html`** — the sign-up mail Supabase sends.

## Why the rest is kept

`migrations/0001`–`0021` are the definition of tables and functions that still
physically exist in the production database. Nothing reads them, but they are
the only record of what is in there, so they stay until someone deliberately
drops the schema. Treat them as history, not as documentation of how the game
works today.

The Edge Functions under `functions/` are in the same position: deployed once,
no longer called.
