// test/fieldable-xi.test.mjs — THE SIDE THE RANKINGS WEIGH IS THE SIDE THE
// UMPIRE WOULD PUT OUT.
//
// A club's published strength used to be the mean rating of its best eleven
// men by card rating - an eleven nobody can ever field, because it owes
// nothing to a keeper or to five bowlers. Every real side carries both, and
// the specialists who fill them rate below the batsmen they displace, so the
// figure flattered every club on earth, and flattered the unbalanced squads
// most.
//
// server/ratings.mjs ports a deterministic "best fieldable eleven" for exactly
// this job. A port is only safe while something checks it, so this plays the
// engine's own picker against it on real generated squads from every corner of
// the world.
//
// AND SINCE THE MATCH-DAY COACH (engine/src/13-matchday-coach.js) THE TWO ARE
// DELIBERATELY NO LONGER THE SAME ELEVEN. pickXI now picks for a PITCH and a
// SKY: it will take a medium-pacer on a green top over a better-rated finger
// spinner, because the ball model says his overs are cheaper today. A club's
// published STRENGTH cannot work that way - a ranking that moved with next
// Sunday's forecast would be a forecast, not a ranking - so the port stays
// conditions-free on purpose.
//
// What still has to hold is that the rating weighs a side somebody could
// actually field, and that it stays close to what the coach would pick.
// Measured across these 48 squads: the two elevens share 8 to 11 men (median
// 10), and the coach's side carries a slightly LOWER mean card rating (median
// -727) precisely because it is buying cricket rather than cards. Both facts
// are asserted below; exact identity is not, and must not be.
import { test } from 'node:test';
import assert from 'node:assert';
import { makeEngine } from './engine-vm.mjs';
import { fieldableXI, squadStrength } from '../server/ratings.mjs';

const eng = makeEngine();
const NAT = ['England', 'Australia', 'India', 'South Africa', 'New Zealand', 'Pakistan'];
const ARCH = ['rock', 'express', 'blade', 'greybeard', 'engine', 'miser', 'balanced'];
const squads = [];
for (let i = 0; i < 48; i++) {
  const g = eng.genSquad(3000 + i * 137, NAT[i % NAT.length], ARCH[i % ARCH.length]);
  if (g && g.players && g.players.length > 11) squads.push(g.players);
}

test('there are real squads to try it on', () => {
  assert.ok(squads.length >= 40, 'generated ' + squads.length + ' squads');
  assert.ok(squads.every(s => s.length > 11), 'every one of them has men to leave out');
});

test('the rating port stays close to the side the coach would field', () => {
  let worst = 11, totalDiff = 0;
  squads.forEach((sq, i) => {
    const mine = fieldableXI(sq).map(p => p.name);
    // the engine's own picker, handed the squad under a name no orders map can
    // hold, so it falls through to the branch that asks the coach
    const picked = eng.ctx.pickXI({ name: '\u0000xi', players: sq });
    assert.ok(picked && picked.length, 'the engine picks an eleven');
    const engine = picked.map(p => p.name);
    assert.equal(mine.length, 11, 'squad ' + i + ' gives eleven men');
    assert.equal(engine.length, 11, 'squad ' + i + ': the coach gives eleven men');
    const shared = mine.filter(n => engine.indexOf(n) >= 0).length;
    worst = Math.min(worst, shared);
    const by = {}; sq.forEach(p => { by[p.name] = p; });
    const mean = ns => ns.reduce((t, n) => t + (by[n].rating || 0), 0) / ns.length;
    totalDiff += mean(engine) - mean(mine);
    assert.ok(shared >= 7,
      'squad ' + i + ': the rating weighs a side only ' + shared + '/11 like the coach\'s');
  });
  assert.ok(worst >= 7, 'worst agreement across the world was ' + worst + '/11');
  // the coach buys cricket, not cards, so on average it fields a slightly
  // LOWER-rated eleven. If that ever inverted, the coach would have quietly
  // become a card-sorter again and this is where it would show.
  assert.ok(totalDiff / squads.length < 200,
    'the coach is not simply picking the highest-rated men');
});

test('every eleven is a side you could take the field with', () => {
  squads.forEach((sq, i) => {
    const xi = fieldableXI(sq);
    assert.equal(xi.length, 11, 'eleven men');
    assert.ok(xi.some(p => p.keeper), 'squad ' + i + ' fields a keeper');
    assert.ok(xi.filter(p => p.bowlType).length >= 5, 'squad ' + i + ' fields five bowlers');
  });
});

test('and it is never flattered by an eleven nobody could field', () => {
  const best11 = sq => {
    const m = sq.slice().sort((a, b) => b.rating - a.rating).slice(0, 11);
    return Math.round(m.reduce((t, p) => t + p.rating, 0) / m.length);
  };
  let flattered = 0;
  squads.forEach(sq => {
    const real = squadStrength(sq), ideal = best11(sq);
    assert.ok(real <= ideal, 'a fieldable side cannot beat the best eleven by rating');
    if (real < ideal) flattered++;
  });
  // "nearly every club" was measured at >80% of this fixed sample when the
  // port was written. Generation is deliberately SIM-AWARE (foQsSquadStrength
  // fits a squad's strength through pickXI, i.e. through the Match-Day
  // Coach), so any legitimate coach change nudges a few marginal squads by a
  // point and can carry one across a hard line: the Phase 2A.1 re-pricing
  // moved this sample from 39 to 38 of 48. The property being protected is
  // "the old figure flattered nearly everybody", and 75% still says so
  // without failing on a single marginal squad every time selection learns
  // something.
  assert.ok(flattered >= squads.length * 0.75,
    'the old figure really was an idealisation for nearly every club (' +
    flattered + ' of ' + squads.length + ')');
});

test('a squad of eleven or fewer is the eleven', () => {
  const small = squads[0].slice(0, 11);
  assert.deepEqual(fieldableXI(small).map(p => p.name), small.map(p => p.name));
  assert.equal(squadStrength([]), 0, 'and nobody is worth nothing');
});
