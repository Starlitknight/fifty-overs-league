// test/player-record-and-log.test.mjs — ONE SHELF, ONE SHAPE.
//
// Two faults, one cause: the player page had two ways of showing the same
// thing, and which one you got depended on the data.
//
//  * The Career record printed the three-class tables where there were
//    figures and the old four-figure card where there were none - so a fringe
//    man, or anyone at all on the first morning of a season, saw a different
//    room from his team-mates.
//  * The match log listed the club's league fixtures whether he played in
//    them or not, but listed exhibitions only from HIS OWN friendlies book,
//    which the umpire opens only for a man who batted, bowled or fielded. A
//    club could play six friendlies and a squad man see none of them. And
//    because the two halves were concatenated - league first, then friendlies,
//    then cut to five - once the club had five rounds behind it no exhibition
//    could ever reach the shelf again.
//
// These read the shipped source. They cannot tell whether the room LOOKS
// right; what they can do is hold the two halves to one rule apiece.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'engine', 'src', 'league', '41-player-page.js'), 'utf8');

test('the record tables stand in the served world even with nothing in them', () => {
  assert.match(src, /function ppBooks\(p, all\)/, 'the books should take the "rule every line" flag');
  assert.match(src, /else if \(all\) out\.push\(\{ cls: cls, b: PP_NIL \}\)/,
    'a class he has not played in should still be a row');
  assert.match(src, /function ppFullRecord\(p, served\)/, 'the record should know whether the world is served');
  assert.match(src, /ppFullRecord\(p, !!ppWorldRid\(hit\)\)/,
    'the Overview should tell the record it is in a served world');
});

test('the old four-figure card is kept for solo play only', () => {
  const at = src.indexOf('function ppFullRecord');
  const body = src.slice(at, src.indexOf('\n  }', at));
  assert.ok(body.includes('miniCareer(p)'), 'solo play still needs the local card');
  assert.ok(body.indexOf('ppBatTable') < body.indexOf('miniCareer'),
    'the tables come first; the card is the fallback, not the default');
});

test('the log reads the club exhibitions, not only the man own book', () => {
  assert.match(src, /world_my_friendlies/, 'the log should read the club-level list of ties');
  assert.match(src, /function ppFriendlies\(rid, slot\)/, 'the list is fetched per club');
  // his own figures are still what fills the "His match" column
  assert.match(src, /byId\[String\(l\.id\)\] = l/, 'his banked lines are laid over the club list by id');
});

test('the two halves are merged by when they were played, not stacked', () => {
  assert.match(src, /lines\.sort\(function \(a, b\) \{ return \(b\.at \|\| 0\) - \(a\.at \|\| 0\); \}\)/,
    'league rounds and exhibitions should be sorted onto one shelf');
  assert.match(src, /function ppRoundMs\(season, round, rid\)/,
    'a league round needs an hour before it can be compared with a friendly');
  assert.ok(!/\(rows \+ frRows\)/.test(src), 'the concatenate-then-cut shelf should be gone');
});

test('a row says which book it came from', () => {
  assert.match(src, /<tr data-k='lg'>/, 'league rows should be marked');
  assert.match(src, /<tr data-k='fr'>/, 'exhibition rows should be marked');
  assert.match(src, /tr\.getAttribute\("data-k"\)/, 'the filter should read the mark');
});

test('a friendly still in its broadcast window is not in the record yet', () => {
  assert.match(src, /f\.status !== "played" \|\| !f\.text/,
    'a played tie whose result is still withheld must not print a result');
});
