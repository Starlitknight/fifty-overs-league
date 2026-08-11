// test/club-page-calendar.test.mjs — WHOSE CLOCK DATES A FIXTURE.
//
// The club page put a date on a club's coming rounds by calling
// foRoundTimeTxt, which belongs to the LOCAL single-player clock
// (30-england-clock.js). That clock models a season as one round per day
// starting tomorrow, anchored to whatever round App.season happened to be on
// when the anchor was first stamped - and it STAYS stamped, so it drifts a
// day for every day that passes and another for every rest day.
//
// Two symptoms, both on one card. A round below the stale anchor got no
// answer at all (roundTime returns null for r < r0), so those rows fell back
// to a bare "R3", "R4"; and the first round at or above it was dated
// "tomorrow", whatever the world thought. A club whose next fixture was
// round two was told round five was tomorrow, on the same card, under the
// two rows that could not name a day between them.
//
// The world runs three rounds and then rests, and each nation bowls its
// first ball at its own hour. The planet owns that calendar, and owns the
// single function every page that dates a fixture is meant to ask.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CP = readFileSync(join(ROOT, 'engine', 'src', 'league', '40-club-page.js'), 'utf8');
const PLANET = readFileSync(join(ROOT, 'engine', 'src', 'league', '27-living-planet.js'), 'utf8');

test('a served page dates a served fixture off the served calendar', () => {
  assert.match(CP, /PL9\.whenTxt\(seasonNo, r9 \| 0, cid\)/,
    'the season, the round and the nation - the three things the answer depends on');
  // the file still NAMES the old clock, in the note explaining why it went;
  // read the code the page runs, not the prose around it
  const code = CP.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/foRoundTimeTxt/.test(code), 'and the local clock is off this page entirely');
});

test('the ground forecast asks the same question as the fixture card', () => {
  // the two lists date the same rounds; a page that answered them from two
  // clocks could print two different days for one match
  assert.match(CP, /var when = roundWhen\(x\.round\);/, 'the forecast reads the one helper');
  assert.equal((CP.match(/var roundWhen = function/g) || []).length, 1, 'and there is only one');
});

test('the world calendar keeps its rest days, so rounds are not one a day', () => {
  // dayOfRound is the shape the club page now inherits: four rounds a week
  // laid on days 0, 1, 3 and 4, not four consecutive days
  assert.match(PLANET, /return Math\.floor\(\(round - 1\) \/ 4\) \* 7 \+ \[0, 1, 3, 4\]\[\(round - 1\) % 4\];/,
    'three-and-rest, then again');
  assert.match(PLANET, /function dayOfSeasonRound\(season, round\) \{/, 'and a season opens it');
  assert.match(PLANET, /return atTxt\(d, rid == null \? 14 : natHour\(rid\), now\);/,
    'the hour is the nation own, not a constant');
});

test('the local clock still answers for the local game, and only for it', () => {
  const CLOCK = readFileSync(join(ROOT, 'engine', 'src', 'league', '30-england-clock.js'), 'utf8');
  // it is not deleted - the single-player season really is one round a day -
  // but the anchor that makes it drift is exactly why a served page may not
  // ask it, so this holds the shape that drifts, on purpose
  assert.match(CLOCK, /App\.wcal = \{ season: App\.seasonNo \|\| 1, d0: d \+ 1, r0: App\.season\.round \| 0/,
    'it anchors to a round and a day and keeps them');
  assert.match(CLOCK, /if \(r < a\.r0\) return null;/,
    'and says nothing at all about a round below its anchor - which is the blank the club page used to print');
});
