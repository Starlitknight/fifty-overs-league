# THE PYRAMID — the world's second great shape

The world becomes a pyramid: sixteen nations, each with sixteen clubs in two
divisions of eight, a national knockout cup, finals-week playoffs, and a
Champions Cup of the sixteen national champions. One season is 42 days — six
exact weeks — and one season is one year of a cricketer's life.

This document is the single authority for the build. Where code and this file
disagree, one of them is wrong on purpose and the tests say which.

## 1. The calendar — 42 days, six weeks, day 0 is always a Monday

`EPOCH = Date.UTC(2026, 7, 3)` — Monday 3 August 2026, world day 0, season 1
day 1. `CYCLE = 42`, so every season starts on a Monday and `di % 7` is the
weekday (0=Mon .. 6=Sun), forever.

The fourth week is the QUIET WEEK. It once belonged to the academies — the
Colts Cup over four days, see docs/ACADEMY.md — but the youth system is
retired for now (migration 075) and the whole week rests: seven scouting
days, no cricket. Weeks 1-3 are exactly as they were when a season was five
weeks: the same twelve league rounds on the same days, the same six tour
days, the same three FA Cup Sundays. Everything after the quiet week is the
old closing fortnight, one week later.

Day-in-season (di, 0-based) map:

| di | weekday | what plays |
|----|---------|------------|
| 0,1 | Mon,Tue | league rounds 1,2 |
| 2 | Wed | internationals (tour day 1) |
| 3,4 | Thu,Fri | league rounds 3,4 |
| 5 | Sat | internationals (tour day 2) |
| 6 | Sun | **FA Cup round of 16** |
| 7,8 | Mon,Tue | league rounds 5,6 |
| 9 | Wed | internationals (tour day 3) |
| 10,11 | Thu,Fri | league rounds 7,8 |
| 12 | Sat | internationals (tour day 4) |
| 13 | Sun | **FA Cup quarter-finals** |
| 14,15 | Mon,Tue | league rounds 9,10 |
| 16 | Wed | internationals (tour day 5) |
| 17,18 | Thu,Fri | league rounds 11,12 |
| 19 | Sat | internationals (tour day 6) |
| 20 | Sun | **FA Cup semi-finals** |
| 21-27 | Mon-Sun | **the quiet week** — rest all seven days (the Colts Cup played here before 075) |
| 28,29 | Mon,Tue | league rounds 13,14 (double round robin complete) |
| 30 | Wed | rest — the players breathe before finals |
| 31 | Thu | **league playoff semi-finals** (both divisions: 1v4, 2v3) |
| 32 | Fri | **league finals** — champions crowned, both divisions |
| 33 | Sat | rest |
| 34 | Sun | **FA Cup final** |
| 35,36,37 | Mon-Wed | **Champions Cup group rounds 1-3** (4 groups of 4) |
| 38 | Thu | **the turning of the year**: ageing, retirements, boys who reach 21 leaving, promotion & relegation — the season transition day |
| 39 | Fri | **Champions Cup quarter-finals** (top 2 per group) |
| 40 | Sat | **Champions Cup semi-finals** |
| 41 | Sun | **Champions Cup final** |

`ROUNDS = 14` (8 clubs, double round robin). Rounds 1-12 fall on
di ∈ {0,1,3,4} + 7·week for weeks 0..2; rounds 13 and 14 are di 28 and 29,
the far side of the quiet week. Playoffs are rounds 15 (semis) and 16 (final)
in the matches table; they never count toward the table.

International tour days are di {2,5,9,12,16,19} — the Wed/Sat of weeks 1-3.
Each robs the NEXT league round of its called-up men (rounds 3,5,7,9,11,13),
exactly the existing call-up law. The quiet week and finals week carry no
tours, so the finals are full-strength.

**REST DAYS** are the days the world stages no club cricket at all —
di {2,5,9,12,16,19,21,22,23,24,25,26,27,30,33}, fifteen of them since 075.
They are what the academies scout on, one recruit apiece, so the list must
stay a pure function of the calendar: `isRestDay(di)` derives it, and nothing
hardcodes the list.

## 2. Sixteen nations

The twelve ICC Full Members plus the four strongest Associates:
eng, aus, sub (India), pak, rsa, nzl, slk, afg, bgd, win, zim, ire
+ ned, sco, nep, usa.

CUT: **wal, ken, can** (their art, crests and flags stay on disk for a future
tier). Glamorgan joins England's Division Two — where Welsh cricket really
plays.

## 3. Two divisions of eight

Slots 0-15 are club identity, never reassigned. Division membership is
SEASONAL: the `seasons` row carries `divisions: {"1":[8 slots],"2":[8 slots]}`
and two schedules `schedule: {"1":[14 rounds],"2":[14 rounds]}`. Season 1:
div 1 = slots 0-7, div 2 = slots 8-15.

- Division One: slot 0 boss (str 1.20) + slots on ladder
  [1.04, 1.00, 0.97, 0.94, 0.91, 0.88, 0.85] shuffled per nation.
- Division Two: founding-cast small clubs on ladder
  [0.86, 0.83, 0.80, 0.78, 0.76, 0.74, 0.72, 0.70] shuffled per nation.
  Squad age profile: one Old Pro (35+, the captain-mentor), a spine of
  local lads, and raw kids — young, headroom-heavy.

