# Fifty Overs — Supabase backend

Postgres schema, identity boundary, and Edge Function seams for the multiplayer
league. The server owns every outcome-determining fact; clients submit only
validated actions.

## Layout
- `migrations/0001_init.sql` — schema (`leagues, members, invites, teams, squads,
  draft_pools, fixtures, challenges, orders, results`), the `standings` view, the
  identity seam, invite/founder flow, and RLS.
- `functions/_shared/identity.ts` — `resolveManagerId(request, leagueId)` and
  `requireFounder(...)`, the Deno/Edge transport wrapper over the DB functions.
- `config.toml` — exposes the `app` schema to PostgREST.
- `tests/run.mjs` — runs the migration in **PGlite (real Postgres)** and exercises
  identity, invite redeem, founder gating, RLS, and standings.

## Run the tests
```bash
cd supabase
npm install          # @electric-sql/pglite
npm test             # node tests/run.mjs — 24 assertions, exit 0 = pass
```

## Identity boundary (the single seam)
```
Supabase Auth JWT → request.jwt.claim.sub (auth_uid) → members.auth_uid → manager_id
```
- `app.current_auth_uid()` reads the JWT GUC (same source as `auth.uid()`).
  Swapping identity providers touches ONLY this function + `identity.ts`.
- `app.resolve_manager_id(league_id)` maps uid → manager_id, raising
  `not authenticated` / `not a member`.
- `app.require_founder(league_id)` gates founder-only actions server-side via the
  `members.role` column.

## Trust boundary / RLS
- RLS is **deny-by-default**: no INSERT/UPDATE/DELETE policies exist, and the
  `authenticated` role has no table write privilege. The only write path is the
  `app.*` `SECURITY DEFINER` functions, which self-authorize.
- Read policies scope every table to the caller's league membership; draft pools
  are private to their owning manager. Membership lookups use `SECURITY DEFINER`
  helpers (`app.my_league_ids()` etc.) to avoid RLS recursion.

## Standings
`app.standings` is derived from `results` (official `comp='league'` only) using the
written `winner_team_id` column — never by parsing `result_text`. NRR uses the
`home_runs/home_balls/away_runs/away_balls` columns the resolver writes.
