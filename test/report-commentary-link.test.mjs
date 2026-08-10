// test/report-commentary-link.test.mjs — THE COMMENTARY TOGGLE STAYS ON ITS
// OWN MATCH.
//
// The report is reachable by three different names, and only one of them is a
// position on this device:
//
//   solo play        #/report?i=<index into App.results>
//   a served match   #/report?n=<nation>&w=<world match id>
//   a friendly       #/report?fr=<friendly id>
//
// The Key moments / Every ball toggle used to build its own address in the
// FIRST form - "#/report?i=" + rec.ix - for all three. A served card carries
// ix:-1, so both links read "#/report?i=-1&t=comm", the router found no served
// name in that and fell through to the local branch, and a reader who tapped
// "Every ball" on his own match was shown a different match entirely. The same
// wrong one every time, from any starting point.
//
// The room may not invent its own address: it takes the one the tab bar is
// already using. This holds that, by running the shipped builder for all three
// namings.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const SRC = join(dirname(fileURLToPath(import.meta.url)),
  '..', 'engine', 'src', 'league', '14-match-report.js');
const src = readFileSync(SRC, 'utf8');

// lift a named function out of the module by walking its braces, skipping
// strings and line comments so a { inside either cannot end it early
function grab(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' should still exist in the report module');
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

// the handful of neighbours the builder calls, stubbed to their contracts
const STUBS = [
  'var FO_MR_MARK={"★":1,"⚑":1,"▶":1};',
  'function foMrNone(a,b){return "NONE:"+a}',
  'function E(s){return String(s==null?"":s)}',
  'function foMrMend(s){return String(s||"")}'
].join('\n');

const ctx = vm.createContext({ console });
vm.runInContext([STUBS, grab('foMrIsKey'), grab('foMrCommentary')].join('\n'), ctx);
const commentary = vm.runInContext('foMrCommentary', ctx);

const LOG = [{ out: '4' }, { out: '' }, { out: 'b' }];
const linksOf = html => [...html.matchAll(/href='([^']+)'/g)].map(m => m[1]);

test('a served match keeps its own address on both sides of the toggle', () => {
  // ix:-1 is exactly what foMrRecFromCard stamps on a served card
  const links = linksOf(commentary({ ix: -1, log: LOG }, {}, false,
    t => '#/report?n=eng&w=eng:s1:r4:m9&t=' + t));
  assert.deepEqual(links, [
    '#/report?n=eng&w=eng:s1:r4:m9&t=comm',
    '#/report?n=eng&w=eng:s1:r4:m9&t=comm&c=all'
  ]);
});

test('a friendly keeps its own address on both sides of the toggle', () => {
  const links = linksOf(commentary({ ix: -1, log: LOG }, {}, true,
    t => '#/report?fr=41&t=' + t));
  assert.deepEqual(links, ['#/report?fr=41&t=comm', '#/report?fr=41&t=comm&c=all']);
});

test('solo play still names a match by its position on this device', () => {
  const links = linksOf(commentary({ ix: 7, log: LOG }, {}, false, null));
  assert.deepEqual(links, ['#/report?i=7&t=comm', '#/report?i=7&t=comm&c=all']);
});

test('no served address ever carries a device index', () => {
  for (const [all, href] of [[false, t => '#/report?n=eng&w=x&t=' + t],
                             [true, t => '#/report?fr=9&t=' + t]]) {
    for (const link of linksOf(commentary({ ix: -1, log: LOG }, {}, all, href))) {
      assert.ok(!/[?&]i=/.test(link), 'a device index leaked into ' + link);
    }
  }
});