CLAIMING: only slots 8-15 (the founding seats) are ever claimable; a human
FOUNDS a club in Division Two. A promoted human club keeps its manager and
its slot. Newcomer levelling targets the div-2 mid rung
(`HUMAN_STR = 0.78` × nation tier).

## 4. The championship

Rounds 1-14 build the table (points 2/1/0, run-difference tiebreak). Then:
- di 24: playoff semis per division — 1st v 4th, 2nd v 3rd (higher seed hosts).
- di 25: the final (higher seed hosts). Winner is **champion**; the table
  winner is recorded as **shield winner** on the honours board.
- Playoff matches bank as rounds 15/16 in `matches`; `computeLeague`
  reads only rounds ≤ 14 for the table.

PROMOTION & RELEGATION (applied when the next season's row is written, on/after
di 31): Division One's bottom two (table) swap with Division Two's table winner
+ playoff champion (if the same club, the beaten finalist takes the second
place).

## 5. The FA Cup (per nation, all 16 clubs)

Straight knockout on the four Sundays: R16 (di 6), QF (13), SF (20),
Final (27). THE DRAW IS A DRAW: `cupDraw` puts the surviving field into the
hat and shuffles it Fisher-Yates from one seed per stage,
`seedOf('fa|<nation>|s<season>|<stage>')`, then pairs it off. (It used to
SORT the field on each club's own hash, which is not the same thing at all -
FNV-1a barely moves when only the last character changes, so the field came
out near slot order and every tie was Division One v Division One or Two v
Two. Measured over 192 draws the shuffle now yields 4.21 cross-division ties
a round against a random expectation of 4.27.) Hosting: the LOWER-division
club hosts (giant-killing at the small ground, groundsman tilt live); same
division → first-drawn hosts. Managers' latest banked orders stand in;
bots play their doctrines. Banked in `cup_matches` with
`comp = 'fa:<nation>'`. The final is at the boss's ground (neutral showpiece,
slot 0, no tilt beyond the boss's own).

## 6. The Champions Cup (16 national champions)

Entrants: each nation's playoff CHAMPION (div 1). Seeded into 4 groups of 4
by the world rankings ladder (fallback NAT_STR order): pot logic — ranks
1-4 head groups A-D, then snake. Group rounds g1,g2,g3 on di 28-30 (single
round robin, one sits nobody — 4 teams = 2 matches per group per day).
Group table: points, then run difference. QF di 32 (A1vB2, B1vA2, C1vD2,
D1vC2), SF di 33 (winners cross), Final di 34. `comp='wcl'` in cup_matches
with stages g1,g2,g3,qf,sf,final.

## 7. Internationals

Six tour days a season (di 2,5,9,12,16,19). The existing machinery holds:
selectors name a fifteen per round, call-ups on window rounds rob the next
league round, tours play at 18:00 UTC, caps and results feed the nations
ladder. WINDOW_DAYS/WINDOWS remap to the six days above.

THE TOUR CALENDAR (nations.mjs seasonTourPlan): real cricket plays SERIES,
not all-nations-every-window. Half the world tours each season: eight
nations pair into FOUR best-of-three series, the other eight rest and tour
the following playable season. A series is played over three tour days, one
game per window — two series in the season's first half (windows before
rounds 3, 5, 7) and two in the second (rounds 9, 11, 13). The second nation
of each pair hosts ("A tour of B"). The draw is one Fisher-Yates over the
field on `intltours|c<cycle>`, where a cycle is two playable seasons — the
shuffle fixes both the pairings and which half of the world tours first;
the halves swap in the cycle's second season, so every nation tours exactly
once per cycle and its clubs lose their internationals for three rounds
every OTHER year, not six every year. World Cup seasons suspend the
rotation (they don't consume a playable slot). Squads are named once, for
the series' first game, and stand for all three; clubs are compensated per
man per robbed round. All three games are played, dead rubbers included,
and the server says the verdict ("X win the series 2-1"). The whole
calendar is served in the nations snapshot (`calendar`, `seriesLen`,
per-nation `tour` with `series`, and `nextTour` for a resting nation). An
odd-sized world simply leaves its odd nation resting.

THE WORLD CUP: every 4th season (season_no % 4 === 0), the tour days become
the World Cup — groups of 4 (same snake seeding off the nations ladder) on
di 2/5/9, QF di 12, SF di 16, Final di 19. `comp='wc'`. Non-WC seasons play
bilateral tours as today.

## 8. Storage — the almanack slims

Only the current round is ever replayed by a broadcast. On every tick, match
rows older than TWO rounds behind the freshest banked round of that nation
lose `result_canonical` and `living` (set NULL); `result` (the scorecard)
is forever. Cup matches likewise after their season ends.

## 9. What stays untouched

The engine itself (no ball-by-ball changes), conditions/doctrines/accents,
the living player, training, academy/colts, market, money, friendlies,
invitational comps, ratings, milestones, the Gazette, honours machinery
(new categories added, nothing removed).

## 10. Reseed

The new world is founded with `initWorld` under the new EPOCH: season 1,
start_day 0 = Monday 3 August 2026. Fresh generation; all claims released
(all prior clubs were div-1 seats that no longer accept claims).
