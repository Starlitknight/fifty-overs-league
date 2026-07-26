// clock.mjs — the world calendar, server-side, injectable time throughout.
// Mirrors the shipped client calendar (engine/src/league/27-living-planet.js):
// same epoch, same 25-day cycle, same 18 rounds, same national hours.
export const EPOCH = Date.UTC(2026, 4, 16);   // 16 May 2026 = world day 0
export const DAY = 86400000;
export const CYCLE = 25;
export const ROUNDS = 18;
export const LIVE_HOURS = 3;
export function natHour(countryId) { return countryId === 'eng' ? 14 : 10; } // P1: England only
export function dayIx(nowMs) { return Math.floor((nowMs - EPOCH) / DAY); }
export function phaseOf(nowMs) {
  const d = dayIx(nowMs), season = Math.floor(d / CYCLE) + 1, di = ((d % CYCLE) + CYCLE) % CYCLE;
  const p = { day: d, season, di };
  if (di < ROUNDS) { p.kind = 'league'; p.round = di + 1; }
  else if (di === 18) p.kind = 'honours';
  else if (di === 19) p.kind = 'draw';
  else if (di <= 23) p.kind = 'cup';
  else p.kind = 'rest';
  return p;
}
// a day's play is settled once its window has closed
export function daySettled(nowMs, day, countryId) {
  return nowMs >= EPOCH + day * DAY + (natHour(countryId) + LIVE_HOURS) * 3600000;
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
