# Fifty Overs — a narrative cricket-management game

**Found a club. Play a career. Share a world.**

Fifty Overs is a cricket management game set in a persistent planet of nineteen
national leagues. You manage one club: you name it, pick its ground, train it,
sign and sell, build a stand, run an academy, and send out an XI. Everyone
else's matches — every club in every nation, every day — are played by the same
deterministic engine on a schedule, whether or not anybody is watching.

**Play:** https://starlitknight.github.io/fifty-overs-league/

The whole game is one self-contained page. There is nothing to install and no
account needed to look around; signing in claims a club and puts you on the
world's schedule.

## The two rules everything else follows

1. **One engine.** The match simulator exists once, in `engine/src/`. The
   browser runs it to show you your match; the World Service runs the *same
   shipped build* headlessly (`server/enginehost.mjs` loads `index.html` in a
   Node VM) to settle everyone else's. A served result and a played result can
   never disagree, because there is only one implementation.

2. **Nothing depends on being online.** Managers are human at times and bots at
   others, in every timezone. So every outcome is decided by state that was
   already banked — orders submitted before the lock, a training plan, an
   academy level — and never by who happened to have the game open. Standings,
   rankings, honours, money, careers and training are all recomputed from the
   stored record, from genesis, rather than re-simulated.

## Two worlds, one page

The same page is the client for **two independent backends**. They share the
Supabase project and the match engine and nothing else. Retiring or changing
either means checking the `rpc("…")` and `sel("…")` call sites in
`engine/src/league/**` first — the game speaks to both.

```
                    ┌──────────────┐
                    │  index.html  │   the game — client for both
                    └──┬────────┬──┘
        world_* RPC ───┘        └─── app.* RPC + league_* reads
                 │                                │
   ┌─────────────▼───────────┐      ┌─────────────▼────────────┐
   │  THE WORLD SERVICE      │      │  FRIENDS LEAGUES         │
   │  world schema           │      │  app schema              │
   │  19 national leagues    │      │  private invite leagues  │
   │  server/*.mjs           │      │  resolver/round.mjs      │
   │  world-tick.yml, hourly │      │  round-resolver.yml      │
   └─────────────────────────┘      └──────────────────────────┘
```

- **The World Service** is the persistent planet: claim a club through
  `#/worldclub` and it plays on a schedule with everyone else's.
- **Friends leagues** are the "play with friends" door on the landing screen:
  create a league, share an invite code, play your own season. Its umpire is
  `resolver/round.mjs` — it advances rounds and resolves human-vs-human
  challenge friendlies. Turn that workflow off and a friends league silently
  stops advancing.

### How the World Service runs

- **`server/`** is the umpire. `tick.mjs` settles everything that is due, for
  every nation, at that nation's own local hour — league rounds, cups, youth,
  training, wages and gate money, invitationals, international windows, the
  transfer market. It is idempotent: a late, doubled or killed run cannot
  corrupt the world, so cron throttling is harmless.
- **`server/migrations/*.sql`** define the `world_*` views and `SECURITY
  DEFINER` functions that the page reads and writes through. Migrations apply
  themselves on the next tick. **A file that has already been applied must never
  be edited** — its checksum is recorded, and a change is a hard error.
  Corrections ship as a new file.
- **`.github/workflows/world-tick.yml`** runs the tick every hour.

Ops detail lives in `server/RUNBOOK.md`; the design laws in `BLUEPRINT.md`; the
roadmap and what has been built in `VISION.md`.

## Repository structure

GitHub Pages serves the committed root files directly, so a few paths are
**pinned** — they cannot move without taking the live site down.

```
fifty-overs-league/
├── index.html            🔒 DEPLOYED — the live page (generated; Pages entry point)
├── version.json          🔒 DEPLOYED — build stamp; the game polls it to offer updates
├── build.sh              🔒 assembler: engine/src → index.html + client/game.html
├── client/               🔒 DEPLOYED
│   ├── game.html            second stable entry (byte-identical to index.html)
│   ├── art/                 every shipped webp — players, grounds, cities, flags, crests
│   └── fonts/               the woff2 faces the page inlines
│
├── engine/               ★ SOURCE OF TRUTH — the whole game lives here
│   ├── shell.html           page skeleton with one marker per engine block
│   ├── calibration-golden.json  the frozen behaviour the engine must reproduce
│   └── src/
│       ├── 00..12-*.js      core simulation + base UI (manifest.txt sets the order)
│       ├── league/          domain layer, one closure: auth, club home, sync,
│       │                    onboarding, orders, matchday, squad, academy,
│       │                    finance, market, nations, invitationals, ratings
│       ├── presentation/    oval stage, smooth renderer, boot (one IIFE)
│       ├── skin/            login / modal / brand CSS
│       └── world/           the baked living-world snapshot generator
│
├── server/               the World Service — the umpire and its schema
│   ├── tick.mjs             settles everything due, every nation
│   ├── enginehost.mjs       runs the shipped index.html headlessly in a Node VM
│   ├── migrations/*.sql     the world schema + the world_* API
│   └── tests/               node --test tests/
│
├── test/                 🔒 golden-master replays — the built page must reproduce
│                            recorded ball-by-ball logs bit-for-bit (CI gate)
├── tools/                re-bless masters · balance gate · calibration · snapshot
├── resolver/             friends-league umpire: headless real-engine round
│                            resolver + challenge friendlies (round.mjs)
├── supabase/             the app schema behind friends leagues + cloud saves
│                            — see supabase/README.md
├── docs/                 engine tuning notes + historical design prompts
│
├── art-packs/            🚫 git-ignored — RAW art uploads and "master" folders.
│                            NOT shipped; the game loads only the derived
│                            client/art/*.webp.
└── .github/workflows/    ci-pages.yml (build + test + deploy) ·
                          world-tick.yml (World Service umpire, hourly) ·
                          round-resolver.yml (friends-league umpire) ·
                          calibration.yml (engine freeze gate) ·
                          world-admin.yml / world-report.yml (owner tools)
```

🔒 pinned (Pages/CI depend on the path) · ★ edit here · 🚫 not tracked

## Working on it

```bash
./build.sh                          # engine/src → index.html + client/game.html
node --test test/*.test.mjs         # 41 — engine, replays, rain, orders, world
cd server && node --test tests/     # the World Service against a local Postgres
node tools/calibration-check.mjs    # the engine-freeze gate CI runs

# the friends-league database, on real Postgres in-process (PGlite):
cd supabase && NODE_PATH=/opt/node22/lib/node_modules node tests/run.mjs
#   ... and the relational spine — the SQL league table against the engine's own,
#       and the umpire's dual write against a real played season:
node tests/run_phase13_relational.mjs   # game.standings == leagueRows()
node tests/run_phase1b_publish.mjs      # resolver/publish.mjs, round by round
```

Never edit `index.html` or `client/game.html` by hand — they are generated from
`engine/src/**` by `build.sh`, which must be run from the repository root. Art:
drop a source pack in `art-packs/` (ignored), convert to `client/art/*.webp`,
and register it in the engine source.

Two safety nets guard gameplay. `test/replay.test.mjs` holds the built page to
recorded ball-by-ball logs bit-for-bit, and `tools/calibration-check.mjs` fails
if the engine's aggregate behaviour drifts from `engine/calibration-golden.json`.
If you meant to change the engine, re-bless them deliberately; if you did not,
they have caught something.
