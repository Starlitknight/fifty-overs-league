# Fifty Overs — a narrative cricket-management game

**Found a club. Play a career. Bring your friends.**

Fifty Overs is a solo-first cricket management game set in a persistent,
seeded England: ten clubs with named managers who select, scheme, trade and
get sacked; a real league and knockout cups where defeat is permanent;
promises, rivalries and a recurring cast (the Gaffer, Reggie Thorne, Priya
Raman, the club secretary, the local reporter) whose stories are built from
your actual scorecards. Every match — yours live in the match centre,
everyone else's headlessly — runs through the same deterministic engine.

**Play now:** https://starlitknight.github.io/fifty-overs-league/ — click
*Start a Solo Career*. No account needed; the career runs entirely in your
browser. Share your world seed with a friend and they start in the same
world; your decisions will still diverge.

Docs: `docs/emergent-world.md` (the career world), `docs/first-summer.md`
(the guided prologue and Lineup Room).

## Multiplayer (the bonus built on the same engine)

An invite-only multiplayer league built on top of the deterministic single-file
cricket sim (now maintained as source modules in `engine/src/`, assembled by
the build), **without rewriting the
game engine**. The server owns every outcome-determining fact; the client is a
view + an action submitter; official match results come only from a server-side
headless resolver running the *real* engine.

```
┌────────────┐   validated actions    ┌──────────────────────┐
│  client    │ ─────────────────────▶ │ Supabase (Postgres)  │
│ league.html│                        │  identity seam        │
│  mp.js     │ ◀───────────────────── │  RLS + app.* funcs    │
└────────────┘   server-owned state   │  standings view       │
      ▲                               └───────────┬──────────┘
      │ deterministic replay                      │ due matches
      │ (local re-resolve)                        ▼
      │                              ┌──────────────────────────┐
      └──────────────────────────── │ resolver container        │
        pinned engine (BUILD_HASH)  │ Playwright + real engine  │
                                    │ __resolveMatch (headless) │
                                    └──────────────────────────┘
```

## The trust boundary
- **Server owns**: squad state, match results, lock timing, standings, the draft.
- **Client submits** only validated actions (`sign_player`, `submit_orders`,
  `issue_challenge`, …). It never writes a result, its own ratings, or lock state.
- **Determinism is the anti-cheat**: a result is a pure function of
  `(homeSquad, awaySquad, homeOrders, awayOrders, {pitch, weather, seed})`. The
  engine has **no `Math.random`/`Date`** in the match path (verified). The client
  verifies any stored result by re-resolving from the same server inputs.
- **Engine-version pinning**: `BUILD_HASH = sha256(game file)` is stored on the
  league; the resolver aborts if its build ≠ the pin, and the client blocks
  actions if its build ≠ the pin.

## Layout
| path | what |
|---|---|
| `engine/shell.html` + `engine/src/*.js` | the game engine, as source modules (gameplay guarded by golden-master replays in `test/replay.test.mjs`) |
| `resolver/resolve-harness.js` | additive `window.__resolveMatch` entry point (no engine-logic edits) |
| `resolver/resolve.mjs` | headless engine caller (hash-pin check, resolve, `verifyResult`) |
| `resolver/worker.mjs` / `server.mjs` / `Dockerfile` | the resolver container |
| `supabase/migrations/*.sql` | schema, identity, actions, friendly, official, founder tools |
| `supabase/functions/` | Edge Functions + shared draft/schedule/identity |
| `client/mp.js` / `league.html` | dashboard + client-side hash-pin guard |

## Build phases (all checkpoints reached)
| phase | what | status |
|---|---|---|
| 0 | feasibility + determinism proof | ✅ engine extractable as a pure fn; byte-identical replays |
| 1 | schema + identity boundary + invite/founder + RLS | ✅ 24 tests |
| 2 | constrained-action API + snake-deal draft | ✅ 23 tests |
| 3 | friendly loop end-to-end (alpha gate) | ✅ 15 e2e |
| 4 | official double round-robin + resolver container + consequences + locks | ✅ 31 e2e |
| 5 | founder tools + standings UI + client hash-pin | ✅ 8 + 14 tests |

## Run everything
```bash
# DB + action logic (PGlite = real Postgres, no server needed)
cd supabase && npm install && npm test            # phases 1,2,5
npm run test:client                                # client render + hash guard

# end-to-end with the real engine (headless Chromium)
cd resolver && npm link playwright
cd ../supabase
npm run test:e2e                                   # phase 3 friendly
npm run test:official                              # phase 4 official
NODE_PATH=/opt/node22/lib/node_modules node ../resolver/proof/prove.mjs   # phase 0 determinism
```

### Follow-ups (done)
- **Season rollover**: `resolver/resolve.mjs → ageSquad` runs the engine's exact
  `seasonEnd` aging (age++, 31+ decline via `jsDerive`, retirement at 35+/32+),
  and `app.founder_advance_season` persists the aged rosters and bumps the season.
- **Timezone-correct fixtures**: `resolve_at` is computed server-side in
  `write_fixtures` from the league's `match_time` in its `tz` (verified: 17:00
  `America/New_York` → 21:00 UTC).

## What is NOT yet live-tested
The Edge Function TS and the resolver container runtime need a running Supabase +
deployed container to exercise end-to-end; their enforcement cores (the `app.*`
SQL and the resolve/store path) are fully tested here. See `supabase/README.md`
and `resolver/README.md` for details.

## Test totals
138 checks green: 24 identity/RLS · 23 actions/draft · 15 friendly e2e · 31
official e2e · 13 season/tz e2e · 8 founder/views · 14 client · 6 determinism · 4
real-pool deal.
