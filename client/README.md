# Fifty Overs — client

The client is a **view + action submitter**. It reads server-owned state and
calls the validated `app.*` actions; it never computes results or squad state.

## Files
- `mp.js` — client integration module (pure, unit-tested):
  - `BUILD_HASH` — sha256 of the engine build this client ships with.
  - `guardBuildHash(leaguePin)` — **client-side hash-pin enforcement**: blocks
    multiplayer actions if the client's engine ≠ the league's pinned build.
  - `renderStandings`, `renderFixtures`, `renderVerifyBadge`, `esc` — pure renderers.
  - `makeApi({url, anonKey, getToken})` — thin REST client over Supabase/PostgREST
    (targets the `app` schema).
- `league.html` — the dashboard shell: connect (Supabase URL + anon key + JWT +
  league id), shows the hash-pin banner, league table, fixtures & results, and a
  founder panel.
- `tests/render.test.mjs` — pure render + hash-guard tests (`node client/tests/render.test.mjs`).

## Deterministic replay
The client watches a match by **re-resolving locally** from the stored server
inputs (squads + locked orders + conds + seed) using the same
`window.__resolveMatch` the resolver ran. Determinism guarantees it reproduces
the stored result byte-for-byte, so there is no live stream — and the same
mechanism powers result **verification** (`resolver/resolve.mjs → verifyResult`):
recompute, compare, flag any mismatch.

## Hosting note
`league.html` calls Supabase directly, so host it as a normal static file (not a
sandboxed artifact — a strict CSP would block the API calls). Update `BUILD_HASH`
in `mp.js` whenever the pinned engine file changes.
