// test/report-commentary-link.test.mjs — THE COMMENTARY FILTERS STAY ON THEIR
// OWN MATCH.
//
// The report is reachable by three different names, and only one of them is a
// position on this device:
//
//   solo play        #/report?i=<index into App.results>
//   a served match   #/report?n=<nation>&w=<world match id>
//   a friendly       #/report?fr=<friendly id>
//
// The filter row used to build its own address in the FIRST form for all
// three. A served card carries ix:-1, so every link read "#/report?i=-1", the
// router found no served name in that and fell through to the local branch,
// and a reader who tapped a filter on his own match was shown a different
// match entirely. The same wrong one every time, from any starting point.
//
// The room may not invent its own address: it takes the one the tab bar is
// already using. This holds that for every filter, in all three namings.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORT = readFileSync(join(HERE, '..', 'engine', 'src', 'league', '14-match-report.js'), 'utf8');
const CORE = readFileSync(join(HERE, '..', 'engine', 'src', '00-core.js'), 'utf8');

// lift a named function out of a module by walking its braces, skipping
// strings and line comments so a { inside either cannot end it early
function grab(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' should still exist');
  let depth = 0, quote = null, esc = false;
  for (let j = src.indexOf('{', at); j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return src.slice(at, j + 1); }
  }
  assert.fail(name + ' has no closing brace');
}

const tblAt = REPORT.indexOf('var FO_MR_FILTERS =');
assert.ok(tblAt > 0, 'the filter table should still exist');
const TABLE = REPORT.slice(tblAt, REPORT.indexOf('];', tblAt) + 2);

const STUBS = [
  'var FO_MR_MARK={"★":1,"⚑":1,"▶":1};',
  'function foMrNone(a,b){return "NONE:"+a}',
  'function E(s){return String(s==null?"":s)}',
  'function foMrMend(s){return String(s||"")}',
  'function isWkt(o){return /^w/.test(String(o||""))&&o!=="wide"}'
].join('\n');

const ctx = vm.createContext({ console });
vm.runInContext([STUBS, TABLE,
  grab(CORE, 'foIsTalentText'), grab(CORE, 'foCommPass'),
  grab(REPORT, 'foMrIsKey'), grab(REPORT, 'foMrCommentary')].join('\n'), ctx);
const commentary = vm.runInContext('foMrCommentary', ctx);
const MODES = vm.runInContext('FO_MR_FILTERS.map(function(f){return f[0]})', ctx);

const LOG = [
  { no: '2.4', out: '6', txt: 'Wright to Harding : Launched over long-on for SIX.' },
  { no: '2.1', out: 'wC', txt: 'Wright to Greaves : WICKET - taken at third man.' },
  { no: '1.3', out: '4', txt: 'Ogden to Harding : It races away for FOUR.' },
  { no: '1.1', out: '', txt: 'Ogden to Harding : Rocket Arm from the deep saves two.' }
];
const linksOf = html => [...html.matchAll(/href='([^']+)'/g)].map(m => m[1]);

test('a served match keeps its own address on every filter', () => {
  // ix:-1 is exactly what foMrRecFromCard stamps on a served card
  for (const mode of MODES) {
    const links = linksOf(commentary({ ix: -1, log: LOG }, {}, mode, t => '#/report?n=eng&w=eng:s1:r4:m9&t=' + t));
    assert.equal(links.length, MODES.length, mode + ': one link per filter');
    for (const link of links) {
      assert.ok(link.startsWith('#/report?n=eng&w=eng:s1:r4:m9&t=comm'), mode + ': stray address ' + link);
      assert.ok(!/[?&]i=/.test(link), mode + ': a device index leaked into ' + link);
    }
  }
});

test('a friendly keeps its own address on every filter', () => {
  for (const mode of MODES) {
    for (const link of linksOf(commentary({ ix: -1, log: LOG }, {}, mode, t => '#/report?fr=41&t=' + t))) {
      assert.ok(link.startsWith('#/report?fr=41&t=comm'), mode + ': stray address ' + link);
      assert.ok(!/[?&]i=/.test(link), mode + ': a device index leaked into ' + link);
    }
  }
});

test('solo play still names a match by its position on this device', () => {
  const links = linksOf(commentary({ ix: 7, log: LOG }, {}, 'key', null));
  for (const link of links) assert.ok(link.startsWith('#/report?i=7&t=comm'), 'stray address ' + link);
});

test('every filter is offered, and exactly one of them is lit', () => {
  for (const mode of MODES) {
    const html = commentary({ ix: -1, log: LOG }, {}, mode, t => '#/report?fr=9&t=' + t);
    const lit = (html.match(/<a class='on'/g) || []).length;
    assert.equal(lit, 1, mode + ': ' + lit + ' chips lit');
    // the chosen filter is the one whose address carries it (key is the bare address)
    const want = mode === 'key' ? "#/report?fr=9&t=comm'" : "&c=" + mode + "'";
    assert.ok(html.includes("<a class='on' href='" + (mode === 'key' ? '#/report?fr=9&t=comm' : '#/report?fr=9&t=comm&c=' + mode) + "'"),
      mode + ': the lit chip should be the one selected (' + want + ')');
  }
});

test('the five questions the live feed asks are all askable here', () => {
  for (const need of ['wickets', 'boundaries', 'talents', 'fielding', 'all']) {
    assert.ok(MODES.includes(need), 'the report should offer the ' + need + ' filter');
  }
});
