// test/club-roster-view.test.mjs — ONE PICTURE OF A CRICKETER.
//
// Your own squad is the Roster: the men grouped by what they are for, each
// with his face, his flag, his craft, his age and a strip of ten stars. A
// rival's squad was a table - rank, glyph, name, overall, form, hand, wage.
// The whole point of opening a rival's page is to size his players up against
// your own, and that cannot be done across two different pictures of a
// cricketer.
//
// So the club page draws the Roster, with the squad room's OWN skin. The
// league layer is not one scope - only what is put on window crosses - so the
// squad room lends what is needed over the wall rather than either side
// keeping a second copy of it.
//
// What a rival's roster does NOT have is the coaching book: the fifteen raw
// skills, the training plan, the expanding detail, the captaincy actions.
// Which is why the star composites are published as summaries (migration
// 082): a number that says how good he is and nothing about which skill got
// him there, so a rival's men wear the SAME stars their own manager sees
// instead of a guess at them.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CP = readFileSync(join(ROOT, 'engine', 'src', 'league', '40-club-page.js'), 'utf8');
const SQ = readFileSync(join(ROOT, 'engine', 'src', 'league', '09-squad-matchlab.js'), 'utf8');
const M82 = readFileSync(join(ROOT, 'server', 'migrations', '082-a-rival-wears-the-same-stars.sql'), 'utf8');
const code = CP.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

test('the squad room lends its roster rather than the club page copying it', () => {
  assert.match(SQ, /window\.__foRosterKit = \{ css: foS2Css, classOf: foSqClass, formGlyph: foSqFormGlyph,/,
    'the stylesheet and the readings a row prints, handed over once');
  assert.match(SQ, /trait: function \(p\) \{ return foS2Trait\(p, 1\); \}/,
    'and the SHORT talent word, because a chip that spells it out eats the name');
  assert.match(code, /var RK = window\.__foRosterKit \|\| \{\};/, 'the club page takes what is lent');
  assert.match(code, /if \(RK\.css\) RK\.css\(\)/, 'including the skin, so the two cannot drift apart');
  // every borrowed helper is guarded: a page that loaded without the squad
  // room must still draw a squad
  ['RK.classOf ?', 'RK.energyOf)', 'RK.formGlyph ?', 'RK.qCol ?'].forEach(function (g) {
    assert.ok(code.indexOf(g) > 0, 'the club page checks for ' + g.split(/[ ?)]/)[0]);
  });
});

test('a rival squad is grouped by what a man is for, not listed by rank', () => {
  assert.match(code, /\[\["bat", "Batters"\], \["ar", "All-rounders"\], \["bowl", "Bowlers"\], \["wk", "Wicketkeepers"\]\]/,
    'the squad room\'s own four sections, in its order');
  assert.match(code, /fo-s2-seck'><span>" \+ sec\[1\] \+ "<\/span><em>" \+\s*\n?\s*men\.length/,
    'each section says how many men are in it');
  // the table it replaced, and the picker that sorted it, are gone
  assert.ok(!/fo-cp-cols/.test(code), 'the old column head is gone');
  assert.ok(!/sortKey/.test(code), 'and the sort picker with it - the grouping IS the order now');
});

test('a row is a door, and it carries what a scout may read', () => {
  assert.match(code, /return "<a class='fo-s2-row' href='" \+ playerHref\(cid, slot, isMine, p\.name\)/,
    'every row opens the man\'s page');
  ['fo-s2-pic', 'fo-s2-flag', 'fo-s2-id', 'fo-s2-age', 'fo-s2-ovr'].forEach(function (c) {
    assert.ok(code.indexOf(c) > 0, 'the row wears ' + c);
  });
  assert.match(code, /RK\.trait \? RK\.trait\(p\) : talentWord\(tal\)/, 'and his talent, short');
});

test('the stars are the same stars, and a bowler is starred on his bowling', () => {
  assert.match(code, /var cb = p\.batComp, cw = p\.bowlType \? p\.bowlComp : null;/,
    'read off the published composites, not guessed from the aggregate');
  assert.match(code, /var useBowl = \(cls === "bowl" && cw != null\) \|\| \(cls === "ar" && cw != null && cw > cb\);/,
    'the same choice the squad room makes');
  assert.match(code, /sf\.html\(sf\.stars\(useBowl \? cw : cb\)\)/, 'drawn by the one star ladder');
  // a dossier served before the composites existed simply has no stars, and
  // the row still draws
  assert.match(code, /if \(cb == null && cw == null\) return "";/, 'and no stars is a row, not a crash');
});

test('the summary crosses the fence and the coaching book does not', () => {
  assert.match(M82, /'batComp', batComp, 'bowlComp', bowlComp/, 'the two composites are published');
  assert.match(M82, /'bowlType',r\.pl->>'bowlType'/, 'and his craft, so the roster knows which to star him on');
  // IT IS BUILT ON THE LAST VERSION OF THE CARD FUNCTION, NOT THE FIRST.
  // world_pk_num has been rewritten four times since 016 - the card stretch,
  // the all-rounder's line, the rounding parity, the inlining - and a draft of
  // this that started from 016 reverted all four while passing its own tests.
  assert.match(M82, /pow double precision; batScore double precision; ovr double precision;/,
    "062's declarations, so it is 062's body being added to");
  assert.match(M82, /ovr := 1\.32 \* ovr - 1;/, 'the card stretch (055) is still applied');
  assert.match(M82, /ovr := 1\.269 \* \(0\.60 \* greatest\(batScore/, "and the all-rounder's line (057)");
  assert.match(M82, /'ovr', greatest\(1, least\(99, floor\(ovr \+ 0\.5\)\)\)/,
    "and the rounding parity (061/062) - floor(x + 0.5), what Math.round does");
  // read the FUNCTION, not the view - the view has sorted and averaged in
  // numeric since 016 and that is nothing to do with the card's arithmetic
  const fn = M82.slice(M82.indexOf('CREATE OR REPLACE FUNCTION'), M82.indexOf('END $$;'));
  assert.ok(!/::numeric/.test(fn), 'nothing in the card function has slipped back to exact decimal');
  // the composites ride on the same aggregates, in the same arithmetic
  assert.match(M82, /batComp := 0\.6 \* bat/, 'the composite reuses the aggregate above it');
  assert.match(M82, /bowlComp := CASE WHEN hasBowl THEN\s*\n\s*0\.6 \* bowl/,
    'and a bowling composite exists only for a man who bowls');
  // and nothing the club page prints is a raw skill
  ['skills', 'vsPace', 'vsSpin', 'wicket', 'economy', 'discipline', 'moveTurn', 'variation',
   'stamina', 'temperament', 'rotation', 'catching', 'stumping'].forEach(function (secret) {
    assert.ok(code.indexOf('p.' + secret) < 0, 'the roster never reaches for p.' + secret);
  });
});
