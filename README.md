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

## Repository structure

The tree is grouped by role. A few paths are **pinned** — GitHub Pages serves
the committed root files directly, and CI/automation hardcode certain paths —
so they cannot move without breaking the live site or the season resolver.
Those are flagged below.

```
fifty-overs-league/
├── index.html            🔒 DEPLOYED — the live page (built; Pages entry point)
├── version.json          🔒 DEPLOYED — build stamp; the game polls it to offer updates
├── build.sh              🔒 assembler: engine/src → index.html + client/game.html
├── client/               🔒 DEPLOYED
│   ├── game.html            second stable entry (identical to index.html)
│   └── art/                 all shipped webp — players, grounds, cities, flags, crests
│
├── engine/               ★ SOURCE OF TRUTH — the whole game lives here
│   ├── shell.html           page skeleton with one marker per engine block
│   └── src/
│       ├── 00..12-*.js      core simulation + base UI (manifest.txt = order)
│       ├── league/          domain layer, one closure: auth, club-home, sync,
│       │                    onboarding, training, market, orders, matchday-centre,
│       │                    squad-matchlab, office, chronicle, scorecard-analysis
│       ├── presentation/    oval stage, smooth renderer, boot (one IIFE)
│       └── skin/            login / modal / brand CSS
│
├── test/                 🔒 golden-master replays — the built page must reproduce
│                            recorded ball-by-ball logs bit-for-bit (CI gate)
├── tools/                re-bless masters (record-masters.mjs) + balance gate (engine-bench.mjs)
│
├── resolver/             🔒 backend: headless real-engine match resolver
│                            (round.mjs is the scheduled season worker)
├── supabase/             🔒 backend: Postgres schema, RLS, Edge Functions, tests
│
├── docs/                 engine-tuning notes, build prompt
├── finance-config.json   reference source-of-truth for the finance constants
│                            (values are embedded into the engine at authoring time)
│
├── art-packs/            🚫 git-ignored — RAW art uploads + "master" folders.
│                            NOT shipped; the game only loads the derived
│                            client/art/*.webp. Recoverable from git history.
└── .github/workflows/    ci-pages.yml (build+test+deploy) · round-resolver.yml (season)
```

🔒 pinned (Pages/CI/automation depend on the path)  ·  ★ edit here  ·  🚫 not tracked

### Multiplayer backend map (same engine, server-owned)
| path | what |
|---|---|
| `resolver/resolve-harness.js` | additive `window.__resolveMatch` entry point (no engine-logic edits) |
| `resolver/resolve.mjs` | headless engine caller (hash-pin check, resolve, `verifyResult`) |
| `resolver/worker.mjs` / `server.mjs` / `round.mjs` / `Dockerfile` | the resolver container + scheduled season worker |
| `supabase/migrations/*.sql` | schema, identity, actions, friendly, official, founder tools |
| `supabase/functions/` | Edge Functions + shared draft/schedule/identity |
| `client/mp.js` / `league.html` | dashboard + client-side hash-pin guard |

## Working on it

```bash
./build.sh                      # engine/src → index.html + client/game.html
node --test test/*.test.mjs     # golden-master replays (gameplay must stay bit-identical)
```

Never edit `index.html` / `client/game.html` by hand — they are generated. Change
`engine/src/**`, then rebuild. Art: drop a source pack in `art-packs/` (ignored),
convert to `client/art/*.webp`, and register it in the engine source.

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
