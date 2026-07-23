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

- **The shared world *is* the game — no solo mode.** An account and a place in
  the world are required to play. (One offline try-out match for a brand-new
  visitor is the most we'd consider; there is no standalone solo career.)
- **Fixed 8-team leagues, one per region. No pyramid yet.** Each region league is
  the region **boss (permanent) + up to 7 humans, bots filling the rest**. As
  humans join, they replace bots. A region is **full at 7 humans**; a newcomer
  who picks a full nation is asked to pick another. The boss slot is never lost.
  (The division pyramid comes only when regions routinely fill.)
- **Format: double round-robin (home & away) = 14 rounds.**
- **The calendar alternates, both competitions running at once.** A **30-day
  season**: 28 match days that **alternate league / Champions Cup** (league on
  even days, cup on odd), then a **2-day break** (rollover: ageing, ceremonies).
  → 14 league days + 14 cup days + 2. ~12 seasons a year (deliberately fast for
  launch; trivially slowed later).
- **The Champions Cup — 20 teams (19 nations' entrants + Thorne):**
  - **Group stage:** four groups of five, drawn randomly (deterministically) each
    season; **single round-robin** (10 matches/group, 40 total, 5 rounds).
  - **Knockouts:** top two per group advance (8) → **quarter-finals → semi-finals
    → 3rd-place play-off → final.** 9 match-rounds; the 14 cup days carry them
    with rest days the Wire uses to build hype, the **final on the last match day.**
  - **Qualification is by *last* season's league:** a season's Cup features the
    **previous season's 19 league winners + Thorne** (season 0 seeds the 19
    bosses). So **winning your league books next season's Champions Cup** — that
    is the monumental prize, and a human first appears in the Cup the season after
    they win their region.
- The **boss plays the league nerfed** (holds his best XI back) and is at **full
  strength only in the Champions Cup**. Beatable in the league, brutal in the Cup.
- **Thorne beats every AI team in every Cup match — group stage included.** He
  wins every Cup until a **human** knocks him out. Runner-up and third vary.
- **Match model:** set orders before the daily lock → your fixture **auto-resolves
  at match hour whether or not you are online**; if you are online you **watch it
  live in the theatre**, otherwise you get the **replay + post-match stats**. You
  never miss a match.
- Your club joins the **region of the nation you choose** at club creation.

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
