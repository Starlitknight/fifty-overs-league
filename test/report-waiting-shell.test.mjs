// test/report-waiting-shell.test.mjs — THE WAITING ROOM WEARS THE SAME CLOTHES
// AS THE ROOM.
//
// A served match paints twice on every arrival: the scoreline goes up from the
// snapshot the instant the reader lands, and the finished report replaces it
// when the World Service answers. That is fine - what is not fine is the two
// paints being different DESIGNS. The first one used to be the Journal shell
// the report itself had retired (masthead, dressing-room painting, folio line,
// its own scoreline and footer), so every reload flashed a deleted design past
// the reader on the way to the live one.
//
// This holds two things:
//   1. nothing in the report module builds the retired shell any more - not
//      the markup, and not the CSS that dressed it;
//   2. the served waiting paint carries the finished page's own skeleton, so
//      the upgrade fills in the body and nothing above it moves.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)),
  '..', 'engine', 'src', 'league', '14-match-report.js');
const src = readFileSync(SRC, 'utf8');

// The retired Journal shell, by every name it went under. Note this is the
// SHELL, not the artwork: hgm-dressing-room is still the honest fallback for a
// ground the game has no painting of, and the finished report uses it.
const RETIRED = ['fo-mr-mast', 'fo-mr-plate', 'fo-mr-folio', 'fo-mr-hero'];

test('the retired Journal shell is gone from the report, markup and CSS alike', () => {
  for (const name of RETIRED) {
    assert.ok(!src.includes(name),
      name + ' is still in the report module; the waiting paint must not revive the old design');
  }
});

test('the served waiting paint carries the finished page skeleton', () => {
  // the block that paints the scoreline while the world is asked for the rest
  const at = src.indexOf('THE WAITING ROOM WEARS THE SAME CLOTHES');
  assert.ok(at > 0, 'the served waiting paint should still be here');
  const block = src.slice(at, at + 3000);
  for (const cls of ['fo-ms-crumb', 'fo-ms-hero', 'fo-ms-hg', 'fo-ms-side', 'fo-ms-mid', 'fo-mr-tabs']) {
    assert.ok(block.includes(cls), 'the waiting paint is missing ' + cls);
  }
});

test('the waiting paint offers the same five ways in as the finished page', () => {
  const at = src.indexOf('THE WAITING ROOM WEARS THE SAME CLOTHES');
  const block = src.slice(at, at + 3000);
  for (const tab of ['sum', 'card', 'comm', 'chart', 'fantasy']) {
    assert.ok(block.includes('"' + tab + '"'), 'the waiting tab bar is missing ' + tab);
  }
  // and it names the served match, never a position on this device
  assert.ok(block.includes('#/report?n='), 'the waiting tabs should use the served address');
  assert.ok(!/#\/report\?i=/.test(block), 'a device index leaked into the waiting tabs');
});

test('every quiet card in the report shares one builder', () => {
  assert.ok(src.includes('function foMrWaitCard('), 'the shared waiting card should still exist');
  // no stray hand-rolled card should reintroduce a second design
  const heads = src.match(/class='fo-mr-head'/g) || [];
  assert.equal(heads.length, 1,
    'only the "report unavailable" card may hand-roll a heading; the rest go through foMrWaitCard');
});
