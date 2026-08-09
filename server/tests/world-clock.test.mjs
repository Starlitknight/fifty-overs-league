// world-clock.test.mjs — THE SHAPE OF THE YEAR.
//
// The calendar is the one thing every other part of the world reads: the
// umpire, the market, the call-ups, the books, the client. It has moved once
// already (five weeks to six, to make room for the Colts Week) and it will be
// tempting to move a day again. These are the properties that must survive any
// such move - not the numbers themselves so much as the laws the numbers obey.
//
// Needs no database: the clock is arithmetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE, ROUNDS, EPOCH, DAY, LEAGUE_DAYS,
  roundOfDay, dayOfRound, nextRoundAfterDay, phaseOf,
  WINDOW_DAYS, WINDOWS, windowRoundOfDay,
  COLTS_DAYS, isRestDay, REST_DAYS,
  PLAYOFF_DAYS, FA_DAYS, CUP_DAYS, HONOURS_DAY, TRANSITION_DAY
} from '../clock.mjs';

const days = Array.from({ length: CYCLE }, (_, di) => di);
const COLTS_STAGES = ['r16', 'qf', 'sf', 'final'];
const coltsStageOfDay = di => COLTS_STAGES.find(k => COLTS_DAYS[k] === di) || null;

test('a season is a whole number of weeks, so di % 7 is the weekday forever', () => {
  assert.equal(CYCLE % 7, 0, 'CYCLE must be a multiple of 7');
  // day 0 of the world is a Monday, and therefore so is day 0 of every season
  assert.equal(new Date(EPOCH).getUTCDay(), 1);
  for (const s of [0, 1, 2, 17, 100]) {
    assert.equal(new Date(EPOCH + s * CYCLE * DAY).getUTCDay(), 1,
      'season ' + (s + 1) + ' must open on a Monday');
  }
});

test('roundOfDay and dayOfRound are exact inverses for every round', () => {
  for (let r = 1; r <= 16; r++) {
    const d = dayOfRound(r);
    assert.ok(d != null, 'round ' + r + ' must have a day');
    assert.ok(d >= 0 && d < CYCLE, 'round ' + r + ' day ' + d + ' must be inside the season');
    assert.equal(roundOfDay(d), r, 'round ' + r + ' -> day ' + d + ' -> round ' + roundOfDay(d));
  }
  // and no day claims a round that does not map back to it
  for (const di of days) {
    const r = roundOfDay(di);
    if (r != null) assert.equal(dayOfRound(r), di, 'day ' + di + ' claims round ' + r);
  }
});

test('every round falls on a distinct day, and the league runs in order', () => {
  const seen = new Map();
  for (let r = 1; r <= 16; r++) {
    const d = dayOfRound(r);
    assert.ok(!seen.has(d), 'day ' + d + ' carries both round ' + seen.get(d) + ' and round ' + r);
    seen.set(d, r);
  }
  for (let r = 2; r <= 16; r++) {
    assert.ok(dayOfRound(r) > dayOfRound(r - 1),
      'round ' + r + ' must fall after round ' + (r - 1));
  }
});

test('no day of the year carries two competitions', () => {
  for (const di of days) {
    const claims = [];
    const r = roundOfDay(di);
    if (r != null) claims.push(r <= ROUNDS ? 'league r' + r : 'playoff r' + r);
    if (Object.keys(FA_DAYS).some(k => FA_DAYS[k] === di)) claims.push('facup');
    if (Object.keys(CUP_DAYS).some(k => CUP_DAYS[k] === di)) claims.push('champions cup');
    if (di === TRANSITION_DAY) claims.push('the turning of the year');
    assert.ok(claims.length <= 1, 'day ' + di + ' carries ' + claims.join(' AND '));
  }
});

test('the quiet week rests: the old Colts Cup days carry nothing at all', () => {
  // the Colts Cup is retired for now (075); its day map stays as the
  // week-four boundary, and every one of its days is a plain rest day
  const cd = COLTS_STAGES.map(k => COLTS_DAYS[k]);
  for (const d of cd) {
    assert.equal(roundOfDay(d), null, 'quiet-week day ' + d + ' must carry no league cricket');
    assert.equal(windowRoundOfDay(d), null, 'quiet-week day ' + d + ' must carry no tour');
    assert.equal(phaseOf(EPOCH + d * DAY).kind, 'rest');
    assert.ok(isRestDay(d), 'quiet-week day ' + d + ' is a scouting day');
  }
});

