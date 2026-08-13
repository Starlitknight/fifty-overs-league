// test/win-odds.test.mjs — THE BAR SAYS THE SAME THING EVERY TIME, AND WHAT IT
// SAYS IS WHAT THE ENGINE DOES.
//
// The preview used to PLAY the fixture forty times and report the tally. For a
// lopsided match that was fine. For an even one it was a lottery: one real tour
// - South Africa against Bangladesh, four per cent apart on paper - came out
// anywhere between 32% and 65% across forty-playing samples, purely on which
// seeds it drew. The page printed the lottery as a verdict, and named the
// weaker side favourite.
//
// The odds are read off the two squads now. A win probability does not have to
// name the winner: 99-to-1 still loses one time in a hundred. It has to say who
// is stronger, by how much, and say it identically every time.
//
// The curve is NOT a guess. It is the engine's own behaviour, fitted: squads
// spanning 0.70x to 1.30x of a baked side, every pairing played both ways
// round, win rate against rating gap by maximum likelihood. This test replays
// a slice of that measurement and holds the curve to it.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const odds = (h, a, neutral) => eng.ctx.window.foPmOdds(h, a, neutral);
const strength = men => eng.ctx.window.foPmStrength(men);

test('the odds are a pure function of the two strengths', () => {
  const a = odds(50000, 48000), b = odds(50000, 48000);
  assert.deepEqual(a, b, 'the same fixture twice is the same answer twice');
  assert.ok(a.home > a.away, 'the stronger side is favoured');
  // and they are a probability
  assert.ok(Math.abs(a.home + a.away + a.tie - 1) < 1e-9, 'the three add to one');
  assert.ok(a.home > 0 && a.home < 1 && a.away > 0 && a.away < 1, 'nobody is ever certain');
});

test('equal sides are near even, with the ground the only thing between them', () => {
  const o = odds(48000, 48000);
  const pc = 100 * o.home / (o.home + o.away);
  // measured directly over 1,600 fixtures played both ways: 51.6% to the host
  assert.ok(pc > 50.5 && pc < 53,
    'the host is favoured, barely: ' + pc.toFixed(1) + '%');
  const n = odds(48000, 48000, true);
  assert.ok(Math.abs(n.home - n.away) < 1e-9, 'and on neutral ground they are dead level');
});

test('a bigger gap is a bigger favourite, always', () => {
  let last = 0;
  [0, 1000, 2000, 4000, 8000, 16000].forEach(d => {
    const p = odds(48000 + d, 48000).home;
    assert.ok(p > last, 'a gap of ' + d + ' is worth more than the one below it');
    last = p;
  });
  // and it never runs away to certainty inside the range the world spans.
  //
  // THE CEILING MOVED WITH THE ENGINE (v3). This read 0.93, which was true of
  // an engine that had no mismatch term: a sixteen-thousand-point gap really
  // did leave the weaker side a chance, because its tail survived the better
  // attack. It does not any more, and the bar must not pretend otherwise -
  // measured over 140 matches a pairing, the engine returns 94% to 100% at
  // gaps of nineteen to twenty-two thousand. So the contract kept here is the
  // one that was always meant: the bar never reaches certainty. What a huge
  // gap is actually worth is the fitted curve's business, and the test below
  // holds that curve to the engine's own answer.
  assert.ok(odds(48000 + 16000, 48000).home < 0.96, 'even a huge gap leaves a chance');
  assert.ok(odds(48000 + 60000, 48000).home < 1, 'and nothing is ever certain');
});

test('the curve reproduces what the engine actually does', () => {
  // scaled squads, the calibration harness's own trick, so the check spans the
  // whole strength band rather than only the middle
  const mk = (baseIx, f, nm) => {
    eng.ctx.__mkArgs = [baseIx, f, nm];
    return JSON.parse(vm.runInContext(`(function(){
      var a = __mkArgs, t = JSON.parse(JSON.stringify(GD.teams[a[0]]));
      t.name = a[2];
      t.players.forEach(function (p) {
        for (var k in p.skills) p.skills[k] = Math.max(1, Math.min(99, Math.round(p.skills[k] * a[1])));
        jsDerive(p);
      });
      return JSON.stringify(t);
    })()`, eng.ctx));
  };
  const sides = [[0, 0.75], [1, 0.90], [0, 1.05], [1, 1.28]].map(([b, f], i) => {
    const t = mk(b, f, 'S' + i);
    return { men: t.players, s: strength(t.players) };
  });
  const N = 110, rows = [];
  for (let i = 0; i < sides.length; i++) for (let j = 0; j < sides.length; j++) {
    if (i === j) continue;
    const H = sides[i], A = sides[j];
    let w = 0, n = 0;
    for (let q = 0; q < N; q++) {
      const r = eng.sim({ name: 'HOME', players: H.men }, { name: 'AWAY', players: A.men },
        'balanced', 'Sunny', (i * 31 + j * 7919 + q * 104729 + 5) >>> 0 || 1);
      if (!r || !r.result) continue;
      n++;
      if (r.result.winner === 'HOME') w++; else if (!r.result.winner) w += 0.5;
    }
    rows.push({ gap: Math.round(H.s - A.s), actual: 100 * w / n, fitted: 100 * odds(H.s, A.s).home });
  }

  // WHAT THIS MODEL IS AND IS NOT. Mean XI rating is one number standing in for
  // a whole side, and a side is more than one number - two squads the same
  // distance apart on rating can be four-fifths and one-half to win depending
  // on where the difference sits, because bowling is worth more than batting.
  // Fitted over 184 pairings the curve misses by about six points on average
  // and by as much as twenty-six on the worst pair; assuming every match even
  // misses by thirty. A win bar is a reading of relative strength, not an
  // oracle - 99-to-1 still loses one time in a hundred - so the contract held
  // here is the AVERAGE, plus never naming the wrong favourite by a distance.
  const mean = rows.reduce((s, r) => s + Math.abs(r.actual - r.fitted), 0) / rows.length;
  assert.ok(mean < 12, 'on average the curve tracks the engine: out by ' + mean.toFixed(1) + ' points');

  rows.forEach(r => {
    // and where the engine is genuinely one-sided the curve must agree which
    // side, however far off the exact figure is
    if (Math.abs(r.actual - 50) > 12) {
      assert.ok((r.actual - 50) * (r.fitted - 50) > 0,
        'gap ' + r.gap + ': engine ' + r.actual.toFixed(1) + '% but curve ' + r.fitted.toFixed(1) +
        '% - the two disagree about who is favoured');
    }
  });
  // it must also order them correctly: a bigger gap is a bigger favourite
  const sorted = rows.slice().sort((a, b) => a.gap - b.gap);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i].fitted >= sorted[i - 1].fitted,
      'the curve is monotonic in the gap');
  }
});

test('strength is the eleven that will take the field, not the whole list', () => {
  const squad = eng.genSquad(5150, 'England', 'balanced').players;
  assert.ok(squad.length > 11, 'a squad is bigger than an eleven');
  const s = strength(squad);
  const all = squad.reduce((t, p) => t + (+p.rating || 0), 0) / squad.length;
  assert.ok(s > all, 'the chosen eleven rate above the squad as a whole: ' +
    Math.round(s) + ' vs ' + Math.round(all));
  assert.equal(strength([]), null, 'and no men means no strength, not a nought');
});
