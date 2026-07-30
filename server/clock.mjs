// clock.mjs — the world calendar, server-side, injectable time throughout.
// Mirrors the shipped client calendar (engine/src/league/27-living-planet.js):
// same epoch, same 25-day cycle, same 18 rounds, same national hours.
export const EPOCH = Date.UTC(2026, 6, 28);   // 28 July 2026 = world day 0, OPENING DAY (round 1 everywhere)
export const DAY = 86400000;
// ---------------------------------------------------------------------------
//  THE 30-DAY SEASON
//
//  Cricket is not played every day of the week, and a season that never drew
//  breath gave a manager no evening to think in. So the league runs in blocks:
//  THREE ROUNDS, THEN A DAY OFF, six times over. Twenty-four days of league,
//  then the closing week - the crowns, the two cups, and one last quiet day.
//
//    day-in-season   what happens
//    0  1  2         rounds 1-3
//    3               rest · INTERNATIONAL WINDOW 1
//    4  5  6         rounds 4-6
//    7               rest · INTERNATIONAL WINDOW 2
//    8  9  10        rounds 7-9
//    11              rest · INTERNATIONAL WINDOW 3
//    12 13 14        rounds 10-12
//    15              rest
//    16 17 18        rounds 13-15
//    19              rest
//    20 21 22        rounds 16-18
//    23              rest
//    24              champions crowned · Champions Cup play-ins
//    25 26 27 28     last sixteen, quarters, semis, THE FINALS
//    29              rest - the wire catches its breath
//
//  Thirty days, and a cricketer's year is thirty days long: one season is one
//  year of his life, and his age rolls over exactly when the umpire ages him.
//
//  NOTHING ANYWHERE MAY ASSUME round === day + 1. It was true when every day
//  was a match day and it is not true now, so the two functions below are the
//  only place the mapping lives - server and client both.
// ---------------------------------------------------------------------------
export const CYCLE = 30;                      // days in a season
export const ROUNDS = 18;                     // ten clubs, double round robin
export const BLOCK = 4;                       // three rounds then a rest day
export const LEAGUE_DAYS = 24;                // six blocks of four
export const LIVE_HOURS = 3;
// day-in-season -> round number, or null if no league cricket is played
export function roundOfDay(di) {
  if (!(di >= 0) || di >= LEAGUE_DAYS) return null;
  if (di % BLOCK === BLOCK - 1) return null;                 // the rest day
  return di - Math.floor(di / BLOCK) + 1;
}
// round number -> day-in-season. The exact inverse of roundOfDay.
export function dayOfRound(round) {
  if (!(round >= 1 && round <= ROUNDS)) return null;
  return Math.floor((round - 1) / (BLOCK - 1)) * BLOCK + ((round - 1) % (BLOCK - 1));
}
// the first round whose day falls AFTER di - the market's "he is available from
// the next round", which used to be `today - start_day + 2` and is not any more
export function nextRoundAfterDay(di) {
  for (let r = 1; r <= ROUNDS; r++) if (dayOfRound(r) > di) return r;
  return ROUNDS + 1;                            // the league is done; he waits for next season
}
// THE INTERNATIONAL WINDOWS. Three rest days a season are window days: the
// selectors name a squad in the morning, their countries play each other that
// evening - and the men named are still away when their clubs next play, so a
// call-up is a hole in your side, the way it is in the real game.
export const WINDOW_DAYS = [3, 7, 11];        // days-in-season the tours are played
export const WINDOWS = [4, 7, 10];            // the club round each one robs
export const INTL_HOUR = 18;                  // every tour starts at 18:00 UTC
export function isWindowRound(round) { return WINDOWS.indexOf(round) >= 0; }
export function windowRoundOfDay(di) { const i = WINDOW_DAYS.indexOf(di); return i < 0 ? null : WINDOWS[i]; }
export function windowDayOfRound(round) { const i = WINDOWS.indexOf(round); return i < 0 ? null : WINDOW_DAYS[i]; }
// the closing week
export const HONOURS_DAY = 24;
export const CUP_DAYS = { pi: 24, r16: 25, qf: 26, sf: 27, final: 28 };
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
  const p = { day: d, season, di };
  const r = roundOfDay(di);
  if (r) { p.kind = 'league'; p.round = r; }
  else if (di < LEAGUE_DAYS) { p.kind = 'rest'; p.window = windowRoundOfDay(di); }
  else if (di === HONOURS_DAY) p.kind = 'honours';
  else if (di <= CUP_DAYS.final) { p.kind = 'cup'; p.stage = ['r16', 'qf', 'sf', 'final'][di - CUP_DAYS.r16]; }
  else p.kind = 'rest';
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
// double round robin for 10 clubs by the circle method, season-shuffled —
// same construction as the client's schedOf
export function scheduleOf(countryId, seasonNo) {
  const N = 10, idx = Array.from({ length: N }, (_, i) => i);
  let seed = seedOf(countryId + '|order|' + seasonNo);
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
  return rounds;
}
