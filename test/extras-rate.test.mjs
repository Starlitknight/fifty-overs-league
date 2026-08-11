// test/extras-rate.test.mjs — THE WORLD GIVES RUNS AWAY LIKE A CRICKET WORLD.
//
// Nobody was watching this number, so it was wrong for the life of the game.
// Measured over 496 banked innings and 120 run fresh through the shipped
// build, Fifty Overs conceded 3.1 extras an innings - 1.3% of its runs, a
// median of three, and a maximum of eleven across the entire world. Men's
// one-day cricket concedes something like twenty, seven or eight per cent of
// the total, and a scorecard without a dozen wides on it does not look like a
// scorecard. Leg byes were the worst of it, at roughly a twelfth of the real
// rate: the engine treated a ball off the pad as RARER than a bye through the
// keeper, which is backwards.
//
// Four log-odds in the ball distribution set the rate - wide, noball, bye, and
// the leg-bye offset written against bye - and they were each an order of
// magnitude too mean. They are calibrated now, and this is the guard, because
// the reason they went unnoticed for so long is that no test ever asked.
//
// The bands are deliberately wide. This is not pinning a number, it is holding
// a shape: wides the largest kind by some way, leg byes second, no-balls rare,
// and the whole lot somewhere near a real card. A change that drifts outside
// these has changed what the game's cricket looks like, and should have to say
// so here.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const A = { name: 'A', players: eng.genSquad(9001, 'England', 'balanced').players };
const B = { name: 'B', players: eng.genSquad(9002, 'England', 'express').players };
// a spread of surfaces, because the pitch moves the swing and grip terms the
// wides and no-balls ride on - a rate true only on a flat deck is not a rate
const CELLS = [['balanced', 'Sunny'], ['green', 'Overcast'], ['dry', 'Sunny'],
               ['slow', 'Sunny'], ['cracked', 'Sunny'], ['twoPaced', 'Overcast']];
const acc = { wd: 0, nb: 0, b: 0, lb: 0, runs: 0, inns: 0 };
for (const [pitch, wx] of CELLS) {
  for (const seed of [8801, 8802]) {
    const r = eng.sim(A, B, pitch, wx, seed);
    for (const inn of (r && r.innings) || []) {
      if (!inn || !inn.extras) continue;
      acc.inns++; acc.runs += inn.runs;
      acc.wd += inn.extras.wd; acc.nb += inn.extras.nb;
      acc.b += inn.extras.b; acc.lb += inn.extras.lb;
    }
  }
}
const per = k => acc[k] / acc.inns;
const total = per('wd') + per('nb') + per('b') + per('lb');
const say = () => 'wd ' + per('wd').toFixed(2) + ' nb ' + per('nb').toFixed(2) +
  ' b ' + per('b').toFixed(2) + ' lb ' + per('lb').toFixed(2) + ' = ' + total.toFixed(2);

test('a sample of real innings was actually played', () => {
  assert.ok(acc.inns >= 20, 'twenty innings or more to average over (' + acc.inns + ')');
  assert.ok(acc.runs / acc.inns > 150, 'and they are full innings, not a broken engine');
});

test('the world concedes extras at something like a cricket rate', () => {
  assert.ok(total >= 13 && total <= 30, 'an innings gives away 13-30 extras: ' + say());
  const share = 100 * (total * acc.inns) / acc.runs;
  assert.ok(share >= 4.5 && share <= 11,
    'which is 4.5-11% of the runs, as it is in the real game: ' + share.toFixed(2) + '%');
});

test('and in something like a cricket shape', () => {
  assert.ok(per('wd') >= 6, 'wides are the bulk of it: ' + say());
  assert.ok(per('wd') > per('lb'), 'more wides than leg byes');
  assert.ok(per('lb') >= 3, 'and leg byes are the second kind, not a rounding error');
  assert.ok(per('lb') > per('b'), 'a ball off the pad beats one through the keeper');
  assert.ok(per('nb') <= 4, 'no-balls stay rare: ' + say());
});

test('the calibration itself is written down where it is set', () => {
  // a bare number in a data blob is how this went wrong for so long
  const core = readCore();
  assert.match(core, /EXTRAS, AT THE RATE THE REAL GAME CONCEDES THEM/,
    'the four log-odds say what they are calibrated to and how it was measured');
  assert.match(core, /lo\.legbye=CAL\.bye\+1\.16;/,
    'and the leg-bye offset is positive - a ball off the pad is the commoner way to give a run away');
});
function readCore() {
  return readFileSync(new URL('../engine/src/00-core.js', import.meta.url), 'utf8');
}
