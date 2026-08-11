// test/club-transfer-history.test.mjs — A ROOM WITH NO DOOR.
//
// The transfer register has been built, styled and served since 038: the
// summary band, the ledger of every deal with the club at the other end of
// it, the four kinds of deal resolved (079). Nothing led there. The club
// page's tab bar named four rooms and this was not one of them, no card
// linked to it, and the only way in was to type &t=transfers into the
// address bar. So the one page that answers "is this a buying club or a
// selling one" was, in effect, not shipped.
//
// It is a tab, and the overview carries a transfer desk that opens it - the
// same shape as the club diary card that opens the full diary.
//
// It also had a date problem it could not have known about. The club home
// walks EVERY table on the page that has a Date column and stamps the
// league's kick-off hour under each date - right for a fixture list, and
// nonsense against the day a cheque cleared. A blanket pass needs a way to
// be told no, so the register says so and is left alone.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CP = readFileSync(join(ROOT, 'engine', 'src', 'league', '40-club-page.js'), 'utf8');
const HOME = readFileSync(join(ROOT, 'engine', 'src', 'league', '01-club-home.js'), 'utf8');
const M80 = readFileSync(join(ROOT, 'server', 'migrations', '080-the-register-counts-in-real-seasons.sql'), 'utf8');

test('the register is a tab, so the page can be reached without typing its address', () => {
  const at = CP.indexOf('var TABS = [["overview"');
  assert.ok(at > 0, 'the club page still has a tab table');
  const tabs = CP.slice(at, CP.indexOf('];', at) + 2);
  assert.match(tabs, /\["transfers", "Transfers"\]/, 'Transfers is one of the rooms');
  // the tab bar builds every entry's address from the table, so naming it is
  // enough - but the branch that draws it must still exist
  assert.match(CP, /\} else if \(tab === "transfers"\) \{/, 'and the branch that draws it');
});

test('the overview carries a desk that opens the register', () => {
  assert.match(CP, /sh\("Transfer desk"\)/, 'a card of its own, named');
  assert.match(CP, /hrefT\("transfers"\) \+ "'>Full transfer history<\/a>/,
    'and a way through to the register');
  // the same four figures the register leads with, so the glance and the page
  // cannot tell different stories
  ['Paid out', 'Taken in', 'Net', 'Deals'].forEach(function (k) {
    assert.ok(CP.indexOf("<span>" + k + "</span>") > 0, 'the desk shows ' + k);
  });
  assert.match(CP, /trCard \+ tlCard \+ chHTML/, 'and it is laid into the overview');
});

test('the ledger keeps the columns a register is read for', () => {
  const head = /<thead><tr><th>Season<\/th><th>Date<\/th><th>Deal<\/th><th class='nm'>Player<\/th>/;
  assert.match(CP, head, 'season, date, which way the deal went, and who');
  assert.match(CP, /<th class='nm'>To \/ from<\/th><th>Age<\/th><th>Fee<\/th>/,
    'the club at the other end, his age on the day, and what it cost');
});

test('the blanket matchday stamp can be told no, and the register tells it no', () => {
  assert.match(HOME, /querySelectorAll\("#page table:not\(\.fo-nomtime\)"\)/,
    'the pass skips a table that opts out');
  assert.match(CP, /<table class='fo-cp-tr fo-nomtime'>/, 'and the register opts out');
  // it really is the same pass that was writing the hour - the opt-out would
  // be pointless against some other loop
  assert.ok(HOME.indexOf('s.className = "fo-mtime"; s.textContent = MATCH_TIME;') > 0,
    'the pass being opted out of is the one that writes the kick-off hour');
});

test('a season is read off the calendar, not divided out of the day', () => {
  assert.match(M80, /FROM seasons s\s*\n\s*WHERE s\.country_id = p_country AND s\.start_day <= l\.settled_day/,
    'the last season to have begun by the day it settled');
  // the migration NARRATES the arithmetic it is replacing, so read the SQL it
  // runs rather than the note explaining why
  const sql = M80.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/settled_day \/ 35/.test(sql), 'and the thirty-five-day year is gone from the body');
  // the migrations it supersedes are untouched - they are applied history
  const old = readFileSync(join(ROOT, 'server', 'migrations', '079-a-deal-names-both-ends.sql'), 'utf8');
  assert.match(old, /settled_day \/ 35/, '079 still says what it said when it ran');
});
