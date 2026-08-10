// test/feed-lineups.test.mjs — ELEVEN MEN TAKE THE FIELD, MANAGER OR NO.
//
// Only a claimed club files a teamsheet, so the broadcast's Lineups tab had
// nothing to print for the other nine and said the engine would name the XI at
// the toss - true, and useless to a reader looking at the side his club is
// playing. The watch page has named those elevens since it was built, off a
// pure function of the squad; the two rooms simply did not share it.
//
// The second fault was in the same panel and invisible in the source unless
// you know what an <em> is doing there: a ten-star rating is ten <em>s, and
// the rule written for the single <em>C</em> beside a captain's name sat three
// classes deep, so it outranked the strip's own colour and painted every
// UNEARNED star in the house terracotta. A four-star batsman read as four gold
// stars and six red ones.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const L = join(dirname(fileURLToPath(import.meta.url)), '..', 'engine', 'src', 'league');
const feed = readFileSync(join(L, '44-feed-match.js'), 'utf8');
const theatre = readFileSync(join(L, '38-world-theatre.js'), 'utf8');

test('the engine pick is one function, shared, not copied', () => {
  assert.match(theatre, /^\s*actualXI: actualXI,/m, 'the theatre should export its picker');
  assert.match(feed, /wt\.actualXI\(men, null\)/, 'the broadcast should ask for the same eleven');
  // a second implementation is how the two rooms start disagreeing
  assert.ok(!/function\s+fdActualXI|var kps\s*=\s*.*keeper/.test(feed),
    'the broadcast must not grow a picker of its own');
});

test('a side with no filed sheet still gets an eleven', () => {
  assert.match(feed, /function fdEngineXI\(slot, nat\)/, 'the panel needs a way to name the engine XI');
  assert.match(feed, /named \? null : fdEngineXI\(slot, nat \|\| rid\)/,
    'a filed sheet wins; the engine pick fills in behind it');
  assert.match(feed, /no sheet filed &middot; the engine&rsquo;s XI/,
    'the column should say where its eleven came from');
});

test('captain and gloves are taken the way the engine takes them', () => {
  const at = feed.indexOf('function fdEngineXI');
  const body = feed.slice(at, feed.indexOf('\n  }', at));
  assert.match(body, /p\.keeper && \(!kp \|\| \(p\.bat \|\| 0\) > \(kp\.bat \|\| 0\)\)/,
    'the gloves go to the best-batting keeper in the XI, as the engine picks him');
  assert.match(body, /var c = p\.capt \|\| 50; if \(c > cv\)/,
    'the armband goes to the coolest head in the XI');
});

test('the squad handed to the picker comes back in its own order', () => {
  // serverSquad hands out a CACHED array; a picker that sorted it in place
  // would quietly reorder every other room's squad
  const at = theatre.indexOf('function actualXI');
  const body = theatre.slice(at, theatre.indexOf('\n  }', at));
  assert.match(body, /var P2 = players\.slice\(\)/, 'the picker works on a copy');
  assert.ok(!/\bplayers\.sort\(/.test(body), 'and never sorts the array it was handed');
});

test('the captain mark stops at the captain', () => {
  assert.match(feed, /\.fo-fd \.fd-xic \.c span > em\{/,
    'the mark is a direct child of the row, and the stars are not');
  assert.ok(!/\.fo-fd \.fd-xic \.c span em\{/.test(feed),
    'the descendant form reaches into the star strip and repaints it');
});
