// test/stats-by-division.test.mjs — TWO DIVISIONS ARE TWO COMPETITIONS.
//
// A nation runs two flights of eight. They play separate fixtures, for
// separate prizes, at a different standard - and every stats table in the game
// was pouring both into one list. So a Division Two batsman was ranked against
// men he will never bowl at, the leading run-scorer of a division nobody could
// see was nobody's leading run-scorer, and the "season so far" card on a
// Division Two manager's own league page named a Division One player who did
// not appear in the table underneath it.
//
// The league page already knew which flight it was on - the plate says so and
// the standings walk between them with ?d= - so the book reads that same call.
// The Stats Centre already had the filter; it now OPENS on the reader's own
// division rather than on the mixture, and its front wall is split too.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = f => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..',
  'engine', 'src', 'league', f), 'utf8');
const LG = src('25-league-table.js');
const ST = src('57-stats-centre.js');

// ---- the league page's Stats tab ------------------------------------------

test('the league book is filtered to the flight the page is on', () => {
  assert.match(LG, /var inDiv9 = function \(x\) \{ return !hasDivs \|\| \(x\.div \| 0 \|\| 1\) === plateDiv; \};/,
    'rows are kept by the page\'s own division');
  assert.match(LG, /var book9 = \(full \|\| \[\]\)\.filter\(inDiv9\);/,
    'and the book is that filtered set');
  assert.match(LG, /var rows9 = book9\.filter\(BK\.keep\)\.sort\(BK\.sort\);/,
    'the table is built from the filtered book, not the whole nation');
  assert.ok(!/var rows9 = full\.filter/.test(LG), 'the unfiltered read is gone');
});

test('a row banked before the world had two flights belongs to the first', () => {
  // `!hasDivs ||` short-circuits a one-division league, and `x.div | 0 || 1`
  // sends a missing division to One rather than dropping the man entirely
  assert.match(LG, /!hasDivs \|\|/, 'a league with one flight filters nothing');
  assert.match(LG, /\(x\.div \| 0 \|\| 1\)/, 'and a row with no division counts as Division One');
});

