# Fifty Overs — Multiplayer League

An invite-only multiplayer league built on top of the deterministic single-file
cricket sim `Fifty_Overs_Club_Manager_2026_v11_6.html`, **without rewriting the
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
| `Fifty_Overs_Club_Manager_2026_v11_6.html` | the pinned game engine (unmodified) |
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

## What is NOT yet live-tested
The Edge Function TS and the resolver container runtime need a running Supabase +
deployed container to exercise end-to-end; their enforcement cores (the `app.*`
SQL and the resolve/store path) are fully tested here. Season-boundary
consequences (aging/experience) and league-local timezone handling for
`resolve_at` are noted as follow-ups. See `supabase/README.md` and
`resolver/README.md` for details.
