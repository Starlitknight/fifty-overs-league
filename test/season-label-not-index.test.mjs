// test/season-label-not-index.test.mjs — A LABEL IS NOT AN INDEX.
//
// The record carries 136 baked seasons behind the live world, so the season
// a reader is shown is not the season the world is in: foSeasonN turns the
// world's season 1 into "Season 137", and every page that prints the words
// "Season N" goes through it.
//
// The fixture list bound that label to a variable called seasonNo and then
// handed it to the CALENDAR - dayOfSeasonRound, faDayOf, schedMirror, the cup
// draw - which want the world's own season. Asked for season 137 while the
// world sat in season 1, the calendar answered honestly: a hundred and
// thirty-six years of forty-two days each, five thousand seven hundred days
// into the future. Every fixture was dated in 2042, and because a row prints
// the day and the month without a year, the whole page read as next April
// while the world played today.
//
// The label and the index are two values now. This holds them apart, and
// holds the shape of the mistake so it cannot come back under another name.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX = readFileSync(join(ROOT, 'engine', 'src', 'league', '24-fixture-list.js'), 'utf8');
const PLANET = readFileSync(join(ROOT, 'engine', 'src', 'league', '27-living-planet.js'), 'utf8');
const code = FX.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

test('the reader number and the world number are two different values', () => {
  assert.match(code, /var seasonNo = \(snap\.seasonNo \| 0\) \|\| 1;/, "the world's own season");
  assert.match(code, /var seasonLbl = window\.foSeasonN \? foSeasonN\(seasonNo\) : seasonNo;/,
    "and the one a reader is shown, derived from it");
});

test('the calendar is only ever asked about the world season', () => {
  // every call that takes a season and answers with a DAY or a DRAW
  [/pl0\.dayOfSeasonRound\(seasonNo, round\)/,
   /pl0\.dayOfSeasonRound\(seasonNo, r3 \+ 1\)/,
   /pl0\.faDayOf\(seasonNo, st\)/,
   /pl0\.faDrawR16\(claim\.country, seasonNo, null, divOf\)/,
   /wt\.schedMirror\(claim\.country, seasonNo\)/,
   /__foFaCup\.want\(claim\.country, seasonNo,/].forEach(function (re) {
    assert.match(code, re, 'this asks with the world season: ' + re);
  });
  // and none of them is handed the label
  assert.ok(!/dayOfSeasonRound\(seasonLbl/.test(code), 'the calendar never sees the label');
  assert.ok(!/schedMirror\([^)]*seasonLbl/.test(code), 'nor does the draw');
  assert.ok(!/faDayOf\(seasonLbl/.test(code), 'nor the cup calendar');
});

test('the label is what the page prints, and the only thing it prints', () => {
  assert.match(code, /" &middot; Season " \+ seasonLbl/, 'the billing wears the reader\'s number');
  assert.ok(!/Season " \+ seasonNo/.test(code), 'and the world\'s number is never printed raw');
});

test('the two really do differ, which is why this matters', () => {
  // foSeasonN adds the baked record to the live season; if that ever became
  // the identity this test would be guarding nothing, so say what it is
  assert.match(PLANET, /function seasonNo\(n\) \{ return histSeasons\(\) \+ Math\.max\(1, n \| 0\); \}/,
    'the label is the live season plus every season already on the record');
  assert.match(PLANET, /function seasonStart\(season\) \{ return ANCHOR\.start \+ \(\(season \| 0\) - ANCHOR\.season\) \* CYCLE; \}/,
    'and the calendar walks a cycle per season from the anchor - so a label ' +
    'used as an index lands a season-length times the record out');
});
