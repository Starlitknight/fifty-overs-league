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
// server/ratings.mjs now ports pickXI's deterministic branch. A port is only
// safe while something checks it, so this plays the engine's own picker
// against it on real generated squads from every corner of the world.
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

test('the port picks the same eleven the engine picks', () => {
  squads.forEach((sq, i) => {
    const mine = fieldableXI(sq).map(p => p.name).sort();
    // the engine's own picker, handed the squad under a name no orders map can
    // hold, so it falls through to the deterministic branch this ports
    const picked = eng.ctx.pickXI({ name: '\u0000xi', players: sq });
    assert.ok(picked && picked.length, 'the engine picks an eleven');
    const engine = picked.map(p => p.name).sort();
    assert.equal(mine.length, 11, 'squad ' + i + ' gives eleven men');
    assert.deepEqual(mine, engine, 'squad ' + i + ': the port and the engine disagree');
  });
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
  assert.ok(flattered > squads.length * 0.8,
    'the old figure really was an idealisation for nearly every club (' +
    flattered + ' of ' + squads.length + ')');
});

test('a squad of eleven or fewer is the eleven', () => {
  const small = squads[0].slice(0, 11);
  assert.deepEqual(fieldableXI(small).map(p => p.name), small.map(p => p.name));
  assert.equal(squadStrength([]), 0, 'and nobody is worth nothing');
});
