// clock.mjs — the world calendar, server-side, injectable time throughout.
// Mirrors the shipped client calendar (engine/src/league/27-living-planet.js):
// same epoch, same 35-day cycle, same 14 rounds, same national hours.
export const EPOCH = Date.UTC(2026, 7, 3);    // MONDAY 3 August 2026 = world day 0, season 1 day 1
export const DAY = 86400000;
// ---------------------------------------------------------------------------
//  THE 35-DAY SEASON — FIVE EXACT WEEKS (docs/PYRAMID.md is the authority)
//
//  Day 0 is always a Monday: CYCLE is 35, so di % 7 IS the weekday, forever.
//  A season is one year of a cricketer's life.
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
//    21 22   Mon Tue   league rounds 13-14 — the double round robin complete
//    23      Wed       rest: the players breathe before finals
//    24      Thu       LEAGUE PLAYOFF SEMIS (1v4, 2v3, both divisions)
//    25      Fri       THE LEAGUE FINALS — champions crowned
//    26      Sat       rest
//    27      Sun       THE FA CUP FINAL
//    28-30   Mon-Wed   CHAMPIONS CUP group rounds 1-3 (4 groups of 4)
//    31      Thu       THE TURNING OF THE YEAR — ageing, youth, promotion & relegation
//    32      Fri       Champions Cup quarter-finals
//    33      Sat       Champions Cup semi-finals
//    34      Sun       THE CHAMPIONS CUP FINAL
//
//  NOTHING ANYWHERE MAY ASSUME round === day + 1. The functions below are the
//  only place the day<->round mapping lives - server and client both.
// ---------------------------------------------------------------------------
export const CYCLE = 35;                      // days in a season = one year
export const ROUNDS = 14;                     // eight clubs, double round robin
export const LEAGUE_DAYS = 23;                // last league round settles di 22
export const LIVE_HOURS = 3;
// the league week: Mon Tue . Thu Fri . . — rounds at di%7 in {0,1,3,4}
const WEEK_POS = { 0: 1, 1: 2, 3: 3, 4: 4 };  // di%7 -> round-in-week
// day-in-season -> league round number, or null if no league cricket that day.
// Playoffs are rounds 15 (di 24) and 16 (di 25) — real fixtures, not table rounds.
export function roundOfDay(di) {
  if (!(di >= 0)) return null;
  if (di === PLAYOFF_DAYS.semi) return 15;
  if (di === PLAYOFF_DAYS.final) return 16;
  if (di >= LEAGUE_DAYS) return null;
  const w = Math.floor(di / 7), pos = WEEK_POS[di % 7];
  if (!pos) return null;
  const r = w * 4 + pos;
  return r >= 1 && r <= ROUNDS ? r : null;
}
// round number -> day-in-season. The exact inverse of roundOfDay.
export function dayOfRound(round) {
  if (round === 15) return PLAYOFF_DAYS.semi;
  if (round === 16) return PLAYOFF_DAYS.final;
  if (!(round >= 1 && round <= ROUNDS)) return null;
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
// finals week and the closing week
export const PLAYOFF_DAYS = { semi: 24, final: 25 };
export const FA_DAYS = { r16: 6, qf: 13, sf: 20, final: 27 };
export const HONOURS_DAY = 25;                // champions are crowned with the league finals
export const TRANSITION_DAY = 31;             // the turning of the year
// the Champions Cup week: groups Mon-Wed, then knockout Fri-Sun
export const CUP_DAYS = { g1: 28, g2: 29, g3: 30, qf: 32, sf: 33, final: 34 };
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
