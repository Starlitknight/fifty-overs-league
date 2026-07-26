# Fifty Overs — World Blueprint (v1, 26 Jul 2026)

The engineering plan for the settled vision (see VISION.md). Decisions locked
by the owner: **one global world · full match engine everywhere · fresh
Season 1 at launch · AI national selectors now, elected managers later ·
infrastructure chosen purely on quality ("whatever it takes")**.

---

## 1. Architecture: the World Service

One global world needs one source of truth. The client stays a static site
(GitHub Pages); a **World Service** owns the universe.

- **Runtime**: a small Node service (Fly.io / Railway / a $10 VPS) running the
  SAME engine code the client ships (engine/src is already extracted into
  modules — the headless adapter from the "emergent world" work is the seed).
  One repo, one engine, two runtimes. Deterministic seeds remain the law: the
  server *schedules and persists*, but any client can re-derive any match
  from its seed for replays/Time Machine.
- **Storage**: Postgres (the existing Supabase project graduates to this
  role): `worlds, countries, clubs, managers, players, seasons, rounds,
  matches (seed, orders_home, orders_away, result blob), transfers,
  callups, standings, trophies, news`.
- **The tick**: a cron ("the umpire") wakes at each nation's hour, gathers
  saved orders (defaults for silent clubs), runs the engine, writes results,
  regenerates standings + wire, then sleeps. Cup days and international
  windows are just other entries in the same calendar table.
- **Client contract**: a read API (`/world/today`, `/league/:country`,
  `/match/:id`, `/club/:id`, `/almanack`) plus a write API (orders, pitch
  doctrine, transfers, signup/claim-club). Client caches aggressively;
  everything renders offline from the last snapshot + deterministic re-sims.
- **Live windows**: no websockets needed — a match's ball-by-ball is derivable
  client-side from its seed once orders are frozen at start-of-window, so
  "watching live" is a deterministic replay paced to the wall clock (already
  how MATCHDAY LIVE works). The server only reveals the seed at window open.
  Absent managers lose nothing; watchers get broadcast.

## 2. The world model

- 19 countries × 1 league × 10 clubs = 190 clubs. Slot 0 of each league is
  the **boss club** (existing cast: Pemberley, Thorne's lieutenants…) —
  never claimable. Slots 1–9 start as bot clubs with painted-city identities
  and generated squads (existing generators).
- **Joining**: a new manager picks a country → claims a bot club → renames
  and re-crests it → inherits its squad, ground, bank. Leaving/50-day
  inactivity returns the club to bot control (FTP rule).
- **Calendar** (already live client-side, moves server-side): 25-day season —
  18 league rounds (double RR), honours day, draw day, 4 cup days, rest day.
  Staggered national hours (England 14:00 UTC). International windows occupy
  fixed rounds (FTP-style weeks 5/8/11 pattern → our days 5, 9, 13).
- **Champions League**: after honours day, the 19 champion clubs (byes for
  top seeds to make 16) play the knockout on cup days. The nations World Cup
  moves to the off-season block between seasons (2 extra rest days become its
  final if needed — calendar v3 extends the cycle to 28 days: 18 rounds +
  honours + draw + 4 CL days + 3 WC days + rest).
- **National teams**: after each round, AI selectors rank every eligible
  player (by nationality, current form, engine ratings). During windows the
  selected XV are locked out of club selection; clubs auto-receive $50k/$20k.
  Tours are engine matches between national XIs. Elections ship in phase 6.

## 3. Phases

**P0 — Matchday page** (client-only, ships this week)
`#/matchday?r=N`: pitch/weather one-liners, head-to-head, probable XIs,
win %, pundit banter. Doors: home CTA + fixture rows. (Owner's named
weakest link; no server dependency.)

**P1 — World Service skeleton** (1–2 sessions)
Stand up the service + DB; port the headless engine adapter; nightly tick
runs ONE country (England) with bot orders; client reads `/world/today`
behind a feature flag. Golden-master tests: server result == client re-sim
from same seed, byte for byte.

**P2 — Full planet on the engine** (1–2 sessions)
All 19 leagues engine-run on the staggered clock. Client planet/almanack/
record books switch from seeded sims to served results (same shapes — the
snapshot override pattern means pages barely change). Persistent squads,
aging, form/fatigue server-side.

**P3 — The joinable world, Season 1** (2–3 sessions)
Accounts, claim-a-club flow, orders API (reusing the existing orders UI +
packets), transfers as FTP-style auctions between clubs, the fresh-world
launch ceremony. Owner's current save retires with honour (its almanack
archived read-only). Old SYNC leagues sunset.

**P4 — Champions League + trophies** (1 session)
Champion-club knockout on cup days; end-of-season trophy categories
(runs/wickets/averages/SR/dismissals), trophy cabinet, hall of fame;
club + global rankings from rolling ratings.

**P5 — National teams + World Cup** (1–2 sessions)
AI selection, availability locks, compensation, tours in windows,
off-season nations World Cup wired to real national squads (the owner's
players genuinely selected).

**P6 — FTP-parity depth** (ongoing waves)
Per-player N/D/A batting & bowling tactics + spells + toss + captain +
default orders; experience/energy/triggered-talent commentary; youth squad
& academies + youth competition; economy (attendance/supporters/stadium/
sponsorship/debt); match ratings page; organised friendly comps; elected
national managers; newspaper (world round-up + lore features) and the
stats universe ride alongside every phase.

## 4. Laws that never bend
1. Determinism: every match reproducible from (seed, orders). The server
   schedules; it never invents.
2. Offline fairness: absence costs nothing mechanical — defaults play,
   compensation pays, windows resolve.
3. One engine: server and client build from the same engine/src modules.
4. The art is sacred: painted world, daylight UI, navy masthead, no sound.
5. History is forever: results, records and retired names are never
   rewritten — the almanack only grows.