test('the tour days rob the rounds the call-up law says they rob', () => {
  assert.equal(WINDOW_DAYS.length, WINDOWS.length);
  WINDOW_DAYS.forEach((d, i) => {
    assert.equal(roundOfDay(d), null, 'tour day ' + d + ' must carry no club cricket');
    assert.equal(windowRoundOfDay(d), WINDOWS[i]);
    // the robbed round must actually come after the tour that robs it
    assert.ok(dayOfRound(WINDOWS[i]) > d,
      'tour on day ' + d + ' robs round ' + WINDOWS[i] + ', which must fall after it');
  });
  // nothing tours during the quiet week or after it: those weeks are full strength
  for (const d of WINDOW_DAYS) assert.ok(d < COLTS_DAYS.r16, 'tour day ' + d + ' must precede the quiet week');
});

test('the closing order of the year is finals, then cups, then the turning', () => {
  assert.ok(dayOfRound(ROUNDS) < PLAYOFF_DAYS.semi, 'the league must finish before its playoffs');
  assert.ok(PLAYOFF_DAYS.semi < PLAYOFF_DAYS.final);
  assert.equal(HONOURS_DAY, PLAYOFF_DAYS.final, 'champions are crowned with the league finals');
  assert.ok(FA_DAYS.r16 < FA_DAYS.qf && FA_DAYS.qf < FA_DAYS.sf && FA_DAYS.sf < FA_DAYS.final);
  assert.ok(CUP_DAYS.g1 < CUP_DAYS.g2 && CUP_DAYS.g2 < CUP_DAYS.g3);
  assert.ok(CUP_DAYS.g3 < CUP_DAYS.qf && CUP_DAYS.qf < CUP_DAYS.sf && CUP_DAYS.sf < CUP_DAYS.final);
  // the year turns after every domestic thing is decided, and before the
  // Champions Cup knockout, exactly as it always has
  assert.ok(TRANSITION_DAY > PLAYOFF_DAYS.final, 'the year must turn after the league finals');
  assert.ok(TRANSITION_DAY > FA_DAYS.final, 'the year must turn after the FA Cup final');
  assert.ok(TRANSITION_DAY > COLTS_DAYS.final, 'the year must turn after the Colts Cup final');
  assert.ok(TRANSITION_DAY < CUP_DAYS.final, 'the year turns inside the Champions Cup week');
  assert.equal(CUP_DAYS.final, CYCLE - 1, 'the last day of the year is the Champions Cup final');
});

test('LEAGUE_DAYS is the day after the last league round', () => {
  assert.equal(LEAGUE_DAYS, dayOfRound(ROUNDS) + 1);
  for (const di of days) {
    const r = roundOfDay(di);
    if (r != null && r <= ROUNDS) assert.ok(di < LEAGUE_DAYS, 'league round on day ' + di);
  }
});

test('nextRoundAfterDay walks the market forward and then gives up', () => {
  assert.equal(nextRoundAfterDay(-1), 1);
  for (let r = 1; r < ROUNDS; r++) {
    assert.equal(nextRoundAfterDay(dayOfRound(r)), r + 1,
      'the day round ' + r + ' is played, the next round is ' + (r + 1));
  }
  assert.equal(nextRoundAfterDay(dayOfRound(ROUNDS)), ROUNDS + 1, 'after the last round, the league is done');
  assert.equal(nextRoundAfterDay(CYCLE - 1), ROUNDS + 1);
});

test('phaseOf names every day of the year, and the season number advances', () => {
  for (const di of days) {
    const p = phaseOf(EPOCH + di * DAY);
    assert.equal(p.season, 1);
    assert.equal(p.di, di);
    assert.equal(p.weekday, di % 7);
    assert.ok(['league', 'playoff', 'facup', 'cup', 'transition', 'rest'].includes(p.kind),
      'day ' + di + ' has kind ' + p.kind);
  }
  assert.equal(phaseOf(EPOCH + CYCLE * DAY).season, 2);
  assert.equal(phaseOf(EPOCH + CYCLE * DAY).di, 0);
  assert.equal(phaseOf(EPOCH + (2 * CYCLE - 1) * DAY).season, 2);
});

test('the rest days are derived, and there are enough to run an academy on', () => {
  // scouting is one recruit per rest day, so this list IS the academy's
  // economy. It must be a pure function of the calendar - a manager counts
  // his chances a season in advance, offline.
  assert.deepEqual(REST_DAYS, days.filter(isRestDay), 'REST_DAYS is exactly what isRestDay says');
  for (const di of REST_DAYS) {
    assert.equal(roundOfDay(di), null, 'rest day ' + di + ' must carry no club cricket');
    assert.ok(!Object.keys(FA_DAYS).some(k => FA_DAYS[k] === di), 'rest day ' + di + ' must carry no cup tie');
  }
  assert.ok(REST_DAYS.length >= 10,
    'an academy needs at least ten scouting days a season, got ' + REST_DAYS.length);
});
