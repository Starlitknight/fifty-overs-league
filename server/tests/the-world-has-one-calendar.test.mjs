// tests/the-world-has-one-calendar.test.mjs — ONE WORLD, ONE DATE.
//
// For one deploy the game had what looked like two worlds running side by
// side. The app header said DAY 5 · SEASON 137. The Gazette's masthead,
// printed by the umpire from the same record two inches below it, said "Day 12
// of season 1". Both were reporting the same cricket. Neither was lying. They
// were using two different names for the same day, and a reader has no way to
// know that.
//
// The two names came apart in two independent places, so this file holds both:
//
//   1. A SEASON'S NUMBER IS NOT ITS NAME. `seasons.season_no` counts from 1
//      because this world was founded in August 2026; the client carries
//      straight on from a baked record of 136 seasons and calls that same
//      season 137. Anything a reader sees uses the name.
//   2. A SEASON'S DAY IS NOT `world_day % 42`. A season opens on its own
//      start_day, and this one did not open on world day 0.
//
// None of this needs a database. It is arithmetic over the calendar and over
// plain rows, which is exactly why it can be pinned this hard.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { makeEngine } from '../../test/engine-vm.mjs';
import { CYCLE, HERITAGE_SEASONS, seasonName, worldAnchor } from '../clock.mjs';

// ---- 1. THE NAME ----------------------------------------------------------

// THE ONE ASSERTION THAT MATTERS HERE, and the reason 136 is allowed to be a
// constant in clock.mjs at all. It is a property of the baked record, not of
// the calendar: if anybody ever writes another season into the history the
// press would quietly misdate every paper by exactly that many seasons, with
// nothing else in the world changing to give it away. This is what gives it
// away. Booting the shipped build costs a second, once.
test('the press and the shipped game count the record the same way', () => {
  const eng = makeEngine();
  const planet = JSON.parse(vm.runInContext(
    'JSON.stringify({ hist: __foPlanet.histSeasons(), one: __foPlanet.seasonNo(1), five: __foPlanet.seasonNo(5) })',
    eng.ctx));
  assert.equal(HERITAGE_SEASONS, planet.hist,
    'clock.HERITAGE_SEASONS is ' + HERITAGE_SEASONS + ' and the build says ' + planet.hist +
    ' - the record has changed, and every masthead is now out by ' +
    Math.abs(planet.hist - HERITAGE_SEASONS) + ' seasons');
  assert.equal(seasonName(1), planet.one, 'the world\'s first season has one name');
  assert.equal(seasonName(5), planet.five, 'and so does its fifth');
});

test('a season index is never printed raw', () => {
  assert.equal(seasonName(1), 137, 'season 1 of the served world is season 137 of the game');
  // a row that predates the numbering, or a nonsense one, still names a season
  // rather than naming season 136 - a paper with no date on it is a bug the
  // reader can see, and this is cheaper than letting it happen
  assert.equal(seasonName(0), 137);
  assert.equal(seasonName(null), 137);
});

// ---- 2. THE DAY -----------------------------------------------------------

const rows = (...spec) => spec.map(([country_id, season_no, start_day]) =>
  ({ country_id, season_no, start_day }));

test('the day-in-season is counted from the season\'s own opening', () => {
  // the world that actually shipped: founded so that season 1 opens on day 7
  const a = worldAnchor(rows(['eng', 1, 7], ['aus', 1, 7], ['ind', 1, 7]), 11);
  assert.equal(a.di, 4, 'world day 11 is day-in-season 4');
  assert.equal(a.di + 1, 5, 'which the masthead prints as Day 5 - what the header says');
  assert.equal(a.name, 137, 'of season 137 - what the header says');
  // and NOT what the press used to print
  assert.notEqual(a.di + 1, (11 % CYCLE) + 1);
});

test('and it walks on with the season', () => {
  const world = rows(['eng', 2, 49], ['aus', 2, 49]);
  assert.equal(worldAnchor(world, 49).di, 0, 'opening day is day-in-season 0');
  assert.equal(worldAnchor(world, 49).name, 138, 'and it is the next season by name too');
  assert.equal(worldAnchor(world, 90).di, 41, 'and the last day of it is 41');
});

// A SEASON THAT HAS NOT OPENED IS NOT THE SEASON. The seasons table carries
// next season's row from the moment the turn of the year writes it, so a naive
// "highest season_no" would have the paper dating itself into a season nobody
// has bowled a ball in.
test('a season the world has not reached yet does not date the paper', () => {
  const world = rows(['eng', 1, 7], ['eng', 2, 49], ['aus', 1, 7], ['aus', 2, 49]);
  const a = worldAnchor(world, 20);
  assert.equal(a.seasonNo, 1, 'still the season being played');
  assert.equal(a.di, 13);
});

// A NATION MAY JOIN MID-WORLD, and when it does it is permanently off phase
// with the rest - which is a true thing about that nation and not a fault. The
// paper is one paper for the whole world, so it dates itself by the calendar
// most of the world is on rather than by whichever row came back first.
test('a latecomer nation does not redate the whole paper', () => {
  const world = rows(['eng', 1, 7], ['aus', 1, 7], ['ind', 1, 7], ['nep', 1, 20]);
  const a = worldAnchor(world, 30);
  assert.equal(a.startDay, 7, 'the founding cohort dates the issue');
  assert.equal(a.di, 23);
});

test('and the answer never depends on the order the rows came back', () => {
  const world = rows(['eng', 1, 7], ['nep', 1, 20], ['aus', 1, 7], ['ind', 1, 7]);
  assert.deepEqual(worldAnchor(world, 30), worldAnchor(world.slice().reverse(), 30));
});

// AND IF THE UMPIRE IS BEHIND, the paper still says what the phones say. The
// row for next season is not written until the turn of the year settles, so on
// a day the tick has not reached there is no row to anchor to and `today -
// start_day` runs past the end of a season. The client rolls its anchor
// forward a cycle at a time and never prints a 43rd day; so does this.
test('a season the umpire has not opened yet is still counted, not overrun', () => {
  const a = worldAnchor(rows(['eng', 1, 7], ['aus', 1, 7]), 7 + CYCLE + 3);
  assert.equal(a.di, 3, 'three days into the next season, not 45 days into this one');
  assert.equal(a.seasonNo, 2);
  assert.equal(a.name, 138, 'and it is named the way every phone names it');
});

// A WORLD FOUNDED THIS MORNING has a seasons row whose start_day is tomorrow -
// init-world founds on the day AFTER the tick that ran. There is no anchor to
// be had, and the honest answer is to say so rather than to invent a negative
// day; the press falls back to the raw calendar in that case, which is only
// ever seen before the world's first ball.
test('a world that has not opened yet has no anchor at all', () => {
  assert.equal(worldAnchor(rows(['eng', 1, 12]), 11), null);
  assert.equal(worldAnchor([], 11), null);
  assert.equal(worldAnchor(null, 11), null);
});
