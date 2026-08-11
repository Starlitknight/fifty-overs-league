// test/roster-of-nations.test.mjs — WHO IS IN THE WORLD, SAID ONCE.
//
// Wales, Kenya and Canada left the top table, and for a long time they left it
// by FILTER: the planet skipped three ids when it listed nations, and so did
// the server when it founded leagues. A filter in two places is a fact in
// neither. Every surface that read the region table straight - the rankings,
// the world map, the almanack, the league dropdowns, the cup - went on knowing
// them, and the baked history went on crowning them.
//
// They are struck from the table itself now. These hold that: one roster, no
// filters standing over it, and nothing anywhere in the shipped source or the
// baked world that still names the three.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { REGIONS } from '../engine/src/world/timeline.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// THE SERVER'S ROSTER IS READ, NOT IMPORTED. init-world.mjs reaches db.mjs,
// which reaches `pg` - a database driver the engine suite has no business
// needing and CI does not install, so importing it here turned a green build
// red on a machine that had never been near Postgres. The list is a literal;
// this is the literal.
const NAT_STR = (function () {
  const src = readFileSync(join(ROOT, 'server', 'init-world.mjs'), 'utf8');
  const at = src.indexOf('export const NAT_STR');
  const lit = src.slice(src.indexOf('[', at), src.indexOf(']', src.indexOf('[', at)) + 1);
  return Object.fromEntries([...lit.matchAll(/'(\w+)'/g)].map(m => [m[1], 1]));
})();
const GONE = ['wal', 'ken', 'can'];
const GONE_NAMES = ['Wales', 'Kenya', 'Canada'];

test('the world table names sixteen nations and not the three that left', () => {
  const cx = readFileSync(join(ROOT, 'engine', 'src', 'league', '12-scorecard-analysis.js'), 'utf8');
  const at = cx.indexOf('var FO_CX_REGIONS = [');
  const table = cx.slice(at, cx.indexOf('\n  ];', at));
  const ids = [...table.matchAll(/^\s{4}\{ id: "(\w+)"/gm)].map(m => m[1]);
  assert.equal(ids.length, 17, 'sixteen nations and the Final: ' + ids.join(','));
  GONE.forEach(g => assert.ok(!ids.includes(g), g + ' is off the table'));
});

test('nobody filters the roster any more, because there is nothing to filter', () => {
  const planet = readFileSync(join(ROOT, 'engine', 'src', 'league', '27-living-planet.js'), 'utf8');
  const host = readFileSync(join(ROOT, 'server', 'enginehost.mjs'), 'utf8');
  assert.ok(!/FO_CUT/.test(planet), 'the planet no longer keeps a cut list');
  assert.ok(!/var CUT = \{/.test(host), 'nor does the server');
});

test('the history and the server roster agree with it', () => {
  assert.equal(REGIONS.length, 16, 'the timeline plays sixteen leagues');
  GONE.forEach(g => assert.ok(!REGIONS.some(r => r.id === g), g + ' has no history'));
  assert.equal(Object.keys(NAT_STR).length, 16, 'the server rates sixteen nations');
  GONE.forEach(g => assert.ok(!(g in NAT_STR), g + ' has no rung'));
});

test('the baked world does not crown a nation that left', () => {
  const snap = readFileSync(join(ROOT, 'world-snapshot.json'), 'utf8');
  GONE.forEach(g => assert.ok(!new RegExp('"' + g + '"').test(snap), g + ' is out of the snapshot'));
  GONE_NAMES.forEach(n => assert.ok(snap.indexOf('"' + n + '"') < 0, n + ' is out of the snapshot'));
});

// The name->code maps are READERS, not producers: a cricketer already in the
// world may carry "Wales" as his nationality, and a map that has forgotten the
// word would leave him without a flag. They stay, deliberately, and this says
// so - so nobody deletes them in a later sweep thinking they were missed.
test('the nationality lookups keep the old names, on purpose', () => {
  const club = readFileSync(join(ROOT, 'engine', 'src', 'league', '40-club-page.js'), 'utf8');
  assert.match(club, /Wales: "wal"/, 'a man whose passport says Wales still resolves');
});

test('no per-nation table keeps a row for a nation that left', () => {
  // the pitch mixes, the archetypes, the doctrines, the boss characters, the
  // year each league was born, the club names the server founds with - every
  // one of them keyed by a region id
  const files = [
    ['engine', 'src', 'league', '27-living-planet.js'],
    ['engine', 'src', 'league', '25-league-table.js'],
    ['engine', 'src', 'league', '55-market.js'],
    ['engine', 'src', 'league', '46-nations.js'],
    ['engine', 'src', 'world', 'timeline.mjs'],
    ['server', 'init-world.mjs']
  ];
  for (const parts of files) {
    const src = readFileSync(join(ROOT, ...parts), 'utf8');
    for (const g of GONE) {
      const key = new RegExp('(^|[\\s{,])' + g + ':\\s', 'm');
      assert.ok(!key.test(src), parts.join('/') + ' still keeps a "' + g + ':" row');
    }
  }
});

test('nothing that FOUNDS a world still names the three', () => {
  // a reader may keep the words (see above); a producer may not, or the world
  // grows the league back
  for (const parts of [['engine', 'src', 'world', 'timeline.mjs'], ['server', 'init-world.mjs']]) {
    const src = readFileSync(join(ROOT, ...parts), 'utf8');
    for (const g of GONE) {
      assert.ok(!new RegExp("['\"]" + g + "['\"]").test(src),
        parts.join('/') + ' still names "' + g + '"');
    }
  }
});
