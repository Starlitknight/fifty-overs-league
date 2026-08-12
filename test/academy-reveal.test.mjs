// test/academy-reveal.test.mjs — THE SIGNATURE IS THE REVEAL.
//
// The scout hands over a REPORT, not a file: ranges where the skills should
// be, an estimate instead of a rating, one sentence of opinion. The whole
// point of that fog is the moment it lifts - and the moment it lifted, the
// manager was put on the squad page with twenty-one names on it and left to
// find his own signing among them. The reveal happened to nobody.
//
// It happens on the page he took the decision from now: the man's own card,
// and beside it what the scout guessed against what he actually is, skill by
// skill, on the very rails the report was drawn on.
import { test } from 'node:test';
import assert from 'node:assert';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const squad = eng.genSquad(6120, 'England', 'balanced').players;
const man = squad.slice().sort((a, b) => b.rating - a.rating)[2];
const ovr = eng.ctx.foPkOvr(man);
const bandsAround = w => {
  const b = {};
  Object.keys(man.skills).forEach(k => {
    b[k] = { lo: Math.max(0, man.skills[k] - w), hi: Math.min(100, man.skills[k] + w) };
  });
  return b;
};
const REP = { name: man.name, age: man.age, scouted: true, skillBands: bandsAround(8),
              ratingBand: { lo: ovr - 6, hi: ovr - 1 } };
const html = eng.ctx.foAcademyRevealHTML(man, REP, 'Mashed Potatoes');

test('the card is the man, and the man is on it', () => {
  assert.ok(html, 'the reveal renders');
  assert.match(html, /Signed &middot; the file is open/, 'it says what just happened');
  assert.ok(html.indexOf(man.name) >= 0, 'he is named');
  assert.match(html, /class='phc'/, 'his card is dealt');
  assert.ok(html.indexOf('>' + ovr + '<') >= 0, 'with the rating the rest of the game gives him');
});

test('every skill is shown as a number, not a range', () => {
  const rows = html.split("class='fo-ac-sk rv'").slice(1);
  assert.ok(rows.length >= 14, 'a row per skill: ' + rows.length);
  Object.keys(man.skills).forEach(k => {
    const v = Math.max(0, Math.min(100, Math.round(man.skills[k])));
    const hit = rows.some(r => new RegExp("class='rng num'>" + v + "<").test(r.split('</div>')[0]));
    assert.ok(hit, k + ' is printed as ' + v);
  });
});

test("and the scout's guess stays under it, so the reader can mark his own homework", () => {
  const row = html.split("class='fo-ac-sk rv'")[1].split('</div>')[0];
  assert.match(row, /u class='bnd' style='left:[\d.]+%;width:[\d.]+%'/, 'the band he was given');
  assert.match(row, /em class='tru' style='left:\d+%'/, 'and the truth landing on it');
});

test('the verdict is measured against the estimate he was sold', () => {
  assert.match(html, new RegExp('The report said <b>' + Math.round(ovr - 6) + '&ndash;' +
    Math.round(ovr - 1) + '</b>\\. He is a <b>' + ovr + '</b>'), 'both figures, side by side');
  assert.match(html, /better than the scout dared put on paper/, 'and he beat it');

  const inside = eng.ctx.foAcademyRevealHTML(man, Object.assign({}, REP,
    { ratingBand: { lo: ovr - 3, hi: ovr + 3 } }), 'X');
  assert.match(inside, /exactly the man the scout described/);
  const under = eng.ctx.foAcademyRevealHTML(man, Object.assign({}, REP,
    { ratingBand: { lo: ovr + 4, hi: ovr + 9 } }), 'X');
  assert.match(under, /short of what the scout hoped/);
  // a report with no estimate at all still says what he is
  const bare = eng.ctx.foAcademyRevealHTML(man, { skillBands: {} }, 'X');
  assert.match(bare, new RegExp('He is a <b>' + ovr + '</b>\\.'), 'no guess to measure, so none is quoted');
});

test('his talents are named, and the two doors are there', () => {
  (man.talents || []).forEach(t => {
    const nm = (eng.ctx.TALN && eng.ctx.TALN[t]) || t;
    assert.ok(html.indexOf(nm) >= 0, 'the reveal names ' + nm);
  });
  if (!(man.talents || []).length) assert.match(html, /No talent has shown itself yet/);
  assert.match(html, /href='#\/player\?n=/, 'a door to his page');
  assert.match(html, /data-fo-rvback/, 'and one back to the academy');
});
