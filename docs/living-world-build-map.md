# Fifty Overs — The Living World

A build map for the persistent, shared, ageing cricket world. This is the
blueprint the phased build follows; it is a living document.

## The vision, in one paragraph

One canonical, persistent cricket world running on a real 24-hour clock.
Nineteen nations, each with a league of region-styled clubs; the region bosses
plus Reggie Thorne contest a season-ending **Champions Cup** that Thorne cannot
lose to AI. A human joins a region, climbs its league on the daily clock, and —
by *winning* it — takes that boss's place in the Cup, the single most monumental
thing they can do. The world ages every season (players and characters grow old,
legends retire, regions pass to successors) and it *talks* — a world news feed
("the Wire") and home-page art dramatise the day's real results. **Bots fill
every seat from day one and are replaced by humans one victory at a time**, so
the world is never empty and the first human ever to beat Thorne becomes that
world's founding legend.

## Locked decisions (v1)

- **One league per region** now; a **pyramid of divisions** is added per region
  only when it outgrows a single tier.
- **<100 players in year one.** Leagues are **variable-size**: a region's league
  holds every human who picks it, plus bots up to a **floor of 8**. England may
  be a 15-team league, Kenya an 8-team (mostly bots). No slots, no waiting.
- **24-hour real clock.** One fixture-round resolves per real day at a fixed
  **match hour** (the world's heartbeat). Season ≈ **3 weeks**: ~2 weeks regular
  league + ~1 week Champions Cup + a rollover day (ageing, ceremonies) → next
  season. ~17 seasons a year.
- **8-team floor, double round-robin (home & away).**
- The **boss plays the league nerfed** (holding his best XI back) and appears at
  **full strength only in the Champions Cup**. Beatable in the league, brutal in
  the Cup. Scouting his B-team via friendlies reveals who he holds back.
- **Thorne is unbeatable by AI in the Cup.** Only a human can end his reign.
  Until then he wins every year; runner-up and third vary.
- Your club joins the **region of the nation you choose** at club creation.

### Deferred to Phase 1 (do not block Phase 0)

- **Match model** — leaning: set orders before the daily lock → resolve at match
  hour → **watch live in the theatre if online, else auto-resolve + replay**.
- **Solo survival** — leaning: keep a **solo/offline sandbox**, but the real game
  (a place in the world, leagues, the Cup, your name in the Wire) requires
  signing in and joining the canonical world.

## Architecture spine

The whole thing rests on one property the engine already has: **matches are a
pure function of their inputs — no `Math.random`, no `Date` in the match path.**

- **Deterministic bot baseline.** The entire bot world — every league fixture and
  result, the full Champions Cup, season-by-season ageing — is a pure function of
  `(worldSeed, date)`. It is cheap to compute and *identical for every player*, so
  it is **canonical by construction** without a live shared simulation.
- **Server-persisted divergences only.** The only thing stored authoritatively is
  what humans *change*: joining a league, a human match result, a league a human
  wins, achievements. The canonical world = **deterministic baseline + persisted
  human deltas.**
- **Cheap compute.** Bot-vs-bot matches run as **pure Node** (milliseconds), not
  in headless Chromium. Playwright + the hash-pin exist only to *verify*
  human-submitted results (the anti-cheat), so cost scales with active humans, not
  world size. Simulating the whole bot world daily is effectively free.
- **Substrate reuse (already built):** Supabase/Postgres (authoritative state,
  RLS, `app.*` action API, standings views); the headless resolver + cron (the
  daily tick); the deterministic engine; `FO_CX_REGIONS` (region/boss config);
  the chronicle engine (ageing → legends); `foStScan` (fact-mining → the Wire).

## Data model (additive to the existing schema)

- **world_state** — `world_seed, epoch_date, current_day, current_season, phase
  (regular|cup|rollover)`.
- **regions** — seeded from `FO_CX_REGIONS`: `id, name, boss_team_id, arch,
  accent`.
- **teams** — `id, region_id, kind (bot|boss|human|thorne), name, owner_user_id,
  strength`. Bots/boss/Thorne deterministic from seed; human teams persisted.
- **players** — `id, team_id, name, age, role, skills, phase
  (prospect|rising|peak|veteran|twilight), retired_at`. Ages tick each season.
- **seasons** — `number, started_on, league_start/end, cup_start/end`.
- **fixtures** — `season_id, competition (region_league|champions_cup),
  region_id, round, home_team_id, away_team_id, scheduled_day, status`.
- **results** — `fixture_id, home_score, away_score, winner_team_id, scorecard,
  drama (key moments), resolved_at, deterministic`.
- **standings** — view over results, per league.
- **cup_bracket** — `season_id, round, slot, team_id, advanced`.
- **registrations** — `user_id, team_id, region_id, joined_season`.
- **wire_events** — `day, kind, region_id, team_ids, headline, body,
  art_panel_key, importance`.
- **hall_of_champions / almanac** — `season, cup_winner, runner_up, third,
  first_human_to_beat_thorne`.
- **achievements** — `user_id, kind (league_won|entered_cup|beat_thorne|…),
  season, detail`.

## The daily tick (cron at match hour; idempotent + deterministic)

1. Advance `current_day`; set `phase` (regular league / cup / rollover).
2. Resolve each fixture due today:
   - **bot-vs-bot** → pure-Node engine from `(seed, fixture)`; store result.
   - **human-involved** → played-live result (verified) if the human was online,
     else auto-resolve from their submitted orders / defaults.
3. Recompute standings / advance the Cup bracket (Thorne always advances vs AI).
4. Mine the day's results → `wire_events` (headlines, drama, `art_panel_key`).
5. **On the rollover day:** age every player (+1 year, 31+ decline, retirement at
   35+/32+); retire legends → museum; promote each league winner into next
   season's Cup field; regenerate bots for retirees; open the new season. Stamp
   the almanac.

Idempotent + deterministic so a re-run, or a catch-up after a missed tick,
reproduces the identical world.

## Phases

- **Phase 0 — The living bot world (no humans).** World clock + 19 deterministic
  leagues + the Champions Cup (Thorne reigns) + season ageing/rollover + a first
  Wire, all followable in-client. Ships the *feeling* of a living world before a
  single human or server row exists. This is the foundation everything bolts to.
- **Phase 1 — Your place in it.** Accounts + registration; your club joins your
  region's league; the daily orders→resolve→watch/auto loop; climb the shared
  table; win it → enter the Cup vs the full-strength cast + Thorne. *(Resolve the
  two deferred decisions here.)*
- **Phase 2 — The world talks.** Wire + home-page art react to real daily results
  (yours and the world's); boss feuds surface from actual Cup fixtures; ageing &
  succession dramatised; the Almanac / Hall of Champions.
- **Phase 3 — Canonical sharing at scale.** Fully server-authoritative for all;
  human achievements broadcast globally ("a human beat Thorne"); friendlies
  (human-vs-human, human-vs-boss B-team); anti-collusion.
- **Phase 4 — The division pyramid + ops hardening**, when leagues outgrow one
  tier.

## Art taxonomy (target 100–150 panels)

Bucketed so the budget is spent deliberately. Each keys off
`wire_event.art_panel_key` and the club-home wallpaper rotation.

- **Champions Cup drama (~25):** bracket reveal, semis, the Final, Thorne lifting
  the Cup, a human dethroning him, marquee upsets.
- **Region flavour (~19–38):** 1–2 per nation — a league title clinched, the boss
  in his pomp, the ground under lights.
- **Boss feuds & succession (~15):** two bosses colliding, a rivalry headline, the
  torch passed when a boss retires.
- **Your club's saga (~25):** founding, first title, a legend's landmark cap, a
  retirement, a bogey broken, entering the Cup.
- **Time & season (~15):** the seasonal light arc, the rollover ceremony,
  anniversary photos on the clubroom wall, an ageing veteran.
- **The Wire itself (~10):** mastheads/scene panels, "extra edition" for world
  events.

## Immediate next step

Build **Phase 0's spine**: the world clock + the deterministic league/Cup
timeline + a first Wire, viewable in-client. Everything else layers on this.
