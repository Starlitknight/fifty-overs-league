# Fifty Overs — Supabase backend

Postgres schema, identity boundary, and Edge Function seams for the multiplayer
league. The server owns every outcome-determining fact; clients submit only
validated actions.

## Layout
- `migrations/0001_init.sql` — schema (`leagues, members, invites, teams, squads,
  draft_pools, fixtures, challenges, orders, results`), the `standings` view, the
  identity seam, invite/founder flow, and RLS.
- `migrations/0002_actions.sql` — the constrained-action API: `create_team,
  sign_player, drop_player, confirm_squad, submit_orders, lock_managers,
  write_draft_pool, issue_challenge, accept_challenge, founder_edit`. Every
  function is `SECURITY DEFINER` and self-authorizes via the identity seam.
- `functions/_shared/identity.ts` — `resolveManagerId(request, leagueId)` /
  `requireFounder(...)`, the Deno/Edge transport wrapper over the DB functions.
- `functions/_shared/draft.js` — `snakeDeal(players, n)`: size-capped
  rating-balanced (LPT) partition of one master pool into N disjoint buckets.
- `functions/action/index.ts` — one dispatcher for all validated actions.
- `functions/deal_draft/index.ts` — founder-only: lock count → real engine master
  pool → snake-deal → persist private buckets.
- `config.toml` — exposes the `app` schema to PostgREST.
- `tests/run.mjs`, `tests/run_phase2.mjs` — run the migrations in **PGlite (real
  Postgres)** and exercise identity, invite/founder, RLS, standings, the two
  load-bearing validations, confirm-squad legality, draft, and availability.
- `tests/draft_realpool.mjs` — snake-deals a **real** `genDraftPool` master pool
  headless and checks the buckets are disjoint, equal-size, rating-balanced.

## Run the tests
```bash
cd supabase
npm install                 # @electric-sql/pglite
npm test                    # 24 + 23 assertions across both phases, exit 0 = pass
npm run test:realpool       # optional: real engine pool via headless Chromium
```

## Load-bearing validations (server-side, tested)
- `sign_player` — the player must be in **that manager's** dealt `draft_pool` and
  the signing must keep `budget_spent <= draft_budget`.
- `submit_orders` — rejected once `now() >= lock`, where the server owns the lock
  (official: fixture kickoff; friendly: kickoff − 5 min).
- `confirm_squad` — reuses the game's v11.6 rule: `>=11, a keeper, >=5 bowling
  options, within budget`, raising the same reasons the UI shows.
- `accept_challenge` — a team-availability window check rejects a friendly that
  overlaps another match (enforced at acceptance, per the design).

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
