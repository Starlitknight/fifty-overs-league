// test/player-page-tabs.test.mjs — A RETIRED ROOM MAY NOT BE LEFT IN A GUARD.
//
// The player page's match log fills asynchronously: the room is drawn, the
// cards are fetched, and when they land a guard decides whether the reader is
// still looking at the room that wanted them. That guard names the room as a
// string. When the log moved from the Matches tab to the Overview, one of the
// two guards moved with it and the other did not - so the cards arrived, the
// guard said "this is not the Matches tab", and the page kept the engine's
// empty local panel reading "No recent matches yet" for a man who had played.
//
// Nothing here can tell whether a room LOOKS right. What it can do is hold
// every TAB comparison to the list of rooms that still exist.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)),
  '..', 'engine', 'src', 'league', '41-player-page.js');
const src = readFileSync(SRC, 'utf8');

// the rooms the page actually has, read off its own tab table
const tabsAt = src.indexOf('var TABS = [');
const TABS = [...src.slice(tabsAt, src.indexOf('];', tabsAt)).matchAll(/\["(\w+)",/g)].map(m => m[1]);

test('the page still declares its rooms', () => {
  assert.ok(TABS.length >= 3, 'the tab table should list the rooms');
  assert.ok(TABS.includes('overview'), 'overview is the first room');
});

test('every TAB comparison names a room that exists', () => {
  // the one sanctioned exception: the redirect that catches bookmarks pointing
  // at a retired room and sends them to the Overview
  const redirectLine = /if \(TAB === "career" \|\| TAB === "country" \|\| TAB === "matches"\) TAB = "overview";/;
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (redirectLine.test(lines[i])) continue;
    // CARD_TAB is a different control with its own rooms (the card shown for a
    // player at another club), so only the page's own TAB is in scope here
    for (const m of lines[i].matchAll(/(?<![A-Z_])TAB\s*[!=]==\s*"(\w+)"/g)) {
      assert.ok(TABS.includes(m[1]),
        'line ' + (i + 1) + ' guards on "' + m[1] + '", which is not a room any more: ' + lines[i].trim());
    }
  }
});

test('a bookmark to a retired room still opens the page', () => {
  for (const gone of ['career', 'country', 'matches']) {
    assert.ok(new RegExp('TAB === "' + gone + '"').test(src),
      gone + ' should still be caught by the redirect, so an old address lands somewhere');
  }
});
