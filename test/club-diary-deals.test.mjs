// test/club-diary-deals.test.mjs — A DEAL NAMES BOTH ENDS OF ITSELF.
//
// Every club's diary carries the men it bought and sold. Three of the four
// kinds of deal have no club at the other end, and the transfer board keeps
// all three at slot -1: a free agent walks on from the open market, a man is
// released, a man is cashed in at the bank. The diary handed all three to the
// page as a club to be named and linked, so a reader of ANY club's diary saw
//
//     Bought Boris Zwart from a club for $1,120,000
//
// pointing at a club page that cannot exist. Five of Yorkshire's six diary
// lines read that way on the day this was written.
//
// The server stamps each deal with which kind it is (migration 079); these
// hold the page to saying so, and - the part that outlives the wording - to
// never minting a link to a club that is not there. A diary banked before 079
// carries no kind at all, so the fallback is checked too.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)),
  '..', 'engine', 'src', 'league', '40-club-page.js');
const src = readFileSync(SRC, 'utf8');

function lift() {
  const grab = name => {
    const at = src.indexOf('function ' + name + '(');
    if (at < 0) throw new Error('missing ' + name);
    let d = 0, q = null, esc = false;
    for (let j = src.indexOf('{', at); j < src.length; j++) {
      const c = src[j];
      if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
      if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(at, j + 1); }
    }
  };
  const whoAt = src.indexOf('var DEAL_WHO = {');
  const ctx = vm.createContext({ Math, String, encodeURIComponent });
  vm.runInContext('function E(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;");}', ctx);
  vm.runInContext(src.slice(whoAt, src.indexOf('};', whoAt) + 2), ctx);
  vm.runInContext(['evClub', 'evPlayer', 'evDealWho', 'evLine'].map(grab).join('\n'), ctx);
  return vm.runInContext('evLine', ctx);
}
const evLine = lift();
const say = e => evLine('eng', 1, e);

test('a signing off the open market is not a purchase from a club', () => {
  const line = say({ kind: 'buy', how: 'free', player: 'Boris Zwart', amount: 1120000 });
  assert.match(line, /Signed .*Boris Zwart.* from the open market for \$1,120,000/);
  assert.ok(!/from a club/.test(line), 'there was no club to buy him from');
});

test('a man let go is released, and a man cashed in is a quick sale', () => {
  assert.match(say({ kind: 'sell', how: 'released', player: 'Old Stager' }), /^Released Old Stager$/);
  const q = say({ kind: 'sell', how: 'bank', player: 'Spare Part', amount: 40000 });
  assert.match(q, /Sold Spare Part for \$40,000/);
  assert.match(q, /quick sale/);
  assert.ok(!/to a club/.test(q), 'the bank is not a club');
});

test('a real deal still names and links the club at the other end', () => {
  const bought = say({ kind: 'buy', how: 'club', player: 'Tom Mercer', amount: 450000,
    oppSlot: 4, oppCountry: 'eng', oppName: 'Kent' });
  assert.match(bought, /Bought .*Tom Mercer.* from <a href='#\/team\?c=eng&s=4'>Kent<\/a> for \$450,000/);
  const sold = say({ kind: 'sell', how: 'club', player: 'Sam Bickley', amount: 380000,
    oppSlot: 7, oppCountry: 'eng', oppName: 'Sussex' });
  assert.match(sold, /Sold Sam Bickley to <a href='#\/team\?c=eng&s=7'>Sussex<\/a> for \$380,000/);
});

test('no line ever links to a club that cannot exist', () => {
  // including the shapes a diary banked before 079 still serves
  const shapes = [
    { kind: 'buy', how: 'free', player: 'A', amount: 1 },
    { kind: 'sell', how: 'released', player: 'B' },
    { kind: 'sell', how: 'bank', player: 'C', amount: 1 },
    { kind: 'buy', player: 'D', amount: 1, oppSlot: -1, oppCountry: 'ned', oppName: null },
    { kind: 'sell', player: 'E', amount: 0, oppSlot: -1, oppCountry: 'released', oppName: null }
  ];
  shapes.forEach(e => {
    const line = say(e);
    assert.ok(!/s=-1/.test(line), 'a slot -1 club page cannot be walked to: ' + line);
  });
});

test('the register reads the deal the same way the diary does', () => {
  // both surfaces draw the counterparty through one helper, which is what
  // stopped them disagreeing about the same row
  assert.match(src, /function evDealWho\(cid, e\)/, 'one helper names the other end');
  assert.match(src, /"<td class='nm'>" \+ evDealWho\(cid, d\) \+ "<\/td>"/,
    'the register column goes through it');
  assert.ok(!/evClub\(cid, d\)/.test(src), 'and not around it');
});