test('the season-so-far card is read off the same rows as the table', () => {
  assert.match(LG, /var topOf9 = function \(keep, cmp\) \{\s*\n\s*var l = book9\.filter\(keep\)\.sort\(cmp\);/,
    'the leaders come from the divisional book');
  ['bat0', 'bowl0', 'hs0', 'bb0'].forEach(k =>
    assert.match(LG, new RegExp('var ' + k + ' = topOf9\\('), k + ' is derived, not taken from the nation-wide snapshot'));
  assert.ok(!/var st = \(snap && snap\.stats\)/.test(LG),
    'the precomputed nation-wide leaders are no longer read here');
});

test('the leaders name the man, so the card can be checked against the table', () => {
  assert.match(LG, /Highest score<\/i><b>" \+ \(hs0 \? hs0\.hs \+ \(hs0\.hsNo \? "\*" : ""\) \+ " &middot; " \+ E\(say\(hs0\.name\)\)/,
    'the highest score says whose it was');
  assert.match(LG, /Best bowling<\/i><b>" \+ \(bb0 \? bb0\.bb\.w \+ "\/" \+ bb0\.bb\.r \+ " &middot; " \+ E\(say\(bb0\.name\)\)/,
    'and so do the best figures');
});

test('every door out of the book keeps the flight it was opened in', () => {
  assert.match(LG, /"t=stats&k=" \+ k \+ \(hasDivs \? "&d=" \+ \(d \| 0\) : ""\)/,
    'the book tabs carry the division');
  assert.match(LG, /class='fo-lgx-cross' href='" \+ statHref9\(bookKey, otherDiv9\)/,
    'and there is a signpost across to the other flight, in the same book');
  assert.match(LG, /"t=" \+ t\[0\] \+\s*\n?\s*\(hasDivs \? "&d=" \+ \(plateDiv \| 0\) : ""\)/,
    'and the page\'s own tab bar no longer drops it on the way to Fixtures');
});

test('the page says which division its book is, in the heading and the rail', () => {
  assert.match(LG, /hasDivs \? divNm9\(plateDiv\) \+ " &middot; the book" : "The stats centre"/,
    'the panel is headed with the division');
  assert.match(LG, /The season so far" \+\s*\n?\s*\(hasDivs \? "<span>" \+ divNm9\(plateDiv\) \+ "<\/span>" : ""\)/,
    'and so is the card beside it');
  assert.match(LG, /Nobody in " \+ \(hasDivs \? divNm9\(plateDiv\) : "this league"\) \+ " has "/,
    'and an empty book names the division it is empty for');
});

// ---- the Stats Centre ------------------------------------------------------

test('the Stats Centre opens on the reader\'s own division', () => {
  assert.match(ST, /function myDivOf\(natId\) \{/, 'it can ask which flight he is in');
  assert.match(ST, /sv\.nation\(\) === natId && sv\.myDiv/,
    'and only answers for the nation he actually holds a seat in');
  assert.match(ST, /var divPick = dRaw === "0" \? "" : \(dRaw === "1" \|\| dRaw === "2"\) \? dRaw : myDivOf\(natId\);/,
    'an address naming no division opens on his own');
});

test('"Both divisions" is an address, or choosing it would not stick', () => {
  // the old href dropped the parameter for Both, which under the new default
  // meant one tap on "Both divisions" and the next paint sent you straight
  // back to your own flight
  assert.match(ST, /\(sc === "club" \? "" : "&d=" \+ \(d \|\| "0"\)\)/,
    'the division is always written into the address');
  assert.match(ST, /\[\["1", "Division One"\], \["2", "Division Two"\], \["", "Both divisions"\]\]/,
    'and the flights lead the control, with Both last');
  assert.ok(!/d && sc !== "club" \? "&d=" \+ d : ""/.test(ST), 'the dropping form is gone');
});

test('the club scope carries no division, because it means nothing there', () => {
  assert.match(ST, /sc === "club" \? "" :/, 'a club is in one flight by definition');
  assert.match(ST, /scope === "club" \? "" : seg\(/, 'so the control is not offered');
});

test('the Data Wall is one division\'s wall', () => {
  assert.match(ST, /function indexBody\(natId, mine, divPick\)/, 'the wall is told which flight');
  assert.match(ST, /var rowsD9 = divPick \? g\.rows\.filter\(function \(x\) \{ return divOf9\(x\) === divPick; \}\) : g\.rows;/,
    'and filters to it');
  ['bats = rowsD9', 'topWkts = rowsD9', 'byBb = rowsD9'].forEach(s =>
    assert.ok(ST.indexOf(s) >= 0, s + ' reads the filtered rows'));
  assert.match(ST, /class='fo-stw-divs'/, 'the wall carries its own flight control');
  assert.match(ST, /var bookDoor9 = function \(k\) \{ return href\(k, "league", false, divPick \|\| "0"\); \};/,
    'and every door off it keeps the flight');
});

test('the wall only offers the choice where there are two flights to choose', () => {
  assert.match(ST, /var hasD2_9 = g\.rows\.some\(function \(x\) \{ return divOf9\(x\) === "2"; \}\);/,
    'it checks the book for a second division');
  assert.match(ST, /var divSeg9 = hasD2_9/, 'and shows the control only then');
});

test('an empty flight in a league that has played says so honestly', () => {
  assert.match(ST, /\} else if \(g\.rows\.length\) \{/,
    'the nation having cricket is a different case from the nation having none');
  assert.match(ST, /No cricket in " \+ divLbl9\.toLowerCase\(\) \+\s*\n?\s*" has been banked yet this season/,
    'and it names the flight rather than claiming the season has not started');
});
