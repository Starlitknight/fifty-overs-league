// clock.mjs — the world calendar, server-side, injectable time throughout.
// Mirrors the shipped client calendar (engine/src/league/27-living-planet.js):
// same epoch, same 42-day cycle, same 14 rounds, same national hours.
export const EPOCH = Date.UTC(2026, 7, 3);    // MONDAY 3 August 2026 = world day 0, season 1 day 1
export const DAY = 86400000;
// ---------------------------------------------------------------------------
//  THE 42-DAY SEASON — SIX EXACT WEEKS (docs/PYRAMID.md is the authority)
//
//  Day 0 is always a Monday: CYCLE is 42, so di % 7 IS the weekday, forever.
//  A season is one year of a cricketer's life.
//
//  Weeks 1-3 are untouched from the five-week season that preceded this one:
//  league rounds 1-12 on the same days, the same six tour days, the FA Cup on
//  the same three Sundays. What the sixth week bought is WEEK 4 - the boys get
//  a week of the calendar to themselves, and the league pauses while they have
//  it. Everything after Colts Week is the old closing fortnight, a week later.
//
//    di      weekday   what plays
//    0  1    Mon Tue   league rounds 1-2        (both divisions)
//    2       Wed       internationals, tour day
//    3  4    Thu Fri   league rounds 3-4
//    5       Sat       internationals, tour day
//    6       Sun       FA CUP round of 16
//    7  8    Mon Tue   league rounds 5-6
//    9       Wed       internationals
//    10 11   Thu Fri   league rounds 7-8
//    12      Sat       internationals
//    13      Sun       FA CUP quarter-finals
//    14 15   Mon Tue   league rounds 9-10
//    16      Wed       internationals
//    17 18   Thu Fri   league rounds 11-12
//    19      Sat       internationals
//    20      Sun       FA CUP semi-finals
//   --- THE QUIET WEEK: the league stands down and the scouts go out ---
//    21-27   Mon-Sun   rest all week (the Colts Cup played here once,
//                      and will again some day - see docs/ACADEMY.md)
//   --- and the league comes back for its last two rounds ---
//    28 29   Mon Tue   league rounds 13-14 — the double round robin complete
//    30      Wed       rest: the players breathe before finals
//    31      Thu       LEAGUE PLAYOFF SEMIS (1v4, 2v3, both divisions)
//    32      Fri       THE LEAGUE FINALS — champions crowned
//    33      Sat       rest
//    34      Sun       THE FA CUP FINAL
//    35-37   Mon-Wed   CHAMPIONS CUP group rounds 1-3 (4 groups of 4)
//    38      Thu       THE TURNING OF THE YEAR — ageing, youth, promotion & relegation
//    39      Fri       Champions Cup quarter-finals
//    40      Sat       Champions Cup semi-finals
//    41      Sun       THE CHAMPIONS CUP FINAL
//
//  NOTHING ANYWHERE MAY ASSUME round === day + 1. The functions below are the
//  only place the day<->round mapping lives - server and client both.
// ---------------------------------------------------------------------------
export const CYCLE = 42;                      // days in a season = one year
export const ROUNDS = 14;                     // eight clubs, double round robin
// ---------------------------------------------------------------------------
//  A SEASON HAS TWO NAMES, AND ONLY ONE OF THEM GOES ON A PAGE.
//
//  `seasons.season_no` counts from 1 because the umpire founded this world on
//  3 August 2026 and that was the first season IT played. The game does not
//  say that anywhere: the record behind the live world runs from 1890 to 2025,
//  a hundred and thirty-six seasons of it, and every surface in the client
//  names the live season by carrying straight on from the record - so the
//  header reads SEASON 137 while the row underneath it says 1.
//
//  This is not two worlds. It is one world with an internal index and a public
//  name, and anything the reader sees must use the name. The Gazette printed
//  the index for one day and it read as a second, contradictory calendar sat
//  under the app's own header.
//
//  136 is `__foPlanet.histSeasons()` in the shipped build - the number of
//  seasons in the baked record, which is a property of the DATA and would move
//  if the record ever grew. It is a constant here rather than a read of the
//  engine because the press must be able to date an issue without booting a VM;
//  tests/the-world-has-one-calendar.test.mjs holds it against the real build,
//  so if the record grows this fails loudly instead of quietly misdating the
//  paper by a season.
// ---------------------------------------------------------------------------
export const HERITAGE_SEASONS = 136;
export function seasonName(n) { return HERITAGE_SEASONS + Math.max(1, n | 0); }
export const WEEK_ROUNDS = 12;                // rounds 1-12 fall on the weekly pattern
export const LATE_DAYS = [28, 29];            // rounds 13 and 14, after the quiet week
export const LEAGUE_DAYS = 30;                // last league round settles di 29
export const LIVE_HOURS = 3;
// ---------------------------------------------------------------------------
//  AND THE WORLD'S OWN DAY-IN-SEASON IS NOT `day % 42`.
//
//  A season opens on its `start_day`, and this world's did not open on world
//  day 0: `init-world.mjs` founds it on the day AFTER the tick that ran, so a
//  world founded on day 6 has its season 1 begin on day 7. Every page in the
//  client anchors to that (`__foPlanet.anchorWorld`, from the served
//  snapshot); the press did not, and dated an issue Day 12 on the morning the
//  app's own header said Day 5.
//
//  Nations founded later carry their own start_day and are permanently off
//  phase with the rest - joining mid-world is a real thing that happens to a
//  real nation, not a bug. But the paper is ONE paper for the whole world, so
//  it dates itself by the calendar most of the world is on: the largest cohort
//  sharing a phase, and within it the newest season already under way.
//
//  Pure function of the rows, so it can be held exactly in a test.
// ---------------------------------------------------------------------------
export function worldAnchor(seasonRows, today) {
  const open = (seasonRows || []).filter(s => (s.start_day | 0) <= today);
  if (!open.length) return null;
  const cohort = new Map();
  for (const s of open) {
    const ph = (((s.start_day | 0) % CYCLE) + CYCLE) % CYCLE;
    if (!cohort.has(ph)) cohort.set(ph, []);
    cohort.get(ph).push(s);
  }
  // the biggest cohort wins; ties break on the lower phase so the answer never
  // depends on which row Postgres handed back first
  let best = null;
  for (const [ph, rows] of [...cohort.entries()].sort((a, b) => a[0] - b[0]))
    if (!best || rows.length > best.rows.length) best = { ph, rows };
  // within it, the season already under way - the newest start_day that is not
  // in the future, which the filter above has already guaranteed
  const row = best.rows.reduce((a, s) => (s.start_day | 0) > (a.start_day | 0) ? s : a);
  const startDay = row.start_day | 0;
  // AND THEN ROLL FORWARD A WHOLE CYCLE AT A TIME, which is exactly what the
  // client's phaseOf does from its own anchor. It matters when the umpire is
  // behind: the seasons row for next season is not written until the turn of
  // the year settles, so on a day the tick has not reached, `today - start_day`
  // can run past 41. Counting it raw would print "Day 43 of season 137" while
  // every phone printed "Day 1 of season 138" - the same disagreement this
  // whole file exists to end, in a rarer costume.
  const rel = today - startDay;
  const seasonNo = (row.season_no | 0) + Math.floor(rel / CYCLE);
  return { startDay, seasonNo, di: ((rel % CYCLE) + CYCLE) % CYCLE, name: seasonName(seasonNo) };
}
// the league week: Mon Tue . Thu Fri . . — rounds at di%7 in {0,1,3,4}
const WEEK_POS = { 0: 1, 1: 2, 3: 3, 4: 4 };  // di%7 -> round-in-week
// day-in-season -> league round number, or null if no league cricket that day.
// Playoffs are rounds 15 (di 31) and 16 (di 32) — real fixtures, not table rounds.
export function roundOfDay(di) {
  if (!(di >= 0)) return null;
  if (di === PLAYOFF_DAYS.semi) return 15;
  if (di === PLAYOFF_DAYS.final) return 16;
  if (di === LATE_DAYS[0]) return 13;
  if (di === LATE_DAYS[1]) return 14;
  // The quiet week and everything after it carries no league cricket of its
  // own; rounds 13-16 are named above, day by day.
  if (di >= COLTS_DAYS.r16) return null;
  const w = Math.floor(di / 7), pos = WEEK_POS[di % 7];
  if (!pos) return null;
  const r = w * 4 + pos;
  return r >= 1 && r <= WEEK_ROUNDS ? r : null;
}
// round number -> day-in-season. The exact inverse of roundOfDay.
export function dayOfRound(round) {
  if (round === 15) return PLAYOFF_DAYS.semi;
  if (round === 16) return PLAYOFF_DAYS.final;
  if (round === 13) return LATE_DAYS[0];
  if (round === 14) return LATE_DAYS[1];
  if (!(round >= 1 && round <= WEEK_ROUNDS)) return null;
  const w = Math.floor((round - 1) / 4), pos = (round - 1) % 4;
  return w * 7 + [0, 1, 3, 4][pos];
}
// the first round whose day falls AFTER di - the market's "he is available
// from the next round"
export function nextRoundAfterDay(di) {
  for (let r = 1; r <= ROUNDS; r++) if (dayOfRound(r) > di) return r;
  return ROUNDS + 1;                            // the league is done; he waits for next season
}
// THE INTERNATIONAL TOUR DAYS. Six Wednesdays and Saturdays a season: the
// selectors name a squad in the morning, their countries play each other that
// evening - and the men named are still away when their clubs next play, so a
// call-up is a hole in your side, the way it is in the real game. The Wed/Sat
// of finals week (di 23, 26) are pure rest: finals are full-strength.
export const WINDOW_DAYS = [2, 5, 9, 12, 16, 19];   // days-in-season the tours are played
export const WINDOWS = [3, 5, 7, 9, 11, 13];        // the club round each one robs
export const INTL_HOUR = 18;                  // every tour starts at 18:00 UTC
export function isWindowRound(round) { return WINDOWS.indexOf(round) >= 0; }
export function windowRoundOfDay(di) { const i = WINDOW_DAYS.indexOf(di); return i < 0 ? null : WINDOWS[i]; }
export function windowDayOfRound(round) { const i = WINDOWS.indexOf(round); return i < 0 ? null : WINDOW_DAYS[i]; }
// THE WORLD CUP comes round every fourth season, played ON the tour days:
// groups on the first three, quarters, semis, the final on the sixth.
export const WC_EVERY = 4;
export function isWorldCupSeason(seasonNo) { return seasonNo % WC_EVERY === 0; }
// THE QUIET WEEK. Week four once belonged to the academies - the Colts Cup,
// all sixteen clubs of a nation in one hat over four days. The cup is retired
// for now (075) and the whole week rests; the day map stays because it is the
// week-four boundary in roundOfDay, and because the boys will be back.
export const COLTS_DAYS = { r16: 21, qf: 22, sf: 24, final: 25 };
// finals week and the closing week
export const PLAYOFF_DAYS = { semi: 31, final: 32 };
export const FA_DAYS = { r16: 6, qf: 13, sf: 20, final: 34 };
export const HONOURS_DAY = 32;                // champions are crowned with the league finals
export const TRANSITION_DAY = 38;             // the turning of the year
// the Champions Cup week: groups Mon-Wed, then knockout Fri-Sun
export const CUP_DAYS = { g1: 35, g2: 36, g3: 37, qf: 39, sf: 40, final: 41 };
// the staggered globe, same formula as the client planet: England is the
// 14:00 UTC league; every other nation hashes onto one of eight slots.
// Parity with the shipped build is asserted by tests/world-p2.test.mjs.
const HOUR_SLOTS = [1, 4, 7, 10, 13, 16, 19, 22];
function h32(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function natHour(countryId) {
  return countryId === 'eng' ? 14 : HOUR_SLOTS[h32('nathour|' + countryId) % HOUR_SLOTS.length];
}
export function dayIx(nowMs) { return Math.floor((nowMs - EPOCH) / DAY); }
export function phaseOf(nowMs) {
  const d = dayIx(nowMs), season = Math.floor(d / CYCLE) + 1, di = ((d % CYCLE) + CYCLE) % CYCLE;
  const p = { day: d, season, di, weekday: di % 7 };
  const r = roundOfDay(di);
  const fa = Object.keys(FA_DAYS).find(k => FA_DAYS[k] === di);
  if (r && r <= ROUNDS) { p.kind = 'league'; p.round = r; }
  else if (r === 15 || r === 16) { p.kind = 'playoff'; p.round = r; p.stage = r === 15 ? 'semi' : 'final'; }
  else if (fa) { p.kind = 'facup'; p.stage = fa; }
  else if (di === TRANSITION_DAY) p.kind = 'transition';
  else if (di >= CUP_DAYS.g1) {
    const st = Object.keys(CUP_DAYS).find(k => CUP_DAYS[k] === di);
    if (st) { p.kind = 'cup'; p.stage = st; } else p.kind = 'rest';
  }
  else { p.kind = 'rest'; p.window = windowRoundOfDay(di); }
  return p;
}
// A REST DAY is a day on which the world stages no club cricket at all - the
// tour days, the whole of the quiet week, and the Wednesday before the
// finals. These are the days an academy may scout, one recruit apiece, so
// the list has to be a pure function of the calendar and nothing else: a
// manager can count his chances a season in advance, offline.
export function isRestDay(di) {
  return phaseOf(EPOCH + di * DAY).kind === 'rest';
}
export const REST_DAYS = Array.from({ length: CYCLE }, (_, i) => i).filter(isRestDay);
// a day's play is settled once its window has closed
export function daySettled(nowMs, day, countryId) {
  return nowMs >= EPOCH + day * DAY + (natHour(countryId) + LIVE_HOURS) * 3600000;
}
// and any fixture on the global clock the same way — the tours keep 18:00 UTC
export function hourSettled(nowMs, day, hour) {
  return nowMs >= EPOCH + day * DAY + (hour + LIVE_HOURS) * 3600000;
}
// FNV-1a of the match id — THE seed derivation, same law as the client
export function seedOf(matchId) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < matchId.length; i++) { h ^= matchId.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
// double round robin for ONE DIVISION of 8 clubs by the circle method,
// season-shuffled — same construction as the client's schedOf. `slots` is the
// division's eight member slots for that season (membership is seasonal:
// promotion and relegation redraw it, so the schedule is built over the
// slots the season actually seats, not over an assumption).
// THE CUP DRAW — A DRAW, NOT A SORT.
// The FA Cup used to be drawn by SORTING the field on seedOf of each club's
// own key, which looks random and is not: FNV-1a barely moves when only the
// last character of a short string changes, so consecutive slots hashed in
// near-order, the sort left the field nearly as it found it, and the ties came
// out 1v0, 3v2, 5v4 - Division One drawn against Division One and Division Two
// against Division Two, every nation, every season. A cup in which no giant
// can be killed is not a cup.
//
// This is the real thing: one seed per draw, and Fisher-Yates over the whole
// field - the same shuffle the league's season order uses. The field goes into
// the hat once and comes out in an order nothing about a club can predict.
// engine/src/league/27-living-planet.js mirrors it exactly.
export function cupDraw(key, field) {
  const idx = field.slice();
  let seed = seedOf(key);
  for (let i = idx.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  return idx;
}

export function scheduleOf(countryId, seasonNo, slots, div = 1) {
  const members = slots || [0, 1, 2, 3, 4, 5, 6, 7];
  const N = members.length, idx = Array.from({ length: N }, (_, i) => i);
  let seed = seedOf(countryId + '|order|d' + div + '|' + seasonNo);
  for (let i = N - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  let list = idx.slice(); const rounds = [];
  for (let r = 0; r < N - 1; r++) {
    const rd = [];
    for (let k = 0; k < N / 2; k++) { const a = list[k], b = list[N - 1 - k]; rd.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(rd);
    list = [list[0], list[N - 1]].concat(list.slice(1, N - 1));
  }
  for (let r = 0; r < N - 1; r++) rounds.push(rounds[r].map(f => [f[1], f[0]]));
  return rounds.map(rd => rd.map(([a, b]) => [members[a], members[b]]));
}
// both divisions' schedules for a season, as the seasons row stores them
export function seasonSchedules(countryId, seasonNo, divisions) {
  return {
    1: scheduleOf(countryId, seasonNo, divisions['1'] || divisions[1], 1),
    2: scheduleOf(countryId, seasonNo, divisions['2'] || divisions[2], 2)
  };
}
