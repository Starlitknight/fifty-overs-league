# The Emergent Cricket World — England career, v1

The First Summer is no longer a fixed ten-chapter ladder. After the guided
prologue, the player enters a **persistent, seeded England season**: ten
clubs with named managers and full rosters, a nine-round league, the
Founders Cup (open knockout, persisted seeded draw), and the Crown Cup
(entry earned by finishing top-four — the player can miss it). Everyone
else's fixtures are played headlessly **through the real match engine**
(`__foGame.simWorld`, the engine's own `newMatch`/`autoPick`/`stepBall`
loop) — no fake scorelines anywhere.

## How to start / resume / share

- **Start**: play the prologue (nav → *The First Summer*). When it ends, the
  career begins automatically: a world seed is generated, ten clubs and a
  fixture calendar are created, and the Season Hub replaces the chapter rail
  at `#/summer`.
- **Play a week**: the hub shows exactly one primary action — play your
  fixture (Lineup Room → live match centre) or advance the week. Advancing
  resolves every other fixture through the real engine, then injuries,
  finances, development ticks, NPC manager decisions and transfers.
- **Resume**: return to `#/summer`. The Gaffer's brief says what changed;
  the save (`fo_career_*`, versioned v2) survives reloads.
- **Share a seed**: Seed & Save tab — copy the seed; a friend entering the
  same world sees the same clubs, rosters and draws, then diverges through
  their own decisions. Full career export/import lives in the same tab.
- **Reset**: Seed & Save tab — the old career is archived, never deleted.

## Losing is permanent

League defeats stand. A cup defeat eliminates the club for the edition
(`out` list, no rematch fixture). Missing the top four means no Crown Cup
that season. There is no boss checkpoint. Seasons end in honest outcomes —
champions, secured status, a final warning, insolvency or dismissal — and a
dismissed manager chooses between a final-warning season (reputation cost)
or ending the career with the record intact.

## Architecture (client/src/, all headless-testable, none in the overlay)

| Module | Job |
| --- | --- |
| `core/rng.js` | serialisable seeded RNG with independent named streams (worldgen, weather, injuries, development, transfers, cupdraw, managers, storylets, newplayers) — drawing from one never shifts another |
| `core/calendar.js` | the 15-week season shape |
| `core/save2.js` | canonical v2 career save + v1 migration (archives originals, consolidates `fo_story_*`/`fo_cx_*`), export/import |
| `world/model.js` | minted immutable ids (players/managers/clubs/fixtures/transfers); names are display data |
| `world/generator.js` | seeded world: 10 clubs, trait-profiled managers (incl. Thorne and peer manager Priya Raman rebuilding Fenholt), engine-compatible rosters, contracts, league fixtures, Founders play-in draw; five international managers exist beyond England |
| `world/competitions.js` | table/points/NRR (all-out = 50 overs), cup progression, earned Crown entry |
| `world/managers.js` | utility + bounded seeded variation: tactic shifts, captain changes, mood, job security, board reviews with recorded reasons |
| `world/transfers.js` | valuations, NPC↔NPC market, offers for user players, full departure records |
| `world/simulator.js` | the weekly tick + season end + rollover (ageing, contracts, new draws) |
| `rivalries/ledger.js` | rivalries earned from close finishes, cup KOs, finals, transfers; emerge/recognise/escalate/cool events |
| `story/storylets.js` | conditional storylets + attention director (caps, rotation, cooldowns, quiet weeks; controls attention, never outcomes) |
| `story/content/england.js` | the England pack: openers, conditions, prospect ask, captain form + both-ways callback, setback, being-studied, headlines, Thorne notice, shuffled Gaffer–Thorne clue thread, peer milestones, transfer offers, emergent talent |
| `features/career.js` | glue: begin/resume, storylet api over real save facts, live user fixtures, promises via confirmed lineups, honest season outcomes |
| `features/career-hub.js` | the Season Hub UI (tabs: Season/Table/Cups/World/Rivalries/History/Seed & Save) |

## Seeded uncertainty

One world seed, persisted; every stream stores its own uint32 state in the
save, so reload reproduces exactly, cup draws can never be rerolled by
refreshing, and adding a storylet roll cannot change a draw (unit-tested).
Injury risk is age-weighted and telegraphed in news; development responds to
age; transfers follow money, ambition and willingness to sell. Career
simulation never touches `Math.random()`.

## Emergence, honestly stated

- Arthur Vale is no longer a scripted event: ~60% of worlds host an
  emergent young talent at a random club (occasionally named Vale), noticed
  only through real run-scoring; many careers never meet him.
- The Gaffer–Thorne clues arrive in a per-career shuffled order and are
  never guaranteed to complete.
- The peer manager's club is simulated like any other: she can top the
  table, crash out of the cup, or beat you to a trophy.
- Former players (sold via accepted offers, or NPC↔NPC moves) keep their id
  and career stats and stay fully simulated at their new club.

## Balance findings (6 real-engine AI seasons, `resolver/_harness.mjs`)

- Roster quality tracks outcomes: mean rank displacement between generation
  quality and final position ≈ 0.67 places — management/quality beats luck
  over a season, luck still decides individual weeks (a 215–214 NPC
  thriller occurred in round 1 of the probe world).
- Champions and both cup winners varied across seeds; Thorne's club missed
  the Crown Cup entirely in one world and won nothing in others.
- No abandoned fixtures, no negative NPC banks, 12–15 transfers and 5–11
  injuries per season.
- Finding: the user's own squad (AI-managed in the harness) won 4/6
  leagues — the drafted starter squad is top-tier for this league. Season
  goals (top-6 + solvency) are correspondingly achievable; difficulty
  tuning is a follow-up knob (opponent mults).

## Known limitations (v1)

- Dismissal offers a final-warning season or ending the career; managing a
  *different* club is not yet supported (the engine binds the user to one
  squad). Documented follow-up.
- Selling user players is gated to solo/practice contexts — in a live
  multiplayer league the board "parks the bid", because the squad is shared
  with multiplayer and solo choices must never change multiplayer strength.
- Batter-vs-bowler duel data is limited to innings-level records (the
  engine does not expose per-ball head-to-heads to the overlay).
- International play: the five overseas managers exist as world figures
  (region packs and tours are Phase 4 and not claimed as complete).
- NPC caps count fielded fixtures, not verified XI membership.
- The user club plays every league round even while cup-alive (single
  fixture per week for the user; NPC cup weeks run parallel).
